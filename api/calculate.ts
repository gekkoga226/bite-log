import { GoogleGenerativeAI } from '@google/generative-ai'

const PROMPT = `あなたは栄養士です。提供された食事の写真とメモから、1食分の栄養を推定してください。
備考に店名・メニュー名がある場合は公式の栄養成分値を最優先で使用してください。
commentは日本語50字以内の一言コメントにしてください。`

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

  const body = req.body as { memo?: string; note?: string; imageBase64?: string; mimeType?: string }
  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: {
      temperature: 0,
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'OBJECT' as any,
        properties: {
          calories: { type: 'NUMBER' as any },
          protein: { type: 'NUMBER' as any },
          fat: { type: 'NUMBER' as any },
          carbs: { type: 'NUMBER' as any },
          comment: { type: 'STRING' as any },
        },
        required: ['calories', 'protein', 'fat', 'carbs', 'comment'],
      } as any,
    },
  })

  const parts: any[] = [
    { text: PROMPT },
    { text: `メモ: ${body.memo ?? ''}\n備考: ${body.note ?? ''}` },
  ]
  if (body.imageBase64 && body.mimeType) {
    parts.push({ inlineData: { data: body.imageBase64, mimeType: body.mimeType } })
  }

  try {
    const result = await model.generateContent(parts)
    const text = result.response.text()
    res.status(200).json({ raw: text })
  } catch (e) {
    res.status(502).json({ error: String(e) })
  }
}
