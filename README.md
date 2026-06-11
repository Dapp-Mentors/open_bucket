# OpenBucket

A live demo of file pinning via the Sia decentralized storage network, driven by an Inngest event pipeline and served through a Next.js UI.

## What it shows

Upload a file → watch it move through four pipeline stages in real time → download it back. Every step is a durable Inngest function, so the pipeline survives crashes and restarts.

```
Upload → Sia erasure-coding → Indexer pin → Indexd metadata → Ready
```

## Stack

| Layer | Tech |
|-------|------|
| Frontend | Next.js 15, TypeScript, Tailwind CSS, Framer Motion |
| Backend | Express + TypeScript |
| Events | Inngest (local dev server) |
| Storage | Sia via `@siafoundation/sia-storage` SDK |
| Metadata | Indexd (simulated — no public write API) |
| Persistence | In-memory (backend) + localStorage (browser) |

---

## Running it

```bash
docker compose up --build
```

| Service   | URL                        |
|-----------|----------------------------|
| Frontend  | http://localhost:3000       |
| Backend   | http://localhost:4000       |
| Inngest   | http://localhost:8288       |

That's it. The first time the backend boots it tries to connect to `https://sia.storage`. If it can't reach the indexer in time (or you haven't approved the app), it falls into **demo mode** — uploads are simulated with realistic delays and fake object IDs. The UI is identical either way; the mode badge in the top nav tells you which you're in.

---

## Connecting a real Sia indexer

The Sia SDK requires a one-time approval flow:

1. Set `SIA_APP_ID` in `docker-compose.yml` to a real 32-byte hex string (your app's stable identity).
2. Start the stack: `docker compose up`.
3. Watch the backend logs for the approval URL:
   ```
   [Sia] Open this URL to approve the app: https://sia.storage/approve?...
   ```
4. Open that URL in your browser and approve the connection.
5. The backend derives and stores an App Key in the `sia-keys` Docker volume.

After the first approval the backend reconnects automatically on every restart using the stored key — no user action required.

**Recovery phrase:** On first boot the backend auto-generates a BIP-39 recovery phrase and writes it to `/app/data/phrase.enc` inside the container (mounted from the `sia-keys` volume). In a production app you'd ask the user for their own phrase and never store it. For this demo, automatic generation keeps the setup frictionless.

---

## Project layout

```
openbucket/
├── docker-compose.yml
├── backend/
│   ├── Dockerfile
│   ├── package.json
│   └── src/
│       ├── index.ts            # Express server + Inngest handler
│       ├── inngest/
│       │   ├── client.ts       # Inngest instance
│       │   └── functions.ts    # upload-and-pin pipeline (4 steps)
│       ├── sia/
│       │   └── client.ts       # Sia SDK singleton + demo mode fallback
│       ├── lib/
│       │   └── fileStore.ts    # In-memory file record store
│       └── routes/
│           ├── upload.ts       # POST /api/upload (multipart)
│           ├── files.ts        # GET /api/files, /api/files/:id, /api/files/:id/download
│           └── sia.ts          # GET /api/sia/status
└── frontend/
    ├── Dockerfile
    ├── package.json
    └── src/
        ├── app/
        │   ├── layout.tsx
        │   ├── page.tsx                  # Screen 1: Dashboard
        │   └── pipeline/[id]/page.tsx    # Screen 2: Pipeline view
        ├── components/
        │   ├── Nav.tsx
        │   ├── FileCard.tsx
        │   ├── UploadModal.tsx
        │   ├── HowItWorks.tsx
        │   ├── Toast.tsx
        │   └── pipeline/PipelineStep.tsx
        ├── hooks/
        │   └── useFilePoller.ts   # 1.5 s polling until terminal state
        ├── lib/
        │   ├── api.ts             # Fetch wrappers
        │   └── storage.ts         # localStorage helpers + formatting utils
        └── types/index.ts
```

---

## Development (without Docker)

```bash
# Terminal 1 — Inngest
npx inngest-cli@latest dev

# Terminal 2 — Backend
cd backend && npm install && npm run dev

# Terminal 3 — Frontend
cd frontend && npm install && npm run dev
```

Set `INNGEST_BASE_URL=http://localhost:8288` in `backend/.env` if you're not using Docker networking.
