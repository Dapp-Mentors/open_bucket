import { NextResponse } from 'next/server'

const BACKEND = process.env.BACKEND_URL ?? 'http://localhost:4000'

export async function GET() {
    try {
        const res = await fetch(`${BACKEND}/api/sia/status`, { cache: 'no-store' })
        if (!res.ok) {
            return NextResponse.json(
                { connected: false, mode: 'demo', indexer: 'unknown' },
                { status: 200 },
            )
        }
        const data = await res.json()
        return NextResponse.json(data)
    } catch {
        // Backend unreachable — return safe demo fallback
        return NextResponse.json({
            connected: false,
            mode: 'demo',
            indexer: 'unknown',
        })
    }
}