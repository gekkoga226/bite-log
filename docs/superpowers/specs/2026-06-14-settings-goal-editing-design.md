# Bite-Log 設定タブ（目標値編集）設計ドキュメント

**作成日**: 2026-06-14
**ステータス**: 承認済み
**対象**: 設定タブで目標カロリー・PFCを編集し Google Sheets に永続化する（Phase 3の一部）

---

## 1. 概要

### 目的

現在 `src/lib/goals.ts` の `DEFAULT_GOALS` 定数（カロリー1800 / P93 / F42 / C195）で固定されている目標値を、設定タブの画面から編集・保存できるようにする。保存先は Google Sheets の新規 `settings` タブとし、端末を越えて同期され、PWAキャッシュのクリアでも消えないようにする。

### 背景

- これまで Service Worker 更新のため PWA をホーム画面から削除・再追加する操作を繰り返してきた。この操作は localStorage を消去するため、localStorage 保存では目標値が失われる。よって Google Sheets を保存先とする。
- 目標値は「今日」タブ・「月間」タブの目標比表示で参照されるため、保存後はアプリ全体に即時反映する必要がある。

---

## 2. スコープ

### 今フェーズに含む

- 目標カロリー・タンパク質(g)・脂質(g)・炭水化物(g) の4値の編集・保存
- Google Sheets `settings` タブへの永続化（自動作成を含む）
- 起動時の目標値ロードと、今日タブ・月間タブへの反映

### 今フェーズに含まない（YAGNI）

- ダイエット開始日（将来の進捗タブ実装時に追加）
- プロフィール（身長・体重・年齢・活動レベル）
- AI目標設定チャット・InBody OCR（Phase 3の別タスク）
- Google Health連携（Fit/Health REST APIが新規PWAから利用不可のため恒久的にスコープ外）

---

## 3. データモデル

### Google Sheets `settings` タブ

単一データ行で保持する。

| セル範囲 | 内容 |
|---|---|
| A1:D1 | ヘッダー: `calories`, `protein`, `fat`, `carbs` |
| A2:D2 | 値（数値） |

- 列順は `calories, protein, fat, carbs` で固定。
- 既存の `meals` タブとは独立。既存データ・Looker Studio に影響しない。

---

## 4. アーキテクチャ

### 新規ファイル

**`src/services/settings.ts`**
- `fetchGoals(token: string): Promise<Goals>`
  - `settings!A2:D2` を読む。タブが存在しない（APIが400/該当タブなし）または値が空なら `DEFAULT_GOALS` を返す。
  - 読み取り時にタブの自動作成は行わない（閲覧のみなら書き込み不要）。
- `saveGoals(token: string, goals: Goals): Promise<void>`
  - 内部で `ensureSettingsSheet(token)` を呼び、タブが無ければ作成しヘッダー行を書く。
  - `settings!A2:D2` に値を `update`（USER_ENTERED）で書き込む。
- `ensureSettingsSheet(token: string): Promise<void>`（内部関数）
  - スプレッドシートのメタを取得し `settings` タブの有無を確認。無ければ `batchUpdate` の `addSheet` で作成し、`settings!A1:D1` にヘッダーを書く。

**`src/screens/SettingsScreen.tsx`**
- props: `{ token: string; goals: Goals; onSaved: (g: Goals) => void }`
- 4つの数値入力（カロリー・タンパク質・脂質・炭水化物）。初期値は `goals`。
- 「保存する」ボタン。保存中は無効化＋「保存中…」表示。
- 保存成功時は `onSaved(newGoals)` を呼び、成功メッセージを表示。失敗時はエラーメッセージを表示し入力値を保持。
- 入力バリデーション: 空・非数値・負数は保存不可（ボタン無効またはエラー表示）。

**`src/auth/useGoals.ts`**
- `useGoals(token: string | null)` フック。
- 戻り値: `{ goals: Goals; setGoals: (g: Goals) => void; loading: boolean }`
- token が得られたら `fetchGoals` を実行。ロード完了までは `DEFAULT_GOALS` を暫定値として返す。
- `setGoals` は保存成功後にアプリ状態を更新するために `SettingsScreen` の `onSaved` から呼ばれる。

### 既存ファイルの変更

**`src/lib/goals.ts`**
- `Goals` 型を追加: `{ calories: number; protein: number; fat: number; carbs: number }`
- `DEFAULT_GOALS` は fallback 値として残す（`Goals` 型に適合）。

**`src/App.tsx`**
- `useGoals(auth.accessToken)` で目標値を取得。
- `TodayScreen` と `MonthlyScreen` に `goals` prop を渡す。
- `settings` タブのプレースホルダを `<SettingsScreen token=... goals=... onSaved={setGoals} />` に置換。

**`src/screens/TodayScreen.tsx`**
- `DEFAULT_GOALS` の直接 import をやめ、`goals: Goals` prop を受け取って使用。

**`src/screens/MonthlyScreen.tsx`**
- 同上。`DEFAULT_GOALS` 直接参照を `goals` prop に置換。

### 目標値の受け渡し

既存コードが `token` を prop drilling している流儀に合わせ、React Context ではなく `goals` prop で各画面に渡す。小規模かつ明示的。

---

## 5. データフロー

```
アプリ起動・認証完了
  → useGoals(token) が fetchGoals 実行
      ├─ settings タブあり → A2:D2 を Goals として返す
      └─ settings タブなし／空 → DEFAULT_GOALS を返す
  → goals を TodayScreen / MonthlyScreen / SettingsScreen に prop で渡す

設定タブで編集 → 保存ボタン
  → saveGoals(token, newGoals)
      ├─ ensureSettingsSheet: タブ無ければ addSheet + ヘッダー書き込み
      └─ settings!A2:D2 を update
  → onSaved(newGoals) → App の setGoals → 全画面に即反映
```

---

## 6. エラーハンドリング

- `fetchGoals` 失敗時: `DEFAULT_GOALS` にフォールバック（アプリは動作継続）。
- `saveGoals` 失敗時: SettingsScreen にエラーメッセージ表示、入力値は保持、再試行可能。
- 入力バリデーション: カロリー・PFC が空／非数値／負数の場合は保存不可。

---

## 7. テスト方針

- `src/services/settings.ts` の純粋ロジック（行⇔Goals変換、空値時のDEFAULT_GOALSフォールバック）を Vitest で検証。
- API呼び出し（fetch）は既存サービス同様、`vi.stubGlobal('fetch', ...)` でモックして主要分岐（タブあり/なし、保存成功/失敗）を検証。
- SettingsScreen の主要な振る舞い（初期値表示・保存呼び出し・無効バリデーション）を React Testing Library で検証。
- 視覚確認は Vercel デプロイ後に iPhone で手動。

---

## 8. 完了条件

1. 設定タブで目標値を編集して保存できる。
2. 保存した値が Google Sheets `settings` タブに書き込まれる。
3. 保存後、今日タブ・月間タブの目標比表示に即時反映される。
4. アプリを再起動しても保存値が保持される。
5. `settings` タブが存在しない初回でも、保存時に自動作成される。
