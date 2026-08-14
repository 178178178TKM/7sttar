// tailwind.config.js
//
// 色トークンはモック (memo-feed-mock.html) の CSS カスタムプロパティをそのまま
// src/styles/index.css の :root / [data-theme] に残し、Tailwind 側は
// var(--...) を参照するだけにしている。こうすることで
// - prefers-color-scheme によるダーク自動切替
// - data-theme="light" / "dark" による明示的な上書き
// をモックと完全に同じ仕組みのまま、Tailwind のユーティリティクラス
// （例: bg-bg-card, text-text-muted）から使えるようにしている。
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        'bg-base': 'var(--bg-base)',
        'bg-surface': 'var(--bg-surface)',
        'bg-card': 'var(--bg-card)',
        'bg-hover': 'var(--bg-hover)',
        'text-primary': 'var(--text-primary)',
        'text-muted': 'var(--text-muted)',
        border: 'var(--border)',
        accent: 'var(--accent)',
        'accent-contrast': 'var(--accent-contrast)',
        danger: 'var(--danger)',
        'danger-bg': 'var(--danger-bg)',
      },
      fontFamily: {
        sans: [
          'Hiragino Sans',
          'Noto Sans JP',
          'Yu Gothic UI',
          'Meiryo',
          'sans-serif',
        ],
        mono: [
          'ui-monospace',
          'SFMono-Regular',
          'Cascadia Code',
          'monospace',
        ],
        mincho: [
          'Hiragino Mincho ProN',
          'Yu Mincho',
          'YuMincho',
          'serif',
        ],
      },
      boxShadow: {
        card: 'var(--shadow-card)',
      },
    },
  },
  plugins: [],
}
