import express from 'express'
import multer from 'multer'
import { v4 as uuidv4 } from 'uuid'
import { inngest } from '../inngest/client.js'
import { fileStore, type FileRecord } from '../lib/fileStore.js'
import { getSiaClient } from '../sia/client.js'
import os from 'os'
import path from 'path'
import fs from 'fs'

const router = express.Router()

const DATA_DIR = '/app/data/uploads'

const upload = multer({
  dest: path.join(os.tmpdir(), 'openbucket'),
  limits: { fileSize: 100 * 1024 * 1024 }, // 100 MB max
})

router.post('/', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No file provided' })
      return
    }

    const fileId = uuidv4()

    // Check if we're in demo mode — if so, copy the file to persistent storage
    const sdk = await getSiaClient()
    const isDemo = !sdk

    let dataPath: string | undefined
    if (isDemo) {
      // In demo mode, keep a persistent copy for downloads
      fs.mkdirSync(DATA_DIR, { recursive: true })
      dataPath = path.join(DATA_DIR, fileId)
      fs.copyFileSync(req.file.path, dataPath)
    }

    const record: FileRecord = {
      id: fileId,
      name: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size,
      status: 'queued',
      progress: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      dataPath,
    }

    fileStore.add(record)

    // Fire the Inngest event to kick off the pipeline
    await inngest.send({
      name: 'file/upload.requested',
      data: {
        fileId,
        filePath: req.file.path,
        fileName: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size,
      },
    })

    res.json({ fileId, status: 'queued' })
  } catch (err) {
    console.error('[upload]', err)
    res.status(500).json({ error: 'Upload failed' })
  }
})

export default router
