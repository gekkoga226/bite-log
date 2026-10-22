import { GoogleGenerativeAI, SchemaType, type ModelParams } from '@google/generative-ai'

const PROMPT = `あなたは管理栄養士です。提供された食事の写真・メモ・備考から、1食分の栄養を推定してください。
写真が複数枚ある場合は、それらすべてを合わせて1食分として扱ってください。

【最重要】itemsには、メモ・備考に書かれている物と、写真に実際に写っている物だけを入れてください。
書かれても写ってもいない料理（ご飯・汁物・おかずなど）を推測で付け足してはいけません。
例えばメモが「バナナ」だけで写真が無ければ、itemsはバナナ1行だけです。

次の手順で推定し、itemsに料理・食材ごとに1行ずつ出力してください（合計はシステム側で計算するので不要です）。
1. 対象の料理・食材を洗い出す。写真がある場合は、写っているご飯・汁物・ソース・ドレッシング・調理油・飲み物も見落とさない
2. 量をグラムで見積もる（amountには「茶碗1杯」「中1本」など目安も書く）。写真があれば食器の大きさや一緒に写っている物と比べる。量の記載が無ければ一般的な1人前とする
3. 日本食品標準成分表の値をもとに、その量でのカロリー・タンパク質・脂質・炭水化物を計算する。揚げ物・炒め物は吸油分も含める
備考に店名・メニュー名がある場合は、その公式の栄養成分値を最優先で使用してください（その場合はメニュー単位で1行にしてよい）。

commentは「itemsの料理名をカンマ区切りで列挙し、' : ' の後に栄養バランスの評価と改善提案を述べる」形式で、日本語100字以内にしてください。
commentで列挙する料理名はitemsと完全に一致させてください。`

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
  const generationConfig: Omit<ModelParams, 'model'> = {
    generationConfig: {
      temperature: 0,
      responseMimeType: 'application/json',
      responseSchema: {
        type: SchemaType.OBJECT,
        properties: {
          items: {
            type: SchemaType.ARRAY,
            items: {
              type: SchemaType.OBJECT,
              properties: {
                name: { type: SchemaType.STRING },
                amount: { type: SchemaType.STRING },
                grams: { type: SchemaType.NUMBER },
                calories: { type: SchemaType.NUMBER },
                protein: { type: SchemaType.NUMBER },
                fat: { type: SchemaType.NUMBER },
                carbs: { type: SchemaType.NUMBER },
              },
              required: ['name', 'amount', 'grams', 'calories', 'protein', 'fat', 'carbs'],
              // 量を見積もってから栄養素を出させるため、生成順を固定する
              propertyOrdering: ['name', 'amount', 'grams', 'calories', 'protein', 'fat', 'carbs'],
            },
          },
          comment: { type: SchemaType.STRING },
        },
        required: ['items', 'comment'],
        propertyOrdering: ['items', 'comment'],
      } as any,
    },
  }

  const parts: any[] = [
    { text: PROMPT },
    {
      text:
        `--- ここから利用者の入力 ---\n` +
        `メモ: ${body.memo?.trim() || '（なし）'}\n` +
        `備考: ${body.note?.trim() || '（なし）'}\n` +
        `写真: ${images.length > 0 ? `${images.length}枚（以下に添付）` : 'なし'}`,
    },
  ]
  for (const img of images) {
    parts.push({ inlineData: { data: img.base64, mimeType: img.mimeType } })
  }

  // 混雑(503等)時は同じモデルで再試行し、それでもダメなら別モデルにフォールバック
  const MODELS = ['gemini-2.5-flash', 'gemini-2.5-flash-lite']
  const ATTEMPTS_PER_MODEL = 2
  let lastError: unknown
  for (const modelName of MODELS) {
    const model = genAI.getGenerativeModel({ model: modelName, ...generationConfig })
    for (let attempt = 0; attempt < ATTEMPTS_PER_MODEL; attempt++) {
      try {
        const result = await model.generateContent(parts)
        res.status(200).json({ raw: JSON.stringify(sumItems(JSON.parse(result.response.text()))) })
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

interface FoodItem {
  name: string
  amount: string
  grams: number
  calories: number
  protein: number
  fat: number
  carbs: number
}

// 品目ごとの推定値を合計する（合計をAIに計算させると足し算を間違えることがあるため）
function sumItems(obj: { items?: FoodItem[]; comment?: string }) {
  const items = obj.items ?? []
  const total = (key: 'calories' | 'protein' | 'fat' | 'carbs') =>
    items.reduce((acc, item) => acc + (Number(item[key]) || 0), 0)
  return {
    calories: total('calories'),
    protein: total('protein'),
    fat: total('fat'),
    carbs: total('carbs'),
    comment: obj.comment ?? '',
    items,
  }
}
