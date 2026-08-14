// src/components/MemoText.jsx
//
// モックの EXCERPT_LIMIT（100文字）による省略＋「続きを開く」を移植。
// 判断: 折りたたみ中のプレビューは素のテキストの先頭100文字をそのまま
// 切り出す（URLが100文字目をまたぐ場合にリンクが分断されるのを避けるため、
// あえてプレビューはリンク化しない）。展開後の全文表示のみ linkify する。
// モックの静的サンプルにも100文字を超えかつURLを含む例は無く、この扱いは
// 実装時の判断であることを明記しておく。
import { useState } from 'react';
import { MEMO_EXCERPT_LIMIT } from '../lib/constants.js';
import { linkifyText } from '../lib/linkify.jsx';

export function MemoText({ text }) {
  const [expanded, setExpanded] = useState(false);
  const needsTruncation = text.length > MEMO_EXCERPT_LIMIT;

  if (!needsTruncation) {
    return <p className="m-0 break-words text-[15px] text-text-primary">{linkifyText(text)}</p>;
  }

  return (
    <>
      <p className="m-0 break-words text-[15px] text-text-primary">
        {expanded ? linkifyText(text) : text.slice(0, MEMO_EXCERPT_LIMIT) + '…'}
      </p>
      <button
        type="button"
        aria-expanded={expanded}
        onClick={() => setExpanded((v) => !v)}
        className="self-start bg-transparent p-0 font-sans text-xs text-text-muted hover:text-text-primary"
      >
        {expanded ? '折りたたむ' : '続きを開く'}
      </button>
    </>
  );
}
