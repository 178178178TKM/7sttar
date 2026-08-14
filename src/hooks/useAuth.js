// src/hooks/useAuth.js
import { useEffect, useState, useCallback } from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
} from 'firebase/auth';
import { auth, googleProvider } from '../firebase.js';
import {
  EMULATOR_TEST_EMAIL,
  EMULATOR_TEST_PASSWORD,
} from '../lib/emulatorTestUser.js';

export function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const signIn = useCallback(async () => {
    setError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (e) {
      setError(e);
    }
  }, []);

  // エミュレータ専用: Google の実アカウントを使わず、seed-emulator.mjs が
  // 事前に作成した固定テストユーザー（src/lib/emulatorTestUser.js）で
  // メール/パスワードサインインする。呼び出し側（LoginScreen）でも
  // VITE_USE_EMULATOR=true のときだけボタンを出しているが、関数内側でも
  // 同じ条件で早期returnしている。import.meta.env.DEV は本番ビルドでは
  // 静的に false に置き換わるため、この早期return以降（ダミーの
  // メール・パスワード文字列を含む）は到達不能コードとしてビルド時に
  // 除去される（npm run build 後、dist/assets/*.js を grep して
  // 実際に含まれないことを確認済み。README参照）。
  const signInAsEmulatorTestUser = useCallback(async () => {
    if (!(import.meta.env.DEV && import.meta.env.VITE_USE_EMULATOR === 'true')) {
      return;
    }
    setError(null);
    try {
      await signInWithEmailAndPassword(auth, EMULATOR_TEST_EMAIL, EMULATOR_TEST_PASSWORD);
    } catch (e) {
      setError(e);
    }
  }, []);

  const signOut = useCallback(async () => {
    await fbSignOut(auth);
  }, []);

  return { user, loading, error, signIn, signInAsEmulatorTestUser, signOut };
}
