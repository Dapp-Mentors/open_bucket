import { Inngest } from 'inngest'

export const inngest = new Inngest({
  id: 'openbucket',
  eventKey: process.env.INNGEST_EVENT_KEY ?? 'local',
  baseUrl: process.env.INNGEST_BASE_URL,
})
