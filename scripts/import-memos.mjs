#!/usr/bin/env node
// scripts/import-memos.mjs
//
// 7sttar（Firestore の memos コレクション）から、まだ Vault に取り込まれて
// いないメモ（importedAt == null）を取得し、00_Inbox に日付ごとの
// Markdown ファイルとして書き出したうえで、Firestore 側の importedAt を
// 更新する。
//
// 設計文書: 00_Inbox/7sttarメモ取り込み処理_設計_2026-08-17.md
// （このスクリプトを読む前に一度目を通すこと。特に §1〜§4 の判断根拠）
//
// 【重要な設計判断（要点だけ再掲）】
// - 認証は Firebase Admin SDK（サービスアカウント鍵）。鍵の発行・配置は
//   このスクリプトの担当ではない（椿が配置する）。パスは環境変数か
//   ローカル設定ファイルで外部から与える（下記「設定の解決順序」）。
//   既定値は %APPDATA%\7sttar\serviceAccount.json（2026-08-17 椿確定。
//   職場PCには配置済み。自宅PCには未配置 — 実行すると「鍵が見つからない」
//   旨のエラーで終了する。これは正常な挙動）。
// - 書き込み順序は「Vault 書き込み成功 → Firestore importedAt 更新」に
//   固定する。取りこぼし（検知不能・回復不能）より重複（検知可能）を
//   許容する（設計文書 §3）。そのためメモ1件ごとに「書き込み→即
//   importedAt更新」を行い、まとめて処理してから最後に一括更新、
//   という形にはしない。
// - バケットファイルの日付は「メモの投稿日」ではなく「このスクリプトを
//   実行した時刻」の実効日付（18:00境界、CLAUDE.md §13）を使う
//   （2026-08-17 ユーザー確定。当初設計案からの変更）。1回の実行で
//   複数の投稿日のメモが同じファイルに入りうるため、各メモの見出しには
//   投稿日時（createdAt、JST、変換なしの原文のまま）を記録する。
// - ファイル名は日付を先頭に置く（YYYY-MM-DD_7sttarメモ.md）。理由は
//   .claude/skills/librarian-trigger-scan の仕分け対象判定にある
//   （日付が先頭のファイル名は「ファイル名の日付」でグルーピングされる
//   一方、それ以外の自由記述ファイルは「OSの作成日時」でグルーピング
//   される。日付を先頭に置かないと、バックログ取り込み時のグルーピング
//   が実行日基準に寄ってしまい、後から見たときに紛らわしくなる）。
// - Firestore クエリは where('owner','==',...).orderBy('createdAt','desc')
//   という、src/hooks/useMemos.js と全く同じ形（firestore.indexes.json に
//   既にデプロイ済みの複合インデックスで足りる形）のみをサーバーへ投げ、
//   取得後にスクリプト側で配列を反転して古い順に処理する。
//   importedAt == null の絞り込みもこのスクリプト内（クライアント側）で
//   行う。当初は 'asc' + サーバー側フィルタを検討したが、実際に動作確認
//   したところ owner+importedAt+createdAt という新しい複合インデックスが
//   要求され（FAILED_PRECONDITION）、そのデプロイには firebase login が
//   必要になる（§1.1の問題に抵触する）ため、既存インデックスの範囲で
//   完結するこの形に変更した（詳細は main() 内のコメント、設計文書
//   §7.4 参照）。個人利用規模の読み取り量では無料枠に対して無視できる
//   コスト増と判断した。
// - 2026-08-18 藤のレビュー指摘（重大扱いではないが藤の提案）を受けて
//   `.limit()` 自体を撤去した。以前は降順取得＋反転のため `.limit(2000)`
//   が実質「新しい方から2000件」を意味し、生涯メモ総数が2000件を超えると
//   古い未取り込みメモが取得範囲から外れる恐れがあった。limit を外せば
//   新規インデックスも firebase login も不要でこの制約が根本解消する
//   （個人利用規模なら Spark の無料枠、読み取り5万回/日には遠く及ばない）。
//   代わりに、取得件数が STALE_DOC_COUNT_WARNING_THRESHOLD を超えたら
//   「異常な滞留の兆候かもしれない」という警告のみ出す（処理は打ち切らない）。

import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { appendMemoToFile, coerceCreatedAt, effectiveDateJst, validateMemoData } from './lib/memoImportUtils.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const OWNER_UID = '86QwIlJqwJTQtOT9jHznrumEGm72'; // firestore.rules の isTheOwner() と同じ値（コンソール Authentication タブで確認済みの本番所有者UID）
const PROJECT_ID_EXPECTED = 'sttar-c31ad';
// 2026-08-18: 取得件数に .limit() は掛けない（上記ファイル冒頭コメント参照）。
// この閾値は取得を打ち切るためのものではなく、「異常な滞留」を検知して
// 警告だけ出すための目安値。
const STALE_DOC_COUNT_WARNING_THRESHOLD = 5000;

function fail(message) {
  console.error(`[import-memos] ${message}`);
  process.exit(1);
}

function parseArgs(argv) {
  const args = { countOnly: false, serviceAccountKeyPath: undefined, vaultInboxDir: undefined };
  for (const a of argv) {
    if (a === '--count-only') args.countOnly = true;
    else if (a.startsWith('--service-account-key=')) args.serviceAccountKeyPath = a.slice('--service-account-key='.length);
    else if (a.startsWith('--vault-inbox-dir=')) args.vaultInboxDir = a.slice('--vault-inbox-dir='.length);
    else if (a === '--help' || a === '-h') {
      console.log(
        [
          '使い方: node scripts/import-memos.mjs [オプション]',
          '',
          'オプション:',
          '  --count-only                 書き込み・更新を行わず、未取り込み件数だけ表示する',
          '  --service-account-key=<path> サービスアカウント鍵のパスを明示指定（既定値・環境変数・設定ファイルより優先）',
          '  --vault-inbox-dir=<path>     00_Inbox の絶対パスを明示指定（同上）',
          '',
          '設定の解決順序（各項目とも上ほど優先）:',
          '  1. コマンドライン引数（上記）',
          '  2. 環境変数 STTAR_SERVICE_ACCOUNT_KEY / STTAR_VAULT_INBOX_DIR',
          '  3. scripts/import-config.local.json（Git管理外。scripts/import-config.local.example.json を参照）',
          '  4. 既定値（サービスアカウント鍵のみ。%APPDATA%\\7sttar\\serviceAccount.json）',
          '',
          '00_Inbox の絶対パスには既定値が無いため、環境変数か設定ファイルでの指定が必須。',
        ].join('\n')
      );
      process.exit(0);
    }
  }
  return args;
}

function loadLocalConfig() {
  const configPath = path.join(__dirname, 'import-config.local.json');
  if (!existsSync(configPath)) return {};
  try {
    return JSON.parse(readFileSync(configPath, 'utf8'));
  } catch (e) {
    fail(
      `${configPath} の読み込みに失敗しました（JSONとして不正、または読み取り権限がありません）: ${e.message}`
    );
    return {}; // fail() は exit するのでここには到達しないが、静的解析用に一応返しておく
  }
}

const cli = parseArgs(process.argv.slice(2));
const localConfig = loadLocalConfig();

// 既定のサービスアカウント鍵の場所: %APPDATA%\7sttar\serviceAccount.json
// （2026-08-17 椿確定。Google Drive 非同期・Vault外・リポジトリ外であり、
// ユーザー名が異なる両PCでも同じ相対規則で通る）。
// %APPDATA% は通常 Windows で常に定義されているが、未定義の環境
// （Windows以外での誤実行など）では、既定値を計算できない旨を明確に
// エラーにする（path.join(undefined, ...) の分かりにくい例外にしない）。
function resolveDefaultServiceAccountKeyPath() {
  const appData = process.env.APPDATA;
  if (!appData) {
    fail(
      '環境変数 APPDATA が定義されていないため、既定のサービスアカウント鍵の場所を決定できません\n' +
        '  （Windows 以外の環境で実行していませんか）。\n' +
        '  環境変数 STTAR_SERVICE_ACCOUNT_KEY か scripts/import-config.local.json の\n' +
        '  "serviceAccountKeyPath" でパスを明示してください。'
    );
  }
  return path.join(appData, '7sttar', 'serviceAccount.json');
}

const serviceAccountKeyPath =
  cli.serviceAccountKeyPath ||
  process.env.STTAR_SERVICE_ACCOUNT_KEY ||
  localConfig.serviceAccountKeyPath ||
  resolveDefaultServiceAccountKeyPath();

const vaultInboxDir =
  cli.vaultInboxDir || process.env.STTAR_VAULT_INBOX_DIR || localConfig.vaultInboxDir || null;

// --- ここから、Firestore に一切触れる前の事前チェック -------------------
// 「鍵が無い」「00_Inbox のパスが無い」は日常的に起こりうる正常な状態
// （鍵は椿がまだ配置していない、または自宅PCのようにまだ一度も配置して
// いない、等）なので、意味不明なスタックトレースで落ちるのではなく、
// 原因と次に何をすればよいかが分かる短いメッセージで終了する。

if (!existsSync(serviceAccountKeyPath)) {
  fail(
    `サービスアカウント鍵が見つかりません: ${serviceAccountKeyPath}\n` +
      '  Firebase コンソール（プロジェクト設定 → サービスアカウント → 新しい秘密鍵の生成）で\n' +
      `  発行し、このPCの ${serviceAccountKeyPath} に配置してください。\n` +
      '  （鍵の発行・配置はこのスクリプトの担当ではなく、椿・ユーザー側の作業です。\n' +
      '  まだ配置されていないPCで実行した場合、このメッセージが表示されるのは正常な挙動です。）\n' +
      '  既定と異なる場所に置く場合は、環境変数 STTAR_SERVICE_ACCOUNT_KEY か\n' +
      '  scripts/import-config.local.json の "serviceAccountKeyPath" で指定してください。'
  );
}

let serviceAccountKey;
try {
  serviceAccountKey = JSON.parse(readFileSync(serviceAccountKeyPath, 'utf8'));
} catch (e) {
  fail(`サービスアカウント鍵の読み込みに失敗しました（${serviceAccountKeyPath}）: ${e.message}`);
}

if (!vaultInboxDir) {
  fail(
    'Vault の 00_Inbox の絶対パスが指定されていません（PCごとに異なるため既定値はありません）。\n' +
      '  環境変数 STTAR_VAULT_INBOX_DIR か scripts/import-config.local.json の\n' +
      '  "vaultInboxDir" で指定してください（設定例: scripts/import-config.local.example.json）。'
  );
}
if (!existsSync(vaultInboxDir) || !statSync(vaultInboxDir).isDirectory()) {
  fail(`指定された 00_Inbox が見つからないか、ディレクトリではありません: ${vaultInboxDir}`);
}

if (serviceAccountKey.project_id && serviceAccountKey.project_id !== PROJECT_ID_EXPECTED) {
  console.warn(
    `[import-memos] 警告: 鍵の project_id (${serviceAccountKey.project_id}) が想定 (${PROJECT_ID_EXPECTED}) と異なります。別プロジェクト用の鍵の可能性があります。`
  );
}

// --- ここから Firestore にアクセスする ----------------------------------
// firebase-admin の読み込み・初期化は事前チェックが全て通ってから行う
// （鍵が無い状態で firebase-admin を読み込んでも実害はないが、上記の
// チェック群を「Firestore に一切触れない純粋な事前検証」として明確に
// 分離しておくため、意図的にここで import する）。

const { initializeApp, cert } = await import('firebase-admin/app');
const { getFirestore, FieldValue } = await import('firebase-admin/firestore');

let db;
try {
  initializeApp({ credential: cert(serviceAccountKey) });
  db = getFirestore();
} catch (e) {
  fail(`サービスアカウント鍵の内容が不正で、Firebase Admin SDK の初期化に失敗しました: ${e.message}`);
}

async function main() {
  const now = new Date();
  const bucketDate = effectiveDateJst(now); // 2026-08-17 ユーザー確定: 実行日の実効日付でバケット分けする
  const fileName = `${bucketDate}_7sttarメモ.md`;
  const filePath = path.join(vaultInboxDir, fileName);

  // orderBy('createdAt','desc') は src/hooks/useMemos.js と全く同じ形（owner
  // 等価 + createdAt 降順）であり、firestore.indexes.json に既に定義・
  // デプロイ済みの複合インデックスをそのまま使える。'asc' にすると
  // （実際に動作確認したところ）別方向の複合インデックスが新たに必要になり
  // FAILED_PRECONDITION で失敗したため、意図的に 'desc' + 取得後に reverse()
  // する形にしてある（新しい複合インデックスのデプロイ — firebase login が
  // 要る — を避けるため。設計文書 §7 追記参照）。
  const snapshot = await db
    .collection('memos')
    .where('owner', '==', OWNER_UID)
    .orderBy('createdAt', 'desc')
    .get();

  // 古い順に処理したいので反転する。
  // 2026-08-18: 以前は .limit(FETCH_LIMIT) を掛けていたため、降順取得＋反転の
  // 都合上「新しい方から数えてFETCH_LIMIT件」しか取得できず、生涯メモ総数が
  // FETCH_LIMIT を超えると古い未取り込みメモが取得範囲から外れる恐れが
  // あった。limit を撤去し、常に全件（owner一致分）取得する形にしたことで
  // この制約は根本解消した。
  const allDocs = snapshot.docs.slice().reverse();
  const pending = allDocs.filter((d) => d.get('importedAt') == null);

  if (allDocs.length >= STALE_DOC_COUNT_WARNING_THRESHOLD) {
    console.warn(
      `[import-memos] 警告: 取得件数(${allDocs.length}件)が閾値(${STALE_DOC_COUNT_WARNING_THRESHOLD})を超えました。owner=${OWNER_UID} の memos が想定より多い可能性があります（importedAt が更新され続けない不具合等、異常な滞留の兆候かもしれません）。`
    );
  }

  if (cli.countOnly) {
    console.log(`[import-memos] 未取り込み: ${pending.length}件（owner全体: ${allDocs.length}件中）`);
    process.exit(0);
  }

  if (pending.length === 0) {
    console.log('[import-memos] 未取り込みのメモはありません（0件）');
    process.exit(0);
  }

  let written = 0;
  let skippedAlreadyPresent = 0;
  let skippedInvalid = 0;
  let importedAtFailures = 0;

  for (const doc of pending) {
    const data = doc.data();
    const memoId = doc.id;
    const createdAt = coerceCreatedAt(data.createdAt);
    const text = data.text;

    // 2026-08-18 藤のレビュー指摘（中度2）を受けて追加: text が欠損・
    // 非文字列、または createdAt が欠損・不正（new Date(undefined) 等で
    // NaN になる）場合、以前は無警告で text を空文字列に置き換え、
    // そのまま importedAt を更新して「処理済み」に確定させていた。
    // これは設計文書 §3.1 の核心（取りこぼしは検知不能・回復不能、重複は
    // 検知可能。ゆえに重複側に倒す）と真逆の経路になっていたため、
    // このメモは取り込まず・importedAt も更新せずにスキップする形に変更
    // した。次回実行時に importedAt == null のまま再度対象になるため、
    // 取りこぼしにはならない（Firestore 側のデータが直らない限り毎回
    // スキップされ続けるが、それは意図どおり — 気づけない消失より、
    // 気づける・実害の小さい「毎回警告が出続ける」状態を選んでいる）。
    // 検証ロジック自体は memoImportUtils.mjs の validateMemoData()
    // （Firestoreに依存しない純粋関数。単体テスト対象）に切り出してある。
    const validation = validateMemoData({ text, createdAt });

    if (!validation.valid) {
      skippedInvalid += 1;
      console.warn(
        `[import-memos] 警告: メモをスキップしました（memoId=${memoId}）: ${validation.reasons.join(' / ')}。` +
          ' Vaultへの書き込み・importedAtの更新のどちらも行っていません（本文の内容はログに出しません。Firestore 側を直接ご確認ください）。'
      );
      continue;
    }

    const result = appendMemoToFile({ filePath, bucketDate, memoId, createdAt, text });

    if (result.blocked) {
      fail(
        `${filePath} は既に librarian_processed: true（橘が処理済み・保留）です。\n` +
          '  内容が混ざる事故を避けるため、このファイルへの追記を中断します。\n' +
          `  Firestore 側は更新していません（残り ${pending.length - (written + skippedAlreadyPresent + skippedInvalid)}件が未処理のままです）。\n` +
          '  状況を確認したうえで再実行してください。'
      );
    }
    if (result.written) written += 1;
    if (result.alreadyPresent) skippedAlreadyPresent += 1;

    // Vault への書き込み（または「既に書き込み済みと確認できた」こと）が
    // 済んでから importedAt を更新する。順序は絶対に逆にしない（設計文書 §3.1）。
    try {
      await doc.ref.update({ importedAt: FieldValue.serverTimestamp() });
    } catch (e) {
      importedAtFailures += 1;
      console.error(`[import-memos] importedAt の更新に失敗しました（memoId=${memoId}）: ${e.message}`);
      console.error('  Vaultへの書き込みは完了しているため、このメモは次回実行時に再取得され、重複として書き込まれる可能性があります（意図的な設計。設計文書 §3.1 参照）。');
    }
  }

  console.log(`[import-memos] 完了: ${filePath}`);
  console.log(
    `  新規書き込み: ${written}件 / 既に書き込み済みでスキップ: ${skippedAlreadyPresent}件 / 不正データでスキップ: ${skippedInvalid}件`
  );
  if (skippedInvalid > 0) {
    console.warn(`  不正データでスキップ: ${skippedInvalid}件（上記の警告ログを参照。importedAt は更新していないため次回再度対象になります）`);
  }
  if (importedAtFailures > 0) {
    console.warn(`  importedAt 更新失敗: ${importedAtFailures}件（上記のログを参照）`);
  }
}

main().catch((err) => {
  if (process.env.STTAR_DEBUG) {
    console.error(err);
  } else {
    console.error(`[import-memos] 予期しないエラーで終了しました: ${err.message || err}`);
    console.error('  詳細なスタックトレースを見るには、環境変数 STTAR_DEBUG=1 を設定して再実行してください。');
  }
  process.exit(1);
});
