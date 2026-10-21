---
name: bite-log-report
description: Bite-Log の食事記録（Google スプレッドシート）と InBody の体組成データから、指定した期間について、筋トレトレーナー目線の食事・運動フィードバックレポート（ビジュアル重視の HTML と、スマホで読む1ページの縦長 PDF）を作る。「レポート作って」「7月〜9月のフィードバックを出して」「直近3か月を振り返りたい」「先月の食事を評価して」「InBody の結果も入れてレポート更新」「コーチングカルテを作り直して」など、Bite-Log の食事・体組成・トレーニングをまとめて振り返る依頼では、スキル名が出なくても必ずこのスキルを使う。期間の指定がなければ直近6か月で作る。
---

# Bite-Log コーチングレポート

Bite-Log に記録された食事と InBody の測定から、期間を指定して「コーチングカルテ」を作る。数値の集計とページの描画はスクリプトが受け持ち、Claude は**数字を読んでトレーナーとしての評価と言葉を書く**ことに集中する。

完成形の見本は `assets/example_content.json`（架空の人物で書いた6か月分のレポートの文章）。トーン、文章の長さ、各セクションの役割は、これに合わせる。

## 全体の流れ

1. 期間を決める
2. スプレッドシートを xlsx で取得する
3. InBody の結果シートがあれば取り込む
4. `analyze.py` で集計する
5. `stats.md` を読み、`content.json`（評価と文章）を書く
6. `build.py` で HTML と PDF を作る
7. プレビューを一度見て直し、ユーザーに渡す

作業ファイルはセッションの scratchpad（なければ一時ディレクトリ）に `bitelog-report-<start>_<end>/` を作って置く。成果物だけをリポジトリの `output/` に出す。

## 1. 期間を決める

- 「2026-07-01〜2026-09-30」「7月から9月」「直近3か月」「先月」などを `--start` / `--end`（YYYY-MM-DD）に変換する。今日の日付を基準にする。
- 指定がなければ、今日を終点に直近6か月。
- 解釈が分かれそうなとき（「夏」など）は、決めた期間を最初の返信で一行伝えて進める。止めて質問するほどではない。

## 2. スプレッドシートを取得する

- スプレッドシート ID は、リポジトリの `.env.local` にある `VITE_SPREADSHEET_ID`。キーなどほかの値は表示しない。
- Google Drive コネクタの `download_file_content` に `exportMimeType: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` を指定する。結果が大きいとツール結果ファイルに保存されるので、そのパスを渡して xlsx に戻す。
  ```
  python scripts/extract_xlsx.py <tool-result-file> <work>/bitelog.xlsx
  ```
- `read_file_content` は先頭のサンプル行しか返さないので、集計には使わない。
- Drive コネクタが使えない場合は、スプレッドシートを xlsx でダウンロードしてもらい、そのパスを使う。

## 3. InBody のデータを用意する

InBody のデータは、次の優先順で使う。

1. **スプレッドシートの `inbody_full` シート**。アプリの進捗画面にある「CSV取込」で、InBody アプリのエクスポート CSV を取り込むと作られる。全測定の正確な測定日時に加えて、筋肉量・骨格筋量・部位別の値・InBody 点数が入る。xlsx に含まれるので、追加の作業はいらない。
2. **InBody のエクスポート CSV**（ユーザーがファイルを渡したとき）。`--inbody-csv` で渡す。受け取ったファイルは `output/data/InBody-<日付>.csv` に保存しておく。アプリにも反映したいと言われたら、アプリの「CSV取込」を案内する（このセッションからはスプレッドシートに書き込めない）。
3. 上の2つがないときだけ、アプリの `inbody` シートと、結果シートの写真から書き起こした `output/data/inbody_history.csv`（`--inbody-history`）を使う。アプリは登録日を測定日として保存していることがある（最大8日のずれを確認済み）。analyze.py は、値が一致して14日以内の行を履歴の日付に寄せる。

`inbody` シートの `muscleMass` は**骨格筋量**（体重の4〜5割程度）。CSV 取り込みより前に写真の OCR で登録した行には、筋肉量（7〜8割）が入っていることがある。レポートのグラフは**筋肉量**を使う。この値は 1 と 2 から読む。

**結果シートの写真**があるときは、その回の詳細（部位別の「標準に対する %」、体重調節）を `output/data/inbody_detail_<測定日>.json` に書き起こす。形式は `references/content-schema.md` の「inbody_detail」。CSV には部位別の kg はあるが「標準に対する %」がないので、InBody 詳細のセクションは写真があるときだけ作る。部位別の図は、図の左側に「左」、右側に「右」と書かれている。図の左上の値が左腕。

## 4. 集計する

```
python scripts/analyze.py --xlsx <work>/bitelog.xlsx --start <start> --end <end> --out-dir <work> \
    [--inbody-csv output/data/InBody-<日付>.csv] [--inbody-history output/data/inbody_history.csv]
```

InBody の出どころ（`inbody_full` / CSV / シート＋履歴）は `stats.md` の InBody 行に出る。

`chart_data.json`（ページに埋め込むデータ）、`stats.json`、`stats.md` ができる。`stats.md` は標準出力にも出る。

- 栄養の平均は「朝・昼・夕の3食がそろった日」だけで出す。欠食のある日を混ぜると、平均がまとめて下がるため。
- 3食そろった日が 0 日だとエラーで止まる。その場合は期間を広げるよう提案する。

## 5. 評価と文章を書く（content.json）

先に `references/coaching-guide.md`（評価の基準と、過去の失敗から得た注意点）と `references/content-schema.md`（各フィールドの役割）を読む。書き方の手本は `assets/example_content.json`。

守ること:

- **数字はすべて `stats.md`（と inbody_detail）から取る。** 文章に出す数字は、手元のデータで確かめられるものだけにする。丸めるときは表示と一致させる。
- **InBody の変化は、測定の並び（`intervals`）を見てから解釈する。** 1回だけ外れた値は測定ブレの可能性がある。何回も続けて同じ方向に動いているなら、本当に起きている変化。前後を見ずに「ブレ」と決めない。
- **運動の記録はデータにない。** 運動メニューは体組成と食事からの提案だと明記する。
- 期間が短い、3食そろった日が少ない、といった読み方の注意は本文か注記に書く。
- 文章は日本語で、トレーナーが本人に話しかける調子にする。具体的な食べ物の名前と数字で語る。お世辞や決まり文句は入れない。

`content.json` は作業ディレクトリに保存する。

## 6. HTML と PDF を作る

```
python scripts/build.py --work-dir <work> \
    --out-html output/html/bite_log_coaching_report_<start>_<end>.html \
    --out-pdf  output/pdf/bite_log_coaching_report_<start>_<end>.pdf \
    --detail output/data/inbody_detail_<date>.json \
    --preview-dir <work>/preview
```

- `--detail` は、測定日が期間内にある詳細 JSON のうち最新のものを渡す。なければ省略する。InBody 詳細のセクションは表示されない。
- PDF は幅500px・余白なしの**縦長1ページ**。スマホで縦にスクロールして読む想定。ページの高さは印刷結果から測って合わせる（2回出力する）ので、少し時間がかかる。
- Chrome / Edge が必要。見つからないときは `--chrome` でパスを渡す。Python は `jinja2`、`openpyxl`、`PyMuPDF`（fitz）、`Pillow` を使う。

## 7. 確認して渡す

- `<work>/preview/pdf_overview.png`（PDF全体を縦に分割して並べた画像）と `desktop_top.png` を一度だけ見る。ラベルの重なり、はみ出し、文章とグラフの食い違いを探し、見つけたら `content.json` か期間を直して、もう一度ビルドする。確認を何度も繰り返さない。
- ユーザーには、HTML と PDF のパス、総合評価と主な指摘を3〜5点、データの注意点を伝える。ファイル送信ツールが使えない環境もあるので、パスは必ず本文に書く。
- HTML のチェックリストは、ブラウザごとに状態を覚える。PDF では空欄で印刷される。

## ファイル

- `scripts/extract_xlsx.py`：Drive の出力から xlsx を復元する
- `scripts/analyze.py`：集計。ヘッダー名で列を読むので、旧フォームのシートとアプリのシートで列順が違っても扱える
- `scripts/build.py`：テンプレートの描画、縦長1ページ PDF の出力、プレビュー画像
- `assets/template.html`：ページのデザイン（Jinja2）
- `assets/example_content.json`：文章の見本
- `references/content-schema.md`：content.json と inbody_detail の形式
- `references/coaching-guide.md`：評価の基準、トレーニングと栄養の目安、注意点
