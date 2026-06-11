export type FileStatus = 'queued' | 'uploading' | 'pinning' | 'indexing' | 'ready' | 'error'

export interface FileRecord {
  id: string
  name: string
  mimeType: string
  size: number
  status: FileStatus
  progress: number
  createdAt: string
  updatedAt: string
  siaObjectId?: string
  pinnedAt?: string
  indexdCid?: string
  error?: string
}

export interface SiaStatus {
  connected: boolean
  mode: 'demo' | 'live'
  indexer: string
}

export const PIPELINE_STEPS = [
  { key: 'queued',    label: 'Queued',                desc: 'Waiting to start',                pct: 0   },
  { key: 'uploading', label: 'Uploading to Sia',       desc: 'Transferring encrypted shards',   pct: 40  },
  { key: 'pinning',   label: 'Pinning on Indexer',     desc: 'Registering object with indexer', pct: 75  },
  { key: 'indexing',  label: 'Registering on Indexd',  desc: 'Creating metadata record',        pct: 88  },
  { key: 'ready',     label: 'Ready',                  desc: 'Pinned and downloadable',         pct: 100 },
] as const

export type PipelineStepKey = (typeof PIPELINE_STEPS)[number]['key']
