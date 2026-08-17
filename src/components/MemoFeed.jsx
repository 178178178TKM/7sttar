// src/components/MemoFeed.jsx
import { useEffect } from 'react';
import { Composer } from './Composer.jsx';
import { MemoCard } from './MemoCard.jsx';

export function MemoFeed({ memos, loading, onPost, initialText, onInitialTextConsumed }) {
  // 共有経由の初期テキスト（initialText）は、Composerの初期値として一度使われたら
  // 「使用済み」として親に伝える。これにより、タブ切り替えでこのコンポーネントが
  // アンマウント→再マウントされても、同じ共有テキストが再びComposerに差し込まれて
  // 編集中の下書きを消してしまうことがなくなる。
  // （initialTextが空になった後にもう一度この副作用は走るが、ガードにより何もしない。
  //   タブ切り替え時の下書き保持そのものの挙動には手を入れていない。）
  useEffect(() => {
    if (initialText && onInitialTextConsumed) {
      onInitialTextConsumed();
    }
  }, [initialText, onInitialTextConsumed]);

  return (
    <section
      id="panel-memo"
      className="pt-4"
      role="tabpanel"
      aria-labelledby="tab-memo"
      tabIndex={0}
    >
      <Composer onPost={onPost} initialText={initialText} />

      {loading ? (
        <p className="px-1 py-6 text-center text-sm text-text-muted">読み込み中…</p>
      ) : memos.length === 0 ? (
        <p className="px-1 py-6 text-center text-sm text-text-muted">
          まだメモがありません。上の入力欄から投稿してみてください。
        </p>
      ) : (
        <ul className="overflow-hidden rounded-xl border border-border">
          {memos.map((memo) => (
            <MemoCard key={memo.id} memo={memo} />
          ))}
        </ul>
      )}

      <p className="mt-5 rounded-xl border border-dashed border-border p-3.5 text-xs text-text-muted">
        同期状態の表示は一覧上の整理のためのものです。「まもなく非表示」になったメモも、PC側のObsidian
        Vault（00_Inbox）にはノートとしてそのまま残り続けます。一覧から消えても失われることはありません。
      </p>
    </section>
  );
}
