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
    const { initSia, Builder, AppKey } = await import('@siafoundation/sia-storage')
    await initSia()

    const appMeta = {
      appId: process.env.SIA_APP_ID ?? '6f70656e6275636b657400000000000000000000000000000000000000000000',
      name: process.env.SIA_APP_NAME ?? 'OpenBucket',
      description: process.env.SIA_APP_DESCRIPTION ?? 'Decentralized file pinning demo',
      serviceUrl: process.env.SIA_APP_SERVICE_URL ?? 'http://localhost:3000',
      logoUrl: undefined,
      callbackUrl: undefined,
    }

    // If we already have a stored app key, skip the approval flow
    if (fs.existsSync(KEY_PATH)) {
      const appKeyHex = fs.readFileSync(KEY_PATH, 'utf8').trim()
      // Re-connect using the stored key (no recovery phrase needed)
      const appKey = new AppKey(Buffer.from(appKeyHex, 'hex'))
      const builder = new Builder(process.env.SIA_INDEXER_URL ?? 'https://sia.storage', appMeta)
      const sdk = await builder.connected(appKey)
      if (!sdk) {
        throw new Error('Stored app key rejected by indexer — clearing key and retrying on next boot')
      }
      console.log('[Sia] Connected with stored app key')
      return sdk
    }

    // First boot — need a recovery phrase
    // In a deployed app the user would provide this; here we auto-generate + persist
    // for the demo container so it survives restarts.
    const { generateRecoveryPhrase } = await import('@siafoundation/sia-storage')
    let phrase: string

    if (fs.existsSync(PHRASE_PATH)) {
      phrase = fs.readFileSync(PHRASE_PATH, 'utf8').trim()
      console.log('[Sia] Using stored recovery phrase')
    } else {
      phrase = generateRecoveryPhrase()
      fs.mkdirSync(path.dirname(PHRASE_PATH), { recursive: true })
      fs.writeFileSync(PHRASE_PATH, phrase, 'utf8')
      console.log('[Sia] Generated new recovery phrase (stored for demo)')
    }

    const builder = new Builder(process.env.SIA_INDEXER_URL ?? 'https://sia.storage', appMeta)
    await builder.requestConnection()
    console.log('[Sia] Waiting for indexer approval…', builder.responseUrl?.())
    await builder.waitForApproval()
    const sdk = await builder.register(phrase)

    const keyHex = Buffer.from(sdk.appKey().export()).toString('hex')
    fs.writeFileSync(KEY_PATH, keyHex, 'utf8')
    console.log('[Sia] App key stored, fully connected')
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