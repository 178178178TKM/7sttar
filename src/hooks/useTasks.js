// src/hooks/useTasks.js
//
// タスクタブは閲覧専用。ここでは読み取り（onSnapshot）のみを行い、
// 書き込み系の関数は一切用意しない。
import { useEffect, useState } from 'react';
import { collection, doc, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { db } from '../firebase.js';

export function useTasks(uid) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!uid) {
      setTasks([]);
      setLoading(false);
      return undefined;
    }
    setLoading(true);
    const q = query(
      collection(db, 'tasks'),
      where('owner', '==', uid),
      orderBy('scheduled', 'asc')
    );
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setTasks(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
      (e) => {
        setError(e);
        setLoading(false);
      }
    );
    return unsubscribe;
  }, [uid]);

  return { tasks, loading, error };
}

export function useTasksMeta(uid) {
  const [updatedAt, setUpdatedAt] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) {
      setUpdatedAt(null);
      setLoading(false);
      return undefined;
    }
    setLoading(true);
    const ref = doc(db, 'tasksMeta', 'latest');
    const unsubscribe = onSnapshot(
      ref,
      (snap) => {
        setUpdatedAt(snap.exists() ? snap.data().updatedAt : null);
        setLoading(false);
      },
      () => setLoading(false)
    );
    return unsubscribe;
  }, [uid]);

  return { updatedAt, loading };
}
