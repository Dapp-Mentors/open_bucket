/**
 * Sia client singleton.
 *
 * On first call we attempt a full connection to the Sia indexer.
 * If the indexer can't be reached (or no recovery phrase is stored)
 * we fall into "demo mode" — all operations are simulated.
 */

import fs from 'fs'
import path from 'path'

const KEY_PATH = '/app/data/appkey.hex'
const PHRASE_PATH = '/app/data/phrase.enc' // in real life: encrypted + user-held

let siaInstance: Awaited<ReturnType<typeof buildClient>> | null = null
let demoMode = false

async function buildClient() {
  try {
    const { initSia, Builder, AppKey, generateRecoveryPhrase } = await import('@siafoundation/sia-storage')
    await initSia()

    // ── Sia AppMetadata (NAPI-RS native addon types) ─────────────────────────
    // The Node.js native addon (NAPI-RS) expects `id: Buffer`, NOT `appId: string`.
    // The WASM/browser build uses `appId: string` — but since we run in Node.js
    // the module resolver picks the native addon via the "node" export condition.
    // TypeScript types from the package use `appId` (WASM shape) so we must cast
    // to `any` — only runtime behaviour matters here.
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
    } as any // NAPI-RS native addon uses `id: Buffer`, WASM types say `appId: string`

    // If we already have a stored app key, skip the approval flow
    if (fs.existsSync(KEY_PATH)) {
      const appKeyHex = fs.readFileSync(KEY_PATH, 'utf8').trim()
      const appKey = new AppKey(Buffer.from(appKeyHex, 'hex'))
      const builder = new Builder(process.env.SIA_INDEXER_URL ?? 'https://sia.storage', appMeta)
      const sdk = await builder.connected(appKey)
      if (!sdk) {
        // Key is stale — delete it so the next boot re-runs the approval flow
        fs.unlinkSync(KEY_PATH)
        throw new Error('Stored app key rejected by indexer — deleted key, will re-approve on next boot')
      }
      console.log('[Sia] Connected with stored app key')
      return sdk
    }

    // ── First boot: run the one-time approval + registration flow ────────────
    // The user MUST open the printed URL in their browser and approve the app.
    // Without approval, waitForApproval() will block until the request expires.
    let phrase: string

    if (fs.existsSync(PHRASE_PATH)) {
      phrase = fs.readFileSync(PHRASE_PATH, 'utf8').trim()
      console.log('[Sia] Using stored recovery phrase')
    } else {
      phrase = generateRecoveryPhrase()
      fs.mkdirSync(path.dirname(PHRASE_PATH), { recursive: true })
      fs.writeFileSync(PHRASE_PATH, phrase, 'utf8')
      console.log('[Sia] Generated new recovery phrase (stored for demo)')
      console.log('[Sia] Recovery phrase saved to:', PHRASE_PATH)
      console.log('[Sia] ⚠️  In production, never store the recovery phrase — give it to the user instead.')
    }

    const builder = new Builder(process.env.SIA_INDEXER_URL ?? 'https://sia.storage', appMeta)

    await builder.requestConnection()

    // ── Always print the approval URL clearly so the operator can act. ─
    const approvalUrl = builder.responseUrl()
    console.log('\n' + '='.repeat(72))
    console.log('[Sia] ACTION REQUIRED — open this URL in your browser to approve the app:')
    console.log(approvalUrl)
    console.log('='.repeat(72) + '\n')

    await builder.waitForApproval()
    const sdk = await builder.register(phrase)

    const keyHex = Buffer.from(sdk.appKey().export()).toString('hex')
    fs.mkdirSync(path.dirname(KEY_PATH), { recursive: true })
    fs.writeFileSync(KEY_PATH, keyHex, 'utf8')
    console.log('[Sia] App key stored at', KEY_PATH, '— fully connected')
    return sdk
  } catch (err) {
    console.warn('[Sia] Could not connect to indexer, running in demo mode:', (err as Error).message)
    demoMode = true
    return null
  }
}

export async function getSiaClient() {
  if (demoMode) return null
  if (!siaInstance) {
    siaInstance = await buildClient()
  }
  return siaInstance
}

export function isDemoMode() {
  return demoMode
}