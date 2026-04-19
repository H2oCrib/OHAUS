import { useState } from 'react';
import type { ProductType, StrainConfig } from '../lib/types';

interface SessionSetupProps {
  onAddStrain: (config: StrainConfig) => void;
  onStartWeighing: () => void;
  strains: StrainConfig[];
}

const PRODUCT_TYPES: ProductType[] = ['Flower', 'Trim', 'Popcorn'];

export function SessionSetup({ onAddStrain, onStartWeighing, strains }: SessionSetupProps) {
  const [strain, setStrain] = useState('');
  const [type, setType] = useState<ProductType>('Flower');
  const [totalUnits, setTotalUnits] = useState('');
  const [claimedLbs, setClaimedLbs] = useState('');
  const [partialCount, setPartialCount] = useState('');
  const [partialSize, setPartialSize] = useState('');

  const isBagged = type === 'Trim' || type === 'Popcorn';
  const itemLabel = isBagged ? 'Bags' : 'Full units';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!strain.trim() || !totalUnits) return;

    const pCount = partialCount ? parseInt(partialCount) : 0;
    const claimed = claimedLbs ? parseFloat(claimedLbs) : null;
    onAddStrain({
      id: crypto.randomUUID(),
      strain: strain.trim(),
      type,
      totalUnits: parseInt(totalUnits),
      claimedLbs: !isBagged && claimed != null ? claimed : null,
      claimedGrams: isBagged && claimed != null ? claimed : null,
      partialCount: pCount,
      partialSizeGrams: partialSize ? parseFloat(partialSize) : 226.8,
    });

    setStrain('');
    setType('Flower');
    setTotalUnits('');
    setClaimedLbs('');
    setPartialCount('');
    setPartialSize('');
  };

  return (
    <div className="min-h-[80vh] px-8 py-8 max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-7">
      {/* LEFT — Form */}
      <div>
        <p className="text-[11px] font-mono uppercase tracking-[0.24em] text-gray-500">Step 2 of 3 &middot; Setup</p>
        <h1 className="mt-1.5 mb-6 text-[26px] lg:text-[28px] font-semibold tracking-[-0.015em] text-gray-50">
          Build your session
        </h1>

        <form onSubmit={handleSubmit} className="bg-base-850 border border-base-700 rounded-2xl p-[22px]">
          <Field label="Strain name">
            <input
              type="text"
              value={strain}
              onChange={e => setStrain(e.target.value)}
              placeholder="e.g. Gas Face"
              required
              className="w-full px-3.5 py-3 bg-base-800 border border-base-700 rounded-xl text-gray-100 placeholder-gray-600 focus:outline-none focus:border-cyan-500/50 font-medium text-[14px]"
            />
          </Field>

          <div className="grid grid-cols-2 gap-4 mt-3.5">
            <Field label={itemLabel}>
              <input
                type="number"
                value={totalUnits}
                onChange={e => setTotalUnits(e.target.value)}
                placeholder="77"
                min="1"
                required
                className="w-full px-3.5 py-3 bg-base-800 border border-base-700 rounded-xl text-gray-100 placeholder-gray-600 focus:outline-none focus:border-cyan-500/50 font-mono text-[15px]"
              />
            </Field>
            <Field label={isBagged ? 'Claimed (g)' : 'Claimed (lbs)'}>
              <input
                type="number"
                value={claimedLbs}
                onChange={e => setClaimedLbs(e.target.value)}
                placeholder={isBagged ? '5000' : '76.78'}
                min="0"
                step={isBagged ? '1' : '0.01'}
                className="w-full px-3.5 py-3 bg-base-800 border border-base-700 rounded-xl text-gray-100 placeholder-gray-600 focus:outline-none focus:border-cyan-500/50 font-mono text-[15px]"
              />
            </Field>
          </div>

          <div className="mt-3.5 flex gap-2 flex-wrap">
            {PRODUCT_TYPES.map(t => {
              const active = t === type;
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className={`px-3 py-[7px] rounded-full text-xs font-medium border transition-colors ${
                    active
                      ? 'bg-cyan-500/15 border-cyan-500/55 text-cyan-400'
                      : 'bg-base-800 border-base-700 text-gray-300 hover:border-base-600'
                  }`}
                >
                  {t}
                </button>
              );
            })}
          </div>

          {/* Partials */}
          <div className="mt-4 pt-4 border-t border-base-700">
            <p className="text-[11px] font-mono uppercase tracking-[0.18em] text-gray-500 mb-3">
              Partials <span className="text-gray-600 normal-case tracking-normal">optional</span>
            </p>
            <div className="grid grid-cols-2 gap-4">
              <Field label="How many">
                <input
                  type="number"
                  value={partialCount}
                  onChange={e => setPartialCount(e.target.value)}
                  placeholder="0"
                  min="0"
                  className="w-full px-3.5 py-3 bg-base-800 border border-base-700 rounded-xl text-gray-100 placeholder-gray-600 focus:outline-none focus:border-cyan-500/50 font-mono text-[15px]"
                />
              </Field>
              <Field label="Partial size (g)">
                <input
                  type="number"
                  value={partialSize}
                  onChange={e => setPartialSize(e.target.value)}
                  placeholder="226.8"
                  min="1"
                  step="0.1"
                  className="w-full px-3.5 py-3 bg-base-800 border border-base-700 rounded-xl text-gray-100 placeholder-gray-600 focus:outline-none focus:border-cyan-500/50 font-mono text-[15px]"
                />
              </Field>
            </div>
          </div>

          <button
            type="submit"
            className="mt-[18px] w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-base-950 font-semibold text-[14px] transition-colors"
          >
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
            Add strain
          </button>
        </form>
      </div>

      {/* RIGHT — Queue */}
      <div className="flex flex-col">
        <p className="text-[11px] font-mono uppercase tracking-[0.24em] text-gray-500 mb-2.5">
          Queued &middot; {strains.length}
        </p>
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
                <div className="text-[12px] font-mono text-gray-500 mt-0.5">
                  {s.totalUnits} {s.type === 'Trim' || s.type === 'Popcorn' ? 'bags' : 'units'}
                  {s.claimedLbs != null && ` · ${s.claimedLbs} lbs`}
                  {s.claimedGrams != null && ` · ${s.claimedGrams} g`}
                  {s.partialCount > 0 && ` · ${s.partialCount}×${s.partialSizeGrams}g partials`}
                </div>
              </div>
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center"
                style={{ background: 'rgba(77,208,255,0.14)', color: '#4DD0FF' }}
              >
                <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
                </svg>
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={onStartWeighing}
          disabled={!strains.length}
          className={`mt-3.5 w-full inline-flex items-center justify-center gap-2 px-[18px] py-3.5 rounded-xl text-[15px] font-semibold transition-colors ${
            strains.length
              ? 'bg-cyan-500 hover:bg-cyan-400 text-base-950'
              : 'bg-base-800 text-gray-600 cursor-not-allowed'
          }`}
        >
          Start weighing
          <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="text-[11px] font-mono uppercase tracking-[0.18em] text-gray-500 mb-1.5">{label}</div>
      {children}
    </label>
  );
}
