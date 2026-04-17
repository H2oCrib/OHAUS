import type { HarvestSession, WorkflowMode, AppPhase } from './types';

const STORAGE_KEY = 'scalesync-session';
const LEGACY_STORAGE_KEY = 'ohause-wet-session';

interface SavedState {
  harvestSession: HarvestSession;
  workflowMode: WorkflowMode;
  phase: AppPhase;
  savedAt: string;
}

/** Serialize session to localStorage. Converts Dates to ISO strings. */
export function saveSession(
  harvestSession: HarvestSession,
  workflowMode: WorkflowMode,
  phase: AppPhase,
): void {
  try {
    const state: SavedState = {
      harvestSession: {
        ...harvestSession,
        config: {
          ...harvestSession.config,
          date: harvestSession.config.date instanceof Date
            ? harvestSession.config.date
            : new Date(harvestSession.config.date),
        },
        readings: harvestSession.readings.map(r => ({
          ...r,
          timestamp: r.timestamp instanceof Date
            ? r.timestamp
            : new Date(r.timestamp),
        })),
      },
      workflowMode,
      phase,
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // localStorage full or unavailable — silent fail
  }
}

/** Load saved session from localStorage. Returns null if none exists. */
export function loadSession(): {
  harvestSession: HarvestSession;
  workflowMode: WorkflowMode;
  phase: AppPhase;
} | null {
  try {
    // Migrate legacy key if present
    let raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
      if (legacy) {
        localStorage.setItem(STORAGE_KEY, legacy);
        localStorage.removeItem(LEGACY_STORAGE_KEY);
        raw = legacy;
      }
    }
    if (!raw) return null;

    const state = JSON.parse(raw) as SavedState;
    if (!state.harvestSession || !state.workflowMode || !state.phase) return null;

    // Convert ISO strings back to Date objects
    return {
      harvestSession: {
        ...state.harvestSession,
        config: {
          ...state.harvestSession.config,
          date: new Date(state.harvestSession.config.date as unknown as string),
        },
        readings: state.harvestSession.readings.map(r => ({
          ...r,
          timestamp: new Date(r.timestamp as unknown as string),
        })),
      },
      workflowMode: state.workflowMode,
      phase: state.phase,
    };
  } catch {
    return null;
  }
}

/** Peek at saved session metadata without applying it. Returns null if none. */
export function peekSession(): {
  batchName: string;
  recorded: number;
  total: number;
  savedAt: string;
  workflowMode: WorkflowMode;
  phase: AppPhase;
} | null {
  try {
    let raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
      if (legacy) raw = legacy;
    }
    if (!raw) return null;
    const state = JSON.parse(raw) as SavedState;
    if (!state.harvestSession || !state.workflowMode || !state.phase) return null;
    const total = state.harvestSession.config.strains.reduce((s, x) => s + x.plantCount, 0);
    return {
      batchName: state.harvestSession.config.batchName,
      recorded: state.harvestSession.readings.length,
      total,
      savedAt: state.savedAt,
      workflowMode: state.workflowMode,
      phase: state.phase,
    };
  } catch {
    return null;
  }
}

/** Clear saved session from localStorage. */
export function clearSession(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(LEGACY_STORAGE_KEY);
  } catch {
    // silent
  }
}

/** Export session to a downloadable JSON file. */
export function exportSessionFile(
  harvestSession: HarvestSession,
  workflowMode: WorkflowMode,
  phase: AppPhase,
): void {
  const state: SavedState = {
    harvestSession,
    workflowMode,
    phase,
    savedAt: new Date().toISOString(),
  };
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const name = harvestSession.config.batchName.replace(/[^a-zA-Z0-9-_ ]/g, '').replace(/\s+/g, '-');
  a.href = url;
  a.download = `harvest-${name}-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Import session from a JSON file. Returns parsed state or null on error. */
export function parseSessionFile(json: string): {
  harvestSession: HarvestSession;
  workflowMode: WorkflowMode;
  phase: AppPhase;
} | null {
  try {
    const state = JSON.parse(json) as SavedState;
    if (!state.harvestSession || !state.workflowMode || !state.phase) return null;

    return {
      harvestSession: {
        ...state.harvestSession,
        config: {
          ...state.harvestSession.config,
          date: new Date(state.harvestSession.config.date as unknown as string),
        },
        readings: state.harvestSession.readings.map(r => ({
          ...r,
          timestamp: new Date(r.timestamp as unknown as string),
        })),
      },
      workflowMode: state.workflowMode,
      phase: state.phase,
    };
  } catch {
    return null;
  }
}

/** Debounced save — call frequently, writes at most every `ms` milliseconds.
 *  `onSaved` fires with the timestamp after each actual write. */
export function createDebouncedSave(ms = 300, onSaved?: (at: Date) => void) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return (
    harvestSession: HarvestSession,
    workflowMode: WorkflowMode,
    phase: AppPhase,
  ) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      saveSession(harvestSession, workflowMode, phase);
      onSaved?.(new Date());
    }, ms);
  };
}
