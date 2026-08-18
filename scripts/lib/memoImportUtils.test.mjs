// scripts/lib/memoImportUtils.test.mjs
//
// scripts/lib/memoImportUtils.mjs の単体テスト。node:test + node:assert
// のみを使用する（追加依存なし。実行: `npm test`）。
//
// 2026-08-18 藤のレビュー指摘（重大1）を受けて追加。以前の実装は
// 「単体テスト13件すべて成功」と報告しながらテストファイルを一切
// リポジトリに残していなかった（一時スクリプトで実行して削除したと
// 推測される）ため、申告を検証できず将来の回帰も防げない状態だった。
// 今後はこのファイルが唯一の正になる。

import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, existsSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test, describe, beforeEach, afterEach } from 'node:test';

import {
  toJst,
  formatJstDateTime,
  effectiveDateJst,
  buildFrontmatter,
  parseExistingFile,
  appendMemoToFile,
  coerceCreatedAt,
  validateMemoData,
} from './memoImportUtils.mjs';

// --- テスト用ヘルパー -------------------------------------------------

/**
 * 「JST の壁時計時刻」を指定して、それに対応する UTC の Date を作る
 * （toJst() が UTC+9h で JST を表現する実装であることの逆算）。
 * 例: jstDate('2026-08-17T17:59:00') は JST 2026-08-17 17:59:00 を表す。
 */
function jstDate(isoWithoutZone) {
  const utcMs = Date.parse(`${isoWithoutZone}Z`); // 文字列をいったんUTC値として解釈
  const NINE_HOURS_MS = 9 * 60 * 60 * 1000;
  return new Date(utcMs - NINE_HOURS_MS); // 9時間引いた値が「本当のUTC」
}

// --- toJst / formatJstDateTime ----------------------------------------

describe('toJst / formatJstDateTime', () => {
  test('UTC の Date を JST（+9h）の壁時計時刻に変換する', () => {
    const utc = new Date('2026-08-17T00:00:00Z');
    const j = toJst(utc);
    assert.equal(j.getUTCFullYear(), 2026);
    assert.equal(j.getUTCMonth(), 7); // 0-indexed: 8月 = 7
    assert.equal(j.getUTCDate(), 17);
    assert.equal(j.getUTCHours(), 9);
  });

  test('日付が変わる境界（UTC 15:00 = JST 翌日 00:00）', () => {
    const utc = new Date('2026-08-16T15:00:00Z');
    const j = toJst(utc);
    assert.equal(j.getUTCDate(), 17);
    assert.equal(j.getUTCHours(), 0);
  });

  test('formatJstDateTime は "YYYY-MM-DD HH:mm" 形式で JST を返す', () => {
    const utc = new Date('2026-08-15T12:05:00Z'); // JST 21:05
    assert.equal(formatJstDateTime(utc), '2026-08-15 21:05');
  });

  test('formatJstDateTime は 0 埋めする（月・日・時・分）', () => {
    const utc = new Date('2026-01-02T00:03:00Z'); // JST 09:03
    assert.equal(formatJstDateTime(utc), '2026-01-02 09:03');
  });
});

// --- effectiveDateJst の境界値 ------------------------------------------
// CLAUDE.md §13: 実効日付は「JST時刻 + 6時間」の日付部分。18:00(JST)を
// 過ぎると翌日扱いになる。藤のレビュー指摘（重大1）で名指しされた
// 4点（17:59 / 18:00 / 23:59 / 00:00）をすべてカバーする。

describe('effectiveDateJst の境界値（18:00 切り替え）', () => {
  test('JST 17:59 → 実効日付はまだ当日', () => {
    const d = jstDate('2026-08-17T17:59:00');
    assert.equal(effectiveDateJst(d), '2026-08-17');
  });

  test('JST 18:00 ちょうど → 実効日付は翌日に切り替わる', () => {
    const d = jstDate('2026-08-17T18:00:00');
    assert.equal(effectiveDateJst(d), '2026-08-18');
  });

  test('JST 23:59 → 実効日付は翌日', () => {
    const d = jstDate('2026-08-17T23:59:00');
    assert.equal(effectiveDateJst(d), '2026-08-18');
  });

  test('JST 00:00 → 実効日付はまだ当日（前日には戻らない）', () => {
    const d = jstDate('2026-08-17T00:00:00');
    assert.equal(effectiveDateJst(d), '2026-08-17');
  });

  test('月またぎ（JST 18:00 が月末日）でも正しく繰り上がる', () => {
    const d = jstDate('2026-08-31T18:00:00');
    assert.equal(effectiveDateJst(d), '2026-09-01');
  });
});

// --- フロントマターの生成→解析ラウンドトリップ ---------------------------

describe('buildFrontmatter / parseExistingFile のラウンドトリップ', () => {
  test('memo_ids が空のとき memo_ids: [] を生成し、解析すると空配列に戻る', () => {
    const fm = buildFrontmatter({ date: '2026-08-17', memoIds: [] });
    const full = fm + '# 見出し\n\n本文\n';
    const parsed = parseExistingFile(full);
    assert.deepEqual(parsed.memoIds, []);
    assert.equal(parsed.librarianProcessed, false);
    assert.equal(parsed.body, '# 見出し\n\n本文\n');
  });

  test('memo_ids が複数あるとき、順序を保ったまま解析できる', () => {
    const memoIds = ['abc123', 'def456', 'ghi789'];
    const fm = buildFrontmatter({ date: '2026-08-17', memoIds });
    const full = fm + '本文\n';
    const parsed = parseExistingFile(full);
    assert.deepEqual(parsed.memoIds, memoIds);
  });

  test('librarian_processed: false（生成時の既定）は false として解析される', () => {
    const fm = buildFrontmatter({ date: '2026-08-17', memoIds: ['a'] });
    const parsed = parseExistingFile(fm + '本文\n');
    assert.equal(parsed.librarianProcessed, false);
  });

  test('フロントマターが無いファイルは body ごと素通りする', () => {
    const raw = '# フロントマターの無い自由記述\n本文のみ\n';
    const parsed = parseExistingFile(raw);
    assert.deepEqual(parsed.memoIds, []);
    assert.equal(parsed.librarianProcessed, false);
    assert.equal(parsed.body, raw);
  });
});

// --- librarian_processed の緩やかな照合（藤のレビュー指摘・中度3） --------

describe('parseExistingFile: librarian_processed の表記揺れ照合', () => {
  const cases = [
    ['librarian_processed: true', true],
    ['librarian_processed: false', false],
    ['librarian_processed:true', true], // コロン直後にスペースなし
    ['librarian_processed: "true"', true], // 二重引用符
    ["librarian_processed: 'true'", true], // 単一引用符
    ['librarian_processed: True', true], // 大文字小文字ゆれ
    ['librarian_processed: TRUE', true],
    ['librarian_processed:   true  ', true], // 余分な空白
    ['librarian_processed: ""', false], // 空文字列は true と読めない → false
    ['librarian_processed: ', false], // 値なし → false
    ['librarian_processed: yes', false], // "true" と読めない値は false（誤って true 側に倒さない）
  ];

  for (const [line, expected] of cases) {
    test(`"${line}" → librarianProcessed === ${expected}`, () => {
      const raw = ['---', 'source: 7sttar', 'date: 2026-08-17', 'memo_ids: []', line, '---', '', '本文'].join('\n');
      const parsed = parseExistingFile(raw);
      assert.equal(parsed.librarianProcessed, expected);
    });
  }

  test('librarian_processed_at: 行を librarian_processed の値として誤検知しない', () => {
    const raw = [
      '---',
      'source: 7sttar',
      'date: 2026-08-17',
      'memo_ids: []',
      'librarian_processed: false',
      'librarian_processed_at: 2026-08-18 09:00',
      '---',
      '',
      '本文',
    ].join('\n');
    const parsed = parseExistingFile(raw);
    assert.equal(parsed.librarianProcessed, false);
  });

  test('librarian_processed_at: だけが true 相当の値を持っていても誤検知しない', () => {
    // librarian_processed_at にたまたま "true" という文字列風の値が入っても
    // （通常ありえないが）別キーとして扱われ、librarian_processed には影響しない。
    const raw = [
      '---',
      'librarian_processed: false',
      'librarian_processed_at: true-ish-value',
      '---',
      '',
      '本文',
    ].join('\n');
    const parsed = parseExistingFile(raw);
    assert.equal(parsed.librarianProcessed, false);
  });
});

// --- coerceCreatedAt / validateMemoData（藤のレビュー指摘・中度2） --------

describe('coerceCreatedAt', () => {
  test('.toDate() を持つ Firestore Timestamp 風オブジェクトはそれを使って変換する', () => {
    const fakeTimestamp = { toDate: () => new Date('2026-08-15T12:05:00Z') };
    const result = coerceCreatedAt(fakeTimestamp);
    assert.equal(result.toISOString(), '2026-08-15T12:05:00.000Z');
  });

  test('文字列はそのまま Date に変換する', () => {
    const result = coerceCreatedAt('2026-08-15T12:05:00Z');
    assert.equal(result.toISOString(), '2026-08-15T12:05:00.000Z');
  });

  test('undefined は Invalid Date になる（呼び出し側の validateMemoData で弾く前提）', () => {
    const result = coerceCreatedAt(undefined);
    assert.ok(Number.isNaN(result.getTime()));
  });

  test('null は Invalid Date になる', () => {
    const result = coerceCreatedAt(null);
    assert.ok(Number.isNaN(result.getTime()));
  });
});

describe('validateMemoData', () => {
  test('text が文字列・createdAt が有効な Date のとき valid:true', () => {
    const result = validateMemoData({ text: '本文', createdAt: new Date('2026-08-15T12:05:00Z') });
    assert.equal(result.valid, true);
    assert.deepEqual(result.reasons, []);
  });

  test('text が空文字列でも「文字列型」なので valid:true（欠損ではなく実際に空のメモとして扱う）', () => {
    const result = validateMemoData({ text: '', createdAt: new Date('2026-08-15T12:05:00Z') });
    assert.equal(result.valid, true);
  });

  test('text が undefined（フィールド欠損）のとき invalid、理由に text が含まれる', () => {
    const result = validateMemoData({ text: undefined, createdAt: new Date('2026-08-15T12:05:00Z') });
    assert.equal(result.valid, false);
    assert.ok(result.reasons.some((r) => r.includes('text')));
  });

  test('text が数値など非文字列のとき invalid', () => {
    const result = validateMemoData({ text: 12345, createdAt: new Date('2026-08-15T12:05:00Z') });
    assert.equal(result.valid, false);
  });

  test('text が null のとき invalid、理由に text が含まれる（藤再レビュー軽微2対応。undefined・数値はカバー済みだったが null 単体のケースが漏れていた）', () => {
    const result = validateMemoData({ text: null, createdAt: new Date('2026-08-15T12:05:00Z') });
    assert.equal(result.valid, false);
    assert.ok(result.reasons.some((r) => r.includes('text')));
  });

  test('createdAt が Invalid Date（coerceCreatedAt(undefined) 相当）のとき invalid、理由に createdAt が含まれる', () => {
    const result = validateMemoData({ text: '本文', createdAt: coerceCreatedAt(undefined) });
    assert.equal(result.valid, false);
    assert.ok(result.reasons.some((r) => r.includes('createdAt')));
  });

  test('text も createdAt も不正なとき、reasons に両方の理由が含まれる', () => {
    const result = validateMemoData({ text: undefined, createdAt: coerceCreatedAt(undefined) });
    assert.equal(result.valid, false);
    assert.equal(result.reasons.length, 2);
  });
});

// --- appendMemoToFile: べき等性・ブロック判定 -----------------------------

describe('appendMemoToFile', () => {
  let dir;
  let filePath;

  beforeEach(() => {
    dir = mkdtempSync(path.join(os.tmpdir(), 'sttar-import-test-'));
    filePath = path.join(dir, '2026-08-17_7sttarメモ.md');
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  test('ファイルが存在しない場合は新規作成し、本文とメタデータを書き込む', () => {
    const createdAt = new Date('2026-08-15T12:05:00Z'); // JST 21:05
    const result = appendMemoToFile({
      filePath,
      bucketDate: '2026-08-17',
      memoId: 'memo-001',
      createdAt,
      text: 'テストメモ本文',
    });
    assert.deepEqual(result, { written: true, alreadyPresent: false, blocked: false });
    assert.ok(existsSync(filePath));
    const content = readFileSync(filePath, 'utf8');
    assert.match(content, /memo_ids:\n {2}- memo-001/);
    assert.match(content, /librarian_processed: false/);
    assert.match(content, /<!-- 7sttar-memo:id=memo-001 -->/);
    assert.match(content, /### 2026-08-15 21:05/);
    assert.match(content, /テストメモ本文/);
  });

  test('同一 memoId を2回書き込むと、2回目は alreadyPresent:true でファイル内容が変化しない（べき等性）', () => {
    const createdAt = new Date('2026-08-15T12:05:00Z');
    appendMemoToFile({ filePath, bucketDate: '2026-08-17', memoId: 'memo-001', createdAt, text: '本文A' });
    const before = readFileSync(filePath, 'utf8');

    const secondResult = appendMemoToFile({
      filePath,
      bucketDate: '2026-08-17',
      memoId: 'memo-001',
      createdAt,
      text: '本文A',
    });

    const after = readFileSync(filePath, 'utf8');
    assert.deepEqual(secondResult, { written: false, alreadyPresent: true, blocked: false });
    assert.equal(after, before);
  });

  test('異なる memoId を追記すると、既存内容を保持したまま末尾に追加される', () => {
    const createdAt1 = new Date('2026-08-15T12:00:00Z');
    const createdAt2 = new Date('2026-08-16T03:00:00Z');
    appendMemoToFile({ filePath, bucketDate: '2026-08-17', memoId: 'memo-001', createdAt: createdAt1, text: '1件目' });
    appendMemoToFile({ filePath, bucketDate: '2026-08-17', memoId: 'memo-002', createdAt: createdAt2, text: '2件目' });

    const content = readFileSync(filePath, 'utf8');
    assert.match(content, /memo_ids:\n {2}- memo-001\n {2}- memo-002/);
    assert.match(content, /1件目/);
    assert.match(content, /2件目/);
    // 追記順（古い順に呼ばれる想定）で本文にも両方残っていること
    assert.ok(content.indexOf('1件目') < content.indexOf('2件目'));
  });

  test('librarian_processed: true のファイルへは書き込まず blocked:true を返す（内容も変更しない）', () => {
    // 橘が処理済み・保留にしたファイルを模した既存ファイルを用意する
    const existing =
      buildFrontmatter({ date: '2026-08-17', memoIds: ['memo-000'] }).replace(
        'librarian_processed: false',
        'librarian_processed: true'
      ) + '# 7sttarメモ 2026-08-17\n\n<!-- 7sttar-memo:id=memo-000 -->\n### 2026-08-14 10:00\n既存メモ\n\n';
    writeFileSync(filePath, existing, 'utf8');

    const before = readFileSync(filePath, 'utf8');
    const result = appendMemoToFile({
      filePath,
      bucketDate: '2026-08-17',
      memoId: 'memo-999',
      createdAt: new Date('2026-08-17T01:00:00Z'),
      text: '混ざってはいけない本文',
    });
    const after = readFileSync(filePath, 'utf8');

    assert.deepEqual(result, { written: false, alreadyPresent: false, blocked: true });
    assert.equal(after, before); // 内容が一切変更されていないこと
    assert.doesNotMatch(after, /混ざってはいけない本文/);
  });

  test('librarian_processed の表記が揺れていても（クォート付き）ブロックされる', () => {
    const existing =
      '---\n' +
      'source: 7sttar\n' +
      'date: 2026-08-17\n' +
      'memo_ids:\n' +
      '  - memo-000\n' +
      'librarian_processed: "true"\n' +
      'librarian_processed_at: 2026-08-18 09:00\n' +
      '---\n\n' +
      '# 7sttarメモ 2026-08-17\n\n既存本文\n';
    writeFileSync(filePath, existing, 'utf8');

    const result = appendMemoToFile({
      filePath,
      bucketDate: '2026-08-17',
      memoId: 'memo-999',
      createdAt: new Date('2026-08-17T01:00:00Z'),
      text: '混ざってはいけない本文2',
    });
    assert.equal(result.blocked, true);
  });
});
