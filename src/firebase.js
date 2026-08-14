// src/firebase.js
//
// kaikeicho の構成を踏襲。ただし本アプリは写真機能を持たないため
// getStorage は使わない（指示により削除）。persistentLocalCache による
// オフライン対応（複数タブ対応込み）は維持する。
import { initializeApp } from 'firebase/app';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  connectFirestoreEmulator,
} from 'firebase/firestore';
import { getAuth, GoogleAuthProvider, connectAuthEmulator } from 'firebase/auth';
import { firebaseConfig } from './env.js';

const app = initializeApp(firebaseConfig);

export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager(),
  }),
});

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Firebase Local Emulator Suite への接続。
//
// import.meta.env.DEV は Vite が本番ビルド時に静的な false へ置き換える定数
// なので、`if (false && ...)` はビルド時に到達不能コードとして扱われ、
// dist/ には残らない（npm run build 後に dist/assets/*.js を
// connectFirestoreEmulator / connectAuthEmulator の文字列で grep して
// 含まれないことを確認済み）。VITE_USE_EMULATOR は開発時にも明示的な
// オプトインを必須にするためのフラグ（.env.local で true にしない限り、
// npm run dev でも本物のFirebaseに繋がる＝誤ってエミュレータ専用のダミー
// firebaseConfig で本番に繋ぎにいく事故を防ぐ）。
if (import.meta.env.DEV && import.meta.env.VITE_USE_EMULATOR === 'true') {
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  console.info('[7sttar] Firebase Emulator Suite に接続しました (Firestore:8080 / Auth:9099)');
}
