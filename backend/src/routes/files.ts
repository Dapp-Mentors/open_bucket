import express from 'express'
import { fileStore } from '../lib/fileStore.js'
import { getSiaClient } from '../sia/client.js'
import fs from 'fs'

const router = express.Router()

// List all files
router.get('/', (_req, res) => {
  res.json(fileStore.getAll())
})

// Get one file's status
router.get('/:id', (req, res) => {
  const record = fileStore.get(req.params.id)
  if (!record) {
    res.status(404).json({ error: 'File not found' })
    return
  }
  res.json(record)
})

// Download — streams from Sia (or local copy in demo mode)
router.get('/:id/download', async (req, res) => {
  const record = fileStore.get(req.params.id)
  if (!record) {
    res.status(404).json({ error: 'File not found' })
    return
  }
  if (record.status !== 'ready') {
    res.status(409).json({ error: 'File not ready yet' })
    return
  }

  try {
    const sdk = await getSiaClient()

    if (!sdk || record.siaObjectId?.startsWith('demo-sia-')) {
      // Demo mode: serve local copy
      if (record.dataPath && fs.existsSync(record.dataPath)) {
        const stat = fs.statSync(record.dataPath)
        res.setHeader('Content-Type', record.mimeType)
        res.setHeader('Content-Disposition', `attachment; filename="${record.name}"`)
        res.setHeader('Content-Length', stat.size)
        const stream = fs.createReadStream(record.dataPath)
        stream.pipe(res)
        return
      }

      // Fallback text if no local copy
      res.setHeader('Content-Type', 'text/plain')
      res.setHeader('Content-Disposition', `attachment; filename="${record.name}"`)
      res.send(`[Demo Mode] File "${record.name}" would be downloaded from Sia here.\nObject ID: ${record.siaObjectId}\nIndexd CID: ${record.indexdCid}`)
      return
    }

    const obj = await sdk.object(record.siaObjectId!)
    const stream = sdk.download(obj)

    res.setHeader('Content-Type', record.mimeType)
    res.setHeader('Content-Disposition', `attachment; filename="${record.name}"`)

    const reader = stream.getReader()
    res.flushHeaders()

    const pump = async () => {
      while (true) {
        const { done, value } = await reader.read()
        if (done) {
          res.end()
          break
        }
        res.write(Buffer.from(value))
      }
    }
    pump().catch((err) => {
      console.error('[download-stream]', err)
      if (!res.headersSent) {
        res.status(500).json({ error: 'Download failed' })
      } else {
        res.end()
      }
    })
  } catch (err) {
    console.error('[download]', err)
    res.status(500).json({ error: 'Download failed' })
  }
})

// Delete — unpins from Sia and removes from records
router.delete('/:id', async (req, res) => {
  const record = fileStore.get(req.params.id)
  if (!record) {
    res.status(404).json({ error: 'File not found' })
    return
  }

  try {
    const sdk = await getSiaClient()

    if (sdk && record.siaObjectId && !record.siaObjectId.startsWith('demo-sia-')) {
      await sdk.deleteObject(record.siaObjectId)
      console.log(`[delete] Unpinned Sia object ${record.siaObjectId} for file ${req.params.id}`)
    }

    fileStore.delete(req.params.id)
    res.json({ success: true })
  } catch (err) {
    console.error('[delete]', err)
    res.status(500).json({ error: 'Delete failed' })
  }
})

export default router
