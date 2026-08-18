# 7sttar

Obsidian Vault と連携する、メモ投入 &amp; 残タスク確認用の個人向け PWA。

- **メモタブ**: 思いついたことをその場で投稿する。投稿は Firestore の `memos` コレクションに保存され、PC側のプロセスが `00_Inbox` へ取り込む（`importedAt` を書き込む）ことで同期状態が変化する。
- **タスクタブ**: PC側が書き込んだ `tasks` を閲覧するだけの読み取り専用ビュー。完了チェックなどの操作はここでは行わない（Obsidian Vault 側で行う）。

## Firebase プロジェクトを作る前に、ローカルだけで動作確認する

**Firebase プロジェクトを作らなくても、Firebase Local Emulator Suite を使えば PC 内だけでこのアプリの動作を確認できる。** アカウント・APIキー・インターネット接続は一切不要。

### 必要なもの

- **Java（JDK/JRE）。** Firestore エミュレータの実行に必須（`openjdk 21` 系で動作確認済み）。自宅PCなど、まだ Java を入れていない環境では事前にインストールしておくこと（`java -version` で確認できる）。
- `npm install` 済みであること（`firebase-tools` / `firebase-admin` は devDependency として同梱済み。グローバルインストール不要）。

### なぜクラウドに繋がらないのか

`.firebaserc` の projectId は **`demo-7sttar`**（`demo-` プレフィックス）にしてある。Firebase はこのプレフィックスの付いた projectId を特別扱いし、**エミュレータが実在するかどうかも確認せず、クラウド側には一切アクセスしない。** これにより、実際には存在しない `demo-7sttar` というプロジェクトでも、警告なくローカルだけで完結する。

### 手順

1. **ターミナルA**でエミュレータを起動する（起動したままにしておく）。

   ```bash
   npm run emulators
   ```

   起動が完了すると `http://127.0.0.1:4000` に Emulator UI が立ち上がる（Firestore/Authenticationの中身をブラウザから直接確認・編集できる）。

2. **ターミナルB**でサンプルデータを投入する（エミュレータが起動している間に実行すること）。

   ```bash
   npm run seed:emulator
   ```

   モック相当のメモ11件（未同期3件・同期済み4件・まもなく非表示3件・完全に非表示になる確認用1件）とタスク8件（期限超過3件を含む）、および `tasksMeta/latest` を投入し、あわせて Authentication エミュレータに固定のテストユーザー（`demo-owner@7sttar.local` / `emulator-only-password`、UIDは `firestore.rules` の `isTheOwner()` に設定されている本番所有者UIDと同じ値。`src/lib/emulatorTestUser.js` の `EMULATOR_TEST_UID` 定数を参照）を作成する。日付はすべて実行時刻からの相対値で計算されるため、いつ実行しても意図した表示状態（同期済み/まもなく非表示など）が再現される。ドキュメントIDは固定なので、何度実行しても重複しない。

3. `.env.local` を用意する（本番用の `.env.example` とは別の値でよい。ダミーで構わない）。

   ```bash
   cp .env.example .env.local
   ```

   `.env.local` の中身を以下のように編集する。

   ```
   VITE_FIREBASE_API_KEY=demo-api-key
   VITE_FIREBASE_AUTH_DOMAIN=demo-7sttar.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=demo-7sttar
   VITE_FIREBASE_STORAGE_BUCKET=
   VITE_FIREBASE_MESSAGING_SENDER_ID=
   VITE_FIREBASE_APP_ID=demo-app-id
   VITE_USE_EMULATOR=true
   ```

   `VITE_FIREBASE_PROJECT_ID` を `.firebaserc` と同じ `demo-7sttar` にすることだけが必須で、他の値はエミュレータに対しては検証されないため適当な文字列でよい。

4. **ターミナルB**（またはC）で Vite を起動する。

   ```bash
   npm run dev
   ```

   `npm run dev:local` を使うと、エミュレータと Vite をまとめて1コマンドで起動できる（初回はターミナルAでのエミュレータ起動→ターミナルBでの `npm run seed:emulator` を別途行うこと。`dev:local` は「同時に立ち上げる」だけで、シード投入までは自動化していない）。

5. ブラウザで `http://localhost:5173/` を開く。ログイン画面で **「エミュレータでログイン（テストユーザー）」**（`VITE_USE_EMULATOR=true` のときだけ表示される、本番のGoogleログインとは別の開発専用ボタン）を押すと、手順2で作成した固定テストユーザーとしてログインでき、投入済みのメモ・タスクがそのまま画面に表示される。

6. 確認が終わったらターミナルAで `Ctrl+C` を押し、**エミュレータを必ず停止する。** 起動したままにするとポートを掴み続け、後で `npm run dev` や他のアプリの邪魔になる。

### tasksMeta/latest のルール検証について

`firestore.rules` の `tasksMeta/latest` は、`isTheOwner()` に設定した本番所有者UIDのみを許可する（このリポジトリでは既に実際のUIDへ置き換え・デプロイ済み。新規プロジェクトから始める場合の初期状態については後述「1. Firebase プロジェクトの作成」手順7を参照）。ローカルエミュレータではこのファイルをフォークせずそのまま使い、`npm run seed:emulator` が **`isTheOwner()` と同じUID（`src/lib/emulatorTestUser.js` の `EMULATOR_TEST_UID` 定数）でテストユーザー**を作成することで、フォークなしにルールの検証を成立させている（判断の理由は `firestore.rules` および `src/lib/emulatorTestUser.js` 内のコメント参照）。`firestore.rules` の `isTheOwner()` のUIDを変更する場合は、`src/lib/emulatorTestUser.js` の `EMULATOR_TEST_UID` も同じ値に揃えないと、ローカルでの `tasksMeta/latest` の検証だけができなくなる（`memos` / `tasks` の owner ベースの検証には影響しない）。

### 本番ビルドへの影響について

エミュレータへの接続コード（`connectFirestoreEmulator` / `connectAuthEmulator` の呼び出しと、テスト用ダミー認証情報の文字列）は、`import.meta.env.DEV`（Viteが本番ビルド時に静的に `false` に置き換える）による分岐の内側にしかない。`npm run build` 後、`dist/assets/*.js` を `connectFirestoreEmulator` / `connectAuthEmulator` / `emulator-only-password` などの文字列で grep して、**一切含まれていないことを確認済み。** 本番ビルドは常に `.env` に設定した本物の Firebase を向く。

## セットアップ

### 1. Firebase プロジェクトの作成

1. https://console.firebase.google.com/ にアクセスしてプロジェクトを作成する。
2. 「Firestore Database」→「データベースを作成」→ ロケーションは **`asia-northeast1`** を選択する。
3. 「Authentication」→「Sign-in method」→ **Google** を有効化する。
4. 「Authentication」→「Settings」→「Authorized domains」に、GitHub Pages の公開ドメイン **`178178178TKM.github.io`** を追加する。
   - **注意**: 2025-04-28 以降に新規作成した Firebase プロジェクトでは、`localhost` がデフォルトの Authorized domains に含まれていない。ローカル開発（`npm run dev`）で Google Sign-In を試す場合は、**`localhost` も手動で Authorized domains に追加する必要がある。** これを忘れると、ローカルでのサインインが `auth/unauthorized-domain` エラーで失敗する。
5. プロジェクト設定 → マイアプリ → ウェブアプリを追加 → `firebaseConfig` の値をメモする。
6. Firebase コンソールで一度 Google アカウントでサインインし（後述のローカル起動でOK）、「Authentication」→「Users」で自分の **UID** を確認する。
7. `firestore.rules` 内のプレースホルダ（Firebase プロジェクトを新規作成した直後は `REPLACE_WITH_OWNER_UID` という文字列になっている）を、確認した実際のUIDに置き換えてから、Firebase コンソールの「Firestore Database」→「ルール」に貼り付けて公開する（このリポジトリの `firestore.rules` はバージョン管理用であり、Firebase への反映は手動、もしくは Firebase CLI での `firebase deploy --only firestore:rules --project production` で行う。`--project` が必要な理由は下記「本番へのデプロイ時の注意（`.firebaserc` について）」を参照）。
   - **このリポジトリでは既に実際のUID（`isTheOwner()` 内、本番プロジェクト `sttar-c31ad` の所有者UID）へ置き換え・デプロイ済み。** この手順7は、別の Firebase プロジェクト・別の所有者アカウントで一から立ち上げ直す場合にのみ必要になる。
   - プレースホルダのままデプロイした場合、`tasksMeta/latest` への読み書きは誰にも許可されない（安全側のデフォルト）。
   - `firestore.indexes.json` に `memos` / `tasks` 用の複合インデックス定義を含めてある（`owner`の等価フィルタ＋`createdAt`/`scheduled`のソートを組み合わせるクエリのため、本番のFirestoreでは複合インデックスが必須。ローカルエミュレータは複合インデックス無しでも動くため気づきにくい点に注意）。`firebase deploy --only firestore:indexes --project production` でまとめてデプロイできる（`firebase login` が必要）。

### 本番へのデプロイ時の注意（`.firebaserc` について）

`.firebaserc` の `default` エイリアスは、上記「Firebase プロジェクトを作る前に、ローカルだけで動作確認する」を素の `firebase` コマンドだけで安全に試せるよう、ダミープロジェクト **`demo-7sttar`** にしてある。本番プロジェクト（`sttar-c31ad`）には `production` エイリアスが割り当ててある。

```json
{
  "projects": {
    "default": "demo-7sttar",
    "production": "sttar-c31ad"
  }
}
```

そのため、`firebase deploy` 系のコマンドを**プロジェクト指定なしでそのまま実行すると `demo-7sttar`（実在しないダミープロジェクト）に向かって失敗する。** 本番へ反映する場合は、以下のいずれかで明示的に `production` を指定すること。

```bash
# コマンドのたびに指定する場合
firebase deploy --only firestore:rules --project production
firebase deploy --only firestore:indexes --project production

# または、このシェルセッションの既定を production に切り替えてから実行する場合
firebase use production
firebase deploy --only firestore:rules
```

いずれも `firebase login` 済みであることが前提（本番プロジェクトへの操作のため）。

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

## PC側のメモ取り込み処理（`npm run import:memos`）

スマホ等からアプリの「メモタブ」に投稿したメモ（Firestore の `memos` コレクション、`importedAt == null` のもの）を、PC上で実行して Obsidian Vault の `00_Inbox` へ Markdown として取り込むための CLI スクリプト。詳細な設計判断は Vault 側の `00_Inbox/7sttarメモ取り込み処理_設計_2026-08-17.md` を参照（認証方式の選定理由、取りこぼし対重複のトレードオフ、実効日付でのバケット分けなど）。

### 認証: サービスアカウント鍵

Firebase Admin SDK（サービスアカウント鍵）で認証する。`firebase login` の状態には一切依存しないため、どの PC・どの実行環境からでも同じように動く。

1. Firebase コンソール（本番プロジェクト `sttar-c31ad`）→ プロジェクト設定 → サービスアカウント → 「新しい秘密鍵の生成」で鍵（JSON）を発行する。
2. 発行した鍵ファイルを、そのPCの **`%APPDATA%\7sttar\serviceAccount.json`** に配置し、ファイル名を `serviceAccount.json` にリネームする（ダウンロード直後のファイル名は `sttar-c31ad-firebase-adminsdk-....json` のような形になっているため、リネームが必要）。
   - 例（職場PC）: `C:\Users\<ユーザー名>\AppData\Roaming\7sttar\serviceAccount.json`
   - 例（自宅PC）: `C:\Users\<ユーザー名>\AppData\Roaming\7sttar\serviceAccount.json`
   - `%APPDATA%` はリポジトリの外・Google Drive 同期対象の外にあるため、Git にも Vault にも一切含まれない（`.gitignore` の `*serviceAccount*.json` パターンにも一致する、誤コミット防止の二重の安全策）。
3. **鍵は Firestore のセキュリティルールを完全に迂回する強力な資格情報。** 発行後は当該PC以外に持ち出さない・共有しないこと。不要になった鍵は Firebase コンソールの「サービスアカウント」画面から失効できる。

### 設定ファイル: `scripts/import-config.local.json`

`00_Inbox` の絶対パスはPCごとに異なるため、Git 管理下に置けない設定ファイルで指定する。

1. `scripts/import-config.local.example.json` をコピーして `scripts/import-config.local.json` を作成する（`.gitignore` 対象なので各PCで個別に作成する必要がある）。
2. `vaultInboxDir` を、そのPCの Vault の `00_Inbox` の絶対パスに書き換える（例: `C:\\Users\\<ユーザー名>\\Desktop\\脳\\myvaultt\\00_Inbox`。JSON なのでバックスラッシュは `\\` と二重に書く）。
3. `serviceAccountKeyPath` は、鍵を既定の場所（`%APPDATA%\7sttar\serviceAccount.json`）に置いた場合は省略してよい（設定ファイル自体からキーを削除するか、値を空にせず該当行ごと削除する）。既定と異なる場所に置いた場合のみ指定する。

設定の解決順序（コマンドライン引数 → 環境変数 `STTAR_SERVICE_ACCOUNT_KEY` / `STTAR_VAULT_INBOX_DIR` → この設定ファイル → 既定値）の詳細は `node scripts/import-memos.mjs --help` で確認できる。

### 自宅PCでのセットアップ手順（まとめ）

1. リポジトリを clone する（例: `C:\Users\<ユーザー名>\dev\7sttar`）。
2. `npm install` する。
3. 上記「認証: サービスアカウント鍵」の手順で鍵を発行・配置する（職場PCの鍵をそのまま使い回すか、別途新規発行するかはユーザー判断。使い回す場合は安全な方法で移送すること）。
4. 上記「設定ファイル」の手順で `scripts/import-config.local.json` を作成する。
5. `npm run import:memos:count` を実行し、エラーなく未取り込み件数が表示されれば設定完了。

### 実行方法

```bash
# 未取り込み件数だけ確認する（Firestore・Vaultいずれも更新しない）
npm run import:memos:count

# 実際に取り込む（00_Inbox/YYYY-MM-DD_7sttarメモ.md に書き込み、
# 取り込んだメモの Firestore 側 importedAt を更新する）
npm run import:memos
```

- 鍵・設定ファイルが未整備の場合、Firestore に一切アクセスする前に原因と対処方法が分かるメッセージを出して終了する（意図した挙動）。
- `text` が欠損している、または `createdAt` が不正なメモは、警告を出したうえで取り込みをスキップする（`importedAt` は更新しない。次回実行時に再度対象になる）。
- 実行結果のサマリに「新規書き込み / 既に書き込み済みでスキップ / 不正データでスキップ」の件数が出力される。

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
