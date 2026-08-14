// src/components/SyncBadge.jsx
//
// モックの3状態バッジ（未同期=三角 / 同期済み=円 / まもなく非表示=ひし形）を
// そのまま移植。形状は clip-path で表現し、色・枠線・タイトル文言も一致させる。
const SHAPES = {
  unsynced: 'polygon(50% 0%, 0% 100%, 100% 100%)', // 三角
  fading: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)', // ひし形
};

const CONFIG = {
  unsynced: {
    label: '未同期',
    title: 'まだ00_Inboxへ取り込まれていません。',
    className: 'border-accent text-accent',
    iconClassName: 'bg-accent',
  },
  synced: {
    label: '同期済み',
    title: '00_Inboxへ取り込み完了。Vaultには残り続けます。',
    className: 'border-border text-text-muted',
    iconClassName: 'rounded-full bg-text-muted',
  },
  fading: {
    label: 'まもなく非表示',
    title: '同期済みから時間が経ち、一覧からはまもなく消えます。ノート自体はVaultに残り続けます。',
    className: 'border-border text-text-muted opacity-65',
    iconClassName: 'bg-text-muted',
  },
};

export function SyncBadge({ status, remainDays }) {
  const config = CONFIG[status];
  if (!config) return null;
  const shape = SHAPES[status];

  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border py-[3px] pl-2 pr-2.5 text-[11px] font-semibold ${config.className}`}
      title={config.title}
    >
      <span
        className={`inline-block h-[9px] w-[9px] flex-none ${config.iconClassName}`}
        style={shape ? { clipPath: shape } : undefined}
        aria-hidden="true"
      />
      <span>{config.label}</span>
      {status === 'fading' && remainDays != null && (
        <span className="font-mono tabular-nums">あと{remainDays}日</span>
      )}
    </span>
  );
}
