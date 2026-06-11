import { inngest } from './client.js'
import { getSiaClient } from '../sia/client.js'
import { fileStore } from '../lib/fileStore.js'
import fs from 'fs'

/**
 * Main upload + pin pipeline.
 *
 * Steps:
 *  1. read-temp-file        – read bytes from disk into serialisable form
 *  2. sia-upload-and-pin    – upload bytes to Sia + immediately pin the object
 *  3. sia-pin               – record the pin timestamp
 *  4. indexd-register       – mock Indexd registration
 *  5. complete              – mark the file ready + clean up temp
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

    // ── Step 1: Read temp file ───────────────────────────────────────────────
    const fileBytes = await step.run('read-temp-file', async () => {
      fileStore.updateStatus(fileId, 'uploading', 10)
      const buf = fs.readFileSync(filePath)
      return Array.from(buf) // must be JSON-serialisable to cross step boundaries
    })

    // ── Step 2: Upload to Sia + pin ──────────────────────────────────────────
    //
    // WHY upload and pin are in the same step:
    //   Inngest steps are isolated — the PinnedObject handle returned by
    //   sdk.upload() is an in-memory object that cannot be serialised across
    //   step boundaries. If upload and pin were separate steps, the handle
    //   would be lost and sdk.pinObject() would have nothing to act on.
    //
    // WHY we use new Blob([uint8]).stream() instead of Readable.toWeb():
    //   The Sia WASM SDK expects a browser-spec Web ReadableStream.
    //   `new Blob([...]).stream()` produces exactly that in both browser and
    //   Node 18+. The Readable.toWeb() adapter works at the Node level but
    //   can trip up the WASM boundary in some environments.
    const siaObjectId = await step.run('sia-upload-and-pin', async () => {
      fileStore.updateStatus(fileId, 'uploading', 40)
      const sdk = await getSiaClient()

      if (!sdk) {
        // Demo mode: no real Sia connection — simulate with a fake ID
        await sleep(1200)
        fileStore.updateStatus(fileId, 'uploading', 65)
        return `demo-sia-${fileId}`
      }

      const { PinnedObject } = await import('@siafoundation/sia-storage')

      // ── FIX 3: Use Blob.stream() to produce a Web ReadableStream ─────────
      // This matches the exact pattern shown in the Sia Node.js quickstart docs.
      const uint8 = new Uint8Array(fileBytes as number[])
      const webStream = new Blob([uint8]).stream()

      const obj = await sdk.upload(new PinnedObject(), webStream)
      fileStore.updateStatus(fileId, 'uploading', 65)

      // pinObject must be called on the live handle in the same step
      await sdk.pinObject(obj)

      return obj.id()
    })

    // ── Step 3: Record pin timestamp ─────────────────────────────────────────
    const pinnedAt = await step.run('sia-pin', async () => {
      fileStore.updateStatus(fileId, 'pinning', 75)

      if (siaObjectId.startsWith('demo-sia-')) {
        await sleep(900)
      }

      return new Date().toISOString()
    })

    // ── Step 4: "Indexd" registration (simulated) ────────────────────────────
    const indexdCid = await step.run('indexd-register', async () => {
      fileStore.updateStatus(fileId, 'indexing', 88)
      // Indexd is a real NCI metadata service but has no public write API.
      // We simulate the registration here for demo purposes.
      await sleep(700)
      return `did:indexd:${siaObjectId.slice(0, 16)}`
    })

    // ── Step 5: Finalise ─────────────────────────────────────────────────────
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
  }
)

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}