// src/hooks/useMemos.js
import { useEffect, useMemo, useState } from 'react';
import {
  addDoc,
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  where,
} from 'firebase/firestore';
import { db } from '../firebase.js';
import { MEMO_FETCH_LIMIT } from '../lib/constants.js';
import { getMemoSyncStatus } from '../lib/format.js';

export function useMemos(uid) {
  const [rawMemos, setRawMemos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!uid) {
      setRawMemos([]);
      setLoading(false);
      return undefined;
    }
    setLoading(true);
    const q = query(
      collection(db, 'memos'),
      where('owner', '==', uid),
      orderBy('createdAt', 'desc'),
      limit(MEMO_FETCH_LIMIT)
    );
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setRawMemos(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
      (e) => {
        setError(e);
        setLoading(false);
      }
    );
    return unsubscribe;
  }, [uid]);

  // 「消える」のは表示だけ（Firestore からは削除しない）。
  // ここで hidden 状態のメモをクエリ結果から除外する。
  const memos = useMemo(() => {
    return rawMemos
      .map((memo) => ({ ...memo, syncStatus: getMemoSyncStatus(memo.importedAt) }))
      .filter((memo) => memo.syncStatus.status !== 'hidden');
  }, [rawMemos]);

  return { memos, loading, error };
}

export async function postMemo(uid, text) {
  const trimmed = text.trim();
  if (!trimmed) return;
  await addDoc(collection(db, 'memos'), {
    text: trimmed,
    createdAt: serverTimestamp(),
    importedAt: null,
    owner: uid,
  });
}
