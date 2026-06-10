import { GoogleGenerativeAI } from '@google/generative-ai'

const PROMPT = `あなたは栄養士です。提供された食事の写真とメモから、1食分の栄養を推定してください。
備考に店名・メニュー名・正確なカロリーがある場合はそれを最優先で反映してください。
必ず以下のJSON形式のみで答えてください（説明文やコードフェンスは不要）:
{"calories": 数値, "protein": 数値(g), "fat": 数値(g), "carbs": 数値(g), "comment": "一言コメント(日本語50字以内)"}`

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
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

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
