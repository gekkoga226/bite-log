import { useEffect, useState, useRef } from 'react'
import { fetchInbody, appendInbody } from '../services/inbody'
import { extractInbody } from '../services/inbodyOcr'
import { fetchMeals } from '../services/sheets'
import { fetchAdvice, summarizeDays } from '../services/advice'
import { compressImages } from '../lib/compressImage'
import { toDateString } from '../lib/date'
import type { Goals } from '../lib/goals'
import type { InBodyRecord, InBodyMetrics, MealRecord } from '../types'

const ADVICE_DAYS = 7

const METRICS: { key: keyof InBodyMetrics; label: string; unit: string; decimals: number }[] = [
  { key: 'weight', label: '体重', unit: 'kg', decimals: 1 },
  { key: 'bodyFatPercent', label: '体脂肪率', unit: '%', decimals: 1 },
  { key: 'muscleMass', label: '骨格筋量', unit: 'kg', decimals: 1 },
  { key: 'bmi', label: 'BMI', unit: '', decimals: 1 },
  { key: 'basalMetabolism', label: '基礎代謝', unit: 'kcal', decimals: 0 },
  { key: 'bodyFatMass', label: '体脂肪量', unit: 'kg', decimals: 1 },
]

function fmt(n: number, decimals: number): string {
  return n.toFixed(decimals)
}
function signed(n: number, decimals: number): string {
  const v = Number(n.toFixed(decimals))
  return v > 0 ? `+${v.toFixed(decimals)}` : v.toFixed(decimals)
}

export function ProgressScreen({ token, goals }: { token: string; goals: Goals }) {
  const [records, setRecords] = useState<InBodyRecord[]>([])
  const [meals, setMeals] = useState<MealRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [metric, setMetric] = useState<keyof InBodyMetrics>('weight')
  const [recording, setRecording] = useState(false)

  function reload() {
    setLoading(true)
    Promise.all([fetchInbody(token), fetchMeals(token).catch(() => [])])
      .then(([rs, ms]) => { setRecords(rs); setMeals(ms) })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    let active = true
    setLoading(true)
    Promise.all([fetchInbody(token), fetchMeals(token).catch(() => [])])
      .then(([rs, ms]) => { if (active) { setRecords(rs); setMeals(ms) } })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [token])

  const latest = records.length > 0 ? records[records.length - 1] : null
  const previous = records.length > 1 ? records[records.length - 2] : null
  const meta = METRICS.find((m) => m.key === metric)!

  return (
    <div className="p-4 pb-24">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold">進捗</h2>
        <button
          onClick={() => setRecording(true)}
          className="text-sm text-brand font-semibold active:opacity-60"
        >
          ＋ InBodyを記録
        </button>
      </div>

      {recording && (
        <RecordInbodyPanel
          token={token}
          onClose={() => setRecording(false)}
          onSaved={() => { setRecording(false); reload() }}
        />
      )}

      {loading ? (
        <div className="text-gray-400 text-sm py-12 text-center">読み込み中…</div>
      ) : (
        <>
          {/* ヒーロー: 最新の体組成 */}
          {latest ? (
            <div className="rounded-2xl p-5 text-white mb-4" style={{ background: 'linear-gradient(135deg,#007AFF,#5856D6)' }}>
              <div className="text-xs opacity-80 mb-1">最新の体組成 ・ {latest.date}</div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold leading-none">{fmt(latest.weight, 1)}</span>
                <span className="text-xs opacity-80">kg</span>
                {previous && (
                  <span className="text-xs opacity-80 ml-1">前回比 {signed(latest.weight - previous.weight, 1)}kg</span>
                )}
              </div>
              <div className="flex gap-2 mt-3 text-xs font-semibold">
                <span className="flex-1 bg-white/20 rounded p-1.5 text-center">体脂肪 {fmt(latest.bodyFatPercent, 1)}%</span>
                <span className="flex-1 bg-white/20 rounded p-1.5 text-center">筋肉 {fmt(latest.muscleMass, 1)}kg</span>
                <span className="flex-1 bg-white/20 rounded p-1.5 text-center">BMI {fmt(latest.bmi, 1)}</span>
              </div>
            </div>
          ) : (
            <div className="bg-white border border-gray-100 rounded-2xl p-6 mb-4 shadow-sm text-center">
              <div className="text-sm text-gray-500 mb-1">体組成の記録がありません</div>
              <div className="text-xs text-gray-400">「＋ InBodyを記録」から写真を解析して登録できます</div>
            </div>
          )}

          {/* 推移グラフ */}
          {records.length > 0 && (
            <div className="bg-white border border-gray-100 rounded-2xl p-4 mb-4 shadow-sm">
              <div className="flex flex-wrap gap-1.5 mb-3">
                {METRICS.map((m) => (
                  <button
                    key={m.key}
                    onClick={() => setMetric(m.key)}
                    className={`px-2.5 py-1 rounded-full text-[11px] ${metric === m.key ? 'bg-brand text-white' : 'bg-gray-100 text-gray-600'}`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
              <TrendChart records={records} metricKey={metric} unit={meta.unit} decimals={meta.decimals} />
            </div>
          )}

          {/* 最新の全指標 */}
          {latest && (
            <div className="bg-white border border-gray-100 rounded-2xl p-4 mb-4 shadow-sm">
              <div className="text-xs text-gray-500 mb-3">最新の各指標（前回比）</div>
              <div className="grid grid-cols-3 gap-3">
                {METRICS.map((m) => {
                  const v = latest[m.key]
                  const diff = previous ? v - previous[m.key] : null
                  return (
                    <div key={m.key}>
                      <div className="text-[11px] text-gray-500">{m.label}</div>
                      <div className="text-base font-bold tabular-nums">{fmt(v, m.decimals)}<span className="text-[10px] font-normal text-gray-400 ml-0.5">{m.unit}</span></div>
                      {diff !== null && Math.abs(Number(diff.toFixed(m.decimals))) > 0 && (
                        <div className={`text-[10px] tabular-nums ${diff > 0 ? 'text-red-400' : 'text-green-500'}`}>{signed(diff, m.decimals)}{m.unit}</div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* AIアドバイス */}
          <AdvicePanel goals={goals} meals={meals} latest={latest} previous={previous} />
        </>
      )}
    </div>
  )
}

function TrendChart({ records, metricKey, unit, decimals }: { records: InBodyRecord[]; metricKey: keyof InBodyMetrics; unit: string; decimals: number }) {
  const W = 320
  const H = 120
  const PAD = 8
  const pts = records.map((r) => r[metricKey])
  const min = Math.min(...pts)
  const max = Math.max(...pts)
  const range = max - min || 1
  const n = pts.length

  const x = (i: number) => (n === 1 ? W / 2 : PAD + (i * (W - PAD * 2)) / (n - 1))
  const y = (v: number) => PAD + (1 - (v - min) / range) * (H - PAD * 2)

  const line = pts.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')

  return (
    <div>
      <div className="flex justify-between text-[10px] text-gray-400 mb-1">
        <span>最大 {fmt(max, decimals)}{unit}</span>
        <span>最小 {fmt(min, decimals)}{unit}</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: H }} preserveAspectRatio="none">
        <path d={line} fill="none" stroke="#007AFF" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {pts.map((v, i) => (
          <circle key={i} cx={x(i)} cy={y(v)} r={i === n - 1 ? 4 : 2.5} fill="#007AFF" />
        ))}
      </svg>
      <div className="flex justify-between text-[10px] text-gray-400 mt-1">
        <span>{records[0].date.slice(5)}</span>
        <span>{records[n - 1].date.slice(5)}</span>
      </div>
    </div>
  )
}

const DRAFT_FIELDS: { key: keyof InBodyMetrics; label: string; unit: string; step: string }[] = [
  { key: 'weight', label: '体重', unit: 'kg', step: '0.1' },
  { key: 'bodyFatPercent', label: '体脂肪率', unit: '%', step: '0.1' },
  { key: 'muscleMass', label: '骨格筋量', unit: 'kg', step: '0.1' },
  { key: 'bmi', label: 'BMI', unit: '', step: '0.1' },
  { key: 'basalMetabolism', label: '基礎代謝', unit: 'kcal', step: '1' },
  { key: 'bodyFatMass', label: '体脂肪量', unit: 'kg', step: '0.1' },
]

const EMPTY_DRAFT: InBodyMetrics = {
  weight: 0, bodyFatPercent: 0, muscleMass: 0, bmi: 0, basalMetabolism: 0, bodyFatMass: 0,
}

function RecordInbodyPanel({ token, onClose, onSaved }: { token: string; onClose: () => void; onSaved: () => void }) {
  const [files, setFiles] = useState<File[]>([])
  const [analyzing, setAnalyzing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [draft, setDraft] = useState<InBodyMetrics | null>(null)
  const [date, setDate] = useState(toDateString(new Date()))
  const inputRef = useRef<HTMLInputElement>(null)
  const today = toDateString(new Date())

  async function analyze() {
    if (files.length === 0) return
    setAnalyzing(true)
    setError(null)
    try {
      const images = await compressImages(files)
      const metrics = await extractInbody({ images })
      setDraft(metrics)
    } catch (e) {
      setError(`解析エラー: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setAnalyzing(false)
    }
  }

  async function save() {
    if (!draft) return
    setSaving(true)
    setError(null)
    try {
      await appendInbody(token, { timestamp: new Date().toISOString(), date, ...draft })
      onSaved()
    } catch (e) {
      setError(`保存エラー: ${e instanceof Error ? e.message : String(e)}`)
      setSaving(false)
    }
  }

  return (
    <div className="bg-white border border-brand/30 rounded-2xl p-4 mb-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-semibold">InBodyを記録</span>
        <button onClick={onClose} className="text-gray-400 text-sm active:text-gray-700" aria-label="閉じる">✕</button>
      </div>

      {error && <div className="bg-red-50 text-red-600 text-xs rounded-lg p-2.5 mb-3">{error}</div>}

      {!draft ? (
        <>
          <p className="text-xs text-gray-500 mb-2">体組成計の結果用紙を撮影・選択すると、数値を自動で読み取ります。</p>
          {files.length > 0 && (
            <div className="text-xs text-gray-600 mb-2">{files.length}枚 選択中</div>
          )}
          <div className="flex gap-2">
            <label className="flex-1 bg-gray-100 text-gray-700 rounded-xl py-2.5 text-sm font-medium text-center cursor-pointer active:bg-gray-200">
              <input
                ref={inputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => { setFiles(Array.from(e.target.files ?? [])); if (inputRef.current) inputRef.current.value = '' }}
                className="hidden"
              />
              写真を選択
            </label>
            <button
              onClick={analyze}
              disabled={files.length === 0 || analyzing}
              className="flex-1 bg-brand text-white rounded-xl py-2.5 text-sm font-semibold disabled:opacity-50"
            >
              {analyzing ? '解析中…' : '解析する'}
            </button>
          </div>
          <button
            onClick={() => setDraft(EMPTY_DRAFT)}
            className="w-full mt-2 text-xs text-gray-500 active:text-gray-700"
          >
            写真なしで手入力する
          </button>
        </>
      ) : (
        <>
          <p className="text-xs text-gray-500 mb-2">読み取り結果を確認・修正してください。</p>
          <div className="mb-3">
            <label className="text-[11px] text-gray-500">測定日</label>
            <input
              type="date"
              value={date}
              max={today}
              onChange={(e) => setDate(e.target.value)}
              className="w-full mt-1 bg-gray-100 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-2.5 mb-3">
            {DRAFT_FIELDS.map((f) => (
              <div key={f.key}>
                <label className="text-[11px] text-gray-500">{f.label}{f.unit && `（${f.unit}）`}</label>
                <input
                  type="number"
                  inputMode="decimal"
                  step={f.step}
                  value={draft[f.key]}
                  onChange={(e) => setDraft({ ...draft, [f.key]: Number(e.target.value) })}
                  className="w-full mt-1 bg-gray-100 rounded-lg px-3 py-2 text-sm tabular-nums"
                />
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <button onClick={() => setDraft(null)} className="flex-1 bg-gray-100 text-gray-600 rounded-xl py-2.5 text-sm font-medium active:bg-gray-200">戻る</button>
            <button
              onClick={save}
              disabled={saving || !draft.weight}
              className="flex-1 bg-brand text-white rounded-xl py-2.5 text-sm font-semibold disabled:opacity-50"
            >
              {saving ? '保存中…' : '保存する'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}

function AdvicePanel({ goals, meals, latest, previous }: {
  goals: Goals
  meals: MealRecord[]
  latest: InBodyRecord | null
  previous: InBodyRecord | null
}) {
  const [advice, setAdvice] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const days = summarizeDays(meals, ADVICE_DAYS)
  const canGenerate = days.length > 0 || latest !== null

  async function generate() {
    setLoading(true)
    setError(null)
    try {
      const text = await fetchAdvice({ goals, days, latest, previous })
      setAdvice(text)
    } catch (e) {
      setError(`生成エラー: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-semibold">🥗 管理栄養士のアドバイス</span>
      </div>
      <p className="text-[11px] text-gray-400 mb-3">直近{ADVICE_DAYS}日間の食事記録と最新の体組成をもとにAIが講評します。</p>

      {advice ? (
        <div className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed mb-3">{advice}</div>
      ) : (
        !canGenerate && <div className="text-xs text-gray-400 mb-3">食事記録または体組成データを登録すると利用できます。</div>
      )}

      {error && <div className="bg-red-50 text-red-600 text-xs rounded-lg p-2.5 mb-3">{error}</div>}

      <button
        onClick={generate}
        disabled={loading || !canGenerate}
        className="w-full bg-brand text-white rounded-xl py-2.5 text-sm font-semibold disabled:opacity-50"
      >
        {loading ? '分析中…' : advice ? 'もう一度生成する' : 'アドバイスをもらう'}
      </button>
    </div>
  )
}
