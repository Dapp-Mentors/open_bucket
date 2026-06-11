import { inngest } from './client.js'
import { getSiaClient } from '../sia/client.js'
import { fileStore } from '../lib/fileStore.js'
import fs from 'fs'
import { Readable } from 'stream'

/**
 * Main upload + pin pipeline.
 *
 * Steps:
 *  1. upload/temp     – move the temp file into in-memory context
 *  2. sia/upload      – upload bytes to Sia network
 *  3. sia/pin         – pin the object on the indexer
 *  4. indexd/register – mock Indexd registration (Indexd is not a real public API yet)
 *  5. complete        – mark the file ready
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
      return Array.from(buf) // must be serialisable
    })

    // ── Step 2: Upload to Sia ────────────────────────────────────────────────
    // BUG 1 FIX: The step returned obj.id() (a string), but the PinnedObject
    // handle was discarded — making it impossible to call sdk.pinObject(obj)
    // in Step 3. Steps are isolated; the obj handle can't cross step boundaries.
    // Fix: combine upload + pin into a single step so the obj handle is available
    // for both calls, exactly as the Sia docs show (upload then immediately pin).
    //
    // BUG 2 FIX: The Sia SDK's upload() expects a Web ReadableStream, but
    // `new Blob([...]).stream()` in Node.js returns a Node.js Readable, not a
    // Web ReadableStream. Fix: use Readable.toWeb() to convert it properly.
    //
    // BUG 3 FIX: Step 3 ("sia-pin") received only the siaObjectId string, then
    // tried to pin "by ID" — but there is no such API. The SDK requires the live
    // PinnedObject handle returned from upload(). Without it, pinObject() was
    // never called, so the upload was never persisted on the indexer and the
    // pipeline silently stalled at 10% (the file read step completed, but the
    // Sia upload step was blocked waiting for a stream that never resolved).
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

      // Convert the serialised byte array back to a Web ReadableStream,
      // which is what the Sia WASM SDK requires.
      const uint8 = new Uint8Array(fileBytes as number[])
      const webStream = Readable.toWeb(Readable.from(uint8)) as ReadableStream

      const obj = await sdk.upload(new PinnedObject(), webStream)
      fileStore.updateStatus(fileId, 'uploading', 65)

      // Pin must be called on the live PinnedObject handle — not by ID.
      // Without this call the indexer never records the object and the upload
      // is lost when the container restarts.
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