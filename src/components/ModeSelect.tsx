import type { WorkflowMode } from '../lib/types';

interface ModeSelectProps {
  onSelectMode: (mode: WorkflowMode) => void;
  onDisconnect: () => void;
  demoMode: boolean;
  onViewHistory?: () => void;
  historyEnabled?: boolean;
}

const MODES: {
  k: WorkflowMode;
  title: string;
  sub: string;
  color: string;
  color2: string;
  path: string;
}[] = [
  {
    k: 'dry',
    title: 'Dry weight',
    sub: 'Verify packaged product against claimed weights.',
    color: '#4DD0FF',
    color2: '#7B5CFF',
    path: 'M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z',
  },
  {
    k: 'wet',
    title: 'Wet harvest',
    sub: 'Scan METRC tags and capture per-plant weight.',
    color: '#7CFFB0',
    color2: '#FFD166',
    path: 'M11 20A7 7 0 014 13V5a10 10 0 0110 10 7 7 0 01-3 5zM5 13c5 0 9 4 9 9',
  },
];

export function ModeSelect({ onSelectMode, onDisconnect, demoMode, onViewHistory, historyEnabled }: ModeSelectProps) {
  return (
    <div className="min-h-[80vh] px-8 py-8 max-w-6xl mx-auto flex flex-col">
      <div className="mb-6">
        <p className="text-[11px] font-mono uppercase tracking-[0.24em] text-gray-500">Step 1 of 3</p>
        <h1 className="mt-1.5 text-[28px] lg:text-[34px] font-semibold tracking-[-0.02em] text-gray-50">
          What are we weighing today?
        </h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1">
        {MODES.map(m => (
          <button
            key={m.k}
            onClick={() => onSelectMode(m.k)}
            className="group text-left p-6 rounded-2xl border border-base-700 transition-all duration-200 flex flex-col justify-between min-h-[260px] hover:-translate-y-0.5"
            style={{
              background: `linear-gradient(160deg, ${m.color}14, transparent 60%), #121829`,
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = m.color + '55'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = ''; }}
          >
            <div>
              <div
                className="w-[54px] h-[54px] rounded-2xl flex items-center justify-center mb-[18px]"
                style={{ background: `linear-gradient(135deg, ${m.color}, ${m.color2})`, color: '#0A0E1A' }}
              >
                <svg width={26} height={26} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d={m.path} />
                </svg>
              </div>
              <div className="text-[22px] lg:text-[24px] font-semibold tracking-[-0.01em] text-gray-50">{m.title}</div>
              <div className="text-[14px] text-gray-400 mt-1.5 max-w-[320px]">{m.sub}</div>
            </div>
            <div
              className="flex justify-between items-center mt-10 text-[13px] font-medium"
              style={{ color: m.color }}
            >
              Continue
              <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </button>
        ))}
      </div>

      {historyEnabled && onViewHistory && (
        <button
          onClick={onViewHistory}
          className="group mt-4 w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-base-700 hover:border-sky-500/40 hover:bg-sky-500/5 transition-all"
        >
          <svg className="w-4 h-4 text-sky-400/80" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-xs uppercase tracking-widest text-gray-400 group-hover:text-sky-300 transition-colors">Harvest History</span>
        </button>
      )}

      <div className="mt-6 flex items-center gap-3 text-xs text-gray-500">
        <button
          onClick={onDisconnect}
          className="hover:text-gray-300 transition-colors"
        >
          Disconnect
        </button>
        {demoMode && (
          <>
            <span className="text-gray-700">&middot;</span>
            <span className="text-amber-500/70 font-mono uppercase tracking-[0.2em] text-[10px]">Demo mode</span>
          </>
        )}
      </div>
    </div>
  );
}
