import { inngest } from './client.js'
import { getSiaClient } from '../sia/client.js'
import { fileStore } from '../lib/fileStore.js'
import { readFile } from 'fs/promises'
import fs from 'fs'

/**
 * Main upload + pin pipeline.
 *
 * Steps:
 *  1. sia-upload-and-pin    – read file from disk, upload to Sia + pin
 *  2. sia-pin               – record the pin timestamp
 *  3. indexd-register       – mock Indexd registration
 *  4. complete              – mark file ready + clean up temp
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
          // Demo mode — simulate with a fake object ID
          await sleep(1500)
          fileStore.updateStatus(fileId, 'uploading', 65)
          return `demo-sia-${fileId}`
        }

        fileStore.updateStatus(fileId, 'uploading', 40)

        console.log(`[upload] Starting upload for ${fileId} (${size} bytes)`)

        const { PinnedObject } = await import('@siafoundation/sia-storage')

        // Read the entire file into memory first (safest for WASM SDK)
        console.log('[upload] Reading file into memory...')
        const fileBuffer = await readFile(filePath)
        const fileBytes = new Uint8Array(
          fileBuffer.buffer,
          fileBuffer.byteOffset,
          fileBuffer.byteLength,
        )
        console.log(`[upload] File read (${fileBytes.byteLength} bytes), creating BYOB stream...`)

        // === FIXED: Proper byte-mode stream + TypeScript-safe BYOB handling ===
        const stream = new ReadableStream({
          type: 'bytes',

          pull(controller) {
            const byobRequest = controller.byobRequest

            if (byobRequest?.view) {
              // Safe BYOB path
              const view = byobRequest.view
              const bytesToCopy = Math.min(view.byteLength, fileBytes.byteLength)

              new Uint8Array(view.buffer, view.byteOffset, bytesToCopy).set(
                fileBytes.subarray(0, bytesToCopy)
              )

              byobRequest.respond(bytesToCopy)
            } else {
              // Fallback (should rarely happen)
              controller.enqueue(fileBytes)
            }

            controller.close()
          },

          cancel(reason) {
            console.warn('[upload] Stream was cancelled:', reason?.message || reason)
          }
        })

        const pinnedObj = new PinnedObject()

        console.log('[upload] Calling sdk.upload() with BYOB stream...')
        const uploadedObj = await sdk.upload(pinnedObj, stream)

        console.log(`[upload] sdk.upload() completed → object id: ${uploadedObj.id ? uploadedObj.id() : 'unknown'}`)

        fileStore.updateStatus(fileId, 'uploading', 65)

        console.log('[upload] Pinning object...')
        await sdk.pinObject(uploadedObj)
        console.log('[upload] pinObject completed')

        return uploadedObj.id()
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