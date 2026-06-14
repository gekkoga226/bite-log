import { GoogleGenerativeAI } from '@google/generative-ai'

interface DaySummary {
  date: string
  calories: number
  protein: number
  fat: number
  carbs: number
}
interface Inbody {
  date: string
  weight: number
  bodyFatPercent: number
  muscleMass: number
  bmi: number
  basalMetabolism: number
  bodyFatMass: number
}
interface Goals {
  calories: number
  protein: number
  fat: number
  carbs: number
}

const SYSTEM = `あなたは経験豊富な管理栄養士です。利用者の直近の食事記録と体組成データをもとに、
親しみやすく具体的なアドバイスを日本語で述べてください。出力の条件:
- 全体で300字以内。
- 「総評」「良い点」「改善提案」の3見出しで、各1〜2文。
- 体組成の変化（体重・体脂肪率・骨格筋量）があれば必ず触れる。
- 数値は具体的に挙げ、PFCバランスや目標との差に基づく実行可能な提案をする。
- 医療行為・断定的な診断は避け、食事の観点に絞る。`

function buildContext(days: DaySummary[], goals: Goals, latest: Inbody | null, previous: Inbody | null): string {
  const lines: string[] = []
  lines.push(`【1日の目標】${goals.calories}kcal / P${goals.protein}g F${goals.fat}g C${goals.carbs}g`)

  if (days.length > 0) {
    lines.push(`\n【直近${days.length}日の食事記録（日別合計）】`)
    for (const d of days) {
      lines.push(`${d.date}: ${Math.round(d.calories)}kcal / P${Math.round(d.protein)}g F${Math.round(d.fat)}g C${Math.round(d.carbs)}g`)
    }
    const n = days.length
    const avg = (sel: (d: DaySummary) => number) => Math.round(days.reduce((s, d) => s + sel(d), 0) / n)
    lines.push(`平均: ${avg((d) => d.calories)}kcal / P${avg((d) => d.protein)}g F${avg((d) => d.fat)}g C${avg((d) => d.carbs)}g`)
  } else {
    lines.push('\n【食事記録】直近の記録なし')
  }

  if (latest) {
    lines.push(`\n【最新の体組成 ${latest.date}】体重${latest.weight}kg / 体脂肪率${latest.bodyFatPercent}% / 骨格筋量${latest.muscleMass}kg / BMI${latest.bmi} / 基礎代謝${latest.basalMetabolism}kcal / 体脂肪量${latest.bodyFatMass}kg`)
    if (previous) {
      const diff = (a: number, b: number) => {
        const v = Math.round((a - b) * 10) / 10
        return v >= 0 ? `+${v}` : `${v}`
      }
      lines.push(`前回(${previous.date})比: 体重${diff(latest.weight, previous.weight)}kg / 体脂肪率${diff(latest.bodyFatPercent, previous.bodyFatPercent)}% / 骨格筋量${diff(latest.muscleMass, previous.muscleMass)}kg`)
    }
  } else {
    lines.push('\n【体組成】記録なし')
  }
  return lines.join('\n')
}

export default async function handler(req: any, res: any): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).send('Method Not Allowed')
    return
  }
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    res.status(500).json({ error: 'API key not configured' })
    return
  }

  const body = req.body as {
    goals?: Goals
    days?: DaySummary[]
    latest?: Inbody | null
    previous?: Inbody | null
  }
  const goals = body.goals ?? { calories: 1800, protein: 93, fat: 42, carbs: 195 }
  const days = body.days ?? []
  if (days.length === 0 && !body.latest) {
    res.status(400).json({ error: '食事記録または体組成データがありません' })
    return
  }

  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash-lite',
    generationConfig: { temperature: 0.4 },
  })

  const parts = [
    { text: SYSTEM },
    { text: buildContext(days, goals, body.latest ?? null, body.previous ?? null) },
  ]

  const MAX_ATTEMPTS = 3
  let lastError: unknown
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      const result = await model.generateContent(parts)
      res.status(200).json({ advice: result.response.text() })
      return
    } catch (e) {
      lastError = e
      const msg = String(e)
      const isRetryable = msg.includes('503') || msg.includes('Service Unavailable') || msg.includes('high demand') || msg.includes('overloaded')
      if (attempt < MAX_ATTEMPTS - 1 && isRetryable) {
        await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)))
        continue
      }
      break
    }
  }
  res.status(502).json({ error: String(lastError) })
}
