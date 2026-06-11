import express from 'express'
import cors from 'cors'
import { serve } from 'inngest/express'
import { inngest } from './inngest/client.js'
import { uploadAndPinFn } from './inngest/functions.js'
import uploadRouter from './routes/upload.js'
import filesRouter from './routes/files.js'
import siaRouter from './routes/sia.js'
import { getSiaClient } from './sia/client.js'

const app = express()
const PORT = process.env.PORT ?? 4000

app.use(cors({ origin: '*' }))
app.use(express.json())

// Inngest event handler
app.use(
  '/api/inngest',
  serve({
    client: inngest,
    functions: [uploadAndPinFn],
  })
)

// REST routes
app.use('/api/upload', uploadRouter)
app.use('/api/files', filesRouter)
app.use('/api/sia', siaRouter)

app.get('/health', (_req, res) => {
  res.json({ ok: true, ts: new Date().toISOString() })
})

app.listen(PORT, async () => {
  console.log(`OpenBucket backend running on :${PORT}`)

  // ── Eagerly initialise the Sia client on boot ─────────────────────────────
  // This triggers the approval-flow (if needed) immediately so the operator
  // sees the ACTION REQUIRED URL without having to upload a file first.
  console.log('[Sia] Initialising Sia client…')
  try {
    const sdk = await getSiaClient()
    if (sdk) {
      console.log('[Sia] Successfully connected to Sia indexer')
    } else {
      const { isDemoMode, getSiaReason } = await import('./sia/client.js')
      if (isDemoMode()) {
        console.log('[Sia] Running in demo mode:', getSiaReason())
      }
    }
  } catch (err) {
    // If SIA_MODE=live fails, log the error but don't crash the server
    console.error('[Sia] Failed to initialise Sia client:', (err as Error).message)
    console.log('[Sia] The server is still running — uploads will fail until Sia is connected.')
  }
})
