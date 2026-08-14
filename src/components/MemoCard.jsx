// src/components/MemoCard.jsx
import { formatIsoDateTime, formatMemoTime } from '../lib/format.js';
import { MemoText } from './MemoText.jsx';
import { SyncBadge } from './SyncBadge.jsx';

export function MemoCard({ memo }) {
  return (
    <li className="flex flex-col gap-1.5 border-b border-border bg-bg-card p-4 transition-colors duration-150 last:border-b-0 hover:bg-bg-hover">
      <MemoText text={memo.text} />
      <div className="flex items-center gap-2">
        <time
          className="font-mono text-xs tabular-nums text-text-muted"
          dateTime={formatIsoDateTime(memo.createdAt)}
        >
          {formatMemoTime(memo.createdAt)}
        </time>
        <SyncBadge status={memo.syncStatus.status} remainDays={memo.syncStatus.remainDays} />
      </div>
    </li>
  );
}
