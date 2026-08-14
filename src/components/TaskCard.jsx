// src/components/TaskCard.jsx
import { overdueDays } from '../lib/format.js';

export function TaskCard({ task }) {
  const overdue = overdueDays(task.scheduled);

  return (
    <li className="flex flex-col gap-2 border-b border-border bg-bg-card p-4 transition-colors duration-150 last:border-b-0 hover:bg-bg-hover">
      <p className="m-0 break-words text-[15px] text-text-primary">{task.text}</p>
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center whitespace-nowrap rounded-full border border-border px-2 py-0.5 text-[11px] font-semibold text-text-muted">
          {task.category}
        </span>
        <span className="text-xs text-text-muted">
          再通知:{' '}
          <time className="font-mono tabular-nums" dateTime={task.scheduled}>
            {task.scheduled}
          </time>
        </span>
        {overdue > 0 && (
          <span
            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-danger bg-danger-bg py-[3px] pl-2 pr-2.5 text-[11px] font-semibold text-danger"
            title="再通知日を過ぎています。"
          >
            <span
              className="inline-block h-[9px] w-[9px] flex-none bg-danger"
              style={{ clipPath: 'polygon(50% 0%, 0% 100%, 100% 100%)' }}
              aria-hidden="true"
            />
            <span>{overdue}日超過</span>
          </span>
        )}
        <span className="text-xs text-text-muted">
          出所:{' '}
          <time className="font-mono tabular-nums" dateTime={task.sourceNote}>
            {task.sourceNote}
          </time>
          より
        </span>
      </div>
    </li>
  );
}
