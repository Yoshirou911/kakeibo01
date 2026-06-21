# ホールデータ研究所 AI

パチンコ・スロット店舗の**過去データ傾向分析**Webアプリ（MVP版）

> ⚠️ このアプリは過去データの傾向分析ツールです。勝利・利益を保証するものではありません。
> 遊技は予算を決めて自己責任で行ってください。

---

## 主な機能

| 機能 | 内容 |
|------|------|
| 店舗登録 | 最大3店舗（無料版） |
| データ入力 | 日付・機種名・差枚/差玉・勝率など |
| CSV インポート | コピペで一括入力 |
| 分析画面 | 注目度S〜D・曜日別・日付末尾別・機種ランキング |
| AIコメント | ルールベースで自然な分析文を自動生成 |
| カレンダー | 月別に注目度を色で表示 |
| PWA | スマホのホーム画面に追加可能 |

---

## ローカルで開く方法

```bash
# 方法1: そのままブラウザで開く（Chromeなど）
# index.html をダブルクリック → Chrome にドラッグ＆ドロップ

# 方法2: ローカルサーバー（推奨・PWA機能が正しく動く）
npx serve .
# または
python -m http.server 8000
```

ブラウザで `http://localhost:8000` を開く。

---

## Vercel でデプロイする方法

### 前提
- [Vercel アカウント](https://vercel.com) を作成済み
- Git（GitHub）に push 済み

### 手順

1. [vercel.com](https://vercel.com) にログイン
2. 「Add New Project」→ GitHubリポジトリを選択
3. Framework Preset: **Other**（静的サイト）
4. Root Directory: このフォルダ（`kakeibo01-main` など）
5. 「Deploy」ボタンをクリック
6. 数秒でURLが発行される（例: `https://hdr-ai.vercel.app`）

### または Vercel CLI で一発デプロイ

```bash
npm install -g vercel
vercel
```

---

## ファイル構成

```
index.html       ← SPA本体（全ページ含む）
style.css        ← ダークテーマCSS
script.js        ← データ管理・分析・UI全ロジック
manifest.json    ← PWA設定
sw.js            ← Service Worker（オフライン対応）
icon-192.png     ← アプリアイコン（192×192）
icon-512.png     ← アプリアイコン（512×512）
README.md        ← このファイル
```

---

## データ仕様（LocalStorage）

すべてのデータはブラウザのLocalStorageに保存されます。

- `hdr_stores` — 店舗リスト（JSON配列）
- `hdr_records` — データレコード（JSON配列）

**ブラウザのデータをクリアするとデータが消えます。**  
CSV機能（Premium）でバックアップをお取りください。

---

## 免責事項

本アプリは過去の入力データを元に統計的傾向を表示するものです。  
将来の出玉・結果を予測・保証するものではありません。  
本アプリの情報を元にした遊技による損失について、開発者は一切の責任を負いません。

**ギャンブル等依存症相談コールセンター: 0120-004-008（無料・24時間）**
