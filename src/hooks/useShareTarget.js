// src/hooks/useShareTarget.js
import { useCallback, useEffect, useState } from 'react';

// Web Share Target (GET) がクエリに載せる title/text/url を
// 「自然な1本のメモ本文」に組み立てる。
// - title と text が同じ内容（title未対応の共有元がtextに同じ値を入れてくることがある）の場合は重複させない
// - 空の項目は詰めない
// - 並び順は title → text → url（見出し → 本文 → 参照リンク、という自然な読み順）
function buildSharedText({ title, text, url }) {
  const t = (title ?? '').trim();
  const b = (text ?? '').trim();
  const u = (url ?? '').trim();

  const parts = [];
  if (t) parts.push(t);
  if (b && b !== t) parts.push(b);
  if (u) parts.push(u);

  return parts.join('\n');
}

function hasShareParams(params) {
  return params.has('title') || params.has('text') || params.has('url');
}

// 共有経由（?title=&text=&url=）で開かれた場合、その内容をメモ入力欄の
// 初期値として1回だけ取り出す。
//
// 読み取り（useState の遅延初期化）はレンダー中に行い、副作用となる
// URLの書き換え（history.replaceState）は useEffect 側に分離している。
// - 読み取りをレンダー中に済ませておくのは、Composer が useState の初期値として
//   即座にこの値を必要とするため（useEffect を待つと1テンポ遅れて間に合わない）。
// - URL の書き換えは「レンダーの結果」ではなく外界に対する副作用そのものなので、
//   Reactの「レンダーは純粋であるべき」という原則に従い useEffect に置く。
// - StrictMode の二重実行でも、2回目は既にクエリが空になっているため
//   hasShareParams が false を返し何もしない（安全に冪等）。
//
// 戻り値は [sharedText, consumeSharedText] のペア。
// consumeSharedText は「この共有テキストは使用済みである」と伝えるための関数で、
// 呼ぶと sharedText が空文字になる。タブ切り替えなどで共有先コンポーネントが
// 再マウントされても、一度使用済みにした共有テキストが再注入されないようにするために使う。
export function useShareTargetText() {
  const [sharedText, setSharedText] = useState(() => {
    if (typeof window === 'undefined') return '';

    const params = new URLSearchParams(window.location.search);
    if (!hasShareParams(params)) return '';

    return buildSharedText({
      title: params.get('title'),
      text: params.get('text'),
      url: params.get('url'),
    });
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const params = new URLSearchParams(window.location.search);
    if (!hasShareParams(params)) return;

    // 既存のルーティングはURLクエリを使っていない（タブ切り替え等はコンポーネント内state）ため、
    // pathname/hashだけ残してクエリのみ除去してよい。
    window.history.replaceState(null, '', window.location.pathname + window.location.hash);
  }, []);

  const consumeSharedText = useCallback(() => {
    setSharedText('');
  }, []);

  return [sharedText, consumeSharedText];
}
