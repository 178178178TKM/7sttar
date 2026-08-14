// src/components/Composer.jsx
import { useState } from 'react';

export function Composer({ onPost }) {
  const [text, setText] = useState('');
  const [posting, setPosting] = useState(false);

  const trimmedEmpty = text.trim().length === 0;

  async function handleSubmit(event) {
    event.preventDefault();
    if (trimmedEmpty || posting) return;
    setPosting(true);
    try {
      await onPost(text);
      setText('');
    } finally {
      setPosting(false);
    }
  }

  return (
    <section
      className="sticky top-[100px] z-[15] mb-4 rounded-2xl border border-border bg-bg-surface p-3 shadow-card"
      aria-label="新規メモ入力"
    >
      <form className="flex flex-col gap-2" onSubmit={handleSubmit}>
        <label htmlFor="memoInput" className="sr-only">
          メモ内容
        </label>
        <textarea
          id="memoInput"
          rows={3}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="思いついたことを、そのまま置いていく"
          className="min-h-[64px] w-full resize-y rounded-[10px] border border-border bg-bg-base p-2.5 font-sans text-[15px] text-text-primary placeholder:text-text-muted"
        />
        <div className="flex items-center justify-between gap-3">
          <span className="font-mono text-xs tabular-nums text-text-muted">
            {text.length}文字
          </span>
          <button
            type="submit"
            disabled={trimmedEmpty || posting}
            className="rounded-full bg-accent px-5 py-2 font-sans text-sm font-bold text-accent-contrast transition-opacity duration-150 enabled:hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            投稿
          </button>
        </div>
      </form>
    </section>
  );
}
