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
// EMULATOR_TEST_UID をあえて firestore.rules の isTheOwner() が指定する
// 本番所有者UIDと同じ値にしているのは意図的な判断である。
// こうすることで、tasksMeta/latest 用に別のエミュレータ専用ルールファイルを
// 用意する必要がなくなり、firestore.rules （本番と同じ1ファイル）を
// そのままエミュレータでも検証できる。
// firestore.rules の isTheOwner() を書き換えた場合は、このファイルの値も
// 揃えて更新すること。揃えないと、ローカルエミュレータでの
// tasksMeta/latest 検証だけができなくなる
// （memos/tasks の owner ベースの検証には影響しない）。
export const EMULATOR_TEST_UID = '86QwIlJqwJTQtOT9jHznrumEGm72';
export const EMULATOR_TEST_EMAIL = 'demo-owner@7sttar.local';
// エミュレータ専用のダミーパスワード。本番の認証情報とは無関係で、
// 漏れても実害はない（Auth エミュレータはネットワークに一切繋がらない）。
export const EMULATOR_TEST_PASSWORD = 'emulator-only-password';
