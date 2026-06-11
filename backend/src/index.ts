import express from 'express'
import cors from 'cors'
import { serve } from 'inngest/express'
import { inngest } from './inngest/client.js'
import { uploadAndPinFn } from './inngest/functions.js'
import uploadRouter from './routes/upload.js'
import filesRouter from './routes/files.js'
import siaRouter from './routes/sia.js'

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

app.listen(PORT, () => {
  console.log(`OpenBucket backend running on :${PORT}`)
})
