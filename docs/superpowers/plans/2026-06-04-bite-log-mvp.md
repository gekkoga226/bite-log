# Bite-Log MVP (Phase 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** iPhoneのSafariからホーム画面に追加して使える食事記録PWAのMVPを構築する。写真/テキストで食事を記録し、Gemini APIがカロリー・PFCを計算、Google Sheetsに保存し、「今日」タブで当日の摂取状況を確認できる。

**Architecture:** Vite + React + TypeScript のクライアントサイドPWA。Google Identity Services でユーザー認証し、ユーザー自身のOAuthトークンで Google Sheets / Drive に直接読み書きする。Gemini API呼び出しのみ Vercel サーバーレス関数 (`/api/calculate`) 経由とし、APIキーをサーバー側に秘匿する。

**Tech Stack:** Vite, React 18, TypeScript, Tailwind CSS, vite-plugin-pwa, Google Identity Services (GIS), Google Sheets API v4, Google Drive API v3, Gemini API (`@google/generative-ai`), Vitest + React Testing Library, Vercel (ホスティング + Functions)。

---

## アーキテクチャ決定事項

- **認証/データアクセス**: Google OAuth (GIS) のアクセストークンを使い、ブラウザから Sheets/Drive を直接操作。トークンはユーザー自身に紐づくため、APIキー秘匿の問題がない。
- **Gemini呼び出し**: Vercel Function 経由。`GEMINI_API_KEY` は環境変数でサーバー側のみ保持。
- **アクセス制限**: ログイン後、メールアドレスが許可リスト（`VITE_ALLOWED_EMAIL`）と一致しない場合はアクセス拒否。
- **データ保存先**: 既存スプレッドシート内に新しいタブ `meals_v2` を作成し、構造化スキーマで保存。既存のフォーム回答シート・Looker Studioは壊さない。
- **テスト方針**: 純粋ロジック（食事タイプ判定、当日集計、Geminiレスポンスのパース）はVitestでTDD。UIコンポーネントはReact Testing Libraryで主要な振る舞いを検証。視覚要素は手動確認ステップを設ける。

## ファイル構成

```
bite-log/
├── api/
│   └── calculate.ts              # Vercel Function: Gemini呼び出し
├── public/
│   ├── manifest.webmanifest      # PWAマニフェスト
│   └── icons/                    # アプリアイコン
├── src/
│   ├── main.tsx                  # エントリポイント
│   ├── App.tsx                   # ルーティング + 認証ガード
│   ├── index.css                 # Tailwind読み込み
│   ├── auth/
│   │   ├── useAuth.ts            # GIS認証フック
│   │   └── AuthGuard.tsx         # 未認証/未許可をブロック
│   ├── lib/
│   │   ├── mealType.ts          # 時間帯→食事タイプ判定（純粋関数）
│   │   ├── parseGemini.ts       # Geminiレスポンスのパース（純粋関数）
│   │   ├── aggregate.ts         # 当日集計（純粋関数）
│   │   └── date.ts              # 日付ユーティリティ（純粋関数）
│   ├── services/
│   │   ├── sheets.ts            # Google Sheets read/write
│   │   ├── drive.ts             # Google Drive 画像アップロード
│   │   └── calculate.ts         # /api/calculate 呼び出し
│   ├── types.ts                  # 共通型定義
│   ├── components/
│   │   ├── BottomNav.tsx        # 下部ナビ
│   │   ├── RecordForm.tsx       # 食事記録フォーム
│   │   ├── CalorieCard.tsx      # カロリーカード
│   │   ├── PfcBars.tsx          # PFCバー
│   │   └── MealList.tsx         # 食事一覧
│   └── screens/
│       ├── TodayScreen.tsx      # 今日タブ
│       └── RecordScreen.tsx     # 記録画面
├── .env.example
├── index.html
├── package.json
├── tailwind.config.js
├── tsconfig.json
├── vite.config.ts
└── vitest.config.ts
```

---

## 前提作業（ユーザーが事前に用意するもの）

実装開始前に、以下をユーザーと一緒に準備する。実装エージェントはTask 1着手前にこれらが揃っているか確認すること。

1. **Google Cloud プロジェクト**: OAuth 2.0 クライアントID（ウェブアプリ）を作成。承認済みオリジンに `http://localhost:5173` と本番URLを追加。
2. **有効化API**: Google Sheets API, Google Drive API。
3. **Gemini APIキー**: Google AI Studio で取得。
4. **既存スプレッドシートID**: `1KLnSNA6YA332a--jDzpA58XLjJY2lGo8i4-qM-erzuY`
5. **Drive保存先フォルダID**: 食事写真を入れるフォルダを作成しID取得。

これらを `.env.local` に設定する（Task 1で雛形作成）。

---

## Task 1: プロジェクト雛形とビルド環境

**Files:**
- Create: `package.json`, `vite.config.ts`, `vitest.config.ts`, `tsconfig.json`, `tailwind.config.js`, `postcss.config.js`, `index.html`, `src/main.tsx`, `src/App.tsx`, `src/index.css`, `.env.example`, `.gitignore`

- [ ] **Step 1: Viteプロジェクトを初期化**

Run:
```bash
cd /c/Users/mizuk/work/bite-log
npm create vite@latest . -- --template react-ts
```
プロンプトで「ディレクトリが空でない」と出たら "Ignore files and continue" を選択（既存の `docs/` `.superpowers/` を残す）。

- [ ] **Step 2: 依存パッケージをインストール**

Run:
```bash
npm install
npm install -D tailwindcss postcss autoprefixer vite-plugin-pwa vitest @testing-library/react @testing-library/jest-dom jsdom @vitejs/plugin-react
npm install @google/generative-ai
npx tailwindcss init -p
```

- [ ] **Step 3: Tailwind設定を書く**

`tailwind.config.js`:
```js
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: { DEFAULT: '#007AFF', accent: '#5856D6' },
      },
    },
  },
  plugins: [],
}
```

`src/index.css`:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

html, body, #root { height: 100%; }
body {
  font-family: -apple-system, BlinkMacSystemFont, 'Hiragino Sans', sans-serif;
  background: #F5F5F7;
  color: #1C1C1E;
  margin: 0;
}
```

- [ ] **Step 4: vite.config.ts と vitest.config.ts を書く**

`vite.config.ts`:
```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Bite-Log',
        short_name: 'Bite-Log',
        start_url: '/',
        display: 'standalone',
        background_color: '#F5F5F7',
        theme_color: '#007AFF',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
    }),
  ],
})
```

`vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test-setup.ts',
  },
})
```

`src/test-setup.ts`:
```ts
import '@testing-library/jest-dom'
```

- [ ] **Step 5: .env.example と .gitignore を整える**

`.env.example`:
```
VITE_GOOGLE_CLIENT_ID=your-oauth-client-id.apps.googleusercontent.com
VITE_ALLOWED_EMAIL=mizuko226@gmail.com
VITE_SPREADSHEET_ID=1KLnSNA6YA332a--jDzpA58XLjJY2lGo8i4-qM-erzuY
VITE_DRIVE_FOLDER_ID=your-drive-folder-id
GEMINI_API_KEY=your-gemini-api-key
```

`.gitignore` に追記:
```
.env.local
.superpowers/
node_modules
dist
```

ユーザーは `.env.example` をコピーして `.env.local` を作り実値を入れる。

- [ ] **Step 6: package.json のscriptsを確認・追記**

`package.json` の `scripts` に以下があること:
```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

- [ ] **Step 7: 開発サーバーが起動することを確認**

Run: `npm run dev`
Expected: `http://localhost:5173` でViteのデフォルト画面が表示される。確認後 Ctrl+C で停止。

- [ ] **Step 8: コミット**

```bash
git add -A
git commit -m "chore: scaffold Vite + React + TS + Tailwind + PWA project"
```

---

## Task 2: 共通型定義

**Files:**
- Create: `src/types.ts`

- [ ] **Step 1: 型を定義**

`src/types.ts`:
```ts
export type MealType = '朝食' | '昼食' | '夕食' | '間食'

/** Gemini計算結果（1食分の栄養素） */
export interface Nutrition {
  calories: number
  protein: number   // g
  fat: number       // g
  carbs: number     // g
  comment: string   // AIコメント
}

/** Sheetsに保存する1行分 */
export interface MealRecord {
  timestamp: string   // ISO8601
  date: string        // YYYY-MM-DD
  mealType: MealType
  photoUrl: string    // 空文字可
  memo: string
  note: string        // 備考
  calories: number
  protein: number
  fat: number
  carbs: number
  comment: string
}

/** 当日集計結果 */
export interface DailyTotals {
  calories: number
  protein: number
  fat: number
  carbs: number
  byType: Record<MealType, number>  // 食事タイプ別カロリー
}
```

- [ ] **Step 2: TypeScriptが通ることを確認**

Run: `npx tsc --noEmit`
Expected: エラーなし

- [ ] **Step 3: コミット**

```bash
git add src/types.ts
git commit -m "feat: add shared type definitions"
```

---

## Task 3: 日付ユーティリティ（TDD）

**Files:**
- Create: `src/lib/date.ts`
- Test: `src/lib/date.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/date.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { toDateString, isSameDay } from './date'

describe('toDateString', () => {
  it('formats a Date as YYYY-MM-DD in local time', () => {
    const d = new Date(2026, 5, 4, 13, 25) // 2026-06-04 13:25 local
    expect(toDateString(d)).toBe('2026-06-04')
  })

  it('pads single-digit month and day', () => {
    const d = new Date(2026, 0, 9, 0, 0)
    expect(toDateString(d)).toBe('2026-01-09')
  })
})

describe('isSameDay', () => {
  it('returns true for same local day', () => {
    expect(isSameDay('2026-06-04', new Date(2026, 5, 4, 23, 59))).toBe(true)
  })
  it('returns false for different day', () => {
    expect(isSameDay('2026-06-04', new Date(2026, 5, 5, 0, 1))).toBe(false)
  })
})
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npm test -- date`
Expected: FAIL（`toDateString` が未定義）

- [ ] **Step 3: 最小実装を書く**

`src/lib/date.ts`:
```ts
export function toDateString(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function isSameDay(dateString: string, d: Date): boolean {
  return toDateString(d) === dateString
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npm test -- date`
Expected: PASS（4テスト）

- [ ] **Step 5: コミット**

```bash
git add src/lib/date.ts src/lib/date.test.ts
git commit -m "feat: add date utilities with tests"
```

---

## Task 4: 食事タイプ自動判定（TDD）

**Files:**
- Create: `src/lib/mealType.ts`
- Test: `src/lib/mealType.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/mealType.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { detectMealType } from './mealType'

describe('detectMealType', () => {
  it('returns 朝食 for 5:00-10:59', () => {
    expect(detectMealType(new Date(2026, 5, 4, 7, 0))).toBe('朝食')
  })
  it('returns 昼食 for 11:00-14:59', () => {
    expect(detectMealType(new Date(2026, 5, 4, 12, 30))).toBe('昼食')
  })
  it('returns 夕食 for 17:00-21:59', () => {
    expect(detectMealType(new Date(2026, 5, 4, 19, 0))).toBe('夕食')
  })
  it('returns 間食 for other hours', () => {
    expect(detectMealType(new Date(2026, 5, 4, 15, 0))).toBe('間食')
    expect(detectMealType(new Date(2026, 5, 4, 23, 0))).toBe('間食')
  })
})
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npm test -- mealType`
Expected: FAIL（`detectMealType` が未定義）

- [ ] **Step 3: 最小実装を書く**

`src/lib/mealType.ts`:
```ts
import type { MealType } from '../types'

export function detectMealType(d: Date): MealType {
  const h = d.getHours()
  if (h >= 5 && h < 11) return '朝食'
  if (h >= 11 && h < 15) return '昼食'
  if (h >= 17 && h < 22) return '夕食'
  return '間食'
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npm test -- mealType`
Expected: PASS（4テスト）

- [ ] **Step 5: コミット**

```bash
git add src/lib/mealType.ts src/lib/mealType.test.ts
git commit -m "feat: add meal type auto-detection with tests"
```

---

## Task 5: Geminiレスポンスのパース（TDD）

**Files:**
- Create: `src/lib/parseGemini.ts`
- Test: `src/lib/parseGemini.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/parseGemini.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { parseNutrition } from './parseGemini'

describe('parseNutrition', () => {
  it('parses clean JSON', () => {
    const raw = '{"calories":620,"protein":35,"fat":18,"carbs":70,"comment":"バランス良好"}'
    expect(parseNutrition(raw)).toEqual({
      calories: 620, protein: 35, fat: 18, carbs: 70, comment: 'バランス良好',
    })
  })

  it('strips ```json code fences', () => {
    const raw = '```json\n{"calories":300,"protein":10,"fat":5,"carbs":50,"comment":"間食"}\n```'
    expect(parseNutrition(raw).calories).toBe(300)
  })

  it('rounds numeric fields to integers', () => {
    const raw = '{"calories":619.7,"protein":35.4,"fat":17.9,"carbs":70.1,"comment":"x"}'
    const r = parseNutrition(raw)
    expect(r.calories).toBe(620)
    expect(r.protein).toBe(35)
  })

  it('throws on missing calories field', () => {
    const raw = '{"protein":10}'
    expect(() => parseNutrition(raw)).toThrow()
  })
})
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npm test -- parseGemini`
Expected: FAIL（`parseNutrition` が未定義）

- [ ] **Step 3: 最小実装を書く**

`src/lib/parseGemini.ts`:
```ts
import type { Nutrition } from '../types'

export function parseNutrition(raw: string): Nutrition {
  const cleaned = raw
    .replace(/```json/gi, '')
    .replace(/```/g, '')
    .trim()
  const obj = JSON.parse(cleaned)
  if (typeof obj.calories !== 'number') {
    throw new Error('calories field missing or not a number')
  }
  return {
    calories: Math.round(obj.calories),
    protein: Math.round(obj.protein ?? 0),
    fat: Math.round(obj.fat ?? 0),
    carbs: Math.round(obj.carbs ?? 0),
    comment: String(obj.comment ?? ''),
  }
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npm test -- parseGemini`
Expected: PASS（4テスト）

- [ ] **Step 5: コミット**

```bash
git add src/lib/parseGemini.ts src/lib/parseGemini.test.ts
git commit -m "feat: add Gemini response parser with tests"
```

---

## Task 6: 当日集計ロジック（TDD）

**Files:**
- Create: `src/lib/aggregate.ts`
- Test: `src/lib/aggregate.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/aggregate.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { aggregateDay } from './aggregate'
import type { MealRecord } from '../types'

function rec(p: Partial<MealRecord>): MealRecord {
  return {
    timestamp: '', date: '2026-06-04', mealType: '朝食', photoUrl: '',
    memo: '', note: '', calories: 0, protein: 0, fat: 0, carbs: 0, comment: '',
    ...p,
  }
}

describe('aggregateDay', () => {
  it('sums only records of the target date', () => {
    const records = [
      rec({ date: '2026-06-04', mealType: '朝食', calories: 350, protein: 20, fat: 10, carbs: 40 }),
      rec({ date: '2026-06-04', mealType: '昼食', calories: 620, protein: 35, fat: 18, carbs: 70 }),
      rec({ date: '2026-06-03', mealType: '夕食', calories: 800, protein: 40, fat: 30, carbs: 80 }),
    ]
    const t = aggregateDay(records, '2026-06-04')
    expect(t.calories).toBe(970)
    expect(t.protein).toBe(55)
    expect(t.byType['朝食']).toBe(350)
    expect(t.byType['昼食']).toBe(620)
    expect(t.byType['夕食']).toBe(0)
  })

  it('returns zeros for a day with no records', () => {
    const t = aggregateDay([], '2026-06-04')
    expect(t.calories).toBe(0)
    expect(t.byType['間食']).toBe(0)
  })
})
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npm test -- aggregate`
Expected: FAIL（`aggregateDay` が未定義）

- [ ] **Step 3: 最小実装を書く**

`src/lib/aggregate.ts`:
```ts
import type { MealRecord, DailyTotals, MealType } from '../types'

export function aggregateDay(records: MealRecord[], date: string): DailyTotals {
  const byType: Record<MealType, number> = { 朝食: 0, 昼食: 0, 夕食: 0, 間食: 0 }
  const totals: DailyTotals = { calories: 0, protein: 0, fat: 0, carbs: 0, byType }
  for (const r of records) {
    if (r.date !== date) continue
    totals.calories += r.calories
    totals.protein += r.protein
    totals.fat += r.fat
    totals.carbs += r.carbs
    byType[r.mealType] += r.calories
  }
  return totals
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npm test -- aggregate`
Expected: PASS（2テスト）

- [ ] **Step 5: コミット**

```bash
git add src/lib/aggregate.ts src/lib/aggregate.test.ts
git commit -m "feat: add daily aggregation with tests"
```

---

## Task 7: Gemini呼び出しサーバーレス関数

**Files:**
- Create: `api/calculate.ts`

- [ ] **Step 1: Vercel Functionを書く**

`api/calculate.ts`:
```ts
import { GoogleGenerativeAI } from '@google/generative-ai'

const PROMPT = `あなたは栄養士です。提供された食事の写真とメモから、1食分の栄養を推定してください。
備考に店名・メニュー名・正確なカロリーがある場合はそれを最優先で反映してください。
必ず以下のJSON形式のみで答えてください（説明文やコードフェンスは不要）:
{"calories": 数値, "protein": 数値(g), "fat": 数値(g), "carbs": 数値(g), "comment": "一言コメント(日本語50字以内)"}`

export const config = { runtime: 'nodejs' }

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 })
  }
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'API key not configured' }), { status: 500 })
  }

  const body = (await req.json()) as { memo?: string; note?: string; imageBase64?: string; mimeType?: string }
  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })

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
    return new Response(JSON.stringify({ raw: text }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 502 })
  }
}
```

- [ ] **Step 2: vercel.json でFunctionを認識させる（必要時）**

`vercel.json`:
```json
{
  "functions": {
    "api/calculate.ts": { "maxDuration": 15 }
  }
}
```

- [ ] **Step 3: TypeScriptが通ることを確認**

Run: `npx tsc --noEmit`
Expected: エラーなし

- [ ] **Step 4: コミット**

```bash
git add api/calculate.ts vercel.json
git commit -m "feat: add Gemini serverless function for nutrition calculation"
```

注: このFunctionの実動作確認はTask 13（統合）でVercel環境にデプロイ後に行う。ローカルでは `vercel dev` を使う。

---

## Task 8: calculate サービス（クライアント側）

**Files:**
- Create: `src/services/calculate.ts`
- Test: `src/services/calculate.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`src/services/calculate.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { calculateNutrition } from './calculate'

beforeEach(() => {
  vi.restoreAllMocks()
})

describe('calculateNutrition', () => {
  it('posts to /api/calculate and parses the raw response', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({ raw: '{"calories":500,"protein":25,"fat":15,"carbs":60,"comment":"ok"}' }),
    })) as any)

    const result = await calculateNutrition({ memo: '牛丼', note: '' })
    expect(result.calories).toBe(500)
    expect(fetch).toHaveBeenCalledWith('/api/calculate', expect.objectContaining({ method: 'POST' }))
  })

  it('throws when the API returns an error status', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 502, json: async () => ({}) })) as any)
    await expect(calculateNutrition({ memo: 'x', note: '' })).rejects.toThrow()
  })
})
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npm test -- services/calculate`
Expected: FAIL（`calculateNutrition` が未定義）

- [ ] **Step 3: 最小実装を書く**

`src/services/calculate.ts`:
```ts
import type { Nutrition } from '../types'
import { parseNutrition } from '../lib/parseGemini'

export interface CalculateInput {
  memo: string
  note: string
  imageBase64?: string
  mimeType?: string
}

export async function calculateNutrition(input: CalculateInput): Promise<Nutrition> {
  const res = await fetch('/api/calculate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) {
    throw new Error(`calculate failed: ${res.status}`)
  }
  const data = (await res.json()) as { raw: string }
  return parseNutrition(data.raw)
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npm test -- services/calculate`
Expected: PASS（2テスト）

- [ ] **Step 5: コミット**

```bash
git add src/services/calculate.ts src/services/calculate.test.ts
git commit -m "feat: add client-side calculate service with tests"
```

---

## Task 9: Google認証フック

**Files:**
- Create: `src/auth/useAuth.ts`, `src/auth/AuthGuard.tsx`
- Modify: `index.html`（GISスクリプト読み込み）

- [ ] **Step 1: index.html にGISスクリプトを追加**

`index.html` の `<head>` に追記:
```html
<script src="https://accounts.google.com/gsi/client" async defer></script>
```

- [ ] **Step 2: 認証フックを書く**

`src/auth/useAuth.ts`:
```ts
import { useState, useCallback } from 'react'

const SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/userinfo.email',
].join(' ')

export interface AuthState {
  accessToken: string | null
  email: string | null
}

declare global {
  interface Window {
    google?: any
  }
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({ accessToken: null, email: null })

  const signIn = useCallback(() => {
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
      scope: SCOPES,
      callback: async (resp: { access_token: string }) => {
        const token = resp.access_token
        // メールアドレス取得
        const userRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${token}` },
        })
        const user = (await userRes.json()) as { email: string }
        setState({ accessToken: token, email: user.email })
      },
    })
    client.requestAccessToken()
  }, [])

  const signOut = useCallback(() => {
    setState({ accessToken: null, email: null })
  }, [])

  return { ...state, signIn, signOut }
}
```

- [ ] **Step 3: 認証ガードコンポーネントを書く**

`src/auth/AuthGuard.tsx`:
```tsx
import type { ReactNode } from 'react'
import type { AuthState } from './useAuth'

interface Props {
  auth: AuthState & { signIn: () => void }
  children: ReactNode
}

export function AuthGuard({ auth, children }: Props) {
  const allowed = import.meta.env.VITE_ALLOWED_EMAIL

  if (!auth.accessToken) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-6 px-8">
        <h1 className="text-3xl font-extrabold">🍽️ Bite-Log</h1>
        <p className="text-gray-500 text-sm">ログインして食事記録を始めましょう</p>
        <button
          onClick={auth.signIn}
          className="bg-brand text-white rounded-xl px-6 py-3 font-semibold"
        >
          Googleでログイン
        </button>
      </div>
    )
  }

  if (auth.email !== allowed) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 px-8">
        <p className="text-red-500 font-semibold">このアカウントはアクセスできません</p>
        <p className="text-gray-500 text-sm">{auth.email}</p>
      </div>
    )
  }

  return <>{children}</>
}
```

- [ ] **Step 4: AuthGuardのレンダリングテストを書く**

`src/auth/AuthGuard.test.tsx`:
```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AuthGuard } from './AuthGuard'

const allowed = import.meta.env.VITE_ALLOWED_EMAIL ?? 'mizuko226@gmail.com'

describe('AuthGuard', () => {
  it('shows login button when not authenticated', () => {
    render(
      <AuthGuard auth={{ accessToken: null, email: null, signIn: vi.fn() }}>
        <div>secret</div>
      </AuthGuard>
    )
    expect(screen.getByText('Googleでログイン')).toBeInTheDocument()
    expect(screen.queryByText('secret')).not.toBeInTheDocument()
  })

  it('renders children when email matches allowlist', () => {
    render(
      <AuthGuard auth={{ accessToken: 'tok', email: allowed, signIn: vi.fn() }}>
        <div>secret</div>
      </AuthGuard>
    )
    expect(screen.getByText('secret')).toBeInTheDocument()
  })
})
```

注: テスト実行のため `.env.local` か `vitest.config.ts` の `define` で `VITE_ALLOWED_EMAIL` を渡すこと。テストを安定させるため `vitest.config.ts` に追記:
```ts
// defineConfig の test の隣に:
define: { 'import.meta.env.VITE_ALLOWED_EMAIL': JSON.stringify('mizuko226@gmail.com') },
```

- [ ] **Step 5: テストが通ることを確認**

Run: `npm test -- AuthGuard`
Expected: PASS（2テスト）

- [ ] **Step 6: コミット**

```bash
git add src/auth/ index.html vitest.config.ts
git commit -m "feat: add Google OAuth hook and auth guard with tests"
```

---

## Task 10: Google Sheets サービス

**Files:**
- Create: `src/services/sheets.ts`
- Test: `src/services/sheets.test.ts`

スプレッドシートのタブ `meals_v2` に以下の列順で1行ずつ追記する:
`timestamp, date, mealType, photoUrl, memo, note, calories, protein, fat, carbs, comment`

- [ ] **Step 1: 失敗するテストを書く（行⇔オブジェクト変換）**

`src/services/sheets.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { recordToRow, rowToRecord } from './sheets'
import type { MealRecord } from '../types'

const sample: MealRecord = {
  timestamp: '2026-06-04T13:25:00.000Z',
  date: '2026-06-04',
  mealType: '昼食',
  photoUrl: 'https://drive/x',
  memo: 'チキンサラダ',
  note: 'セブン',
  calories: 620, protein: 35, fat: 18, carbs: 70, comment: 'バランス良好',
}

describe('recordToRow / rowToRecord', () => {
  it('converts a record to a row array in column order', () => {
    expect(recordToRow(sample)).toEqual([
      '2026-06-04T13:25:00.000Z', '2026-06-04', '昼食', 'https://drive/x',
      'チキンサラダ', 'セブン', 620, 35, 18, 70, 'バランス良好',
    ])
  })

  it('round-trips row -> record', () => {
    const row = recordToRow(sample)
    expect(rowToRecord(row.map(String))).toEqual(sample)
  })
})
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npm test -- services/sheets`
Expected: FAIL（`recordToRow` が未定義）

- [ ] **Step 3: 実装を書く（変換 + API呼び出し）**

`src/services/sheets.ts`:
```ts
import type { MealRecord, MealType } from '../types'

const SHEET_NAME = 'meals_v2'
const SPREADSHEET_ID = import.meta.env.VITE_SPREADSHEET_ID

export function recordToRow(r: MealRecord): (string | number)[] {
  return [
    r.timestamp, r.date, r.mealType, r.photoUrl,
    r.memo, r.note, r.calories, r.protein, r.fat, r.carbs, r.comment,
  ]
}

export function rowToRecord(cells: string[]): MealRecord {
  return {
    timestamp: cells[0] ?? '',
    date: cells[1] ?? '',
    mealType: (cells[2] as MealType) ?? '間食',
    photoUrl: cells[3] ?? '',
    memo: cells[4] ?? '',
    note: cells[5] ?? '',
    calories: Number(cells[6] ?? 0),
    protein: Number(cells[7] ?? 0),
    fat: Number(cells[8] ?? 0),
    carbs: Number(cells[9] ?? 0),
    comment: cells[10] ?? '',
  }
}

export async function appendMeal(token: string, record: MealRecord): Promise<void> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${SHEET_NAME}!A:K:append?valueInputOption=USER_ENTERED`
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ values: [recordToRow(record)] }),
  })
  if (!res.ok) throw new Error(`appendMeal failed: ${res.status}`)
}

export async function fetchMeals(token: string): Promise<MealRecord[]> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${SHEET_NAME}!A2:K`
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) throw new Error(`fetchMeals failed: ${res.status}`)
  const data = (await res.json()) as { values?: string[][] }
  return (data.values ?? []).map(rowToRecord)
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npm test -- services/sheets`
Expected: PASS（2テスト）

- [ ] **Step 5: コミット**

```bash
git add src/services/sheets.ts src/services/sheets.test.ts
git commit -m "feat: add Google Sheets service with row conversion tests"
```

注: `meals_v2` タブはユーザーが手動で作成し、1行目に上記11列のヘッダーを入れておく。実装エージェントはユーザーに依頼すること。

---

## Task 11: Google Drive 画像アップロードサービス

**Files:**
- Create: `src/services/drive.ts`, `src/lib/fileToBase64.ts`
- Test: `src/lib/fileToBase64.test.ts`

- [ ] **Step 1: base64変換ユーティリティの失敗するテストを書く**

`src/lib/fileToBase64.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { stripDataUrlPrefix } from './fileToBase64'

describe('stripDataUrlPrefix', () => {
  it('removes the data URL prefix and returns raw base64', () => {
    const dataUrl = 'data:image/jpeg;base64,/9j/4AAQSkZJRg=='
    expect(stripDataUrlPrefix(dataUrl)).toBe('/9j/4AAQSkZJRg==')
  })
  it('returns input unchanged when no prefix present', () => {
    expect(stripDataUrlPrefix('abc123')).toBe('abc123')
  })
})
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npm test -- fileToBase64`
Expected: FAIL（`stripDataUrlPrefix` が未定義）

- [ ] **Step 3: 実装を書く**

`src/lib/fileToBase64.ts`:
```ts
export function stripDataUrlPrefix(dataUrl: string): string {
  const idx = dataUrl.indexOf('base64,')
  return idx >= 0 ? dataUrl.slice(idx + 'base64,'.length) : dataUrl
}

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npm test -- fileToBase64`
Expected: PASS（2テスト）

- [ ] **Step 5: Driveアップロードサービスを書く**

`src/services/drive.ts`:
```ts
const FOLDER_ID = import.meta.env.VITE_DRIVE_FOLDER_ID

/** multipartでDriveにアップロードし、閲覧用URLを返す */
export async function uploadImage(token: string, file: File): Promise<string> {
  const metadata = {
    name: `meal-${Date.now()}-${file.name}`,
    parents: [FOLDER_ID],
  }
  const form = new FormData()
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }))
  form.append('file', file)

  const res = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id',
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    }
  )
  if (!res.ok) throw new Error(`uploadImage failed: ${res.status}`)
  const data = (await res.json()) as { id: string }
  return `https://drive.google.com/uc?id=${data.id}`
}
```

- [ ] **Step 6: TypeScriptが通ることを確認**

Run: `npx tsc --noEmit`
Expected: エラーなし

- [ ] **Step 7: コミット**

```bash
git add src/services/drive.ts src/lib/fileToBase64.ts src/lib/fileToBase64.test.ts
git commit -m "feat: add Google Drive image upload and base64 utilities with tests"
```

---

## Task 12: UIコンポーネント（今日タブの表示部品）

**Files:**
- Create: `src/components/CalorieCard.tsx`, `src/components/PfcBars.tsx`, `src/components/MealList.tsx`
- Test: `src/components/CalorieCard.test.tsx`

- [ ] **Step 1: CalorieCardの失敗するテストを書く**

`src/components/CalorieCard.test.tsx`:
```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CalorieCard } from './CalorieCard'

describe('CalorieCard', () => {
  it('shows consumed, target and remaining calories', () => {
    render(<CalorieCard consumed={1350} target={1800} />)
    expect(screen.getByText('1,350')).toBeInTheDocument()
    expect(screen.getByText(/1,800/)).toBeInTheDocument()
    expect(screen.getByText(/450/)).toBeInTheDocument()
  })

  it('clamps remaining at 0 when over target', () => {
    render(<CalorieCard consumed={2000} target={1800} />)
    expect(screen.getByText(/0 kcal/)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npm test -- CalorieCard`
Expected: FAIL（`CalorieCard` が未定義）

- [ ] **Step 3: CalorieCardを実装**

`src/components/CalorieCard.tsx`:
```tsx
interface Props { consumed: number; target: number }

export function CalorieCard({ consumed, target }: Props) {
  const remaining = Math.max(0, target - consumed)
  const pct = target > 0 ? Math.min(100, Math.round((consumed / target) * 100)) : 0
  return (
    <div className="rounded-2xl p-5 text-white mb-4" style={{ background: 'linear-gradient(135deg,#007AFF,#5856D6)' }}>
      <div className="text-xs opacity-80 mb-2">今日の摂取カロリー</div>
      <div className="flex items-end gap-2 mb-3">
        <div className="text-4xl font-bold leading-none">{consumed.toLocaleString()}</div>
        <div className="text-sm opacity-80 pb-1">kcal</div>
      </div>
      <div className="text-sm opacity-80">目標 {target.toLocaleString()} kcal まで残り <strong>{remaining.toLocaleString()} kcal</strong></div>
      <div className="mt-2 bg-white/30 rounded-lg h-2">
        <div className="bg-white rounded-lg h-full" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npm test -- CalorieCard`
Expected: PASS（2テスト）

- [ ] **Step 5: PfcBarsを実装**

`src/components/PfcBars.tsx`:
```tsx
interface Props {
  protein: { value: number; target: number }
  fat: { value: number; target: number }
  carbs: { value: number; target: number }
}

function Bar({ label, value, target, color }: { label: string; value: number; target: number; color: string }) {
  const pct = target > 0 ? Math.min(100, Math.round((value / target) * 100)) : 0
  return (
    <div className="flex-1 bg-gray-100 rounded-2xl p-3 text-center">
      <div className="text-xl font-bold" style={{ color }}>{value}g</div>
      <div className="text-[11px] text-gray-500 mt-0.5">{label}</div>
      <div className="bg-gray-200 rounded h-1 mt-1.5">
        <div className="rounded h-full" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  )
}

export function PfcBars({ protein, fat, carbs }: Props) {
  return (
    <div className="flex gap-2.5 mb-4">
      <Bar label="タンパク質" value={protein.value} target={protein.target} color="#FF3B30" />
      <Bar label="脂質" value={fat.value} target={fat.target} color="#FF9500" />
      <Bar label="炭水化物" value={carbs.value} target={carbs.target} color="#34C759" />
    </div>
  )
}
```

- [ ] **Step 6: MealListを実装**

`src/components/MealList.tsx`:
```tsx
import type { MealRecord, MealType } from '../types'

const ICONS: Record<MealType, string> = { 朝食: '🌅', 昼食: '☀️', 夕食: '🌙', 間食: '🍪' }
const ORDER: MealType[] = ['朝食', '昼食', '夕食', '間食']

export function MealList({ meals }: { meals: MealRecord[] }) {
  return (
    <div>
      <div className="text-sm font-semibold mb-2.5 text-gray-700">本日の食事記録</div>
      {ORDER.map((type) => {
        const items = meals.filter((m) => m.mealType === type)
        const total = items.reduce((s, m) => s + m.calories, 0)
        const memo = items.map((m) => m.memo).filter(Boolean).join('、')
        const recorded = items.length > 0
        return (
          <div key={type} className={`flex items-center py-3 border-b border-gray-100 gap-3 ${recorded ? '' : 'opacity-40'}`}>
            <div className="text-2xl w-9 text-center">{ICONS[type]}</div>
            <div className="flex-1">
              <div className="text-sm font-medium">{type}</div>
              <div className="text-xs text-gray-500 mt-0.5">{recorded ? memo || '（メモなし）' : '未記録'}</div>
            </div>
            <div className="text-[15px] font-semibold text-brand">{recorded ? `${total} kcal` : '— kcal'}</div>
          </div>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 7: TypeScriptとテストが通ることを確認**

Run: `npx tsc --noEmit && npm test -- CalorieCard`
Expected: エラーなし、PASS

- [ ] **Step 8: コミット**

```bash
git add src/components/
git commit -m "feat: add CalorieCard, PfcBars, MealList UI components"
```

---

## Task 13: 記録フォームと送信フロー

**Files:**
- Create: `src/components/RecordForm.tsx`, `src/screens/RecordScreen.tsx`

目標カロリー・PFCはMVPでは定数（後フェーズで設定タブから可変化）。`src/lib/goals.ts` に暫定の目標値を置く。

- [ ] **Step 1: 暫定目標値を定義**

`src/lib/goals.ts`:
```ts
export const DEFAULT_GOALS = {
  calories: 1800,
  protein: 93,
  fat: 42,
  carbs: 195,
}
```

- [ ] **Step 2: 記録フォームを実装**

`src/components/RecordForm.tsx`:
```tsx
import { useState } from 'react'
import type { MealType } from '../types'

export interface RecordFormValues {
  mealType: MealType
  memo: string
  note: string
  file: File | null
}

interface Props {
  initialMealType: MealType
  submitting: boolean
  onSubmit: (values: RecordFormValues) => void
}

const TYPES: MealType[] = ['朝食', '昼食', '夕食', '間食']

export function RecordForm({ initialMealType, submitting, onSubmit }: Props) {
  const [mealType, setMealType] = useState<MealType>(initialMealType)
  const [memo, setMemo] = useState('')
  const [note, setNote] = useState('')
  const [file, setFile] = useState<File | null>(null)

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => { e.preventDefault(); onSubmit({ mealType, memo, note, file }) }}
    >
      <div>
        <label className="text-xs text-gray-500">食事タイプ</label>
        <div className="flex gap-2 mt-1">
          {TYPES.map((t) => (
            <button
              type="button"
              key={t}
              onClick={() => setMealType(t)}
              className={`flex-1 py-2 rounded-lg text-sm ${mealType === t ? 'bg-brand text-white' : 'bg-gray-100 text-gray-600'}`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="text-xs text-gray-500">写真（任意）</label>
        <input
          type="file"
          accept="image/*"
          capture="environment"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="block mt-1 text-sm"
        />
      </div>

      <div>
        <label className="text-xs text-gray-500">食事内容メモ</label>
        <input
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          placeholder="例: 牛丼"
          className="w-full mt-1 bg-gray-100 rounded-lg px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label className="text-xs text-gray-500">備考（店名・メニュー名など）</label>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="例: セブンイレブン サラダチキン"
          className="w-full mt-1 bg-gray-100 rounded-lg px-3 py-2 text-sm"
        />
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="bg-brand text-white rounded-xl py-3 font-semibold disabled:opacity-50"
      >
        {submitting ? '計算中…' : '記録する'}
      </button>
    </form>
  )
}
```

- [ ] **Step 3: 記録画面（送信フロー）を実装**

`src/screens/RecordScreen.tsx`:
```tsx
import { useState } from 'react'
import { RecordForm, type RecordFormValues } from '../components/RecordForm'
import { detectMealType } from '../lib/mealType'
import { toDateString } from '../lib/date'
import { uploadImage } from '../services/drive'
import { calculateNutrition } from '../services/calculate'
import { appendMeal } from '../services/sheets'
import { fileToDataUrl, stripDataUrlPrefix } from '../lib/fileToBase64'
import type { Nutrition } from '../types'

interface Props {
  token: string
  onDone: () => void
}

export function RecordScreen({ token, onDone }: Props) {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<Nutrition | null>(null)

  async function handleSubmit(values: RecordFormValues) {
    setSubmitting(true)
    setError(null)
    try {
      let photoUrl = ''
      let imageBase64: string | undefined
      let mimeType: string | undefined
      if (values.file) {
        const dataUrl = await fileToDataUrl(values.file)
        imageBase64 = stripDataUrlPrefix(dataUrl)
        mimeType = values.file.type
        photoUrl = await uploadImage(token, values.file)
      }

      const nutrition = await calculateNutrition({
        memo: values.memo, note: values.note, imageBase64, mimeType,
      })

      const now = new Date()
      await appendMeal(token, {
        timestamp: now.toISOString(),
        date: toDateString(now),
        mealType: values.mealType,
        photoUrl,
        memo: values.memo,
        note: values.note,
        ...nutrition,
      })
      setResult(nutrition)
    } catch (e) {
      setError('計算または保存に失敗しました。もう一度お試しください。')
    } finally {
      setSubmitting(false)
    }
  }

  if (result) {
    return (
      <div className="p-4 flex flex-col gap-4">
        <div className="rounded-2xl p-5 text-white" style={{ background: 'linear-gradient(135deg,#007AFF,#5856D6)' }}>
          <div className="text-xs opacity-80 mb-1">計算結果</div>
          <div className="text-4xl font-bold">{result.calories} <span className="text-sm font-normal">kcal</span></div>
          <div className="flex gap-2 mt-3 text-xs font-semibold">
            <span className="flex-1 bg-white/20 rounded p-1.5 text-center">P {result.protein}g</span>
            <span className="flex-1 bg-white/20 rounded p-1.5 text-center">F {result.fat}g</span>
            <span className="flex-1 bg-white/20 rounded p-1.5 text-center">C {result.carbs}g</span>
          </div>
          {result.comment && <div className="text-xs opacity-90 mt-3">{result.comment}</div>}
        </div>
        <button onClick={onDone} className="bg-brand text-white rounded-xl py-3 font-semibold">完了</button>
      </div>
    )
  }

  return (
    <div className="p-4">
      <h2 className="text-lg font-bold mb-4">食事を記録</h2>
      {error && (
        <div className="bg-red-50 text-red-600 text-sm rounded-lg p-3 mb-3">{error}</div>
      )}
      <RecordForm initialMealType={detectMealType(new Date())} submitting={submitting} onSubmit={handleSubmit} />
    </div>
  )
}
```

- [ ] **Step 4: RecordFormのテストを書く**

`src/components/RecordForm.test.tsx`:
```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { RecordForm } from './RecordForm'

describe('RecordForm', () => {
  it('submits with the entered memo and selected meal type', () => {
    const onSubmit = vi.fn()
    render(<RecordForm initialMealType="昼食" submitting={false} onSubmit={onSubmit} />)

    fireEvent.change(screen.getByPlaceholderText('例: 牛丼'), { target: { value: 'ラーメン' } })
    fireEvent.click(screen.getByText('記録する'))

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ memo: 'ラーメン', mealType: '昼食' }))
  })

  it('disables submit button while submitting', () => {
    render(<RecordForm initialMealType="朝食" submitting={true} onSubmit={vi.fn()} />)
    expect(screen.getByText('計算中…')).toBeDisabled()
  })
})
```

- [ ] **Step 5: テストが通ることを確認**

Run: `npm test -- RecordForm`
Expected: PASS（2テスト）

- [ ] **Step 6: コミット**

```bash
git add src/components/RecordForm.tsx src/components/RecordForm.test.tsx src/screens/RecordScreen.tsx src/lib/goals.ts
git commit -m "feat: add record form and submission flow"
```

---

## Task 14: 今日タブ画面

**Files:**
- Create: `src/screens/TodayScreen.tsx`

- [ ] **Step 1: 今日タブ画面を実装**

`src/screens/TodayScreen.tsx`:
```tsx
import { useEffect, useState } from 'react'
import { fetchMeals } from '../services/sheets'
import { aggregateDay } from '../lib/aggregate'
import { toDateString } from '../lib/date'
import { DEFAULT_GOALS } from '../lib/goals'
import { CalorieCard } from '../components/CalorieCard'
import { PfcBars } from '../components/PfcBars'
import { MealList } from '../components/MealList'
import type { MealRecord } from '../types'

function greeting(d: Date): string {
  const h = d.getHours()
  if (h < 11) return 'おはようございます 👋'
  if (h < 18) return 'こんにちは 👋'
  return 'こんばんは 👋'
}

export function TodayScreen({ token, reloadKey }: { token: string; reloadKey: number }) {
  const [meals, setMeals] = useState<MealRecord[]>([])
  const [loading, setLoading] = useState(true)
  const today = toDateString(new Date())

  useEffect(() => {
    let active = true
    setLoading(true)
    fetchMeals(token)
      .then((all) => { if (active) setMeals(all.filter((m) => m.date === today)) })
      .catch(() => { if (active) setMeals([]) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [token, today, reloadKey])

  const totals = aggregateDay(meals, today)

  return (
    <div className="p-4 pb-24">
      <div className="text-xl font-bold mb-0.5">{greeting(new Date())}</div>
      <div className="text-[13px] text-gray-500 mb-4">{today}</div>
      {loading ? (
        <div className="text-gray-400 text-sm py-8 text-center">読み込み中…</div>
      ) : (
        <>
          <CalorieCard consumed={totals.calories} target={DEFAULT_GOALS.calories} />
          <PfcBars
            protein={{ value: totals.protein, target: DEFAULT_GOALS.protein }}
            fat={{ value: totals.fat, target: DEFAULT_GOALS.fat }}
            carbs={{ value: totals.carbs, target: DEFAULT_GOALS.carbs }}
          />
          <MealList meals={meals} />
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 2: TypeScriptが通ることを確認**

Run: `npx tsc --noEmit`
Expected: エラーなし

- [ ] **Step 3: コミット**

```bash
git add src/screens/TodayScreen.tsx
git commit -m "feat: add Today screen with daily aggregation"
```

---

## Task 15: 下部ナビとアプリシェル統合

**Files:**
- Create: `src/components/BottomNav.tsx`
- Modify: `src/App.tsx`, `src/main.tsx`

MVPでは「今日」タブと記録画面のみ稼働。「週間」「進捗」「設定」はプレースホルダ（Phase 2/3で実装）。中央＋ボタンで記録画面へ。

- [ ] **Step 1: 下部ナビを実装**

`src/components/BottomNav.tsx`:
```tsx
export type Tab = 'today' | 'weekly' | 'progress' | 'settings'

interface Props {
  active: Tab
  onChange: (t: Tab) => void
  onRecord: () => void
}

const ITEMS: { key: Tab; icon: string; label: string }[] = [
  { key: 'today', icon: '🏠', label: '今日' },
  { key: 'weekly', icon: '📊', label: '週間' },
  { key: 'progress', icon: '🎯', label: '進捗' },
  { key: 'settings', icon: '⚙️', label: '設定' },
]

export function BottomNav({ active, onChange, onRecord }: Props) {
  return (
    <div className="fixed bottom-0 left-0 right-0 max-w-[430px] mx-auto bg-white border-t border-gray-200 flex items-center px-2 pt-2 pb-5">
      {ITEMS.slice(0, 2).map((it) => (
        <NavButton key={it.key} {...it} active={active === it.key} onClick={() => onChange(it.key)} />
      ))}
      <button
        onClick={onRecord}
        className="w-14 h-14 -mt-6 bg-brand text-white rounded-full text-3xl flex items-center justify-center shadow-lg mx-1"
        aria-label="記録する"
      >＋</button>
      {ITEMS.slice(2).map((it) => (
        <NavButton key={it.key} {...it} active={active === it.key} onClick={() => onChange(it.key)} />
      ))}
    </div>
  )
}

function NavButton({ icon, label, active, onClick }: { icon: string; label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`flex-1 text-center text-[10px] ${active ? 'text-brand' : 'text-gray-400'}`}>
      <span className="block text-xl mb-0.5">{icon}</span>{label}
    </button>
  )
}
```

- [ ] **Step 2: App.tsx を実装（認証ガード + 画面切替）**

`src/App.tsx`:
```tsx
import { useState } from 'react'
import { useAuth } from './auth/useAuth'
import { AuthGuard } from './auth/AuthGuard'
import { BottomNav, type Tab } from './components/BottomNav'
import { TodayScreen } from './screens/TodayScreen'
import { RecordScreen } from './screens/RecordScreen'

export default function App() {
  const auth = useAuth()
  const [tab, setTab] = useState<Tab>('today')
  const [recording, setRecording] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  return (
    <AuthGuard auth={auth}>
      <div className="max-w-[430px] mx-auto min-h-full bg-white">
        {recording ? (
          <RecordScreen
            token={auth.accessToken!}
            onDone={() => { setRecording(false); setReloadKey((k) => k + 1); setTab('today') }}
          />
        ) : (
          <>
            {tab === 'today' && <TodayScreen token={auth.accessToken!} reloadKey={reloadKey} />}
            {tab === 'weekly' && <Placeholder label="週間（Phase 2で実装）" />}
            {tab === 'progress' && <Placeholder label="進捗（Phase 2/3で実装）" />}
            {tab === 'settings' && <Placeholder label="設定（Phase 3で実装）" />}
            <BottomNav active={tab} onChange={setTab} onRecord={() => setRecording(true)} />
          </>
        )}
      </div>
    </AuthGuard>
  )
}

function Placeholder({ label }: { label: string }) {
  return <div className="p-8 text-center text-gray-400 text-sm pb-24">{label}</div>
}
```

- [ ] **Step 3: main.tsx を確認**

`src/main.tsx`:
```tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
```

- [ ] **Step 4: ビルドとテスト全体が通ることを確認**

Run: `npx tsc --noEmit && npm test`
Expected: TypeScriptエラーなし、全テストPASS

- [ ] **Step 5: コミット**

```bash
git add src/App.tsx src/main.tsx src/components/BottomNav.tsx
git commit -m "feat: wire app shell with bottom nav and screen routing"
```

---

## Task 16: PWAアイコンとマニフェスト最終化

**Files:**
- Create: `public/icons/icon-192.png`, `public/icons/icon-512.png`, `public/apple-touch-icon.png`
- Modify: `index.html`

- [ ] **Step 1: アイコン画像を用意**

ユーザーに 512×512 のアプリアイコンPNGを用意してもらい、192×192 と `apple-touch-icon.png`（180×180）にリサイズして `public/icons/` と `public/` に配置。簡易的には単色背景＋🍽️絵文字でも可。

- [ ] **Step 2: index.html にiOS用メタタグを追加**

`index.html` の `<head>` に追記:
```html
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="default" />
<meta name="apple-mobile-web-app-title" content="Bite-Log" />
<link rel="apple-touch-icon" href="/apple-touch-icon.png" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover, maximum-scale=1.0, user-scalable=no" />
```

- [ ] **Step 3: 本番ビルドが成功することを確認**

Run: `npm run build`
Expected: `dist/` が生成され、`dist/manifest.webmanifest` と Service Worker が出力される

- [ ] **Step 4: コミット**

```bash
git add public/ index.html
git commit -m "feat: finalize PWA icons and iOS meta tags"
```

---

## Task 17: 統合動作確認（Vercelデプロイ）

**Files:** なし（デプロイと手動確認）

- [ ] **Step 1: Vercelにデプロイ**

Run:
```bash
npm install -g vercel
vercel
```
プロンプトに従いプロジェクトをリンク。

- [ ] **Step 2: 環境変数を設定**

Vercelダッシュボード（またはCLI）で以下を設定:
- `GEMINI_API_KEY`（サーバー側）
- `VITE_GOOGLE_CLIENT_ID`, `VITE_ALLOWED_EMAIL`, `VITE_SPREADSHEET_ID`, `VITE_DRIVE_FOLDER_ID`（ビルド時）

Run: `vercel --prod`

- [ ] **Step 3: OAuth承認済みオリジンに本番URLを追加**

Google Cloud Console の OAuth クライアント設定で、承認済みJavaScript生成元に本番URL（例: `https://bite-log.vercel.app`）を追加。

- [ ] **Step 4: 手動E2E確認**

iPhoneのSafariで本番URLを開き、以下を順に確認:
1. 「Googleでログイン」→ 自分のアカウントで認証できる
2. ＋ボタン → 写真撮影 + メモ入力 → 「記録する」→ 2〜3秒後にカロリー結果が表示される
3. 「完了」→ 今日タブにカロリー・PFC・食事一覧が反映される
4. Googleスプレッドシートの `meals_v2` タブに行が追加されている
5. 別アカウントでログインするとアクセス拒否される
6. Safari共有 →「ホーム画面に追加」→ アイコンから起動できる

- [ ] **Step 5: 確認結果を記録**

すべて成功したらPhase 1完了。問題があれば該当Taskに戻って修正。

---

## Self-Review チェック結果

**Spec coverage（Phase 1範囲）:**
- ✅ Google OAuth認証 → Task 9
- ✅ 食事記録フォーム（写真+テキスト+タイプ+備考）→ Task 13
- ✅ Gemini計算（同期型、エラー時再送信）→ Task 7, 8, 13
- ✅ Google Sheets保存 → Task 10
- ✅ Google Drive画像アップロード → Task 11
- ✅ 今日タブ（カロリーカード+PFCバー+食事一覧）→ Task 12, 14
- ✅ 食事タイプ自動判定 → Task 4
- ✅ PWA（manifest+iOSメタ+アイコン）→ Task 1, 16
- ✅ アクセス制限（allowlist）→ Task 9
- ⏭️ AIアドバイス（今日タブ）→ Phase 2へ（当日サマリー生成はダッシュボード強化時にまとめて実装）

**Phase 1スコープ外（後続計画）:**
- 週間タブ・進捗タブ → Phase 2
- 設定タブ・AI目標設定・InBody・Google Health連携 → Phase 3

**型整合性:** `MealRecord` / `Nutrition` / `MealType` / `DailyTotals` は Task 2 で定義し、全Taskで一貫使用。`appendMeal`/`fetchMeals`/`uploadImage`/`calculateNutrition` のシグネチャは呼び出し側（Task 13, 14）と一致。

**Placeholder scan:** 実装コードにプレースホルダなし。アイコン画像とユーザー準備物（タブ作成・環境変数）のみ手動ステップとして明示。
