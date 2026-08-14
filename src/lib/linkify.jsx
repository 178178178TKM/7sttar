// src/lib/linkify.jsx
//
// 本文中の URL をリンク化して表示するための純粋関数。
// dangerouslySetInnerHTML は使わず、React 要素の配列として組み立てる
// （モックが textContent のみを使い innerHTML にユーザー由来の文字列を
// 流し込まないようにしていた方針を踏襲した XSS 対策）。
const URL_PATTERN = /(https?:\/\/[^\s]+)/g;

export function linkifyText(text) {
  const parts = text.split(URL_PATTERN);
  return parts.map((part, i) => {
    if (part.match(URL_PATTERN)) {
      return (
        <a
          key={i}
          className="text-accent underline underline-offset-2"
          href={part}
          target="_blank"
          rel="noopener noreferrer"
        >
          {part}
        </a>
      );
    }
    return part ? <span key={i}>{part}</span> : null;
  });
}
