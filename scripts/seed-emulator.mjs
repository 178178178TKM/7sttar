#!/usr/bin/env node
// scripts/seed-emulator.mjs
//
// 起動中の Firebase Local Emulator Suite (Firestore + Auth) に、モック
// (memo-feed-mock.html) 相当のサンプルデータを流し込む。
// 先に `npm run emulators` でエミュレータを起動しておくこと（このスクリプトは
// 新たにエミュレータを起動しない。既存の実行中インスタンスに接続する）。
//
// 日付は「今」からの相対オフセットで組み立てている（固定の絶対日付にすると、
// 実行するタイミング次第で FADE_AFTER_DAYS / HIDE_AFTER_DAYS のしきい値を
// 跨いでしまい、狙った表示状態（同期済み/まもなく非表示など）を再現できなく
// なるため）。
//
// owner フィールド・Auth エミュレータのテストユーザーは
// src/lib/emulatorTestUser.js の固定値を共有で使う（そちらにも理由を記載）。
//
// べき等性: ドキュメントIDを固定（memo-01 等）にしているため、何度実行しても
// 上書きされるだけで重複は増えない。

import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import {
  EMULATOR_TEST_UID,
  EMULATOR_TEST_EMAIL,
  EMULATOR_TEST_PASSWORD,
} from '../src/lib/emulatorTestUser.js';
import { FADE_AFTER_DAYS, HIDE_AFTER_DAYS } from '../src/lib/constants.js';

// firebase.json の emulators.firestore.port / emulators.auth.port と一致させること。
process.env.FIRESTORE_EMULATOR_HOST ||= '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST ||= '127.0.0.1:9099';

const PROJECT_ID = 'demo-7sttar'; // .firebaserc の default と一致させること

initializeApp({ projectId: PROJECT_ID });
const db = getFirestore();
const auth = getAuth();

const now = new Date();

function hoursAgo(h) {
  return new Date(now.getTime() - h * 60 * 60 * 1000);
}
function daysAgo(d) {
  return hoursAgo(d * 24);
}
function daysFromNowDateOnly(offsetDays) {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offsetDays);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

async function ensureTestUser() {
  try {
    await auth.createUser({
      uid: EMULATOR_TEST_UID,
      email: EMULATOR_TEST_EMAIL,
      password: EMULATOR_TEST_PASSWORD,
      emailVerified: true,
    });
    console.log(`[auth] created test user uid=${EMULATOR_TEST_UID}`);
  } catch (e) {
    if (e.code === 'auth/uid-already-exists' || e.code === 'auth/email-already-exists') {
      console.log(`[auth] test user already exists uid=${EMULATOR_TEST_UID} (skip)`);
    } else {
      throw e;
    }
  }
}

// メモ11件:
//  - unsynced: 3件（importedAt: null）
//  - synced: 4件（importedAt から FADE_AFTER_DAYS(5日) 未満）
//    ※うち1件は100文字超の長文（続きを開くの動作確認用）
//  - fading: 3件（FADE_AFTER_DAYS 以上 HIDE_AFTER_DAYS(7日) 未満）
//  - hidden: 1件（HIDE_AFTER_DAYS 以上。一覧に出ないことの確認用のおまけ）
const owner = EMULATOR_TEST_UID;
const LONG_TEXT =
  '体験型の展示のアイデアメモ：入場時に鍵を渡す演出で、退場時に回収する仕掛け。観客ごとに鍵の重さや素材を変えておくと、後から感想を聞くときに「あの鍵の話ですか」と会話のきっかけになりそう。動線設計と音響のタイミング調整も、次回の打ち合わせで詰める。';

const memos = [
  {
    id: 'memo-01',
    text: '日航大阪の稟議どうなったか確認する',
    createdAt: hoursAgo(0.1),
    importedAt: null,
  },
  {
    id: 'memo-02',
    text: '新宿の現場、サイネージの電源容量を再確認しておく',
    createdAt: hoursAgo(0.7),
    importedAt: null,
  },
  {
    id: 'memo-03',
    text: '業界動向の記事、あとで読む https://example.com/news/digital-signage-trend-2026',
    createdAt: hoursAgo(2),
    importedAt: null,
  },
  {
    id: 'memo-04',
    text: '帰りにHDMIケーブル買う（4K対応・長尺のやつ）',
    createdAt: daysAgo(1),
    importedAt: hoursAgo(20),
  },
  {
    id: 'memo-05',
    text: '来週の打ち合わせまでにプロジェクター見積もりを2社分揃える',
    createdAt: daysAgo(2),
    importedAt: daysAgo(1),
  },
  {
    id: 'memo-06',
    text: LONG_TEXT,
    createdAt: daysAgo(3),
    importedAt: daysAgo(2),
  },
  {
    id: 'memo-07',
    text: '提案書のテンプレ、去年のホテル案件から流用できないか確認する',
    createdAt: daysAgo(4),
    importedAt: daysAgo(3),
  },
  {
    id: 'memo-08',
    text: 'Obsidianのdataviewの使い方を今度調べる。案件管理表に使えそう',
    createdAt: daysAgo(HIDE_AFTER_DAYS - 1 + 0.2),
    importedAt: daysAgo(HIDE_AFTER_DAYS - 1), // あと1日で非表示
  },
  {
    id: 'memo-09',
    text: '洗剤切れそう、詰め替え買う',
    createdAt: daysAgo(FADE_AFTER_DAYS + 0.2),
    importedAt: daysAgo(FADE_AFTER_DAYS), // あと2日で非表示
  },
  {
    id: 'memo-10',
    text: 'ロビーのLEDビジョン、輝度調整の記事見つけた https://example.com/blog/led-brightness-tuning',
    createdAt: daysAgo(FADE_AFTER_DAYS + 0.3),
    importedAt: daysAgo(FADE_AFTER_DAYS),
  },
  {
    id: 'memo-11-hidden-check',
    text: '（確認用）この一覧には出ないはず。HIDE_AFTER_DAYSを超えたメモ。',
    createdAt: daysAgo(HIDE_AFTER_DAYS + 2),
    importedAt: daysAgo(HIDE_AFTER_DAYS + 1),
  },
];

// タスク8件: 期限超過3件・本日1件・翌日1件・未来3件（うち1件は「先方回答」で当日）
const tasks = [
  {
    id: 'task-01',
    text: 'Firebaseのセキュリティルールの書き方を復習しておく',
    category: '04_Learn',
    scheduled: daysFromNowDateOnly(-5),
    sourceNote: daysFromNowDateOnly(-9),
  },
  {
    id: 'task-02',
    text: '日航大阪の稟議、承認状況を営業に確認する',
    category: '02_Work',
    scheduled: daysFromNowDateOnly(-3),
    sourceNote: daysFromNowDateOnly(-6),
  },
  {
    id: 'task-03',
    text: '確定申告用にレシートをスキャンしておく',
    category: '05_Life',
    scheduled: daysFromNowDateOnly(-1),
    sourceNote: daysFromNowDateOnly(-4),
  },
  {
    id: 'task-04',
    text: '新宿現場、サイネージの電源容量について先方へ回答を送る',
    category: '02_Work',
    scheduled: daysFromNowDateOnly(0),
    sourceNote: daysFromNowDateOnly(-2),
  },
  {
    id: 'task-05',
    text: '体験型展示の鍵演出、プロトタイプの発注先をリストアップする',
    category: '03_Criative',
    scheduled: daysFromNowDateOnly(0),
    sourceNote: daysFromNowDateOnly(-1),
  },
  {
    id: 'task-06',
    text: 'プロジェクター見積もり2社分を比較して社内共有する',
    category: '02_Work',
    scheduled: daysFromNowDateOnly(3),
    sourceNote: daysFromNowDateOnly(0),
  },
  {
    id: 'task-07',
    text: 'Obsidianのdataviewでタスク管理ビューを組んでみる',
    category: '04_Learn',
    scheduled: daysFromNowDateOnly(6),
    sourceNote: daysFromNowDateOnly(0),
  },
  {
    id: 'task-08',
    text: '冬物のクリーニングを出す',
    category: '05_Life',
    scheduled: daysFromNowDateOnly(11),
    sourceNote: daysFromNowDateOnly(0),
  },
];

async function seedMemos() {
  const batch = db.batch();
  for (const m of memos) {
    const ref = db.collection('memos').doc(m.id);
    batch.set(ref, {
      text: m.text,
      createdAt: m.createdAt,
      importedAt: m.importedAt,
      owner,
    });
  }
  await batch.commit();
  console.log(`[firestore] seeded ${memos.length} memos`);
}

async function seedTasks() {
  const batch = db.batch();
  for (const t of tasks) {
    const ref = db.collection('tasks').doc(t.id);
    batch.set(ref, {
      text: t.text,
      category: t.category,
      scheduled: t.scheduled,
      sourceNote: t.sourceNote,
      owner,
    });
  }
  await batch.commit();
  console.log(`[firestore] seeded ${tasks.length} tasks`);
}

async function seedTasksMeta() {
  // 12時間しきい値(TASK_STALE_THRESHOLD_HOURS)以内の「1時間前」にしておき、
  // デフォルトでは停滞警告が出ない状態にしてある。停滞表示を確認したい場合は
  // Emulator UI (http://127.0.0.1:4000) から tasksMeta/latest.updatedAt を
  // 手動で古い日時に書き換えるとよい。
  await db.doc('tasksMeta/latest').set({ updatedAt: hoursAgo(1) });
  console.log('[firestore] seeded tasksMeta/latest');
}

async function main() {
  await ensureTestUser();
  await seedMemos();
  await seedTasks();
  await seedTasksMeta();
  console.log('\n完了。エミュレータUI: http://127.0.0.1:4000');
  console.log(`ログイン用テストアカウント: ${EMULATOR_TEST_EMAIL} / ${EMULATOR_TEST_PASSWORD}`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
