/**
 * Sia client singleton.
 *
 * Mode determination (priority order):
 *   1. SIA_MODE=live    → Will attempt connection and FAIL if it can't connect
 *   2. SIA_MODE=auto    → Try to connect, fall back to demo if unreachable (default)
 *   3. SIA_MODE=demo    → Skip connection entirely, always use demo mode
 *
 * In live/auto mode with no stored key, the approval URL is printed to logs.
 * The operator must open it in a browser to approve the app.
 *
 * Once approved, the app key is stored in /app/data/appkey.hex and reused
 * on subsequent boots without requiring re-approval.
 */

import fs from 'fs'
import path from 'path'

const KEY_PATH = '/app/data/appkey.hex'
const PHRASE_PATH = '/app/data/phrase.enc'

let siaInstance: Awaited<ReturnType<typeof buildClient>> | null = null
let available = false // true = SDK connected and usable
let reason = ''       // human-readable message about mode

type SiaMode = 'demo' | 'auto' | 'live'

function resolveMode(): SiaMode {
  const env = (process.env.SIA_MODE ?? 'auto').toLowerCase() as SiaMode
  if (['demo', 'auto', 'live'].includes(env)) return env
  return 'auto'
}

async function buildClient() {
  const mode = resolveMode()

  // ── Force demo mode ──────────────────────────────────────────────────────
  if (mode === 'demo') {
    reason = 'SIA_MODE=demo explicitly set'
    console.log('[Sia] Mode forced to DEMO by SIA_MODE env var')
    return null
  }

  // ── Attempt live connection ─────────────────────────────────────────────
  try {
    const { initSia, Builder, AppKey, generateRecoveryPhrase } = await import('@siafoundation/sia-storage')
    await initSia()

    const appMeta = {
      id: Buffer.from(
        process.env.SIA_APP_ID ?? '6f70656e6275636b657400000000000000000000000000000000000000000000',
        'hex'
      ),
      name: process.env.SIA_APP_NAME ?? 'OpenBucket',
      description: process.env.SIA_APP_DESCRIPTION ?? 'Decentralized file pinning demo',
      serviceUrl: process.env.SIA_APP_SERVICE_URL ?? 'http://localhost:3000',
      logoUrl: undefined as string | undefined,
      callbackUrl: undefined as string | undefined,
    } as any

    const indexerUrl = process.env.SIA_INDEXER_URL ?? 'https://sia.storage'

    // If we already have a stored app key, skip the approval flow
    if (fs.existsSync(KEY_PATH)) {
      const appKeyHex = fs.readFileSync(KEY_PATH, 'utf8').trim()
      const appKey = new AppKey(Buffer.from(appKeyHex, 'hex'))
      const builder = new Builder(indexerUrl, appMeta)
      const sdk = await builder.connected(appKey)
      if (!sdk) {
        fs.unlinkSync(KEY_PATH)
        throw new Error('Stored app key rejected by indexer — deleted key, will re-approve on next boot')
      }
      console.log('[Sia] Connected with stored app key')
      available = true
      reason = 'Connected to Sia indexer via stored app key'
      return sdk
    }

    // ── First boot: run the one-time approval + registration flow ─────────
    let phrase: string

    if (fs.existsSync(PHRASE_PATH)) {
      phrase = fs.readFileSync(PHRASE_PATH, 'utf8').trim()
      console.log('[Sia] Using stored recovery phrase')
    } else {
      phrase = generateRecoveryPhrase()
      fs.mkdirSync(path.dirname(PHRASE_PATH), { recursive: true })
      fs.writeFileSync(PHRASE_PATH, phrase, 'utf8')
      console.log('[Sia] Generated new recovery phrase (stored for demo)')
      console.log('[Sia] ⚠️  In production, never store the recovery phrase — give it to the user instead.')
    }

    const builder = new Builder(indexerUrl, appMeta)
    await builder.requestConnection()

    const approvalUrl = builder.responseUrl()
    console.log('\n' + '='.repeat(72))
    console.log('[Sia] ACTION REQUIRED — open this URL in your browser to approve the app:')
    console.log(approvalUrl)
    console.log('='.repeat(72) + '\n')

    // Wait up to 120 seconds for approval (default SDK timeout is longer)
    await builder.waitForApproval()
    const sdk = await builder.register(phrase)

    const keyHex = Buffer.from(sdk.appKey().export()).toString('hex')
    fs.mkdirSync(path.dirname(KEY_PATH), { recursive: true })
    fs.writeFileSync(KEY_PATH, keyHex, 'utf8')
    console.log('[Sia] App key stored — fully connected')

    available = true
    reason = 'Connected to Sia indexer'
    return sdk
  } catch (err) {
    const message = (err as Error).message

    if (mode === 'live') {
      // In live mode, failure is fatal — rethrow
      console.error('[Sia] SIA_MODE=live but connection failed:', message)
      reason = `LIVE mode failed: ${message}`
      throw err
    }

    // auto mode: fall back to demo
    console.warn('[Sia] Could not connect to indexer, running in demo mode:', message)
    reason = `Demo mode (indexer unreachable: ${message})`
    return null
  }
}

export async function getSiaClient() {
  if (siaInstance === null && available === false && resolveMode() !== 'demo') {
    // First call — attempt connection (only if not already tried)
    siaInstance = await buildClient()
  } else if (siaInstance === null && available === false) {
    // Demo mode — keep returning null
    return null
  }
  return siaInstance
}

export function isDemoMode(): boolean {
  return !available
}

export function getSiaReason(): string {
  return reason
}

export { resolveMode }