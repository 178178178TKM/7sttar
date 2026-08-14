// src/lib/emulatorTestUser.js
//
// Firebase Local Emulator Suite でのローカル動作確認専用の、固定テストユーザー
// の識別情報。本番のFirebase（実際のGoogleアカウント）とは一切関係ない。
//
// このファイルは2箇所から読み込まれる:
//   1. scripts/seed-emulator.mjs（Node/Admin SDK）
//      - Auth エミュレータにこのUIDでユーザーを作成する
//      - 投入するメモ・タスクの owner フィールドにこのUIDを使う
//   2. src/components/LoginScreen.jsx（ブラウザ/Client SDK、開発ビルドのみ）
//      - VITE_USE_EMULATOR=true のときだけ表示される
//        「エミュレータでログイン」ボタンから、このメール/パスワードで
//        signInWithEmailAndPassword する
//
// EMULATOR_TEST_UID をあえて firestore.rules のプレースホルダ文字列
// 'REPLACE_WITH_OWNER_UID' と同じ値にしているのは意図的な判断である。
// こうすることで、tasksMeta/latest 用に別のエミュレータ専用ルールファイルを
// 用意する必要がなくなり、firestore.rules （本番と同じ1ファイル）を
// そのままエミュレータでも検証できる。
// 本番にデプロイする際は firestore.rules のプレースホルダを実際のUIDに
// 置き換える（README参照）。その置き換えを行うと、このファイルの値と
// 一致しなくなり、ローカルエミュレータでの tasksMeta/latest 検証は
// 「プレースホルダ文字列のままの状態」でしか意味を持たなくなる点に注意。
// 置き換え後もエミュレータでこの経路を検証したい場合は、この
// EMULATOR_TEST_UID を実際のUIDと同じ値に変更すること。
export const EMULATOR_TEST_UID = 'REPLACE_WITH_OWNER_UID';
export const EMULATOR_TEST_EMAIL = 'demo-owner@7sttar.local';
// エミュレータ専用のダミーパスワード。本番の認証情報とは無関係で、
// 漏れても実害はない（Auth エミュレータはネットワークに一切繋がらない）。
export const EMULATOR_TEST_PASSWORD = 'emulator-only-password';
