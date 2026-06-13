import { inngest } from './client.js'
import { getSiaClient } from '../sia/client.js'
import { fileStore } from '../lib/fileStore.js'
import { readFile } from 'fs/promises'
import fs from 'fs'

/**
 * Upload + Pin Pipeline
 *
 * Dedup: Inngest concurrency key prevents parallel runs; DB‑level check
 * handles replayed runs after crash. Steps: upload → pin → register → clean up.
 */

export const uploadAndPinFn = inngest.createFunction(
  {
    id: 'upload-and-pin',
    name: 'Upload & Pin File',
    concurrency: {
      limit: 1,
      key: 'event.data.fileId',
    },
  },
  { event: 'file/upload.requested' },

  async ({ event, step }) => {
    const { fileId, filePath, fileName, mimeType, size } = event.data as {
      fileId: string
      filePath: string
      fileName: string
      mimeType: string
      size: number
    }

    // Skip if already completed (Inngest replay guard)
    const existing = fileStore.get(fileId)
    if (existing?.status === 'ready') {
      console.log(`[upload][idempotent] file ${fileId} already ready — returning stored result`)
      return {
        fileId,
        siaObjectId: existing.siaObjectId,
        indexdCid: existing.indexdCid,
        pinnedAt: existing.pinnedAt,
      }
    }

    try {
      console.log(`[upload][debug] pipeline started`, { fileId, fileName, size, mimeType })

      // ── Step 1: Upload ─────────────────────────────────────────────────────
      const siaObjectId = await step.run('sia-upload-and-pin', async () => {
        fileStore.updateStatus(fileId, 'uploading', 10)

        const sdk = await getSiaClient()

        if (!sdk) {
          console.log('[upload][debug] running in demo mode')
          await sleep(1200)
          fileStore.updateStatus(fileId, 'uploading', 65)
          return `demo-sia-${fileId}`
        }

        fileStore.updateStatus(fileId, 'uploading', 25)

        console.log('[upload][debug] reading file from disk...', filePath)
        const fileBuffer = await readFile(filePath)
        const fileBytes = new Uint8Array(
          fileBuffer.buffer,
          fileBuffer.byteOffset,
          fileBuffer.byteLength,
        )
        console.log('[upload][debug] file loaded into memory', { bytes: fileBytes.byteLength })

        const { PinnedObject } = await import('@siafoundation/sia-storage')
        const pinnedObj = new PinnedObject()

        // Plain enqueue stream — BYOB can hang if SDK never issues byobRequest
        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue(fileBytes)
            controller.close()
          },
        })

        console.log('[upload][debug] calling sdk.upload()')
        const uploadedObj = await sdk.upload(pinnedObj, stream)

        const objectId =
          typeof uploadedObj?.id === 'function' ? uploadedObj.id() : uploadedObj?.id

        if (!objectId) {
          throw new Error('Sia upload failed: sdk.upload() returned no object ID')
        }

        console.log('[upload][debug] upload completed', { objectId })
        fileStore.updateStatus(fileId, 'uploading', 60)

        console.log('[upload][debug] pinning object...')
        await sdk.pinObject(uploadedObj)
        console.log('[upload][debug] pin complete')

        return objectId
      })

      // ── Step 2: Pin ────────────────────────────────────────────────────────
      const pinnedAt = await step.run('sia-pin', async () => {
        fileStore.updateStatus(fileId, 'pinning', 75)

        if (siaObjectId.startsWith('demo-sia-')) {
          await sleep(800)
        }

        return new Date().toISOString()
      })

      // ── Step 3: Indexd (mock) ──────────────────────────────────────────────
      const indexdCid = await step.run('indexd-register', async () => {
        fileStore.updateStatus(fileId, 'indexing', 88)
        await sleep(600)
        return `did:indexd:${siaObjectId.slice(0, 16)}`
      })

      // ── Step 4: Complete ───────────────────────────────────────────────────
      await step.run('complete', async () => {
        fileStore.updateStatus(fileId, 'ready', 100, {
          siaObjectId,
          pinnedAt,
          indexdCid,
        })

        try {
          fs.unlinkSync(filePath)
          console.log('[upload][debug] temp file cleaned')
        } catch {
          // already gone
        }
      })

      console.log('[upload][debug] pipeline completed successfully', {
        fileId,
        siaObjectId,
        indexdCid,
        pinnedAt,
      })

      return { fileId, siaObjectId, indexdCid, pinnedAt }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error('[upload][error] pipeline failed', { fileId, message })
      fileStore.setError(fileId, message)
      throw err
    }
  },
)

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}