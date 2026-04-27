import React, { useEffect, useMemo, useState } from 'react';
import { useUIStore } from '../../store/ui.store';

function formatTime(sec: number) {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, '0')}`;
}

export function FocusTimer() {
  const { focusMode, focusTimer, stopFocusMode } = useUIStore();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!focusMode || !focusTimer.running) return;
    const t = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(t);
  }, [focusMode, focusTimer.running]);

  const remainingSec = useMemo(() => {
    if (!focusMode || !focusTimer.running || !focusTimer.startedAt) return null;
    if (!focusTimer.durationSec) return null;
    const elapsed = (now - focusTimer.startedAt) / 1000;
    return Math.max(0, focusTimer.durationSec - elapsed);
  }, [focusMode, focusTimer, now]);

  useEffect(() => {
    if (remainingSec === 0) {
      stopFocusMode();
    }
  }, [remainingSec, stopFocusMode]);

  if (!focusMode) return null;

  return (
    <div className="fixed top-4 right-4 z-[900] lain-glass rounded-xl px-3 h-10 flex items-center gap-3 border border-border/40">
      <div className="text-xs tracking-[0.25em] text-text-muted">FOCUS</div>
      <div className="text-sm font-semibold text-text-primary">
        {remainingSec == null ? 'ON' : formatTime(remainingSec)}
      </div>
      <button
        type="button"
        onClick={stopFocusMode}
        className="px-2 h-7 rounded-md text-xs bg-bg-panel hover:bg-bg-primary text-text-secondary border border-border/40"
        title="End Focus Mode"
      >
        End
      </button>
    </div>
  );
}

