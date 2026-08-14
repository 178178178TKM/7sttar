// src/components/TaskList.jsx
import { formatIsoDateTime, formatMemoTime, isTaskListStale } from '../lib/format.js';
import { TaskCard } from './TaskCard.jsx';

export function TaskList({ tasks, updatedAt, loading }) {
  const stale = isTaskListStale(updatedAt);

  return (
    <section
      id="panel-task"
      className="pt-4"
      role="tabpanel"
      aria-labelledby="tab-task"
      tabIndex={0}
    >
      <div className="mb-2 flex items-baseline gap-1.5 text-xs text-text-muted">
        <span>最終更新:</span>
        {updatedAt ? (
          <time className="font-mono tabular-nums text-text-primary" dateTime={formatIsoDateTime(updatedAt)}>
            {formatMemoTime(updatedAt)}
          </time>
        ) : (
          <span className="text-text-primary">不明</span>
        )}
      </div>

      {stale && (
        <p className="m-0 mb-3 rounded-[10px] border border-danger bg-danger-bg px-3 py-2 text-xs text-danger">
          PCで更新されていません。最新の状態でない可能性があります。
        </p>
      )}

      <p className="m-0 mb-4 text-xs text-text-muted">
        この一覧は閲覧専用です。完了のチェックはPC側のObsidian Vaultで行ってください。
      </p>

      {loading ? (
        <p className="px-1 py-6 text-center text-sm text-text-muted">読み込み中…</p>
      ) : tasks.length === 0 ? (
        <p className="px-1 py-6 text-center text-sm text-text-muted">残タスクはありません。</p>
      ) : (
        <ul className="overflow-hidden rounded-xl border border-border">
          {tasks.map((task) => (
            <TaskCard key={task.id} task={task} />
          ))}
        </ul>
      )}
    </section>
  );
}
