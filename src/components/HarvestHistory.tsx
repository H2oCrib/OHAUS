import { useEffect, useRef, useState } from 'react';
import {
  listCompletedHarvests,
  loadCloudHarvest,
  deleteCloudHarvest,
  importHarvestReport,
  type CloudHarvestHistoryItem,
} from '../lib/cloud';
import { getDeviceId } from '../lib/device-id';
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

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const importInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importNotice, setImportNotice] = useState<string | null>(null);

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setImportError(null);
    setImportNotice(null);
    setImporting(true);
    const result = await importHarvestReport(file, getDeviceId(), { regenerateIds: true });
    setImporting(false);
    if (!result.ok) {
      setImportError(result.error);
      return;
    }
    setImportNotice(`Imported "${result.data.session.config.batchName}" — ${result.data.plantsImported} plants`);
    // Refresh list
    const refreshed = await listCompletedHarvests(50);
    if (refreshed.ok) setItems(refreshed.data);
  };

  const handleDelete = async (id: string) => {
    setDeleteError(null);
    setDeletingId(id);
    const result = await deleteCloudHarvest(id);
    setDeletingId(null);
    if (!result.ok) {
      setDeleteError(result.error);
      return;
    }
    setItems(prev => (prev ?? []).filter(h => h.id !== id));
    setConfirmDeleteId(null);
    if (detail && detail.config.id === id) setDetail(null);
  };

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
    const isDeleting = deletingId === detail.config.id;
    const awaitingConfirm = confirmDeleteId === detail.config.id;
    return (
      <div className="max-w-5xl mx-auto py-4 px-3 sm:px-4">
        <div className="mb-3 flex items-center justify-between gap-2 flex-wrap">
          <button
            onClick={() => setDetail(null)}
            className="px-3 py-1.5 bg-base-800 hover:bg-base-700 border border-base-600 rounded text-xs text-gray-400 transition-colors"
          >
            ← Back to History
          </button>
          {!awaitingConfirm ? (
            <button
              onClick={() => setConfirmDeleteId(detail.config.id)}
              className="px-3 py-1.5 bg-base-800 hover:bg-red-500/15 border border-base-600 hover:border-red-500/40 rounded text-xs text-gray-400 hover:text-red-400 transition-colors"
            >
              Delete Harvest
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-xs text-red-400">Delete this harvest and all readings?</span>
              <button
                onClick={() => handleDelete(detail.config.id)}
                disabled={isDeleting}
                className="px-3 py-1.5 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-xs font-medium rounded transition-colors"
              >
                {isDeleting ? 'Deleting…' : 'Confirm Delete'}
              </button>
              <button
                onClick={() => setConfirmDeleteId(null)}
                disabled={isDeleting}
                className="px-3 py-1.5 bg-base-800 hover:bg-base-700 border border-base-600 text-gray-400 text-xs rounded transition-colors"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
        {deleteError && (
          <p className="text-xs text-red-400 mb-3">Delete failed: {deleteError}</p>
        )}
        <WetSummary
          session={detail}
          onExport={() => exportWetExcel(detail)}
        />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-4 sm:py-6 px-3 sm:px-4">
      <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
        <div>
          <p className="text-[10px] sm:text-xs font-medium uppercase tracking-widest text-gray-500 mb-0.5">Cloud</p>
          <h2 className="text-xl sm:text-2xl font-semibold text-gray-50">Harvest History</h2>
        </div>
        <div className="flex items-center gap-2">
          <input
            ref={importInputRef}
            type="file"
            accept=".json,application/json,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={handleImport}
            className="hidden"
          />
          <button
            onClick={() => importInputRef.current?.click()}
            disabled={importing}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-500/10 hover:bg-green-500/20 disabled:opacity-50 border border-green-500/30 hover:border-green-500/50 rounded-xl text-xs text-green-400 font-medium transition-colors"
          >
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3v12m0 0l-4-4m4 4l4-4 M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2" />
            </svg>
            {importing ? 'Importing…' : 'Import report'}
          </button>
          <button
            onClick={onBack}
            className="px-3 py-1.5 bg-base-800 hover:bg-base-700 border border-base-600 rounded-xl text-xs text-gray-400 transition-colors"
          >
            ← Back
          </button>
        </div>
      </div>

      {importNotice && (
        <div className="bg-green-500/10 border border-green-500/30 rounded-xl px-4 py-2.5 mb-3 flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
          <span className="text-xs text-green-300">{importNotice}</span>
          <button
            onClick={() => setImportNotice(null)}
            className="ml-auto text-[10px] text-gray-500 hover:text-gray-300"
          >
            dismiss
          </button>
        </div>
      )}
      {importError && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-2.5 mb-3 flex items-center gap-2">
          <span className="text-xs text-red-400">Import failed: {importError}</span>
          <button
            onClick={() => setImportError(null)}
            className="ml-auto text-[10px] text-gray-500 hover:text-gray-300"
          >
            dismiss
          </button>
        </div>
      )}

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
                  <th className="w-24 px-2"></th>
                </tr>
              </thead>
              <tbody>
                {items.map((h, i) => {
                  const lbs = h.total_weight_grams / GRAMS_PER_LB;
                  const isConfirming = confirmDeleteId === h.id;
                  const isDeleting = deletingId === h.id;
                  return (
                    <tr
                      key={h.id}
                      onClick={() => !isConfirming && openDetail(h.id)}
                      className={`${isConfirming ? 'bg-red-500/10' : (i % 2 === 0 ? 'bg-base-900' : 'bg-base-800/30')} ${isConfirming ? '' : 'cursor-pointer hover:bg-base-700/50'} transition-colors`}
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
                      <td className="px-2 py-2 text-right whitespace-nowrap" onClick={e => e.stopPropagation()}>
                        {!isConfirming ? (
                          <button
                            onClick={() => setConfirmDeleteId(h.id)}
                            aria-label={`Delete ${h.batch_name}`}
                            className="text-gray-600 hover:text-red-400 text-sm px-2 transition-colors"
                            title="Delete harvest"
                          >
                            🗑
                          </button>
                        ) : (
                          <div className="inline-flex gap-1">
                            <button
                              onClick={() => handleDelete(h.id)}
                              disabled={isDeleting}
                              className="px-2 py-0.5 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-[10px] font-medium rounded"
                            >
                              {isDeleting ? '…' : 'Delete'}
                            </button>
                            <button
                              onClick={() => setConfirmDeleteId(null)}
                              disabled={isDeleting}
                              className="px-2 py-0.5 bg-base-800 hover:bg-base-700 border border-base-600 text-gray-400 text-[10px] rounded"
                            >
                              Cancel
                            </button>
                          </div>
                        )}
                      </td>
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
      {deleteError && (
        <p className="text-xs text-red-400 mt-2">Delete failed: {deleteError}</p>
      )}
      {detailLoading && (
        <p className="text-xs text-gray-500 mt-2">Opening harvest…</p>
      )}
    </div>
  );
}
