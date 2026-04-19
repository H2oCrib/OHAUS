import { useEffect, useState } from 'react';
import { listCompletedHarvests, type CloudHarvestHistoryItem } from '../lib/cloud';
import { GRAMS_PER_LB } from '../lib/types';

interface ScaleConnectionProps {
  connected: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
  onDemoMode: () => void;
  error: string | null;
  onViewHistory?: () => void;
  historyEnabled?: boolean;
}

function formatShortDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function ScaleConnection({ connected, onConnect, onDisconnect, onDemoMode, error, onViewHistory, historyEnabled }: ScaleConnectionProps) {
  const today = new Date().toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  const webSerial = typeof navigator !== 'undefined' && 'serial' in navigator;

  const [recent, setRecent] = useState<CloudHarvestHistoryItem[] | null>(null);
  const [recentLoading, setRecentLoading] = useState(false);

  useEffect(() => {
    if (!historyEnabled) return;
    let cancelled = false;
    setRecentLoading(true);
    (async () => {
      const result = await listCompletedHarvests(3);
      if (cancelled) return;
      setRecentLoading(false);
      if (result.ok) setRecent(result.data);
      else setRecent([]);
    })();
    return () => { cancelled = true; };
  }, [historyEnabled]);

  return (
    <div className="min-h-[82vh] px-8 py-8 grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-6xl mx-auto">
      {/* LEFT — Hero */}
      <div className="flex flex-col justify-center">
        <p className="text-[12px] font-mono uppercase tracking-[0.24em] text-gray-500 mb-4">
          Session &middot; {today}
        </p>
        <h1 className="text-[44px] lg:text-[54px] font-semibold leading-[1.02] tracking-[-0.035em] text-gray-50">
          Ready to
          <br />
          <span
            className="bg-clip-text text-transparent"
            style={{ backgroundImage: 'linear-gradient(135deg, #4DD0FF, #7B5CFF)' }}
          >
            weigh in.
          </span>
        </h1>
        <p className="text-[15px] leading-[1.5] text-gray-400 max-w-[360px] mt-[18px]">
          Connect your OHAUS Valor 7000 or start in demo mode. Your last session is saved — nothing's lost.
        </p>

        {!connected ? (
          <>
            <div className="flex flex-wrap gap-2.5 mt-7">
              <button
                onClick={onConnect}
                className="inline-flex items-center gap-2 px-[22px] py-[14px] rounded-xl bg-cyan-500 hover:bg-cyan-400 text-base-950 font-semibold text-[15px] transition-colors"
              >
                <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2v10M5.636 5.636a9 9 0 1012.728 0" />
                </svg>
                Connect scale
              </button>
              <button
                onClick={onDemoMode}
                className="inline-flex items-center gap-2 px-[22px] py-[14px] rounded-xl bg-transparent border border-base-700 hover:border-base-600 text-gray-200 font-medium text-[15px] transition-colors"
              >
                Demo mode
              </button>
            </div>

            {!webSerial && (
              <p className="mt-4 text-red-400 text-sm bg-red-500/10 px-4 py-2.5 rounded-xl border border-red-500/15 max-w-[400px]">
                Web Serial not supported — use Chrome or Edge
              </p>
            )}

            <p className="mt-9 text-[12px] font-mono tracking-[0.05em] text-gray-600">
              USB &middot; RS-232 &middot; 9600 baud &middot; 8-N-1
            </p>
          </>
        ) : (
          <div className="mt-7 flex items-center gap-4 max-w-[400px]">
            <div className="flex items-center gap-3 px-5 py-3 rounded-xl border border-cyan-500/30 bg-cyan-500/8 flex-1">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" style={{ boxShadow: '0 0 8px #4DD0FF' }} />
              <div>
                <p className="text-cyan-400 font-semibold text-sm">Connected</p>
                <p className="text-[10px] font-mono text-gray-500">Scale ready</p>
              </div>
            </div>
            <button
              onClick={onDisconnect}
              className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
            >
              Disconnect
            </button>
          </div>
        )}

        {error && (
          <p className="mt-4 text-red-400 text-sm bg-red-500/10 px-4 py-2.5 rounded-xl border border-red-500/15 max-w-[400px]">
            {error}
          </p>
        )}
      </div>

      {/* RIGHT — Recent Harvests */}
      <div
        className="relative rounded-2xl border border-base-700 p-7 flex flex-col overflow-hidden min-h-[340px]"
        style={{
          background:
            'radial-gradient(ellipse at 30% 20%, rgba(123,92,255,0.12), transparent 55%), radial-gradient(ellipse at 70% 80%, rgba(77,208,255,0.12), transparent 60%), #121829',
        }}
      >
        <div className="flex items-center justify-between mb-4">
          <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-gray-500">
            Recent Harvests
          </p>
          {historyEnabled && onViewHistory && (
            <button
              onClick={onViewHistory}
              className="text-[11px] font-mono uppercase tracking-[0.18em] text-cyan-400 hover:text-cyan-300 transition-colors inline-flex items-center gap-1"
            >
              View all
              <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 5l7 7-7 7" />
              </svg>
            </button>
          )}
        </div>

        {!historyEnabled && (
          <div className="flex-1 flex items-center justify-center text-center">
            <p className="text-[13px] text-gray-500 max-w-[240px]">
              Cloud sync off — harvest history unavailable. Complete a harvest locally to export a report.
            </p>
          </div>
        )}

        {historyEnabled && recentLoading && (
          <div className="flex-1 flex items-center justify-center text-[13px] text-gray-500">
            Loading…
          </div>
        )}

        {historyEnabled && !recentLoading && recent && recent.length === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center text-center gap-2.5">
            <p className="text-[13px] text-gray-400 max-w-[240px]">
              No completed harvests yet. They'll appear here after you finish a cloud-synced harvest.
            </p>
            {onViewHistory && (
              <button
                onClick={onViewHistory}
                className="text-[11px] font-mono uppercase tracking-[0.14em] text-cyan-400 hover:text-cyan-300 inline-flex items-center gap-1 transition-colors"
              >
                Open history
                <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 5l7 7-7 7" />
                </svg>
              </button>
            )}
          </div>
        )}

        {historyEnabled && !recentLoading && recent && recent.length > 0 && (
          <div className="flex-1 flex flex-col gap-2">
            {recent.map(h => {
              const lbs = h.total_weight_grams / GRAMS_PER_LB;
              return (
                <button
                  key={h.id}
                  onClick={onViewHistory}
                  className="group text-left rounded-xl border border-base-700 hover:border-cyan-500/40 bg-base-900/40 hover:bg-base-900/70 px-4 py-3 transition-colors flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <p className="text-[14px] font-semibold text-gray-100 truncate group-hover:text-cyan-300 transition-colors">{h.batch_name}</p>
                    <p className="text-[11px] font-mono text-gray-500 mt-0.5">
                      {formatShortDate(h.completed_at)} &middot; {h.reading_count}/{h.total_plants} plants
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[15px] font-semibold font-mono text-gray-100 tabular-nums">
                      {lbs.toFixed(2)}<span className="text-[11px] text-gray-500 ml-1 font-light">lbs</span>
                    </p>
                    <p className="text-[10px] font-mono text-gray-600 tabular-nums">{h.total_weight_grams.toFixed(0)} g</p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
