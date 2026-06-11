import { inngest } from './client.js'
import { getSiaClient } from '../sia/client.js'
import { fileStore } from '../lib/fileStore.js'
import fs from 'fs'

/**
 * Main upload + pin pipeline.
 *
 * Steps:
 *  1. sia-upload-and-pin    – read file from disk, upload bytes to Sia + pin
 *  2. sia-pin               – record the pin timestamp
 *  3. indexd-register       – mock Indexd registration
 *  4. complete              – mark the file ready + clean up temp
 *
 * IMPORTANT: We do NOT read file bytes into an array and pass them across
 * Inngest step boundaries. Doing so produces a huge JSON payload that
 * exceeds Inngest's response size limit. Instead, each step that needs
 * the file reads it directly from disk — the file path is still valid
 * because the handler and Inngest dev server run in the same container.
 */
export const uploadAndPinFn = inngest.createFunction(
  { id: 'upload-and-pin', name: 'Upload & Pin File' },
  { event: 'file/upload.requested' },

  async ({ event, step }) => {
    const { fileId, filePath, fileName, mimeType, size } = event.data as {
      fileId: string
      filePath: string
      fileName: string
      mimeType: string
      size: number
    }

    try {
      // ── Step 1: Upload to Sia + pin ──────────────────────────────────────────
      const siaObjectId = await step.run('sia-upload-and-pin', async () => {
        fileStore.updateStatus(fileId, 'uploading', 10)
        const sdk = await getSiaClient()

        if (!sdk) {
          // Demo mode: no real Sia connection — simulate with a fake ID
          await sleep(1500)
          fileStore.updateStatus(fileId, 'uploading', 65)
          return `demo-sia-${fileId}`
        }

        // Read file from disk directly — avoids serialising huge byte arrays
        // across Inngest step boundaries
        fileStore.updateStatus(fileId, 'uploading', 40)
        const buf = fs.readFileSync(filePath)

        const { PinnedObject } = await import('@siafoundation/sia-storage')

        const uint8 = new Uint8Array(buf)
        const webStream = new Blob([uint8]).stream()

        const obj = await sdk.upload(new PinnedObject(), webStream)
        fileStore.updateStatus(fileId, 'uploading', 65)

        // pinObject must be called on the live handle in the same step
        await sdk.pinObject(obj)

        return obj.id()
      })

      // ── Step 2: Record pin timestamp ─────────────────────────────────────────
      const pinnedAt = await step.run('sia-pin', async () => {
        fileStore.updateStatus(fileId, 'pinning', 75)

        if (siaObjectId.startsWith('demo-sia-')) {
          await sleep(900)
        }

        return new Date().toISOString()
      })

      // ── Step 3: "Indexd" registration (simulated) ────────────────────────────
      const indexdCid = await step.run('indexd-register', async () => {
        fileStore.updateStatus(fileId, 'indexing', 88)
        // Indexd is a real NCI metadata service but has no public write API.
        // We simulate the registration here for demo purposes.
        await sleep(700)
        return `did:indexd:${siaObjectId.slice(0, 16)}`
      })

      // ── Step 4: Finalise ─────────────────────────────────────────────────────
      await step.run('complete', async () => {
        fileStore.updateStatus(fileId, 'ready', 100, {
          siaObjectId,
          pinnedAt,
          indexdCid,
        })
        // Clean up temp file
        try {
          fs.unlinkSync(filePath)
        } catch {
          // already gone, fine
        }
      })

      return { fileId, siaObjectId, indexdCid, pinnedAt }
    } catch (err) {
      // ── Global error handler: propagate failure to frontend ────────────────
      const message = err instanceof Error ? err.message : String(err)
      console.error(`[upload-and-pin] Pipeline failed for file ${fileId}:`, message)
      fileStore.setError(fileId, message)
      throw err
    }
  }
)

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}