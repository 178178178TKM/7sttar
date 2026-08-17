// src/App.jsx
import { useState } from 'react';
import { useAuth } from './hooks/useAuth.js';
import { useMemos, postMemo } from './hooks/useMemos.js';
import { useTasks, useTasksMeta } from './hooks/useTasks.js';
import { useShareTargetText } from './hooks/useShareTarget.js';
import { SharkLogo } from './components/SharkLogo.jsx';
import { ThemeToggle } from './components/ThemeToggle.jsx';
import { Tabs } from './components/Tabs.jsx';
import { MemoFeed } from './components/MemoFeed.jsx';
import { TaskList } from './components/TaskList.jsx';
import { LoginScreen } from './components/LoginScreen.jsx';

const TABS = [
  { id: 'memo', label: 'メモ' },
  { id: 'task', label: 'タスク' },
];

export default function App() {
  const {
    user,
    loading: authLoading,
    signIn,
    signInAsEmulatorTestUser,
    error: authError,
  } = useAuth();
  const [sharedText, consumeSharedText] = useShareTargetText();

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg-base font-sans text-sm text-text-muted">
        読み込み中…
      </div>
    );
  }

  if (!user) {
    return (
      <LoginScreen
        onSignIn={signIn}
        onSignInEmulator={signInAsEmulatorTestUser}
        error={authError}
      />
    );
  }

  return (
    <AuthedApp
      uid={user.uid}
      sharedText={sharedText}
      onSharedTextConsumed={consumeSharedText}
    />
  );
}

function AuthedApp({ uid, sharedText, onSharedTextConsumed }) {
  const [activeTab, setActiveTab] = useState('memo');
  const { memos, loading: memosLoading } = useMemos(uid);
  const { tasks, loading: tasksLoading } = useTasks(uid);
  const { updatedAt } = useTasksMeta(uid);

  return (
    <div className="min-h-screen bg-bg-base font-sans leading-relaxed text-text-primary antialiased">
      <div className="mx-auto flex max-w-[560px] flex-col px-4 pb-10">
        <header className="sticky top-0 z-20 bg-bg-base pb-2 pt-4">
          <div className="flex items-baseline justify-between gap-3">
            <h1 className="m-0 flex items-baseline gap-2 text-lg font-bold">
              <span className="flex items-center gap-2">
                <SharkLogo />
                <span className="font-mincho tracking-wide text-accent">7sttar</span>
              </span>
              <span className="text-xs font-normal text-text-muted">投入口 &amp; 残タスク確認</span>
            </h1>
            <ThemeToggle />
          </div>
          <Tabs tabs={TABS} activeId={activeTab} onChange={setActiveTab} />
        </header>

        {activeTab === 'memo' && (
          <MemoFeed
            memos={memos}
            loading={memosLoading}
            onPost={(text) => postMemo(uid, text)}
            initialText={sharedText}
            onInitialTextConsumed={onSharedTextConsumed}
          />
        )}
        {activeTab === 'task' && (
          <TaskList tasks={tasks} updatedAt={updatedAt} loading={tasksLoading} />
        )}
      </div>
    </div>
  );
}
