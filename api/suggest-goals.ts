import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai'

interface Goals { calories: number; protein: number; fat: number; carbs: number }
interface Inbody {
  weight: number; bodyFatPercent: number; muscleMass: number
  basalMetabolism: number; bodyFatMass: number
}
interface MealAvg { calories: number; protein: number; fat: number; carbs: number }
interface Targets {
  bodyFatPercent?: number | null
  weight?: number | null
  muscleMass?: number | null
  deadlineMonths: number
}

const SYSTEM = `あなたは管理栄養士兼スポーツ栄養の専門家です。
利用者のデータをもとに、1日の食事目標（カロリー・PFC）を科学的に算出してください。

【算出の手順】
1. カロリー目標
   - TDEE = 基礎代謝量 × 1.35（座位中心の生活を想定）
   - 体脂肪の削減目標がある場合:
       減らすべき体脂肪量(kg) = 現在の体脂肪量 − 目標体脂肪量
       1日のカロリー赤字 = 減らすべき体脂肪量 × 7700 ÷ (達成期限の週数)
       1日のカロリー赤字の安全上限は750 kcal（週0.75kg減相当）
   - 目標カロリー = TDEE − カロリー赤字（最小1000 kcalを下回らない）
   - 体脂肪・体重の目標が未設定の場合はTDEEをそのまま使用

2. タンパク質 (g)
   - 骨格筋量の目標がある場合は目標骨格筋量 × 2.2g/kg
   - それ以外は体重（または目標体重）× 1.8g/kg
   - 端数は切り上げ

3. 脂質 (g)
   - 体重 × 0.8g/kg を最低値とし、目標カロリーの25〜30%以内に収める

4. 炭水化物 (g)
   - (目標カロリー − タンパク質 × 4 − 脂質 × 9) ÷ 4
   - 50g を下回る場合は50gに切り上げ（ケトジェニックは想定しない）

5. 未設定の目標は「現状維持」として扱い、余裕のある設定にする

reasoning は200字以内、計算根拠の数値を具体的に示す日本語テキスト。`

function buildContext(
  current: Goals,
  inbody: Inbody | null,
  mealAvg: MealAvg | null,
  targets: Targets,
): string {
  const lines: string[] = []
  lines.push(`【現在の食事目標】${current.calories}kcal / P${current.protein}g F${current.fat}g C${current.carbs}g`)

  if (inbody) {
    lines.push(
      `【最新のInBody】体重${inbody.weight}kg / 体脂肪率${inbody.bodyFatPercent}% / 骨格筋量${inbody.muscleMass}kg / 基礎代謝${inbody.basalMetabolism}kcal / 体脂肪量${inbody.bodyFatMass}kg`,
    )
  } else {
    lines.push('【InBodyデータ】なし（標準的な推定式を使用してください）')
  }

  if (mealAvg) {
    lines.push(
      `【直近の1日平均摂取量】${Math.round(mealAvg.calories)}kcal / P${Math.round(mealAvg.protein)}g F${Math.round(mealAvg.fat)}g C${Math.round(mealAvg.carbs)}g`,
    )
  } else {
    lines.push('【直近の食事記録】なし')
  }

  const deadline = targets.deadlineMonths
  lines.push(`【達成期限】${deadline}ヶ月（約${Math.round(deadline * 4.33)}週）`)

  const targetLines: string[] = []
  if (targets.bodyFatPercent != null) targetLines.push(`体脂肪率: ${targets.bodyFatPercent}%`)
  else targetLines.push('体脂肪率: 現状維持')
  if (targets.weight != null) targetLines.push(`体重: ${targets.weight}kg`)
  else targetLines.push('体重: 現状維持')
  if (targets.muscleMass != null) targetLines.push(`骨格筋量: ${targets.muscleMass}kg`)
  else targetLines.push('骨格筋量: 現状維持')
  lines.push(`【体組成目標】${targetLines.join(' / ')}`)

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
    current?: Goals
    inbody?: Inbody | null
    mealAvg?: MealAvg | null
    targets?: Targets
  }
  const current = body.current ?? { calories: 1800, protein: 93, fat: 42, carbs: 195 }
  const targets = body.targets ?? { deadlineMonths: 3 }
  if (!targets.deadlineMonths || targets.deadlineMonths <= 0) targets.deadlineMonths = 3

  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-pro',
    generationConfig: {
      temperature: 0,
      responseMimeType: 'application/json',
      responseSchema: {
        type: SchemaType.OBJECT,
        properties: {
          calories: { type: SchemaType.NUMBER },
          protein: { type: SchemaType.NUMBER },
          fat: { type: SchemaType.NUMBER },
          carbs: { type: SchemaType.NUMBER },
          reasoning: { type: SchemaType.STRING },
        },
        required: ['calories', 'protein', 'fat', 'carbs', 'reasoning'],
      },
    },
  })

  const parts = [
    { text: SYSTEM },
    { text: buildContext(current, body.inbody ?? null, body.mealAvg ?? null, targets) },
  ]

  const MAX_ATTEMPTS = 3
  let lastError: unknown
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      const result = await model.generateContent(parts)
      res.status(200).json(JSON.parse(result.response.text()))
      return
    } catch (e) {
      lastError = e
      const msg = String(e)
      const isRetryable =
        msg.includes('503') || msg.includes('Service Unavailable') ||
        msg.includes('high demand') || msg.includes('overloaded')
      if (attempt < MAX_ATTEMPTS - 1 && isRetryable) {
        await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)))
        continue
      }
      break
    }
  }
  res.status(502).json({ error: String(lastError) })
}
