import type { InBodyMetrics } from '../types'

const FIELDS: (keyof InBodyMetrics)[] = [
  'weight',
  'bodyFatPercent',
  'muscleMass',
  'bmi',
  'basalMetabolism',
  'bodyFatMass',
]

/** 小数第1位まで丸める（体重・体脂肪率などは小数が意味を持つため） */
function round1(n: unknown): number {
  const v = Number(n)
  if (!Number.isFinite(v)) return 0
  return Math.round(v * 10) / 10
}

export function parseInbody(raw: string): InBodyMetrics {
  const cleaned = raw
    .replace(/```json/gi, '')
    .replace(/```/g, '')
    .trim()
  const obj = JSON.parse(cleaned)
  if (typeof obj.weight !== 'number') {
    throw new Error('weight field missing or not a number')
  }
  const out = {} as InBodyMetrics
  for (const f of FIELDS) {
    out[f] = round1(obj[f])
  }
  return out
}
