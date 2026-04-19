import { useState, useRef } from 'react';
import type { HarvestBatchConfig, HarvestStrainConfig, HarvestSession } from '../lib/types';
import { ScannerHowTo } from './ScannerGuide';
import { parseSessionFile } from '../lib/session-persistence';
import { cloudEnabled } from '../lib/supabase';

export type SaveMode = 'local' | 'cloud';

const SAVE_MODE_KEY = 'scalesync-save-mode';

function readStoredSaveMode(): SaveMode {
  try {
    const raw = localStorage.getItem(SAVE_MODE_KEY);
    if (raw === 'cloud' || raw === 'local') return raw;
  } catch {
    // fall through
  }
  return 'local';
}

interface WetSetupProps {
  onStartWeighing: (config: HarvestBatchConfig, saveMode: SaveMode) => void;
  onLoadSession: (session: HarvestSession) => void;
  onBack: () => void;
}

export function WetSetup({ onStartWeighing, onLoadSession, onBack }: WetSetupProps) {
  const [saveMode, setSaveMode] = useState<SaveMode>(() => {
    const stored = readStoredSaveMode();
    return cloudEnabled ? stored : 'local';
  });

  const chooseMode = (mode: SaveMode) => {
    if (mode === 'cloud' && !cloudEnabled) return;
    setSaveMode(mode);
    try { localStorage.setItem(SAVE_MODE_KEY, mode); } catch { /* ignore */ }
  };
  const today = new Date().toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' });
  const [batchName, setBatchName] = useState(`Harvest ${today}`);
  const [strains, setStrains] = useState<HarvestStrainConfig[]>([]);
  const [strainName, setStrainName] = useState('');
  const [plantCount, setPlantCount] = useState('');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [bulkError, setBulkError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleLoadFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoadError(null);
    const reader = new FileReader();
    reader.onload = () => {
      const parsed = parseSessionFile(reader.result as string);
      if (parsed) {
        onLoadSession(parsed.harvestSession);
      } else {
        setLoadError('Invalid session file');
        setTimeout(() => setLoadError(null), 3000);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const totalPlants = strains.reduce((sum, s) => sum + s.plantCount, 0);

  const handleAddStrain = (e: React.FormEvent) => {
    e.preventDefault();
    if (!strainName.trim() || !plantCount) return;

    setStrains(prev => [...prev, {
      id: crypto.randomUUID(),
      strain: strainName.trim(),
      plantCount: parseInt(plantCount),
    }]);
    setStrainName('');
    setPlantCount('');
  };

  const handleRemoveStrain = (id: string) => {
    setStrains(prev => prev.filter(s => s.id !== id));
  };

  const handleBulkAdd = () => {
    setBulkError(null);
    const lines = bulkText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (lines.length === 0) { setBulkError('Paste one strain per line'); return; }
    const parsed: HarvestStrainConfig[] = [];
    const errors: string[] = [];
    for (const [i, line] of lines.entries()) {
      const numMatch = line.match(/\b(\d+)\b/);
      if (!numMatch) { errors.push(`Line ${i + 1}: no count`); continue; }
      const count = parseInt(numMatch[1], 10);
      if (count <= 0) { errors.push(`Line ${i + 1}: count must be > 0`); continue; }
      const name = line
        .replace(numMatch[0], '')
        .replace(/[,\t]+/g, ' ')
        .replace(/\bplants?\b/gi, '')
        .replace(/\s+/g, ' ')
        .trim();
      if (!name) { errors.push(`Line ${i + 1}: no strain name`); continue; }
      parsed.push({ id: crypto.randomUUID(), strain: name, plantCount: count });
    }
    if (errors.length) { setBulkError(errors.slice(0, 3).join(' · ')); return; }
    setStrains(prev => [...prev, ...parsed]);
    setBulkText('');
    setBulkOpen(false);
  };

  const handleStart = () => {
    if (strains.length === 0 || !batchName.trim()) return;
    onStartWeighing({
      id: crypto.randomUUID(),
      batchName: batchName.trim(),
      strains,
      date: new Date(),
    }, saveMode);
  };

  const fieldLabel = 'text-[11px] font-mono uppercase tracking-[0.18em] text-gray-500 mb-1.5';
  const inputCls = 'w-full px-3.5 py-3 bg-base-800 border border-base-700 rounded-xl text-gray-100 placeholder-gray-600 focus:outline-none focus:border-green-500/50 font-medium text-[14px]';

  return (
    <div className="min-h-[80vh] px-8 py-8 max-w-6xl mx-auto">
      {/* Top eyebrow row */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={onBack}
          className="px-3 py-1.5 bg-base-800 hover:bg-base-700 border border-base-700 rounded-lg text-xs text-gray-300 transition-colors"
        >
          &larr; Back
        </button>
        <div>
          <p className="text-[11px] font-mono uppercase tracking-[0.24em] text-gray-500">Step 2 of 3 &middot; Setup</p>
          <h1 className="mt-1 text-[26px] lg:text-[28px] font-semibold tracking-[-0.015em] text-gray-50">
            Wet weight harvest
          </h1>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-7">
        {/* LEFT — Form */}
        <div className="flex flex-col gap-3.5">
          {/* Batch + Save destination merged into one primary card */}
          <div className="bg-base-850 border border-base-700 rounded-2xl p-[22px]">
            <label className="block">
              <div className={fieldLabel}>Batch name</div>
              <input
                type="text"
                value={batchName}
                onChange={e => setBatchName(e.target.value)}
                placeholder="e.g. Harvest 4/9/2026"
                className={inputCls}
                required
              />
            </label>

            <div className="mt-4 pt-4 border-t border-base-700 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className={fieldLabel}>Save to</p>
                <p className="text-[11px] text-gray-600">
                  {saveMode === 'cloud'
                    ? 'Local + Supabase. Works offline, syncs when online.'
                    : 'This browser only. Export or save file to back up.'}
                  {!cloudEnabled && <span className="ml-2 text-amber-500/80">Cloud disabled.</span>}
                </p>
              </div>
              <div role="tablist" aria-label="Save destination" className="inline-flex rounded-xl border border-base-700 bg-base-800 p-0.5 shrink-0">
                <button
                  type="button"
                  role="tab"
                  aria-selected={saveMode === 'local'}
                  onClick={() => chooseMode('local')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    saveMode === 'local' ? 'bg-green-500 text-base-950 font-semibold' : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  Local only
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={saveMode === 'cloud'}
                  onClick={() => chooseMode('cloud')}
                  disabled={!cloudEnabled}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    saveMode === 'cloud'
                      ? 'bg-green-500 text-base-950 font-semibold'
                      : cloudEnabled
                        ? 'text-gray-400 hover:text-gray-200'
                        : 'text-gray-700 cursor-not-allowed'
                  }`}
                >
                  Sync to cloud
                </button>
              </div>
            </div>
          </div>

          {/* Add Strain form */}
          <form onSubmit={handleAddStrain} className="bg-base-850 border border-base-700 rounded-2xl p-[22px]">
            <label className="block">
              <div className={fieldLabel}>Strain name</div>
              <input
                type="text"
                value={strainName}
                onChange={e => setStrainName(e.target.value)}
                placeholder="e.g. Gas Face"
                className={inputCls}
                required
              />
            </label>
            <label className="block mt-3.5">
              <div className={fieldLabel}>Plants</div>
              <input
                type="number"
                value={plantCount}
                onChange={e => setPlantCount(e.target.value)}
                placeholder="24"
                min="1"
                className={`${inputCls} font-mono text-[15px]`}
                required
              />
            </label>
            <button
              type="submit"
              className="mt-[18px] w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-green-500 hover:bg-green-400 text-base-950 font-semibold text-[14px] transition-colors"
            >
              <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 5v14M5 12h14" />
              </svg>
              Add strain
            </button>
          </form>

          {/* Paste strain list (collapsible) */}
          <div className="bg-base-850 border border-base-700 rounded-2xl overflow-hidden">
            <button
              type="button"
              onClick={() => setBulkOpen(v => !v)}
              className="w-full flex items-center justify-between px-[22px] py-3.5 text-left hover:bg-base-800/40 transition-colors"
              aria-expanded={bulkOpen}
            >
              <div>
                <p className="text-[13px] font-semibold text-gray-200">Paste strain list</p>
                <p className="text-[11px] text-gray-500 mt-0.5">Bulk add from a harvest sheet — one strain per line</p>
              </div>
              <span className="text-gray-500 text-xs">{bulkOpen ? '▲' : '▼'}</span>
            </button>
            {bulkOpen && (
              <div className="px-[22px] pb-4 border-t border-base-700">
                <textarea
                  value={bulkText}
                  onChange={e => setBulkText(e.target.value)}
                  placeholder={'CHERRIEZ 117\nRAINBOW RUNTZ 63\nBLUE NERDZ 144\n...'}
                  rows={6}
                  className="w-full mt-3.5 px-3.5 py-2.5 bg-base-800 border border-base-700 rounded-xl text-gray-100 placeholder-gray-600 focus:outline-none focus:border-green-500/50 font-mono text-[13px]"
                />
                <p className="text-[10px] text-gray-600 mt-1.5">
                  Accepts: <span className="font-mono">NAME 117</span>, <span className="font-mono">NAME, 117</span>, <span className="font-mono">NAME 117 plants</span>
                </p>
                {bulkError && <p className="text-[10px] text-red-400 mt-1.5">{bulkError}</p>}
                <div className="flex gap-2 mt-3">
                  <button
                    type="button"
                    onClick={handleBulkAdd}
                    className="flex-1 py-2.5 bg-green-500 hover:bg-green-400 text-base-950 text-[13px] font-semibold rounded-xl transition-colors"
                  >
                    Add all
                  </button>
                  <button
                    type="button"
                    onClick={() => { setBulkText(''); setBulkError(null); setBulkOpen(false); }}
                    className="px-4 py-2.5 bg-base-800 hover:bg-base-700 border border-base-700 text-gray-300 text-[13px] rounded-xl transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Resume previous session */}
          <div className="bg-base-850 border border-base-700 rounded-2xl p-[18px] flex items-center justify-between gap-3">
            <div>
              <p className="text-[13px] font-semibold text-gray-200">Resume previous session</p>
              <p className="text-[11px] text-gray-500 mt-0.5">Load a saved .json progress file</p>
            </div>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2 bg-base-800 hover:bg-base-700 border border-base-700 rounded-xl text-[13px] text-gray-200 font-medium transition-colors"
            >
              Load file
            </button>
            <input ref={fileInputRef} type="file" accept=".json" onChange={handleLoadFile} className="hidden" />
          </div>
          {loadError && <p className="text-xs text-red-400">{loadError}</p>}

          {/* Scanner setup */}
          <ScannerHowTo />
        </div>

        {/* RIGHT — Queue + Start */}
        <div className="flex flex-col">
          <div className="flex justify-between items-center mb-2.5">
            <p className="text-[11px] font-mono uppercase tracking-[0.24em] text-gray-500">
              Queued &middot; {strains.length}
            </p>
            {totalPlants > 0 && (
              <span className="text-[11px] font-mono text-green-400">{totalPlants} plants total</span>
            )}
          </div>
          <div className="flex-1 flex flex-col gap-2">
            {strains.length === 0 && (
              <div className="rounded-2xl border border-dashed border-base-600 p-7 text-center text-sm text-gray-500">
                Add your first strain to begin.
              </div>
            )}
            {strains.map(s => (
              <div
                key={s.id}
                className="bg-base-850 border border-base-700 rounded-xl px-4 py-3.5 flex justify-between items-center"
              >
                <div>
                  <div className="text-[15px] font-semibold text-gray-50">{s.strain}</div>
                  <div className="text-[12px] font-mono text-gray-500 mt-0.5">{s.plantCount} plants</div>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => handleRemoveStrain(s.id)}
                    className="text-gray-600 hover:text-red-400 transition-colors text-[11px]"
                  >
                    Remove
                  </button>
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center"
                    style={{ background: 'rgba(124,255,176,0.14)', color: '#7CFFB0' }}
                  >
                    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M11 20A7 7 0 014 13V5a10 10 0 0110 10 7 7 0 01-3 5zM5 13c5 0 9 4 9 9" />
                    </svg>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={handleStart}
            disabled={!strains.length}
            className={`mt-3.5 w-full inline-flex items-center justify-center gap-2 px-[18px] py-3.5 rounded-xl text-[15px] font-semibold transition-colors ${
              strains.length
                ? 'bg-green-500 hover:bg-green-400 text-base-950'
                : 'bg-base-800 text-gray-600 cursor-not-allowed'
            }`}
          >
            {strains.length ? `Start weighing (${totalPlants} plants)` : 'Start weighing'}
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
