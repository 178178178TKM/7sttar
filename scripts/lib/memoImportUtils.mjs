// scripts/lib/memoImportUtils.mjs
//
// scripts/import-memos.mjs から使う純粋関数・ファイル操作ユーティリティ。
// Firestore への依存を持たない（テスト・単体動作確認をしやすくするために
// あえて分離してある）。設計: 00_Inbox/7sttarメモ取り込み処理_設計_2026-08-17.md
//
// 日時計算はすべて Asia/Tokyo を明示的に仮定して行う（OS のローカル
// タイムゾーン設定に暗黙に依存しない。実行PCのタイムゾーン設定が万一
// 日本以外になっていても、常に同じ結果になるようにするため）。

import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs';

const NINE_HOURS_MS = 9 * 60 * 60 * 1000;
const SIX_HOURS_MS = 6 * 60 * 60 * 1000;

/**
 * UTC の Date を「JST の壁時計時刻」を表す Date に変換する。
 * 戻り値の getUTCFullYear() 等を読むと JST の年月日時分秒が得られる
 * （タイムゾーン変換のトリック。日本にサマータイムが無いため常に固定+9h）。
 */
export function toJst(date) {
  return new Date(date.getTime() + NINE_HOURS_MS);
}

/** JST の "YYYY-MM-DD HH:mm" 文字列（メモ本文の見出し用）。 */
export function formatJstDateTime(date) {
  const j = toJst(date);
  const y = j.getUTCFullYear();
  const mo = String(j.getUTCMonth() + 1).padStart(2, '0');
  const d = String(j.getUTCDate()).padStart(2, '0');
  const h = String(j.getUTCHours()).padStart(2, '0');
  const mi = String(j.getUTCMinutes()).padStart(2, '0');
  return `${y}-${mo}-${d} ${h}:${mi}`;
}

/**
 * 実効日付（CLAUDE.md §13）: JST の対象時刻に6時間加算した日付部分。
 * 18:00 (JST) を過ぎると翌日扱いになる。
 *
 * 2026-08-17 ユーザー確定: バケットファイルの日付には「メモの投稿日時
 * (createdAt)」ではなく「このスクリプトを実行した時刻」の実効日付を使う。
 * この関数はどちらの用途にも使える汎用関数（呼び出し側が渡す Date で決まる）。
 */
export function effectiveDateJst(date) {
  const j = toJst(date);
  const shifted = new Date(j.getTime() + SIX_HOURS_MS);
  const y = shifted.getUTCFullYear();
  const mo = String(shifted.getUTCMonth() + 1).padStart(2, '0');
  const d = String(shifted.getUTCDate()).padStart(2, '0');
  return `${y}-${mo}-${d}`;
}

/**
 * フロントマターを生成する。`type` / `tags` は意図的に持たせない
 * （設計文書 §2.4 参照。抽出前の生素材のため、共通フロントマター
 * スキーマの対象外として扱う）。
 */
export function buildFrontmatter({ date, memoIds }) {
  const memoIdsBlock =
    memoIds.length > 0
      ? `memo_ids:\n${memoIds.map((id) => `  - ${id}`).join('\n')}`
      : 'memo_ids: []';
  return (
    '---\n' +
    'source: 7sttar\n' +
    `date: ${date}\n` +
    `${memoIdsBlock}\n` +
    'librarian_processed: false\n' +
    'librarian_processed_at: \n' +
    '---\n' +
    '\n'
  );
}

/**
 * 既存ファイルの内容から、フロントマターの memo_ids・librarian_processed
 * と、本文（フロントマターを除いた部分）を取り出す。
 * このファイルは常に本スクリプト自身が buildFrontmatter() で書いた形式
 * であることを前提にした簡易パーサーであり、汎用 YAML パーサーではない。
 */
export function parseExistingFile(raw) {
  const lines = raw.split(/\r?\n/);
  if (lines[0] !== '---') {
    return { memoIds: [], librarianProcessed: false, body: raw };
  }
  let endIdx = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i] === '---') {
      endIdx = i;
      break;
    }
  }
  if (endIdx === -1) {
    return { memoIds: [], librarianProcessed: false, body: raw };
  }

  const fmLines = lines.slice(1, endIdx);
  let bodyLines = lines.slice(endIdx + 1);
  if (bodyLines[0] === '') bodyLines = bodyLines.slice(1); // フロントマター直後の空行を1つだけ吸収
  const body = bodyLines.join('\n');

  const memoIds = [];
  let inMemoIds = false;
  let librarianProcessed = false;
  for (const line of fmLines) {
    if (/^memo_ids:\s*\[\s*\]\s*$/.test(line)) {
      inMemoIds = false;
      continue;
    }
    if (/^memo_ids:\s*$/.test(line)) {
      inMemoIds = true;
      continue;
    }
    if (inMemoIds) {
      const m = line.match(/^\s*-\s+(\S+)\s*$/);
      if (m) {
        memoIds.push(m[1]);
        continue;
      }
      inMemoIds = false;
    }
    // 2026-08-18 藤のレビュー指摘（中度2）を受けて緩和: 当初は
    // `^librarian_processed:\s*(true|false)\s*$` という完全一致に近い形
    // でしか検知できず、Obsidian の Properties パネル編集や手動整形で
    // クォートが付いたり大文字小文字が変わったりすると blocked 判定が
    // 効かなくなっていた。
    //
    // 「判定を緩める方向のみ」に限定する（ブロックし損なうこと＝安全でない
    // 方向の誤判定を避ける）ため、この正規表現でマッチした行の値が
    // 大文字小文字を無視して "true"（前後の単一/二重引用符は許容）と
    // 読み取れたときのみ true にする。それ以外（"false" はもちろん、
    // 空値・不正な値なども含む）は false のままにする —
    // つまり「true と誤読することはあっても、false 側へ誤読することはない」
    // 形にしてある。
    //
    // `librarian_processed_at:` など前方一致する別キーを誤って拾わない
    // よう、キーの直後に空白を挟んで `:` が続く行だけにマッチさせる。
    const lp = line.match(/^\s*librarian_processed\s*:\s*(.*?)\s*$/);
    if (lp) {
      const unquoted = lp[1].replace(/^(['"])(.*)\1$/, '$2').trim();
      if (/^true$/i.test(unquoted)) librarianProcessed = true;
    }
  }
  return { memoIds, librarianProcessed, body };
}

/**
 * Firestore ドキュメントの createdAt フィールド（Timestamp オブジェクトの
 * 場合も、既に文字列・数値・undefined などの場合もある）を Date に変換する。
 * Firestore SDK 自体には依存しない（`.toDate` メソッドを持つかどうかの
 * ダックタイピングのみで判定するため、テストでは素のオブジェクトを渡せる）。
 */
export function coerceCreatedAt(rawCreatedAt) {
  if (rawCreatedAt && typeof rawCreatedAt.toDate === 'function') {
    return rawCreatedAt.toDate();
  }
  // `new Date(null)` は 1970-01-01T00:00:00Z（epoch）という「有効なDate」に
  // なってしまい、欠損を Invalid Date として検知できない（`new Date(undefined)`
  // は Invalid Date になるのと非対称）。null/undefined はどちらも「欠損」
  // として明示的に Invalid Date を返すことで、validateMemoData() 側の
  // 判定に一貫して引っかかるようにする（単体テストで判明した差異。
  // 2026-08-18）。
  if (rawCreatedAt == null) {
    return new Date(NaN);
  }
  return new Date(rawCreatedAt);
}

/**
 * 1件のメモが Vault へ取り込み可能な最低限の形をしているか検証する。
 *
 * 2026-08-18 藤のレビュー指摘（重大1と対をなす中度2）を受けて追加。
 * 以前は import-memos.mjs 側で `text` が欠損・非文字列のとき無警告で
 * 空文字列に置き換え、`createdAt` が不正（`new Date(undefined)` 等で
 * Invalid Date）でもそのまま `formatJstDateTime` に渡していた。結果、
 * 見出しが `NaN-NaN-NaN NaN:NaN` になったり本文が無言で消えたりした
 * まま `importedAt` が更新され、「処理済み」に確定してしまっていた
 * （設計文書 §3.1「取りこぼしは検知不能・回復不能。ゆえに重複側に倒す」
 * と真逆の経路）。
 *
 * この関数は判定のみを行う純粋関数（ファイル・Firestore いずれにも
 * 触れない）。呼び出し側（import-memos.mjs）が invalid な場合に
 * スキップ・警告・importedAt 未更新の判断を行う。
 *
 * @returns {{valid: boolean, reasons: string[]}}
 */
export function validateMemoData({ text, createdAt }) {
  const reasons = [];
  if (typeof text !== 'string') {
    reasons.push('text が欠損しているか文字列型ではありません');
  }
  if (!(createdAt instanceof Date) || Number.isNaN(createdAt.getTime())) {
    reasons.push('createdAt が欠損しているか日時として解釈できません');
  }
  return { valid: reasons.length === 0, reasons };
}

/**
 * 一時ファイルへ書いてから rename する（同一ボリューム内では原子的な
 * 置き換えになる）。書き込み途中でプロセスが落ちても、対象ファイルは
 * 「更新前の内容のまま」か「更新後の内容」のどちらかにしかならず、
 * 中途半端な壊れたファイルが残らない。
 *
 * 万一 rename 前にクラッシュした場合、`<filePath>.tmp-<pid>-<time>` という
 * 拡張子が `.md` ではないファイルが残ることがあるが、橘の仕分け対象
 * （`-Filter *.md`）には含まれないため誤って取り込まれることはない。
 */
export function atomicWrite(filePath, content) {
  const tmpPath = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  writeFileSync(tmpPath, content, 'utf8');
  renameSync(tmpPath, filePath);
}

/**
 * 1件のメモを、日付バケットファイルへ追記する（無ければ新規作成）。
 * 既に同じ memoId が書き込み済みなら何もしない（べき等性。設計文書 §3.2）。
 *
 * 対象ファイルが既に `librarian_processed: true`（橘が処理済み・保留に
 * した後もファイルが残っているケース）だった場合は、内容を混ぜる事故を
 * 避けるため書き込みを行わず blocked:true を返す（呼び出し側で中断すること）。
 *
 * @returns {{written: boolean, alreadyPresent: boolean, blocked: boolean}}
 */
export function appendMemoToFile({ filePath, bucketDate, memoId, createdAt, text }) {
  let memoIds = [];
  let librarianProcessed = false;
  let body = `# 7sttarメモ ${bucketDate}\n\n`;

  if (existsSync(filePath)) {
    const raw = readFileSync(filePath, 'utf8');
    const parsed = parseExistingFile(raw);
    memoIds = parsed.memoIds;
    librarianProcessed = parsed.librarianProcessed;
    if (parsed.body) body = parsed.body;
  }

  if (librarianProcessed) {
    return { written: false, alreadyPresent: false, blocked: true };
  }

  if (memoIds.includes(memoId)) {
    return { written: false, alreadyPresent: true, blocked: false };
  }

  // 本文は無加工で逐語転記する（機微情報の検出・フィルタは行わない。
  // 設計文書 §7.1・椿判断ログ 2026-08-15「平文の認証情報は無言で無視する」
  // の判断は本文を読む後段の担当（橘）に委ねる）。
  const block = `<!-- 7sttar-memo:id=${memoId} -->\n` + `### ${formatJstDateTime(createdAt)}\n` + `${text}\n\n`;

  body += block;
  memoIds.push(memoId);

  const frontmatter = buildFrontmatter({ date: bucketDate, memoIds });
  atomicWrite(filePath, frontmatter + body);

  return { written: true, alreadyPresent: false, blocked: false };
}
