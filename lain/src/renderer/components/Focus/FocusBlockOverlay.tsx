import React, { useMemo, useState, useEffect } from 'react';
import { useUIStore } from '../../store/ui.store';

function msToMinSec(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, '0')}`;
}

export function FocusBlockOverlay() {
  const { focusMode, focusBlockOverlay, clearFocusBlocked, breakGlass, breakGlassNow, stopFocusMode } =
    useUIStore();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!focusMode || !focusBlockOverlay) return;
    const t = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(t);
  }, [focusMode, focusBlockOverlay]);

  const cooldownLeft = useMemo(() => {
    if (!breakGlass.cooldownUntil) return null;
    const ms = breakGlass.cooldownUntil - now;
    return ms > 0 ? ms : 0;
  }, [breakGlass.cooldownUntil, now]);

  if (!focusMode || !focusBlockOverlay) return null;

  const canBreak =
    !breakGlass.cooldownUntil || breakGlass.cooldownUntil <= now;

  return (
    <div className="fixed inset-0 z-[950] bg-black/60 flex items-center justify-center p-6">
      <div className="w-[720px] max-w-[95vw] lain-glass rounded-2xl border border-border/50 overflow-hidden">
        <div className="px-5 py-4 border-b border-border/40 flex items-center">
          <div className="text-xs tracking-[0.25em] text-text-muted">FOCUS MODE</div>
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={clearFocusBlocked}
              className="px-3 h-8 rounded-md text-xs bg-bg-panel hover:bg-bg-primary text-text-secondary border border-border/40"
            >
              Dismiss
            </button>
          </div>
        </div>

        <div className="p-5">
          <div className="text-xl font-semibold text-text-primary">Blocked while focusing</div>
          <div className="mt-2 text-sm text-text-secondary break-all">
            <div className="mb-1">
              <span className="text-text-muted">URL:</span> {focusBlockOverlay.url}
            </div>
            <div>
              <span className="text-text-muted">Rule:</span> {focusBlockOverlay.rule}
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={!canBreak}
              onClick={() => breakGlassNow()}
              className="px-4 h-10 rounded-xl bg-accent hover:bg-accent-hover text-white text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title={
                canBreak
                  ? `Allow blocked sites for ${breakGlass.allowMinutes} minutes`
                  : `Cooldown active (${msToMinSec(cooldownLeft || 0)} left)`
              }
            >
              Break Glass ({breakGlass.allowMinutes}m)
            </button>
            <button
              type="button"
              onClick={stopFocusMode}
              className="px-4 h-10 rounded-xl bg-bg-panel hover:bg-bg-primary text-text-primary text-sm font-medium border border-border/40"
              title="Turn off Focus Mode"
            >
              End Focus Mode
            </button>
            {!canBreak && (
              <div className="text-xs text-text-muted">
                Break Glass cooldown: <span className="text-text-primary">{msToMinSec(cooldownLeft || 0)}</span>
              </div>
            )}
          </div>

          <div className="mt-5 text-xs text-text-muted">
            Tip: edit your Focus Mode blocklist in Settings.
          </div>
        </div>
      </div>
    </div>
  );
}

