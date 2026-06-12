/**
 * Sia SDK singleton.
 *
 * Exposes three new functions used by the setup flow:
 *   getApprovalUrl()    – returns the URL the user must open to approve the app
 *   isApprovalPending() – true while we're waiting for the user to approve
 *   retryConnection()   – called after the user says they've approved; attempts
 *                         to complete registration and update the singleton state
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
let _builder: Builder | null = null
let _demoMode = false
let _reason = ''
let _initPromise: Promise<Sdk | null> | null = null
let _sdkInitialized = false

// Approval flow state
let _approvalPending = false
let _approvalUrl = ''

// ── Helpers ────────────────────────────────────────────────────────────────────

async function ensureInit(): Promise<void> {
  if (_sdkInitialized) return
  await initSia()
  setLogger((message) => console.debug('[Sia SDK]', message), 'warn')
  _sdkInitialized = true
}

function parseAppIdBuffer(): Buffer {
  if (!APP_ID_HEX || APP_ID_HEX.length !== 64) {
    throw new Error(
      `SIA_APP_ID must be a 64-character hex string (32 bytes). Got: "${APP_ID_HEX}"`
    )
  }
  return Buffer.from(APP_ID_HEX, 'hex')
}

function loadStoredAppKey(): AppKey | null {
  try {
    if (!fs.existsSync(KEY_PATH)) return null
    const hex = fs.readFileSync(KEY_PATH, 'utf8').trim()
    console.log('[Sia] Loading stored app key from', KEY_PATH)
    return new AppKey(Buffer.from(hex, 'hex'))
  } catch (err) {
    console.warn('[Sia] Could not load stored app key:', (err as Error).message)
    return null
  }
}

function saveAppKey(key: AppKey): void {
  const exported = key.export()
  fs.mkdirSync(path.dirname(KEY_PATH), { recursive: true })
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
  validateRecoveryPhrase(phrase)
  fs.mkdirSync(path.dirname(PHRASE_PATH), { recursive: true })
  fs.writeFileSync(PHRASE_PATH, phrase, 'utf8')
  console.log('[Sia] Generated and saved new recovery phrase to', PHRASE_PATH)
  return phrase
}

function makeBuilder(): Builder {
  const appMeta = {
    id: parseAppIdBuffer(),
    name: APP_NAME,
    description: APP_DESC,
    serviceUrl: APP_SVC_URL,
    appId: APP_ID_HEX,
    logoUrl: '',
    callbackUrl: APP_SVC_URL,
  }
  return new Builder(INDEXER_URL, appMeta)
}

// ── Core init ──────────────────────────────────────────────────────────────────

async function initSiaClient(): Promise<Sdk | null> {
  if (SIA_MODE === 'demo') {
    _demoMode = true
    _reason = 'SIA_MODE=demo'
    return null
  }

  await ensureInit()

  _builder = makeBuilder()

  // 1. Try stored key first
  const storedKey = loadStoredAppKey()
  if (storedKey) {
    console.log('[Sia] Attempting connection with stored app key…')
    const sdk = await _builder.connected(storedKey)
    if (sdk) {
      console.log('[Sia] Connected with stored app key')
      _approvalPending = false
      _approvalUrl = ''
      return sdk
    }
    console.warn('[Sia] Stored key rejected — starting fresh registration…')
  }

  // 2. Start registration flow — request the connection URL
  console.log('[Sia] Starting registration flow…')
  const phrase = loadOrGeneratePhrase()

  try {
    await _builder.requestConnection()
    const url = _builder.responseUrl()

    _approvalUrl = url
    _approvalPending = true

    console.log('')
    console.log('╔══════════════════════════════════════════════════════════════╗')
    console.log('║               [Sia] ACTION REQUIRED                          ║')
    console.log('║  Open this URL to approve the app:                           ║')
    console.log(`║  ${url.padEnd(60)}║`)
    console.log('╚══════════════════════════════════════════════════════════════╝')
    console.log('')
    console.log('[Sia] Waiting for user approval via UI…')

    // Do NOT block here — the frontend will poll /api/sia/poll-connection
    // which calls retryConnection() once the user has approved.
    return null
  } catch (err) {
    console.warn(
      '[Sia] requestConnection failed — may already be approved:',
      (err as Error).message
    )
  }

  // 3. If requestConnection threw, try registering immediately (already approved)
  try {
    const sdk = await _builder.register(phrase)
    saveAppKey(sdk.appKey())
    _approvalPending = false
    _approvalUrl = ''
    console.log('[Sia] Registration complete — app key stored.')
    return sdk
  } catch (err) {
    console.error('[Sia] register() failed:', (err as Error).message)
    _demoMode = true
    _reason = (err as Error).message
    return null
  }
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

export function isApprovalPending(): boolean {
  return _approvalPending
}

export function getApprovalUrl(): string {
  return _approvalUrl
}

/**
 * Called by POST /api/sia/poll-connection.
 *
 * If we're still waiting for approval, attempts to complete the register()
 * call. If it succeeds, the singleton state is updated and subsequent calls
 * to isDemoMode() / isApprovalPending() reflect the new state.
 */
export async function retryConnection(): Promise<void> {
  if (_sdk) return // already connected
  if (!_approvalPending) return // nothing to retry
  if (!_builder) return // init hasn't run yet

  console.log('[Sia] retryConnection() — attempting register()…')

  const phrase = loadOrGeneratePhrase()

  try {
    const sdk = await _builder.register(phrase)
    saveAppKey(sdk.appKey())
    _sdk = sdk
    _demoMode = false
    _reason = ''
    _approvalPending = false
    _approvalUrl = ''
    console.log('[Sia] retryConnection() succeeded — app is now connected.')
  } catch (err) {
    // Not approved yet — log quietly and leave _approvalPending true
    console.log('[Sia] retryConnection() — not approved yet:', (err as Error).message)
  }
}

/**
 * Returns the live Sdk instance, or null in demo/pending mode.
 * Safe to call multiple times — init only runs once.
 */
export async function getSiaClient(): Promise<Sdk | null> {
  if (_sdk) return _sdk
  if (_demoMode) return null

  if (!_initPromise) {
    _initPromise = initSiaClient()
      .then((sdk) => {
        _sdk = sdk
        if (!sdk && !_approvalPending) {
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