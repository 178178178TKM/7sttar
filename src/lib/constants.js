// src/lib/constants.js
//
// メモの表示状態（未同期 / 同期済み / まもなく非表示）に関わる閾値を
// 1箇所にまとめておく。ここを変えるだけで挙動を調整できるようにする。

// importedAt（PC側が 00_Inbox へ取り込んだ時刻）からこの日数が経過するまでは
// 「同期済み」として通常表示する。
// 根拠: 取り込み直後の数日はスマホ側で「取り込まれたか」を確認する用途が
// 中心になると想定し、1週間弱は普通に見えていてほしいという想定で5日とした。
export const FADE_AFTER_DAYS = 5;

// importedAt からこの日数が経過すると一覧から除外する（非表示）。
// Firestore のドキュメント自体は削除しない（クエリ側で除外するのみ）。
// 根拠: FADE_AFTER_DAYS からさらに2日程度の猶予（「あと1日」〜「あと2日」の
// カウントダウン表示）を経て消えるようにし、消える前に気づける余地を残した。
export const HIDE_AFTER_DAYS = 7;

// メモ本文の省略表示の閾値（この文字数を超えたら「続きを開く」で折りたたむ）。
// モック (memo-feed-mock.html) の EXCERPT_LIMIT に合わせて100文字。
export const MEMO_EXCERPT_LIMIT = 100;

// tasksMeta/latest.updatedAt がこの時間以上前だと「PCで更新されていません」の
// 停滞警告を出す。
// 根拠: PC側の取り込みバッチは通常1日に何度か走る想定のため、半日（12時間）
// 更新が無ければ停滞とみなす。
export const TASK_STALE_THRESHOLD_HOURS = 12;

// Firestore から取得するメモの最大件数（無制限にすると読み取り課金が
// 際限なく増えるため上限を設ける）。
export const MEMO_FETCH_LIMIT = 200;
