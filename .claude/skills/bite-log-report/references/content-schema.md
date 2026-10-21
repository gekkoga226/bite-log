# content.json と inbody_detail の形式

`content.json` は、レポートの文章と評価をすべて持つ。グラフの数値は `chart_data.json` から描かれるので、ここには書かない。完成例は `assets/example_content.json`。

文字列には、次のインライン HTML を使ってよい。

- `<b>…</b>`：強調
- `<span class="delta-up">…</span>`：良い変化（緑）
- `<span class="delta-warn">…</span>`：注意（赤）

それ以外のタグやスタイルは入れない。画面幅によってレイアウトが崩れるため。

## トップレベル

| キー | 必須 | 内容 |
|---|---|---|
| `title` | | ページのタイトル。既定は「Bite-Log コーチングカルテ」 |
| `eyebrow` | | 見出し上の小さな行。省略すると「Bite-Log · Coaching Report · 開始 — 終了」 |
| `hero` | ✓ | `h1`（1行目）、`h1_accent`（2行目、赤字。省略可）、`lead`（2〜3文の導入） |
| `overall` | ✓ | `grade`（S/A/B/C/D）、`plus`（"+" か "" ）、`summary`（総評2〜3文。先頭を `<b>総合 B+。</b>` にする） |
| `grades` | ✓ | 6項目前後。`{name, grade, score}`。score は 0〜100 で、メーターの長さになる |
| `kpis` | ✓ | 4枚。`{label, value, unit, sub}`。value は表示用の文字列（"2,034"） |
| `body` | InBody があれば | `h2`、`lead`、`coach`（体組成の解釈。省略可） |
| `inbody_detail` | 詳細 JSON を渡すとき | `h2`、`lead`、`goal_text` |
| `protein` | ✓ | `h2`、`lead`、`coach`（省略可） |
| `daily` | ✓ | `h2`、`lead` |
| `balance` | ✓ | `h2`、`lead`、`counter_title`（朝食で最も多い品目のカウンター名）、`counter_note` |
| `consistency` | ✓ | `h2`、`lead` |
| `patterns` | ✓ | `h2`、`lead`、`fame`（2枚）、`freq`（4枚） |
| `training` | ✓ | `h2`、`lead`、`week`（7日）、`mark_legend`、`rules`（3枚） |
| `targets` | ✓ | 下記 |
| `notes` | | 注記に足す行。期間・推定値・目標値の3行は自動で入るので、それ以外（InBody の統合や日付修正、運動ログがないこと、期間の偏り）を書く |

## 各セクションの書き方

- `h2` は、そのセクションの結論を1行で書く。「〜の推移」のような説明ラベルにしない。例：「夏に筋肉が2 kg落ち、10月に取り返した」
- `lead` は2〜4文。グラフを読む前提になる数字と、何に注目するかを書く。
- `coach` は、トレーナーとしての解釈と次の一手。数字の羅列にしない。
- 画面向けの「カーソルを合わせると…」「マスを選ぶと…」といった案内は、テンプレートが自動で付ける。PDF では消える。

### kpis

例：平均カロリー、たんぱく質（1日平均と g/kg）、脂質のエネルギー比、筋肉量（最新の InBody）。期間の主題に合わせて入れ替えてよい。`sub` には比較対象を書く（目標比、前回比、期間内の最高値など）。

### patterns

- `fame`：`{tag, date, value, unit, text}`。通常は「ベストデイ・目標に最も近い日」（`stats.best_day`）と「要注意・最大カロリーの日」（`stats.max_day`）。`date` は「2026-05-27（水）」の形。
- `freq`：`{label, n, unit, note}`。`stats.foods` から、強みと課題が両方わかる4つを選ぶ（主食・汁物・麺類・揚げ物など）。

### training.week

7日分。

```json
{"dn": "MON", "title": "上半身 A", "kind": "up|low|rest", "mark": false,
 "items": [["ベンチプレス", "4×6–8"], ["8,000歩を目安に歩く"]]}
```

- `kind` は色分けになる。上半身が `up`（青）、下半身が `low`（緑）、休養が `rest`（グレー）。
- `mark: true` にすると赤枠で強調する（例：食べすぎやすい曜日）。その意味を `mark_legend` に書く。
- `items` の2つ目の要素はセット×レップ。なければ省略する。

### targets

```json
{"h2": "次の4週間の数値目標", "lead": "…", "eyebrow": "Next 4 weeks", "actual_label": "3か月の実績",
 "rows": [["項目", "実績", "次の目標", "具体策"], …],
 "swaps_title": "夕食の置き換え表", "swap_diff_label": "脂質の差", "swaps": [["いつもの", "置き換え", "差"], …],
 "checklist_title": "4週間チャレンジ", "checklist": ["…", …]}
```

`actual_label` は期間の長さに合わせる（「3か月の実績」など）。`swaps` は省略できる。チェックリストは6〜8項目。

## inbody_detail_<date>.json

InBody 結果シートの写真から書き起こす。測っていない項目は `null` にする。

```json
{
  "date": "2026-06-26",
  "profile": {"height_cm": 172, "age": 34, "sex": "女性"},
  "score": 79, "weight": 64.5, "muscle": 49.8, "fat_mass": 11.7, "fat_pct": 18.1, "bmi": 21.8,
  "smm": 29.6, "smm_range": "27.0〜33.0", "visceral": 4, "waist": 78.2, "bmr": 1506, "smi": 7.9,
  "lean": [["左腕", 2.71, 89.3], ["右腕", 2.80, 92.1], ["体幹", 23.4, 96.0], ["左脚", 8.52, 100.4], ["右脚", 8.47, 99.8]],
  "fat":  [["左腕", 0.7, 104.0], ["右腕", 0.6, 96.5], ["体幹", 5.4, 121.0], ["左脚", 2.0, 110.8], ["右脚", 2.0, 110.5]],
  "goal": {"muscle_now": 49.8, "fat_now": 11.7, "weight_now": 64.5,
           "muscle_change": 1.8, "fat_change": -1.5, "weight_target": 64.6, "weight_change": 0.1}
}
```（数値は架空の例）

- `lean` / `fat` は `[部位, kg, 標準に対する%]`。
- `goal` は結果シート右側の「体重調節」欄から取る。適正体重、脂肪調節、筋肉調節。
- `profile` はページには出さない。g/kg やトレーニング強度を考えるときに使う。
