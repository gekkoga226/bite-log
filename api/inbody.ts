import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai'

const PROMPT = `あなたはInBodyなどの体組成計の結果用紙を読み取るOCRアシスタントです。
提供された写真から以下の数値を読み取り、JSONで返してください。
- weight: 体重（kg）
- bodyFatPercent: 体脂肪率（%）
- muscleMass: 骨格筋量（kg）。「骨格筋量」が無ければ「筋肉量」を使う
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
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash-lite',
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
  })

  const parts: any[] = [{ text: PROMPT }]
  for (const img of images) {
    parts.push({ inlineData: { data: img.base64, mimeType: img.mimeType } })
  }

  const MAX_ATTEMPTS = 3
  let lastError: unknown
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      const result = await model.generateContent(parts)
      res.status(200).json({ raw: result.response.text() })
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
