// Node.js runtime handler for chat processing (AI processing)
export const runtime = 'nodejs'

import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}))
  // TODO: call into serverless AI processing (src/lib/infrastructure/llm-adapter)
  return NextResponse.json({ ok: true, queued: true, received: body })
}
