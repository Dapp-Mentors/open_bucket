import express from 'express'
import multer from 'multer'
import { v4 as uuidv4 } from 'uuid'
import { inngest } from '../inngest/client.js'
import { fileStore } from '../lib/fileStore.js'
import os from 'os'
import path from 'path'

const router = express.Router()

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
    const record = {
      id: fileId,
      name: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size,
      status: 'queued' as const,
      progress: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
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
