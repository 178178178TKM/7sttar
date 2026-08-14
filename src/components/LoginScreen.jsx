// src/components/LoginScreen.jsx
//
// モックにはログイン画面のUIは無いため、既存の配色トークン・タイポグラフィ
// （明朝体のワードマーク、サメのロゴ、金のアクセントボタン）を踏襲する形で
// 未ログイン時専用の画面として新規に構成した。
import { SharkLogo } from './SharkLogo.jsx';

export function LoginScreen({ onSignIn, error }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-bg-base px-6 text-center font-sans text-text-primary">
      <div className="flex items-center gap-2">
        <SharkLogo className="h-8" />
        <span className="font-mincho text-2xl tracking-wide text-accent">7sttar</span>
      </div>
      <p className="text-sm text-text-muted">投入口 & 残タスク確認</p>
      <button
        type="button"
        onClick={onSignIn}
        className="rounded-full bg-accent px-6 py-2.5 font-sans text-sm font-bold text-accent-contrast transition-opacity duration-150 hover:opacity-90"
      >
        Googleでログイン
      </button>
      {error && (
        <p className="max-w-xs text-xs text-danger">
          ログインに失敗しました。時間をおいて再度お試しください。
        </p>
      )}
    </div>
  );
}
