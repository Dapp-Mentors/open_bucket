# Tests

Covers internal logic for both the backend and frontend — no external services, no Sia SDK, no Inngest, no HTTP calls.

## What's covered

| File | Tests |
|------|-------|
| `storage.test.ts` | `formatBytes`, `statusColor`, `statusLabel` from `frontend/src/lib/storage.ts` |
| `localStorage.test.ts` | `loadLocalFiles`, `saveLocalFiles`, `upsertLocalFile` from `frontend/src/lib/storage.ts` |
| `pipelineSteps.test.ts` | `PIPELINE_STEPS` constant shape and ordering from `frontend/src/types/index.ts` |
| `fileStore.test.ts` | `nullToUndefined`, `toRow`, and all CRUD methods via in-memory SQLite |
| `config.test.ts` | Path derivation logic from `backend/src/lib/config.ts` |
| `api.test.ts` | `downloadUrl` construction and fallback values from `frontend/src/lib/api.ts` |

## Running

```bash
cd tests
npm install
npm test
```

Coverage report:

```bash
npm run test:coverage
```

## Notes

- `fileStore.test.ts` uses an in-memory SQLite database (`:memory:`), so it leaves no files on disk and runs in isolation.
- `localStorage.test.ts` mocks `window.localStorage` using a plain JS object — no browser or jsdom required.
- No test talks to any network endpoint or spawns any process.
