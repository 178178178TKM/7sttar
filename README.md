# 7sttar

Obsidian Vault と連携する、メモ投入 &amp; 残タスク確認用の個人向け PWA。

- **メモタブ**: 思いついたことをその場で投稿する。投稿は Firestore の `memos` コレクションに保存され、PC側のプロセスが `00_Inbox` へ取り込む（`importedAt` を書き込む）ことで同期状態が変化する。
- **タスクタブ**: PC側が書き込んだ `tasks` を閲覧するだけの読み取り専用ビュー。完了チェックなどの操作はここでは行わない（Obsidian Vault 側で行う）。

## セットアップ

### 1. Firebase プロジェクトの作成

1. https://console.firebase.google.com/ にアクセスしてプロジェクトを作成する。
2. 「Firestore Database」→「データベースを作成」→ ロケーションは **`asia-northeast1`** を選択する。
3. 「Authentication」→「Sign-in method」→ **Google** を有効化する。
4. 「Authentication」→「Settings」→「Authorized domains」に、GitHub Pages の公開ドメイン **`178178178TKM.github.io`** を追加する。
   - **注意**: 2025-04-28 以降に新規作成した Firebase プロジェクトでは、`localhost` がデフォルトの Authorized domains に含まれていない。ローカル開発（`npm run dev`）で Google Sign-In を試す場合は、**`localhost` も手動で Authorized domains に追加する必要がある。** これを忘れると、ローカルでのサインインが `auth/unauthorized-domain` エラーで失敗する。
5. プロジェクト設定 → マイアプリ → ウェブアプリを追加 → `firebaseConfig` の値をメモする。
6. Firebase コンソールで一度 Google アカウントでサインインし（後述のローカル起動でOK）、「Authentication」→「Users」で自分の **UID** を確認する。
7. `firestore.rules` 内の `REPLACE_WITH_OWNER_UID` を、確認した実際のUIDに置き換えてから、Firebase コンソールの「Firestore Database」→「ルール」に貼り付けて公開する（このリポジトリの `firestore.rules` はバージョン管理用であり、Firebase への反映は手動、もしくは Firebase CLI での `firebase deploy --only firestore:rules` で行う）。
   - プレースホルダのままデプロイした場合、`tasksMeta/latest` への読み書きは誰にも許可されない（安全側のデフォルト）。

### 2. GitHub リポジトリの設定

1. Settings → Secrets and variables → Actions → 以下の6つを登録する。
   - `VITE_FIREBASE_API_KEY`
   - `VITE_FIREBASE_AUTH_DOMAIN`
   - `VITE_FIREBASE_PROJECT_ID`
   - `VITE_FIREBASE_STORAGE_BUCKET`
   - `VITE_FIREBASE_MESSAGING_SENDER_ID`
   - `VITE_FIREBASE_APP_ID`
2. Settings → Pages → Source = **「GitHub Actions」** を選択する。

### 3. ローカル開発

```bash
cp .env.example .env.local
# .env.local に Firebase 設定値を記入
npm install
npm run dev
```

上記「Authorized domains」に `localhost` を追加していないと、ローカルでの Google Sign-In が失敗する点に注意。

### 4. デプロイ

`main` ブランチへのプッシュで自動デプロイされる。

```bash
git push origin main
```

GitHub Actions タブでビルド・デプロイの進行を確認する。

## データモデル（Firestore）

```
memos/{id}
  text: string          // 本文（URLもここに含まれる。表示時にlinkifyする）
  createdAt: timestamp
  importedAt: timestamp | null   // PC側が 00_Inbox へ取り込んだ時刻。未取込は null
  owner: string          // Firebase Auth の uid

tasks/{id}               // PC側が書き込む。アプリからは読み取りのみ
  text: string
  category: string       // "02_Work" | "03_Criative" | "04_Learn" | "05_Life"
  scheduled: string       // "YYYY-MM-DD"（再通知日）
  sourceNote: string      // 出所（例 "2026-08-12"）
  owner: string
tasksMeta/latest          // 最終更新時刻の1ドキュメント
  updatedAt: timestamp
```

### メモの表示状態としきい値

`src/lib/constants.js` に定数化してある（変更する場合はここを編集する）。

- `FADE_AFTER_DAYS = 5`: `importedAt` からこの日数までは「同期済み」表示。
- `HIDE_AFTER_DAYS = 7`: この日数を超えると一覧から除外する（**Firestore からは削除しない**。削除するかどうかは別途ユーザー判断が必要）。
- `MEMO_EXCERPT_LIMIT = 100`: 本文の省略表示のしきい値（文字数）。
- `TASK_STALE_THRESHOLD_HOURS = 12`: `tasksMeta/latest.updatedAt` がこの時間より古いと「PCで更新されていません」の警告を出す。

## 技術スタック

- Vite 5 + React 18
- Firebase Firestore v12（`persistentLocalCache` によるオフライン対応）
- Firebase Authentication（Google Sign-In）
- Tailwind CSS 3
- GitHub Pages（GitHub Actions によるデプロイ）

## PWA アイコン

`public/favicon.svg`（紺地に金のサメ、ベクター）に加えて、`scripts/generate-icons.mjs`（`sharp` 使用）で以下の PNG を生成し、リポジトリにコミットしている。

- `public/pwa-192.png`（192×192, purpose: any）
- `public/pwa-512.png`（512×512, purpose: any）
- `public/pwa-maskable-512.png`（512×512, purpose: maskable。Android のアダプティブアイコンによる外周トリミングに備え、サメを中央のセーフゾーンに収まるよう縮小配置している）
- `public/apple-touch-icon.png`（180×180）

**アイコンの意匠（サメの形・金色）を変更する場合は、`public/favicon.svg` と `scripts/generate-icons.mjs` 内の `SHARK_SHAPE`（同じポリゴン座標を複製保持している）の両方を揃えて更新したうえで、`npm run icons` を実行し PNG を再生成すること。**（両者を分けている理由は `scripts/generate-icons.mjs` 冒頭のコメントを参照。favicon.svg はブラウザタブ用で角丸背景・背景色が異なるため、PNG生成用に独立した定義を持たせている。）`sharp` は devDependency なので、通常のビルド（`npm run build`）には含まれない。
