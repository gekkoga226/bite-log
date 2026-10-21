import { GoogleGenerativeAI, SchemaType, type ModelParams } from '@google/generative-ai'

const PROMPT = `あなたはInBodyなどの体組成計の結果用紙を読み取るOCRアシスタントです。
提供された写真から以下の数値を読み取り、JSONで返してください。
- weight: 体重（kg）
- bodyFatPercent: 体脂肪率（%）
- muscleMass: 骨格筋量（kg）。InBodyの結果用紙では右下「研究項目」欄の「骨格筋量」（体重の4〜5割程度の値）。体成分分析表の「筋肉量」（体重の7〜8割の値）とは別の項目なので使わない
- bmi: BMI
- basalMetabolism: 基礎代謝量（kcal）
- bodyFatMass: 体脂肪量（kg）
読み取れない項目は 0 にしてください。数値のみを返し、単位は含めないでください。`

interface ImagePart {
  base64: string
  mimeType: string
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

  const body = req.body as { images?: ImagePart[] }
  const images: ImagePart[] = body.images ?? []
  if (images.length === 0) {
    res.status(400).json({ error: 'no image provided' })
    return
  }

  const genAI = new GoogleGenerativeAI(apiKey)
  const generationConfig: Omit<ModelParams, 'model'> = {
    generationConfig: {
      temperature: 0,
      responseMimeType: 'application/json',
      responseSchema: {
        type: SchemaType.OBJECT,
        properties: {
          weight: { type: SchemaType.NUMBER },
          bodyFatPercent: { type: SchemaType.NUMBER },
          muscleMass: { type: SchemaType.NUMBER },
          bmi: { type: SchemaType.NUMBER },
          basalMetabolism: { type: SchemaType.NUMBER },
          bodyFatMass: { type: SchemaType.NUMBER },
        },
        required: ['weight', 'bodyFatPercent', 'muscleMass', 'bmi', 'basalMetabolism', 'bodyFatMass'],
      },
    },
  }

  const parts: any[] = [{ text: PROMPT }]
  for (const img of images) {
    parts.push({ inlineData: { data: img.base64, mimeType: img.mimeType } })
  }

  // 混雑(503等)時は同じモデルで再試行し、それでもダメなら別モデルにフォールバック
  const MODELS = ['gemini-2.5-flash-lite', 'gemini-2.5-flash']
  const ATTEMPTS_PER_MODEL = 2
  let lastError: unknown
  for (const modelName of MODELS) {
    const model = genAI.getGenerativeModel({ model: modelName, ...generationConfig })
    for (let attempt = 0; attempt < ATTEMPTS_PER_MODEL; attempt++) {
      try {
        const result = await model.generateContent(parts)
        res.status(200).json({ raw: result.response.text() })
        return
      } catch (e) {
        lastError = e
        if (!isOverloaded(e)) {
          res.status(502).json({ error: String(e) })
          return
        }
        if (attempt < ATTEMPTS_PER_MODEL - 1) await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)))
      }
    }
  }
  res.status(503).json({
    error: `AIサーバーが混雑しています。少し時間をおいて再度お試しください。(${String(lastError)})`,
  })
}

function isOverloaded(e: unknown): boolean {
  const msg = String(e)
  return (
    msg.includes('503') || msg.includes('Service Unavailable') ||
    msg.includes('high demand') || msg.includes('overloaded') ||
    msg.includes('[500') || msg.includes('Internal Server Error')
  )
}
