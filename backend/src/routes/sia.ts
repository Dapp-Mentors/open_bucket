import express from 'express'
import {
  isDemoMode,
  getSiaReason,
  resolveMode,
  getApprovalUrl,
  isApprovalPending,
  retryConnection,
} from '../sia/client.js'

const router = express.Router()

/**
 * GET /api/sia/status
 *
 * Returns the current Sia connection state including whether an approval
 * URL is waiting for the user. The frontend uses this on load to decide
 * whether to show the setup modal.
 */
router.get('/status', (_req, res) => {
  const pending = isApprovalPending()
  const approvalUrl = pending ? getApprovalUrl() : undefined

  res.json({
    connected: !isDemoMode(),
    mode: isDemoMode() ? 'demo' : 'live',
    configMode: resolveMode(),
    reason: getSiaReason(),
    indexer: process.env.SIA_INDEXER_URL ?? 'https://sia.storage',
    approvalPending: pending,
    approvalUrl,
  })
})

/**
 * POST /api/sia/poll-connection
 *
 * Called by the frontend after the user clicks "I've approved it" in the
 * setup modal. Attempts to complete the registration flow if still pending,
 * then returns the current connection status.
 *
 * Returns the same shape as /status so the frontend can update in one call.
 */
router.post('/poll-connection', async (_req, res) => {
  try {
    await retryConnection()
  } catch {
    // retryConnection logs internally — swallow here so we always return JSON
  }

  const pending = isApprovalPending()
  const approvalUrl = pending ? getApprovalUrl() : undefined

  res.json({
    connected: !isDemoMode(),
    mode: isDemoMode() ? 'demo' : 'live',
    configMode: resolveMode(),
    reason: getSiaReason(),
    indexer: process.env.SIA_INDEXER_URL ?? 'https://sia.storage',
    approvalPending: pending,
    approvalUrl,
  })
})

export default router