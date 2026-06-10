import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai'

const PROMPT = `あなたは管理栄養士です。提供された食事の写真・メモ・備考から、1食分の栄養を推定してください。
写真が複数枚ある場合は、それらすべてを合わせて1食分として合算してください。
備考に店名・メニュー名がある場合は、その公式の栄養成分値を最優先で使用してください。
commentは「食材を列挙し、栄養バランスの評価と改善提案を述べる」形式で、日本語100字以内にしてください。
例: 「白米, 鮭のホイル焼き, 納豆, 味噌汁 : タンパク質源が豊富で栄養バランスが良いです。副菜に緑黄色野菜や海藻類を追加しましょう。」`

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

  const body = req.body as {
    memo?: string
    note?: string
    images?: ImagePart[]
    imageBase64?: string
    mimeType?: string
  }

  // 後方互換: 単一画像も配列に正規化
  const images: ImagePart[] = body.images ?? []
  if (body.imageBase64 && body.mimeType) {
    images.push({ base64: body.imageBase64, mimeType: body.mimeType })
  }

  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
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
          comment: { type: SchemaType.STRING },
        },
        required: ['calories', 'protein', 'fat', 'carbs', 'comment'],
      },
    },
  })

  const parts: any[] = [
    { text: PROMPT },
    { text: `メモ: ${body.memo ?? ''}\n備考: ${body.note ?? ''}` },
  ]
  for (const img of images) {
    parts.push({ inlineData: { data: img.base64, mimeType: img.mimeType } })
  }

  try {
    const result = await model.generateContent(parts)
    const text = result.response.text()
    res.status(200).json({ raw: text })
  } catch (e) {
    res.status(502).json({ error: String(e) })
  }
}
