// src/components/SharkLogo.jsx
//
// モック (memo-feed-mock.html) の .app-shark-logo をそのまま移植。
// 12点ポリゴン＋目のサメロゴ。currentColor で色をアクセントに合わせる。
export function SharkLogo({ className = '' }) {
  return (
    <svg
      className={`h-5 w-auto flex-none text-accent ${className}`}
      viewBox="0 0 64 30"
      aria-hidden="true"
      focusable="false"
    >
      <polygon
        points="2,14 10,8 18,0 24,8 46,10 62,2 52,14 62,22 46,18 20,22 14,28 10,20"
        fill="currentColor"
      />
      <circle cx="9" cy="12" r="1.4" fill="var(--bg-base)" />
    </svg>
  );
}
