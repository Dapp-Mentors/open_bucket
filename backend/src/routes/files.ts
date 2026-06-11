import express from 'express'
import { fileStore } from '../lib/fileStore.js'
import { getSiaClient } from '../sia/client.js'

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

// Download a pinned file
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
      // Demo mode: return a placeholder response
      res.setHeader('Content-Type', 'text/plain')
      res.setHeader('Content-Disposition', `attachment; filename="${record.name}"`)
      res.send(`[Demo Mode] File "${record.name}" would be downloaded from Sia here.\nObject ID: ${record.siaObjectId}\nIndexd CID: ${record.indexdCid}`)
      return
    }

    // Real download path would reconstruct the object by ID
    // For now return a note — implementing full stateful object persistence
    // requires a persistent DB to map fileId → Sia object reference across restarts
    res.setHeader('Content-Type', record.mimeType)
    res.setHeader('Content-Disposition', `attachment; filename="${record.name}"`)
    res.send(`Sia object ${record.siaObjectId} ready for download.`)
  } catch (err) {
    console.error('[download]', err)
    res.status(500).json({ error: 'Download failed' })
  }
})

export default router
