// src/lib/format.js
import {
  FADE_AFTER_DAYS,
  HIDE_AFTER_DAYS,
  TASK_STALE_THRESHOLD_HOURS,
} from './constants.js';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function pad(n) {
  return n < 10 ? '0' + n : String(n);
}

// Firestore Timestamp | Date | null -> Date | null
export function toDate(value) {
  if (!value) return null;
  if (typeof value.toDate === 'function') return value.toDate();
  if (value instanceof Date) return value;
  return new Date(value);
}

// モックの memo-time 表記 "MM/DD HH:mm" に合わせる。
export function formatMemoTime(dateLike) {
  const d = toDate(dateLike);
  if (!d) return '';
  return `${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function formatIsoDateTime(dateLike) {
  const d = toDate(dateLike);
  if (!d) return '';
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}`
  );
}

// 日付のみの比較用に、時刻を切り捨てたミリ秒を返す。
function dateOnlyMs(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

// "YYYY-MM-DD" 文字列を、ローカルタイムの Date（時刻0時）として解釈する。
export function parseDateOnly(str) {
  if (!str) return null;
  const [y, m, d] = str.split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

// タスクの再通知日が今日を過ぎている日数。0以下なら未超過。
export function overdueDays(scheduledStr, now = new Date()) {
  const scheduled = parseDateOnly(scheduledStr);
  if (!scheduled) return 0;
  const diff = dateOnlyMs(now) - dateOnlyMs(scheduled);
  return Math.floor(diff / ONE_DAY_MS);
}

// tasksMeta/latest.updatedAt が古すぎて「停滞」とみなすべきか。
export function isTaskListStale(updatedAtLike, now = new Date()) {
  const updatedAt = toDate(updatedAtLike);
  if (!updatedAt) return true; // 更新時刻が取れない場合は安全側で「停滞」扱い
  const diffHours = (now.getTime() - updatedAt.getTime()) / (60 * 60 * 1000);
  return diffHours >= TASK_STALE_THRESHOLD_HOURS;
}

// メモの表示状態を判定する。
// 'unsynced'  : importedAt が null（まだ00_Inboxへ取り込まれていない）
// 'synced'    : 取り込み済みで、まだ FADE_AFTER_DAYS 以内
// 'fading'    : 取り込み済みで、FADE_AFTER_DAYS 以上 HIDE_AFTER_DAYS 未満経過
// 'hidden'    : HIDE_AFTER_DAYS 以上経過 → 一覧から除外する（削除はしない）
export function getMemoSyncStatus(importedAtLike, now = new Date()) {
  if (!importedAtLike) {
    return { status: 'unsynced', remainDays: null };
  }
  const importedAt = toDate(importedAtLike);
  if (!importedAt) {
    return { status: 'unsynced', remainDays: null };
  }
  const elapsedDays = Math.floor((now.getTime() - importedAt.getTime()) / ONE_DAY_MS);

  if (elapsedDays >= HIDE_AFTER_DAYS) {
    return { status: 'hidden', remainDays: 0 };
  }
  if (elapsedDays >= FADE_AFTER_DAYS) {
    return { status: 'fading', remainDays: HIDE_AFTER_DAYS - elapsedDays };
  }
  return { status: 'synced', remainDays: null };
}
