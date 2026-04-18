import { useEffect, useState } from 'react';
import {
  listCompletedHarvests,
  loadCloudHarvest,
  type CloudHarvestHistoryItem,
} from '../lib/cloud';
import { GRAMS_PER_LB } from '../lib/types';
import type { HarvestSession } from '../lib/types';
import { WetSummary } from './WetSummary';
import { exportWetExcel } from '../lib/wet-export';

interface HarvestHistoryProps {
  onBack: () => void;
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function HarvestHistory({ onBack }: HarvestHistoryProps) {
  const [items, setItems] = useState<CloudHarvestHistoryItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [detail, setDetail] = useState<HarvestSession | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const result = await listCompletedHarvests(50);
      if (cancelled) return;
      if (result.ok) {
        setItems(result.data);
        setError(null);
      } else {
        setError(result.error);
        setItems([]);
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const openDetail = async (id: string) => {
    setDetailError(null);
    setDetailLoading(true);
    const result = await loadCloudHarvest(id);
    setDetailLoading(false);
    if (!result.ok) {
      setDetailError(result.error);
      return;
    }
    setDetail(result.data);
  };

  // Detail view — reuse WetSummary read-only.
  if (detail) {
    return (
      <div className="max-w-5xl mx-auto py-4 px-3 sm:px-4">
        <div className="mb-3 flex gap-2">
          <button
            onClick={() => setDetail(null)}
            className="px-3 py-1.5 bg-base-800 hover:bg-base-700 border border-base-600 rounded text-xs text-gray-400 transition-colors"
          >
            ← Back to History
          </button>
        </div>
        <WetSummary
          session={detail}
          onExport={() => exportWetExcel(detail)}
          onNewSession={() => setDetail(null)}
        />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-4 sm:py-6 px-3 sm:px-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-[10px] sm:text-xs font-medium uppercase tracking-widest text-gray-500 mb-0.5">Cloud</p>
          <h2 className="text-xl sm:text-2xl font-semibold text-gray-50">Harvest History</h2>
        </div>
        <button
          onClick={onBack}
          className="px-3 py-1.5 bg-base-800 hover:bg-base-700 border border-base-600 rounded text-xs text-gray-400 transition-colors"
        >
          ← Back
        </button>
      </div>

      {loading && (
        <div className="bg-base-900 border border-base-700 rounded-lg p-6 text-center text-xs text-gray-500">
          Loading…
        </div>
      )}

      {error && !loading && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-xs text-red-400">
          Failed to load history: {error}
        </div>
      )}

      {!loading && items && items.length === 0 && !error && (
        <div className="bg-base-900 border border-base-700 rounded-lg p-6 text-center text-xs text-gray-500">
          No completed harvests yet. They'll appear here after you finish a cloud-synced harvest.
        </div>
      )}

      {!loading && items && items.length > 0 && (
        <div className="bg-base-900 border border-base-700 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm min-w-[640px]">
              <thead className="bg-base-800 border-b border-base-700">
                <tr>
                  <th className="px-3 sm:px-4 py-2 text-[10px] sm:text-xs font-medium uppercase tracking-widest text-gray-500">Batch</th>
                  <th className="px-3 sm:px-4 py-2 text-[10px] sm:text-xs font-medium uppercase tracking-widest text-gray-500">Finished</th>
                  <th className="px-3 sm:px-4 py-2 text-[10px] sm:text-xs font-medium uppercase tracking-widest text-gray-500 text-right">Plants</th>
                  <th className="px-3 sm:px-4 py-2 text-[10px] sm:text-xs font-medium uppercase tracking-widest text-gray-500 text-right">Weight (g)</th>
                  <th className="px-3 sm:px-4 py-2 text-[10px] sm:text-xs font-medium uppercase tracking-widest text-gray-500 text-right">Lbs</th>
                  <th className="w-8"></th>
                </tr>
              </thead>
              <tbody>
                {items.map((h, i) => {
                  const lbs = h.total_weight_grams / GRAMS_PER_LB;
                  return (
                    <tr
                      key={h.id}
                      onClick={() => openDetail(h.id)}
                      className={`cursor-pointer hover:bg-base-700/50 transition-colors ${i % 2 === 0 ? 'bg-base-900' : 'bg-base-800/30'}`}
                    >
                      <td className="px-3 sm:px-4 py-2">
                        <p className="text-gray-200 font-medium truncate">{h.batch_name}</p>
                        <p className="text-[10px] text-gray-600 font-mono">{h.workflow_mode}</p>
                      </td>
                      <td className="px-3 sm:px-4 py-2 text-gray-400 font-mono text-[11px]">{formatDate(h.completed_at)}</td>
                      <td className="px-3 sm:px-4 py-2 font-mono text-right text-gray-300 tabular-nums">
                        {h.reading_count}<span className="text-gray-600">/{h.total_plants}</span>
                      </td>
                      <td className="px-3 sm:px-4 py-2 font-mono text-right text-gray-200 tabular-nums">{h.total_weight_grams.toFixed(1)}</td>
                      <td className="px-3 sm:px-4 py-2 font-mono text-right text-gray-200 tabular-nums">{lbs.toFixed(2)}</td>
                      <td className="px-2 py-2 text-gray-600 text-right">›</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {detailError && (
        <p className="text-xs text-red-400 mt-2">Load failed: {detailError}</p>
      )}
      {detailLoading && (
        <p className="text-xs text-gray-500 mt-2">Opening harvest…</p>
      )}
    </div>
  );
}
