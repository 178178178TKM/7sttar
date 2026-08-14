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
} from 'firebase/firestore';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { firebaseConfig } from './env.js';

const app = initializeApp(firebaseConfig);

export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager(),
  }),
});

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
