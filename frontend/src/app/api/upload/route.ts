import { NextResponse, type NextRequest } from 'next/server'

const BACKEND = process.env.BACKEND_URL ?? 'http://localhost:4000'

export async function POST(req: NextRequest) {
    try {
        const body = await req.formData()

        const res = await fetch(`${BACKEND}/api/upload`, {
            method: 'POST',
            // FormData sets the correct multipart Content-Type with boundary automatically
            body,
        })

        if (!res.ok) {
            const text = await res.text()
            return NextResponse.json({ error: text }, { status: res.status })
        }

        return NextResponse.json(await res.json())
    } catch {
        return NextResponse.json({ error: 'Backend unreachable' }, { status: 502 })
    }
}