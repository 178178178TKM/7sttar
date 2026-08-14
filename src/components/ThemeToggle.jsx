// src/components/ThemeToggle.jsx
//
// モックのテーマ切替ロジックを踏襲。data-theme="light"|"dark" を
// <html> に付与して :root[data-theme=...] の CSS 変数を上書きする。
// モックにはない拡張として、選んだテーマを localStorage に保存し次回訪問時に
// 復元する（意匠・配色トークンは一切変更していない、挙動面のみの追加）。
import { useEffect, useState } from 'react';

const STORAGE_KEY = '7sttar-theme';

function currentEffectiveTheme() {
  const explicit = document.documentElement.dataset.theme;
  if (explicit === 'dark' || explicit === 'light') return explicit;
  const prefersDark =
    window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  return prefersDark ? 'dark' : 'light';
}

export function ThemeToggle() {
  const [effective, setEffective] = useState(currentEffectiveTheme);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'dark' || saved === 'light') {
      document.documentElement.dataset.theme = saved;
      setEffective(saved);
    }
  }, []);

  function handleClick() {
    const next = currentEffectiveTheme() === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    localStorage.setItem(STORAGE_KEY, next);
    setEffective(next);
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-pressed={effective === 'dark'}
      className="inline-flex items-center gap-1.5 rounded-full border border-border bg-bg-surface px-3 py-1.5 font-sans text-xs text-text-primary transition-colors duration-150 hover:border-text-primary"
    >
      <span className="inline-block h-2 w-2 rounded-full bg-text-muted" aria-hidden="true" />
      <span>{effective === 'dark' ? 'ライトに切替' : 'ダークに切替'}</span>
    </button>
  );
}
