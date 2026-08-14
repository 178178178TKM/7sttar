// src/components/LoginScreen.jsx
//
// モックにはログイン画面のUIは無いため、既存の配色トークン・タイポグラフィ
// （明朝体のワードマーク、サメのロゴ、金のアクセントボタン）を踏襲する形で
// 未ログイン時専用の画面として新規に構成した。
//
// 「エミュレータでログイン」ボタンは、Firebase Local Emulator Suite で
// ローカル動作確認するための開発専用の追加UI。VITE_USE_EMULATOR=true かつ
// 開発ビルド(import.meta.env.DEV)のときだけ表示する。本番のGoogle Sign-Inの
// 意匠・導線は変更していない（追加ボタンを条件付きで下に添えているだけ）。
// 本番ビルドではこの分岐が false になり描画されない。
import { SharkLogo } from './SharkLogo.jsx';

const showEmulatorLogin = import.meta.env.DEV && import.meta.env.VITE_USE_EMULATOR === 'true';

export function LoginScreen({ onSignIn, onSignInEmulator, error }) {
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
      {showEmulatorLogin && (
        <button
          type="button"
          onClick={onSignInEmulator}
          className="rounded-full border border-dashed border-border px-6 py-2 font-sans text-xs text-text-muted transition-colors duration-150 hover:border-text-primary hover:text-text-primary"
        >
          エミュレータでログイン（テストユーザー）
        </button>
      )}
      {error && (
        <p className="max-w-xs text-xs text-danger">
          ログインに失敗しました。時間をおいて再度お試しください。
        </p>
      )}
    </div>
  );
}
