# 設定タブ（目標値編集）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 設定タブで目標カロリー・PFCを編集し Google Sheets の `settings` タブに永続化する。今日タブ・月間タブの目標比表示に即時反映する。

**Architecture:** `useGoals` フックがアプリ起動時に Sheets から目標値をロードし、`goals` prop として全画面に渡す。設定タブで保存すると `setGoals` でアプリ状態を更新し全画面に即時反映。`settings` タブは初回保存時に `ensureSettingsSheet` が自動作成する。

**Tech Stack:** React 18, TypeScript, Google Sheets API v4, Vitest, React Testing Library

---

## ファイル構成

| ファイル | 操作 | 責務 |
|---|---|---|
| `src/lib/goals.ts` | 変更 | `Goals` 型を追加（`DEFAULT_GOALS` の fallback は残す） |
| `src/services/settings.ts` | 新規 | `fetchGoals` / `saveGoals` / `ensureSettingsSheet` |
| `src/services/settings.test.ts` | 新規 | service のユニットテスト |
| `src/auth/useGoals.ts` | 新規 | 起動時に Sheets から goals をロードするフック |
| `src/auth/useGoals.test.ts` | 新規 | フックのテスト |
| `src/screens/SettingsScreen.tsx` | 新規 | 目標値編集 UI |
| `src/screens/SettingsScreen.test.tsx` | 新規 | 画面のテスト |
| `src/screens/TodayScreen.tsx` | 変更 | `DEFAULT_GOALS` 直接参照 → `goals` prop |
| `src/screens/MonthlyScreen.tsx` | 変更 | `DEFAULT_GOALS` 直接参照 → `goals` prop |
| `src/App.tsx` | 変更 | `useGoals` を追加・全画面に `goals` を渡す |

---

## Task 1: Goals 型を追加

**Files:**
- Modify: `src/lib/goals.ts`

- [ ] **Step 1: `Goals` 型を追加し `DEFAULT_GOALS` に型注釈を付ける**

`src/lib/goals.ts` を以下に書き換える:
```ts
export interface Goals {
  calories: number
  protein: number
  fat: number
  carbs: number
}

export const DEFAULT_GOALS: Goals = {
  calories: 1800,
  protein: 93,
  fat: 42,
  carbs: 195,
}
```

- [ ] **Step 2: TypeScript が通ることを確認**

Run: `npx tsc --noEmit`
Expected: エラーなし

- [ ] **Step 3: コミット**

```bash
git add src/lib/goals.ts
git commit -m "feat: add Goals interface to goals.ts"
```

---

## Task 2: settings サービス（TDD）

**Files:**
- Create: `src/services/settings.ts`
- Test: `src/services/settings.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`src/services/settings.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fetchGoals, saveGoals } from './settings'

beforeEach(() => { vi.restoreAllMocks() })

describe('fetchGoals', () => {
  it('returns DEFAULT_GOALS when sheet has no data row', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({ values: undefined }),
    })))
    const result = await fetchGoals('tok')
    expect(result).toEqual({ calories: 1800, protein: 93, fat: 42, carbs: 195 })
  })

  it('returns parsed goals when sheet has data', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({ values: [['2000', '100', '50', '200']] }),
    })))
    const result = await fetchGoals('tok')
    expect(result).toEqual({ calories: 2000, protein: 100, fat: 50, carbs: 200 })
  })

  it('returns DEFAULT_GOALS on network error', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 403 })))
    const result = await fetchGoals('tok')
    expect(result).toEqual({ calories: 1800, protein: 93, fat: 42, carbs: 195 })
  })
})

describe('saveGoals', () => {
  it('PUTs to the settings range when sheet already exists', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ sheets: [{ properties: { title: 'settings' } }] }),
      })
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) })
    vi.stubGlobal('fetch', fetchMock)

    await saveGoals('tok', { calories: 2000, protein: 100, fat: 50, carbs: 200 })

    expect(fetchMock).toHaveBeenCalledTimes(2)
    const [url, opts] = fetchMock.mock.calls[1]
    expect(url).toContain('settings')
    expect(opts.method).toBe('PUT')
    expect(JSON.parse(opts.body)).toMatchObject({ values: [[2000, 100, 50, 200]] })
  })

  it('creates the sheet then saves when sheet does not exist', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ sheets: [] }) }) // sheetExists
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) })            // addSheet
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) })            // write header
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) })            // PUT values
    vi.stubGlobal('fetch', fetchMock)

    await saveGoals('tok', { calories: 1800, protein: 93, fat: 42, carbs: 195 })
    expect(fetchMock).toHaveBeenCalledTimes(4)
  })

  it('throws when the PUT request fails', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ sheets: [{ properties: { title: 'settings' } }] }),
      })
      .mockResolvedValueOnce({ ok: false, status: 403 })
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      saveGoals('tok', { calories: 1800, protein: 93, fat: 42, carbs: 195 })
    ).rejects.toThrow('saveGoals failed: 403')
  })
})
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npm test -- settings`
Expected: FAIL（`fetchGoals` が未定義）

- [ ] **Step 3: 実装を書く**

`src/services/settings.ts`:
```ts
import type { Goals } from '../lib/goals'
import { DEFAULT_GOALS } from '../lib/goals'

const SHEET_NAME = 'settings'
const SPREADSHEET_ID = import.meta.env.VITE_SPREADSHEET_ID

function rowToGoals(cells: string[]): Goals {
  const calories = Number(cells[0])
  const protein = Number(cells[1])
  const fat = Number(cells[2])
  const carbs = Number(cells[3])
  if (!calories || !protein || !fat || !carbs) return DEFAULT_GOALS
  return { calories, protein, fat, carbs }
}

function goalsToRow(g: Goals): (string | number)[] {
  return [g.calories, g.protein, g.fat, g.carbs]
}

async function sheetExists(token: string): Promise<boolean> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}`
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) return false
  const data = (await res.json()) as { sheets: Array<{ properties: { title: string } }> }
  return data.sheets.some((s) => s.properties.title === SHEET_NAME)
}

async function ensureSettingsSheet(token: string): Promise<void> {
  if (await sheetExists(token)) return

  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}:batchUpdate`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ requests: [{ addSheet: { properties: { title: SHEET_NAME } } }] }),
    },
  )

  const headerRange = encodeURIComponent(`'${SHEET_NAME}'!A1:D1`)
  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${headerRange}?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ values: [['calories', 'protein', 'fat', 'carbs']] }),
    },
  )
}

export async function fetchGoals(token: string): Promise<Goals> {
  try {
    const range = encodeURIComponent(`'${SHEET_NAME}'!A2:D2`)
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${range}`
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
    if (!res.ok) return DEFAULT_GOALS
    const data = (await res.json()) as { values?: string[][] }
    const row = data.values?.[0]
    if (!row) return DEFAULT_GOALS
    return rowToGoals(row)
  } catch {
    return DEFAULT_GOALS
  }
}

export async function saveGoals(token: string, goals: Goals): Promise<void> {
  await ensureSettingsSheet(token)
  const range = encodeURIComponent(`'${SHEET_NAME}'!A2:D2`)
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${range}?valueInputOption=USER_ENTERED`
  const res = await fetch(url, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ values: [goalsToRow(goals)] }),
  })
  if (!res.ok) throw new Error(`saveGoals failed: ${res.status}`)
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npm test -- settings`
Expected: PASS（6テスト）

- [ ] **Step 5: コミット**

```bash
git add src/services/settings.ts src/services/settings.test.ts
git commit -m "feat: add settings service for goal persistence"
```

---

## Task 3: useGoals フック（TDD）

**Files:**
- Create: `src/auth/useGoals.ts`
- Test: `src/auth/useGoals.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`src/auth/useGoals.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useGoals } from './useGoals'

vi.mock('../services/settings', () => ({
  fetchGoals: vi.fn(),
}))
import { fetchGoals } from '../services/settings'

beforeEach(() => { vi.restoreAllMocks() })

describe('useGoals', () => {
  it('returns DEFAULT_GOALS initially then updates after fetch', async () => {
    vi.mocked(fetchGoals).mockResolvedValue({ calories: 2000, protein: 100, fat: 50, carbs: 200 })
    const { result } = renderHook(() => useGoals('tok'))

    expect(result.current.goals.calories).toBe(1800)
    await waitFor(() => expect(result.current.goals.calories).toBe(2000))
    expect(result.current.loading).toBe(false)
  })

  it('does not call fetchGoals when token is null', () => {
    renderHook(() => useGoals(null))
    expect(fetchGoals).not.toHaveBeenCalled()
  })

  it('setGoals updates state immediately', async () => {
    vi.mocked(fetchGoals).mockResolvedValue({ calories: 1800, protein: 93, fat: 42, carbs: 195 })
    const { result } = renderHook(() => useGoals('tok'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    result.current.setGoals({ calories: 2200, protein: 110, fat: 55, carbs: 220 })
    await waitFor(() => expect(result.current.goals.calories).toBe(2200))
  })
})
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npm test -- useGoals`
Expected: FAIL（`useGoals` が未定義）

- [ ] **Step 3: 実装を書く**

`src/auth/useGoals.ts`:
```ts
import { useState, useEffect } from 'react'
import { fetchGoals } from '../services/settings'
import { DEFAULT_GOALS } from '../lib/goals'
import type { Goals } from '../lib/goals'

export function useGoals(token: string | null) {
  const [goals, setGoals] = useState<Goals>(DEFAULT_GOALS)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!token) return
    let active = true
    setLoading(true)
    fetchGoals(token)
      .then((g) => { if (active) setGoals(g) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [token])

  return { goals, setGoals, loading }
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npm test -- useGoals`
Expected: PASS（3テスト）

- [ ] **Step 5: コミット**

```bash
git add src/auth/useGoals.ts src/auth/useGoals.test.ts
git commit -m "feat: add useGoals hook for loading goal settings"
```

---

## Task 4: SettingsScreen（TDD）

**Files:**
- Create: `src/screens/SettingsScreen.tsx`
- Test: `src/screens/SettingsScreen.test.tsx`

- [ ] **Step 1: 失敗するテストを書く**

`src/screens/SettingsScreen.test.tsx`:
```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { SettingsScreen } from './SettingsScreen'

vi.mock('../services/settings', () => ({
  saveGoals: vi.fn(),
}))
import { saveGoals } from '../services/settings'

const baseGoals = { calories: 1800, protein: 93, fat: 42, carbs: 195 }

describe('SettingsScreen', () => {
  it('renders current goal values as input field values', () => {
    render(<SettingsScreen token="tok" goals={baseGoals} onSaved={vi.fn()} />)
    expect(screen.getByDisplayValue('1800')).toBeInTheDocument()
    expect(screen.getByDisplayValue('93')).toBeInTheDocument()
    expect(screen.getByDisplayValue('42')).toBeInTheDocument()
    expect(screen.getByDisplayValue('195')).toBeInTheDocument()
  })

  it('calls saveGoals and onSaved with current values on success', async () => {
    vi.mocked(saveGoals).mockResolvedValueOnce(undefined)
    const onSaved = vi.fn()
    render(<SettingsScreen token="tok" goals={baseGoals} onSaved={onSaved} />)

    fireEvent.click(screen.getByRole('button', { name: '保存する' }))
    await waitFor(() => expect(saveGoals).toHaveBeenCalledWith('tok', baseGoals))
    expect(onSaved).toHaveBeenCalledWith(baseGoals)
    expect(screen.getByText('保存しました')).toBeInTheDocument()
  })

  it('shows error message on save failure', async () => {
    vi.mocked(saveGoals).mockRejectedValueOnce(new Error('fail'))
    render(<SettingsScreen token="tok" goals={baseGoals} onSaved={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: '保存する' }))
    await waitFor(() =>
      expect(screen.getByText('保存に失敗しました。もう一度お試しください。')).toBeInTheDocument()
    )
  })

  it('disables save button when a field is cleared', () => {
    render(<SettingsScreen token="tok" goals={baseGoals} onSaved={vi.fn()} />)
    fireEvent.change(screen.getByDisplayValue('1800'), { target: { value: '' } })
    expect(screen.getByRole('button', { name: '保存する' })).toBeDisabled()
  })
})
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npm test -- SettingsScreen`
Expected: FAIL（`SettingsScreen` が未定義）

- [ ] **Step 3: 実装を書く**

`src/screens/SettingsScreen.tsx`:
```tsx
import { useState } from 'react'
import { saveGoals } from '../services/settings'
import type { Goals } from '../lib/goals'

interface Props {
  token: string
  goals: Goals
  onSaved: (g: Goals) => void
}

function isValid(v: string): boolean {
  return v !== '' && !isNaN(Number(v)) && Number(v) > 0
}

export function SettingsScreen({ token, goals, onSaved }: Props) {
  const [calories, setCalories] = useState(String(goals.calories))
  const [protein, setProtein] = useState(String(goals.protein))
  const [fat, setFat] = useState(String(goals.fat))
  const [carbs, setCarbs] = useState(String(goals.carbs))
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const canSave = [calories, protein, fat, carbs].every(isValid)

  async function handleSave() {
    if (!canSave) return
    setSaving(true)
    setMessage(null)
    const newGoals: Goals = {
      calories: Math.round(Number(calories)),
      protein: Math.round(Number(protein)),
      fat: Math.round(Number(fat)),
      carbs: Math.round(Number(carbs)),
    }
    try {
      await saveGoals(token, newGoals)
      onSaved(newGoals)
      setMessage({ type: 'success', text: '保存しました' })
    } catch {
      setMessage({ type: 'error', text: '保存に失敗しました。もう一度お試しください。' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-4 pb-24">
      <h2 className="text-lg font-bold mb-4">設定</h2>
      <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm mb-4">
        <div className="text-xs text-gray-500 mb-4">目標値</div>
        <GoalField label="カロリー" unit="kcal" value={calories} onChange={setCalories} />
        <GoalField label="タンパク質" unit="g" value={protein} onChange={setProtein} />
        <GoalField label="脂質" unit="g" value={fat} onChange={setFat} />
        <GoalField label="炭水化物" unit="g" value={carbs} onChange={setCarbs} />
      </div>

      {message && (
        <div
          className={`text-sm rounded-lg p-3 mb-3 ${
            message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'
          }`}
        >
          {message.text}
        </div>
      )}

      <button
        onClick={handleSave}
        disabled={saving || !canSave}
        aria-label="保存する"
        className="w-full bg-brand text-white rounded-xl py-3 font-semibold disabled:opacity-50"
      >
        {saving ? '保存中…' : '保存する'}
      </button>
    </div>
  )
}

function GoalField({
  label,
  unit,
  value,
  onChange,
}: {
  label: string
  unit: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-gray-50 last:border-0">
      <span className="text-sm text-gray-700 flex-1">{label}</span>
      <input
        type="number"
        inputMode="numeric"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-24 text-right bg-gray-50 rounded-lg px-3 py-1.5 text-sm tabular-nums"
      />
      <span className="text-xs text-gray-400 w-8">{unit}</span>
    </div>
  )
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npm test -- SettingsScreen`
Expected: PASS（4テスト）

- [ ] **Step 5: コミット**

```bash
git add src/screens/SettingsScreen.tsx src/screens/SettingsScreen.test.tsx
git commit -m "feat: add SettingsScreen for goal value editing"
```

---

## Task 5: TodayScreen に goals prop を追加

**Files:**
- Modify: `src/screens/TodayScreen.tsx`

- [ ] **Step 1: import を変更**

`src/screens/TodayScreen.tsx` の先頭 import を変更:
```ts
// 変更前:
import { DEFAULT_GOALS } from '../lib/goals'

// 変更後:
import type { Goals } from '../lib/goals'
```

- [ ] **Step 2: props に goals を追加**

```ts
// 変更前:
export function TodayScreen({ token, reloadKey }: { token: string; reloadKey: number }) {

// 変更後:
export function TodayScreen({ token, reloadKey, goals }: { token: string; reloadKey: number; goals: Goals }) {
```

- [ ] **Step 3: DEFAULT_GOALS 参照を goals に置換**

```tsx
// 変更前:
<CalorieCard consumed={totals.calories} target={DEFAULT_GOALS.calories} />
<PfcBars
  protein={{ value: totals.protein, target: DEFAULT_GOALS.protein }}
  fat={{ value: totals.fat, target: DEFAULT_GOALS.fat }}
  carbs={{ value: totals.carbs, target: DEFAULT_GOALS.carbs }}
/>

// 変更後:
<CalorieCard consumed={totals.calories} target={goals.calories} />
<PfcBars
  protein={{ value: totals.protein, target: goals.protein }}
  fat={{ value: totals.fat, target: goals.fat }}
  carbs={{ value: totals.carbs, target: goals.carbs }}
/>
```

- [ ] **Step 4: コミット**

```bash
git add src/screens/TodayScreen.tsx
git commit -m "feat: TodayScreen accepts goals prop instead of DEFAULT_GOALS"
```

---

## Task 6: MonthlyScreen に goals prop を追加

**Files:**
- Modify: `src/screens/MonthlyScreen.tsx`

- [ ] **Step 1: import を変更**

```ts
// 変更前:
import { DEFAULT_GOALS } from '../lib/goals'

// 変更後:
import type { Goals } from '../lib/goals'
```

- [ ] **Step 2: props に goals を追加**

```ts
// 変更前:
export function MonthlyScreen({ token }: { token: string }) {

// 変更後:
export function MonthlyScreen({ token, goals }: { token: string; goals: Goals }) {
```

- [ ] **Step 3: コンポーネント本体の DEFAULT_GOALS 参照をすべて goals に置換**

```ts
// avgPct の計算（変更前）:
const avgPct = Math.min(100, Math.round((avgCalories / DEFAULT_GOALS.calories) * 100))
// 変更後:
const avgPct = Math.min(100, Math.round((avgCalories / goals.calories) * 100))
```

```tsx
// ヒーローカード（変更前）:
<span className="text-xs opacity-80">/ 目標 {DEFAULT_GOALS.calories.toLocaleString()} kcal</span>
// 変更後:
<span className="text-xs opacity-80">/ 目標 {goals.calories.toLocaleString()} kcal</span>
```

```tsx
// カレンダーの超過判定（変更前）:
const over = cal > DEFAULT_GOALS.calories
// 変更後:
const over = cal > goals.calories
```

```tsx
// PfcRow 呼び出し（変更前）:
<PfcRow label="タンパク質" value={avgP} goal={DEFAULT_GOALS.protein} color="bg-blue-400" />
<PfcRow label="脂質" value={avgF} goal={DEFAULT_GOALS.fat} color="bg-yellow-400" />
<PfcRow label="炭水化物" value={avgC} goal={DEFAULT_GOALS.carbs} color="bg-green-400" />
// 変更後:
<PfcRow label="タンパク質" value={avgP} goal={goals.protein} color="bg-blue-400" />
<PfcRow label="脂質" value={avgF} goal={goals.fat} color="bg-yellow-400" />
<PfcRow label="炭水化物" value={avgC} goal={goals.carbs} color="bg-green-400" />
```

- [ ] **Step 4: DayPfcChart に goals を渡す**

呼び出し側:
```tsx
// 変更前:
<DayPfcChart meals={selectedMeals} />
// 変更後:
<DayPfcChart meals={selectedMeals} goals={goals} />
```

`DayPfcChart` 関数定義:
```tsx
// 変更前:
function DayPfcChart({ meals }: { meals: MealRecord[] }) {
  // ...
  const goal = DEFAULT_GOALS[key]

// 変更後:
function DayPfcChart({ meals, goals }: { meals: MealRecord[]; goals: Goals }) {
  // ...
  const goal = goals[key]
```

- [ ] **Step 5: コミット**

```bash
git add src/screens/MonthlyScreen.tsx
git commit -m "feat: MonthlyScreen accepts goals prop instead of DEFAULT_GOALS"
```

---

## Task 7: App.tsx を配線

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: App.tsx を書き換える**

`src/App.tsx`:
```tsx
import { useState } from 'react'
import { useAuth } from './auth/useAuth'
import { useGoals } from './auth/useGoals'
import { AuthGuard } from './auth/AuthGuard'
import { BottomNav, type Tab } from './components/BottomNav'
import { TodayScreen } from './screens/TodayScreen'
import { RecordScreen } from './screens/RecordScreen'
import { MonthlyScreen } from './screens/MonthlyScreen'
import { SettingsScreen } from './screens/SettingsScreen'

export default function App() {
  const auth = useAuth()
  const { goals, setGoals } = useGoals(auth.accessToken)
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
            onCancel={() => setRecording(false)}
          />
        ) : (
          <>
            {tab === 'today' && <TodayScreen token={auth.accessToken!} reloadKey={reloadKey} goals={goals} />}
            {tab === 'weekly' && <MonthlyScreen token={auth.accessToken!} goals={goals} />}
            {tab === 'progress' && <Placeholder label="進捗（Phase 2/3で実装）" />}
            {tab === 'settings' && (
              <SettingsScreen token={auth.accessToken!} goals={goals} onSaved={setGoals} />
            )}
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

- [ ] **Step 2: TypeScript と全テストが通ることを確認**

Run: `npx tsc --noEmit && npm test`
Expected: TypeScript エラーなし、全テスト PASS

- [ ] **Step 3: コミット**

```bash
git add src/App.tsx
git commit -m "feat: wire useGoals and SettingsScreen into App"
```

---

## Task 8: ビルドと本番デプロイ

**Files:** なし

- [ ] **Step 1: 本番ビルドが成功することを確認**

Run: `npm run build`
Expected: `dist/` が生成されエラーなし

- [ ] **Step 2: 本番デプロイ**

Run: `vercel --prod --yes`
Expected: `https://bite-log-eight.vercel.app` にデプロイ完了、ALIASED と表示される

- [ ] **Step 3: iPhone で手動確認**

1. 設定タブを開き、目標カロリーを変更して「保存する」をタップ
2. 「保存しました」が表示されること
3. 今日タブに戻り、目標比が新しい値で表示されること
4. 月間タブのヒーローカードの目標値が更新されていること
5. アプリを完全に閉じて再起動し、設定値が保持されていること
6. Google スプレッドシートに `settings` タブが作成され、値が書き込まれていること

---

## Self-Review

**Spec coverage:**
- ✅ 目標カロリー・P・F・C の編集・保存 → Task 4 SettingsScreen
- ✅ Google Sheets `settings` タブへの永続化 → Task 2 settings service
- ✅ `settings` タブの自動作成（初回保存時）→ Task 2 `ensureSettingsSheet`
- ✅ 起動時の目標値ロード → Task 3 useGoals
- ✅ 今日タブへの反映 → Task 5
- ✅ 月間タブへの反映 → Task 6（DayPfcChart への goals 伝達を含む）
- ✅ 保存後の即時反映 → Task 7 `onSaved={setGoals}`
- ✅ バリデーション（空・負数・非数値）→ Task 4 `isValid`
- ✅ 保存失敗時のエラーメッセージ → Task 4
- ✅ `fetchGoals` 失敗時の DEFAULT_GOALS フォールバック → Task 2

**Placeholder scan:** なし

**型一貫性:**
- `Goals` interface: Task 1 定義
- `fetchGoals(token: string): Promise<Goals>`: Task 2 定義、Task 3 で import して使用
- `saveGoals(token: string, goals: Goals): Promise<void>`: Task 2 定義、Task 4 で import して使用
- `useGoals(token: string | null)` → `{ goals: Goals; setGoals: Dispatch<SetStateAction<Goals>>; loading: boolean }`: Task 3 定義
- `SettingsScreen` props `onSaved: (g: Goals) => void`: Task 4 定義。`setGoals` (Dispatch) は `(g: Goals) => void` を満たす ✅
- `TodayScreen` props `goals: Goals`: Task 5 追加、Task 7 で渡す
- `MonthlyScreen` props `goals: Goals`: Task 6 追加、Task 7 で渡す
- `DayPfcChart` props `goals: Goals`: Task 6 追加（呼び出し・定義ともに変更）
