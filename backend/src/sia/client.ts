/**
 * Sia SDK singleton.
 *
 * Mirrors the pattern used in SiaFoundation/sia-storage-app:
 *   packages/node-adapters/src/auth.ts
 *
 * Key details sourced directly from their implementation:
 *  - initSia() is called (and guarded) before any Builder/AppKey usage
 *  - AppMetadata.id is Buffer.from(hexString, 'hex') — NOT a raw hex string
 *  - Stored key is loaded via new AppKey(Buffer.from(hexToUint8(keyHex)))
 *  - setLogger() is wired up after initSia() for SDK-level debug output
 */

import path from 'path'
import fs from 'fs'
import {
  initSia,
  setLogger,
  AppKey,
  Builder,
  generateRecoveryPhrase,
  validateRecoveryPhrase,
  type Sdk,
} from '@siafoundation/sia-storage'
import { KEY_PATH, PHRASE_PATH } from '../lib/config.js'

// ── Env ────────────────────────────────────────────────────────────────────────

const INDEXER_URL = process.env.SIA_INDEXER_URL  ?? 'https://sia.storage'
const APP_ID_HEX  = process.env.SIA_APP_ID        ?? '6f70656e6275636b657400000000000000000000000000000000000000000000'
const APP_NAME    = process.env.SIA_APP_NAME      ?? 'OpenBucket'
const APP_DESC    = process.env.SIA_APP_DESCRIPTION ?? 'Decentralized file pinning demo'
const APP_SVC_URL = process.env.SIA_APP_SERVICE_URL ?? 'http://localhost:3000'
const SIA_MODE    = (process.env.SIA_MODE ?? 'auto').toLowerCase()

// ── Module state ───────────────────────────────────────────────────────────────

let _sdk: Sdk | null = null
let _demoMode = false
let _reason = ''
let _initPromise: Promise<Sdk | null> | null = null
let _sdkInitialized = false

// ── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Load the native addon and set up the SDK logger.
 * Guarded by a flag — safe to call multiple times, only runs once.
 * Mirrors auth.ts ensureInit() in sia-storage-app.
 */
async function ensureInit(): Promise<void> {
  if (_sdkInitialized) return
  await initSia()
  setLogger((message) => console.debug('[Sia SDK]', message), 'warn')
  _sdkInitialized = true
}

/**
 * Parse SIA_APP_ID env var into the 32-byte Buffer the Node native SDK requires.
 * The WASM build takes a string; the Node native build takes Buffer.
 * Sourced from auth.ts parseAppMeta():  id: Buffer.from(parsed.appID, 'hex')
 */
function parseAppIdBuffer(): Buffer {
  if (!APP_ID_HEX || APP_ID_HEX.length !== 64) {
    throw new Error(
      `SIA_APP_ID must be a 64-character hex string (32 bytes). Got: "${APP_ID_HEX}"`
    )
  }
  return Buffer.from(APP_ID_HEX, 'hex')
}

/**
 * Load a stored app key from disk.
 * Mirrors auth.ts connectWithKey():
 *   new AppKey(Buffer.from(hexToUint8(keyHex)))
 * hexToUint8 just does Buffer.from(hex, 'hex') under the hood.
 */
function loadStoredAppKey(): AppKey | null {
  try {
    if (!fs.existsSync(KEY_PATH)) return null
    const hex = fs.readFileSync(KEY_PATH, 'utf8').trim()
    console.log('[Sia] Loading stored app key from', KEY_PATH)
    // Buffer.from(hex, 'hex') is what hexToUint8() does in their codebase
    return new AppKey(Buffer.from(hex, 'hex'))
  } catch (err) {
    console.warn('[Sia] Could not load stored app key:', (err as Error).message)
    return null
  }
}

/**
 * Persist the app key returned from builder.register() or sdk.appKey().
 * Mirrors auth.ts register():
 *   return uint8ToHex(new Uint8Array(sdk.appKey().export()))
 * uint8ToHex is Buffer.from(bytes).toString('hex').
 */
function saveAppKey(key: AppKey): void {
  const exported = key.export() // returns Buffer in the Node native build
  fs.mkdirSync(path.dirname(KEY_PATH), { recursive: true })
  // uint8ToHex equivalent: Buffer → hex string
  fs.writeFileSync(KEY_PATH, Buffer.from(exported).toString('hex'), 'utf8')
  console.log('[Sia] App key saved to', KEY_PATH)
}

function loadOrGeneratePhrase(): string {
  if (fs.existsSync(PHRASE_PATH)) {
    const phrase = fs.readFileSync(PHRASE_PATH, 'utf8').trim()
    console.log('[Sia] Loaded recovery phrase from', PHRASE_PATH)
    return phrase
  }
  const phrase = generateRecoveryPhrase()
  validateRecoveryPhrase(phrase) // sanity check
  fs.mkdirSync(path.dirname(PHRASE_PATH), { recursive: true })
  fs.writeFileSync(PHRASE_PATH, phrase, 'utf8')
  console.log('[Sia] Generated and saved new recovery phrase to', PHRASE_PATH)
  return phrase
}

// ── Core init ──────────────────────────────────────────────────────────────────

async function initSiaClient(): Promise<Sdk | null> {
  if (SIA_MODE === 'demo') {
    _demoMode = true
    _reason = 'SIA_MODE=demo'
    return null
  }

  // Must run before new Builder() or new AppKey() — loads the native addon
  await ensureInit()

  const appMeta = {
    id: parseAppIdBuffer(), // Buffer, not hex string — this is the critical fix
    name: APP_NAME,
    description: APP_DESC,
    serviceUrl: APP_SVC_URL,
    // Add missing properties to satisfy AppMetadata type
    appId: APP_ID_HEX,
    logoUrl: '',
    callbackUrl: APP_SVC_URL,
  }

  const builder = new Builder(INDEXER_URL, appMeta)

  // 1. Try stored key first (mirrors auth.ts connectWithKey)
  const storedKey = loadStoredAppKey()
  if (storedKey) {
    console.log('[Sia] Attempting connection with stored app key…')
    const sdk = await builder.connected(storedKey)
    if (sdk) {
      console.log('[Sia] Connected with stored app key')
      return sdk
    }
    console.warn('[Sia] Stored key rejected by indexer — re-registering…')
  }

  // 2. Registration flow (mirrors auth.ts requestConnection + waitForApproval + register)
  console.log('[Sia] Starting registration flow…')
  const phrase = loadOrGeneratePhrase()

  try {
    await builder.requestConnection()
    const approvalUrl = builder.responseUrl()
    console.log('')
    console.log('╔══════════════════════════════════════════════════════════════╗')
    console.log('║               [Sia] ACTION REQUIRED                          ║')
    console.log('║  Open this URL to approve the app:                           ║')
    console.log(`║  ${approvalUrl.padEnd(60)}║`)
    console.log('╚══════════════════════════════════════════════════════════════╝')
    console.log('')
    console.log('[Sia] Waiting for approval…')
    await builder.waitForApproval()
    console.log('[Sia] Approval received.')
  } catch (err) {
    // Already approved on a previous boot — register() will succeed anyway
    console.warn(
      '[Sia] requestConnection/waitForApproval skipped (likely already approved):',
      (err as Error).message
    )
  }

  const sdk = await builder.register(phrase)

  // Persist the derived key so we skip this flow on the next boot
  saveAppKey(sdk.appKey())
  console.log('[Sia] Registration complete — app key stored.')
  return sdk
}

// ── Public API ─────────────────────────────────────────────────────────────────

export function resolveMode(): string {
  return SIA_MODE
}

export function isDemoMode(): boolean {
  return _demoMode
}

export function getSiaReason(): string {
  return _reason
}

/**
 * Returns the live Sdk instance, or null in demo mode.
 * Safe to call multiple times — init only runs once.
 */
export async function getSiaClient(): Promise<Sdk | null> {
  if (_sdk) return _sdk
  if (_demoMode) return null

  if (!_initPromise) {
    _initPromise = initSiaClient()
      .then((sdk) => {
        _sdk = sdk
        if (!sdk) {
          _demoMode = true
          if (!_reason) _reason = 'Sia connection unavailable'
        }
        return sdk
      })
      .catch((err) => {
        console.error('[Sia] Init failed:', (err as Error).message)
        _demoMode = true
        _reason = (err as Error).message
        return null
      })
  }

  return _initPromise
}