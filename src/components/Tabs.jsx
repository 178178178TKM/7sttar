// src/components/Tabs.jsx
//
// モックの WAI-ARIA Tabs パターン（自動アクティベーション + roving tabindex）を
// React に移植したもの。矢印キー / Home / End での移動、クリックでの切替に対応。
import { useRef } from 'react';

export function Tabs({ tabs, activeId, onChange }) {
  const btnRefs = useRef({});

  function focusAndActivate(id) {
    onChange(id);
    btnRefs.current[id]?.focus();
  }

  function handleKeyDown(event, index) {
    let newIndex = null;
    if (event.key === 'ArrowRight') {
      newIndex = (index + 1) % tabs.length;
    } else if (event.key === 'ArrowLeft') {
      newIndex = (index - 1 + tabs.length) % tabs.length;
    } else if (event.key === 'Home') {
      newIndex = 0;
    } else if (event.key === 'End') {
      newIndex = tabs.length - 1;
    }
    if (newIndex !== null) {
      event.preventDefault();
      focusAndActivate(tabs[newIndex].id);
    }
  }

  return (
    <div className="mt-3 flex gap-1 border-b border-border" role="tablist" aria-label="表示切替">
      {tabs.map((tab, index) => {
        const selected = tab.id === activeId;
        return (
          <button
            key={tab.id}
            ref={(el) => {
              btnRefs.current[tab.id] = el;
            }}
            type="button"
            role="tab"
            id={`tab-${tab.id}`}
            aria-selected={selected}
            aria-controls={`panel-${tab.id}`}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(tab.id)}
            onKeyDown={(e) => handleKeyDown(e, index)}
            className={`border-b-2 px-3.5 py-2.5 font-sans text-sm font-semibold transition-colors duration-150 ${
              selected
                ? 'border-accent text-text-primary'
                : 'border-transparent text-text-muted hover:text-text-primary'
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
