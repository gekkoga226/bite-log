import type { InBodyMetrics } from '../types'
import { parseInbody } from '../lib/parseInbody'

export interface InbodyOcrInput {
  images: { base64: string; mimeType: string }[]
}

export async function extractInbody(input: InbodyOcrInput): Promise<InBodyMetrics> {
  const res = await fetch('/api/inbody', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) {
    let detail = ''
    try {
      const body = (await res.json()) as { error?: string }
      detail = body.error ? ` - ${body.error}` : ''
    } catch {
      /* ignore */
    }
    throw new Error(`inbody OCR failed: ${res.status}${detail}`)
  }
  const data = (await res.json()) as { raw: string }
  return parseInbody(data.raw)
}
