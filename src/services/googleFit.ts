import type { MealType } from '../types'

const BASE = 'https://www.googleapis.com/fitness/v1/users/me'
const PKG = 'app.bitelog.pwa'
const STREAM_NAME = 'bite-log-nutrition'
const DS_CACHE_KEY = 'bite-log-fit-datasource-id'

const MEAL_INT: Partial<Record<MealType, number>> = {
  朝食: 1,
  昼食: 2,
  夕食: 3,
  間食: 4,
}

async function getDataSourceId(token: string): Promise<string> {
  const cached = localStorage.getItem(DS_CACHE_KEY)
  if (cached) return cached

  // データソースを新規作成
  const createRes = await fetch(`${BASE}/dataSources`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      dataStreamName: STREAM_NAME,
      type: 'derived',
      application: { packageName: PKG, name: 'Bite-Log', version: '1' },
      dataType: { name: 'com.google.nutrition' },
    }),
  })

  if (createRes.ok) {
    const data = (await createRes.json()) as { dataStreamId: string }
    localStorage.setItem(DS_CACHE_KEY, data.dataStreamId)
    return data.dataStreamId
  }

  // 409 = すでに存在 → 一覧から取得
  if (createRes.status === 409) {
    const listRes = await fetch(
      `${BASE}/dataSources?dataTypeName=com.google.nutrition`,
      { headers: { Authorization: `Bearer ${token}` } },
    )
    if (!listRes.ok) throw new Error(`Google Fit list failed: ${listRes.status}`)
    const list = (await listRes.json()) as { dataSource?: { dataStreamId: string; application?: { packageName?: string }; dataStreamName?: string }[] }
    const src = list.dataSource?.find(
      (s) => s.application?.packageName === PKG && s.dataStreamName === STREAM_NAME,
    )
    if (!src) throw new Error('Google Fit data source not found after 409')
    localStorage.setItem(DS_CACHE_KEY, src.dataStreamId)
    return src.dataStreamId
  }

  throw new Error(`Google Fit createDataSource failed: ${createRes.status}`)
}

export interface FitNutritionInput {
  timestamp: string
  mealType: MealType
  calories: number
  protein: number
  fat: number
  carbs: number
}

export async function logNutritionToFit(token: string, input: FitNutritionInput): Promise<void> {
  const dataSourceId = await getDataSourceId(token)

  // BigInt でナノ秒計算（Dateミリ秒 × 1,000,000）
  const ms = BigInt(new Date(input.timestamp).getTime())
  const startNs = (ms * 1_000_000n).toString()
  const endNs = (ms * 1_000_000n + 1_800_000_000_000n).toString() // 30分
  const datasetId = `${startNs}-${endNs}`

  const res = await fetch(
    `${BASE}/dataSources/${encodeURIComponent(dataSourceId)}/datasets/${datasetId}`,
    {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        minStartTimeNs: startNs,
        maxEndTimeNs: endNs,
        dataSourceId,
        point: [
          {
            startTimeNanos: startNs,
            endTimeNanos: endNs,
            dataTypeName: 'com.google.nutrition',
            value: [
              {
                mapVal: [
                  { key: 'calories', value: { fpVal: input.calories } },
                  { key: 'protein', value: { fpVal: input.protein } },
                  { key: 'fat.total', value: { fpVal: input.fat } },
                  { key: 'carbs.total', value: { fpVal: input.carbs } },
                ],
              },
              { intVal: MEAL_INT[input.mealType] ?? 4 },
            ],
          },
        ],
      }),
    },
  )

  if (!res.ok) throw new Error(`Google Fit sync failed: ${res.status}`)
}
