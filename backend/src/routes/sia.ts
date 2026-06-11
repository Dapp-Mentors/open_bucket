import express from 'express'
import { isDemoMode, getSiaReason, resolveMode } from '../sia/client.js'

const router = express.Router()

router.get('/status', (_req, res) => {
  res.json({
    connected: !isDemoMode(),
    mode: isDemoMode() ? 'demo' : 'live',
    configMode: resolveMode(),
    reason: getSiaReason(),
    indexer: process.env.SIA_INDEXER_URL ?? 'https://sia.storage',
  })
})

export default router
