import { NextResponse, type NextRequest } from 'next/server'

const BACKEND = process.env.BACKEND_URL ?? 'http://localhost:4000'

export async function GET() {
  try {
    const res = await fetch(`${BACKEND}/api/files`, { cache: 'no-store' })
    if (!res.ok) return NextResponse.json([], { status: 200 })
    return NextResponse.json(await res.json())
  } catch {
    return NextResponse.json([])
  }
}