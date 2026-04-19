/**
 * Cloud API layer — one-way push of harvests / strains / readings to Supabase.
 *
 * All functions return Result<T> — they never throw on expected errors.
 * Callers MUST check the .ok discriminator.
 *
 * Supabase v2 error model: every query resolves to { data, error }. We always
 * check `error` and convert to a Result. See:
 * https://supabase.com/docs/reference/javascript/insert
 */

import { supabase } from './supabase';
import { parseSessionFile } from './session-persistence';
import { parseHarvestXlsx } from './wet-import';
import type {
  HarvestSession,
  WetWeightReading,
  WorkflowMode,
} from './types';

export type Result<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

function err(error: string): Result<never> {
  return { ok: false, error };
}

function ok<T>(data: T): Result<T> {
  return { ok: true, data };
}

function requireClient() {
  if (!supabase) return err('Supabase not configured');
  return null;
}

// ─── Harvest row + strain rows ────────────────────────────────────────────

export async function pushHarvest(
  session: HarvestSession,
  workflowMode: WorkflowMode,
  deviceId: string,
): Promise<Result> {
  const missing = requireClient();
  if (missing) return missing;

  const totalPlants = session.config.strains.reduce(
    (sum, s) => sum + s.plantCount,
    0,
  );

  const harvestRow = {
    id: session.config.id,
    batch_name: session.config.batchName,
    workflow_mode: workflowMode,
    status: session.completed ? 'completed' : 'active',
    total_plants: totalPlants,
    started_at:
      session.config.date instanceof Date
        ? session.config.date.toISOString()
        : new Date(session.config.date).toISOString(),
    completed_at: session.completed ? new Date().toISOString() : null,
    device_id: deviceId,
  };

  const { error: hErr } = await supabase!
    .from('harvests')
    .upsert(harvestRow, { onConflict: 'id' })
    .select();
  if (hErr) return err(`harvests upsert: ${hErr.message}`);

  const strainRows = session.config.strains.map((s, i) => ({
    id: s.id,
    harvest_id: session.config.id,
    strain: s.strain,
    plant_count: s.plantCount,
    position: i,
  }));

  if (strainRows.length > 0) {
    const { error: sErr } = await supabase!
      .from('harvest_strains')
      .upsert(strainRows, { onConflict: 'id' })
      .select();
    if (sErr) return err(`harvest_strains upsert: ${sErr.message}`);
  }

  return ok(undefined);
}

// ─── Reading batch ────────────────────────────────────────────────────────

export async function pushReadings(
  harvestId: string,
  readings: WetWeightReading[],
  deviceId: string,
): Promise<Result> {
  const missing = requireClient();
  if (missing) return missing;
  if (readings.length === 0) return ok(undefined);

  const rows = readings.map(r => ({
    id: r.id,
    harvest_id: harvestId,
    plant_number: r.plantNumber,
    strain: r.strain,
    tag_id: r.tagId,
    weight_grams: r.weightGrams,
    captured_at:
      r.timestamp instanceof Date
        ? r.timestamp.toISOString()
        : new Date(r.timestamp).toISOString(),
    device_id: deviceId,
  }));

  const { error } = await supabase!
    .from('harvest_readings')
    .upsert(rows, { onConflict: 'id' })
    .select();
  if (error) return err(`harvest_readings upsert: ${error.message}`);
  return ok(undefined);
}

// ─── Completion ───────────────────────────────────────────────────────────

export async function markHarvestCompleted(
  harvestId: string,
): Promise<Result> {
  const missing = requireClient();
  if (missing) return missing;

  const { error } = await supabase!
    .from('harvests')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', harvestId);
  if (error) return err(`harvests mark-completed: ${error.message}`);
  return ok(undefined);
}

// ─── Import a completed harvest JSON report into Supabase ────────────────
//
// Reads a .json file exported via `exportSessionFile` (session-persistence),
// validates the shape, and pushes harvest + strains + readings + marks the
// harvest completed. Idempotent via UUID upsert — re-importing the same file
// is a no-op (or refreshes fields).
//
// `options.regenerateIds` assigns fresh UUIDs to every row. Use when seeding
// an imported report as a separate record (e.g. a friend's harvest file you
// don't want to collide with an active session of the same id).
export interface ImportHarvestResult {
  session: HarvestSession;
  plantsImported: number;
}

export async function importHarvestReport(
  file: File,
  deviceId: string,
  options: { regenerateIds?: boolean } = {},
): Promise<Result<ImportHarvestResult>> {
  const missing = requireClient();
  if (missing) return missing;

  const name = (file.name || '').toLowerCase();
  const isXlsx = name.endsWith('.xlsx') || file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  const isJson = name.endsWith('.json') || file.type === 'application/json';

  let harvestSession: HarvestSession | null = null;
  let workflowMode: WorkflowMode = 'wet';

  if (isXlsx) {
    harvestSession = await parseHarvestXlsx(file);
    if (!harvestSession) return err('Invalid Excel report — expected a ScaleSync wet-weight export with Summary + Detail sheets');
  } else if (isJson) {
    let text: string;
    try {
      text = await file.text();
    } catch {
      return err('Could not read file');
    }
    const parsed = parseSessionFile(text);
    if (!parsed) return err('Invalid harvest file — expected a ScaleSync .json export');
    harvestSession = parsed.harvestSession;
    workflowMode = parsed.workflowMode;
  } else {
    return err('Unsupported file type — use .json or .xlsx');
  }

  if (workflowMode !== 'wet') {
    return err('Only wet-weight harvests can be imported');
  }
  if (!harvestSession.config?.batchName) {
    return err('Missing batch name — file may be corrupted');
  }
  if (!Array.isArray(harvestSession.readings) || harvestSession.readings.length === 0) {
    return err('No plant readings found in file');
  }

  // xlsx parser already generates fresh UUIDs; JSON path may preserve originals.
  let session: HarvestSession = harvestSession;
  if (options.regenerateIds && !isXlsx) {
    const newHarvestId = crypto.randomUUID();
    session = {
      ...harvestSession,
      config: {
        ...harvestSession.config,
        id: newHarvestId,
        strains: harvestSession.config.strains.map(s => ({ ...s, id: crypto.randomUUID() })),
      },
      readings: harvestSession.readings.map(r => ({ ...r, id: crypto.randomUUID() })),
    };
  }

  // Force completed so it lands in history, not active sessions.
  const completedSession: HarvestSession = { ...session, completed: true };

  const pushResult = await pushHarvest(completedSession, 'wet', deviceId);
  if (!pushResult.ok) return err(`Import failed at harvest: ${pushResult.error}`);

  const readingsResult = await pushReadings(completedSession.config.id, completedSession.readings, deviceId);
  if (!readingsResult.ok) return err(`Import failed at readings: ${readingsResult.error}`);

  const completeResult = await markHarvestCompleted(completedSession.config.id);
  if (!completeResult.ok) return err(`Import failed at completion: ${completeResult.error}`);

  return ok({ session: completedSession, plantsImported: completedSession.readings.length });
}

export async function deleteCloudHarvest(harvestId: string): Promise<Result> {
  const missing = requireClient();
  if (missing) return missing;
  const { error } = await supabase!
    .from('harvests')
    .delete()
    .eq('id', harvestId);
  if (error) return err(`harvests delete: ${error.message}`);
  return ok(undefined);
}

// ─── List + load (used by Phase 5 resume flow; exported now for outbox tests) ──

export interface CloudHarvestSummary {
  id: string;
  batch_name: string;
  workflow_mode: WorkflowMode;
  status: 'active' | 'completed' | 'archived';
  total_plants: number;
  started_at: string;
  device_id: string | null;
}

export async function listCloudHarvests(
  limit = 10,
): Promise<Result<CloudHarvestSummary[]>> {
  const missing = requireClient();
  if (missing) return missing;
  const { data, error } = await supabase!
    .from('harvests')
    .select('id, batch_name, workflow_mode, status, total_plants, started_at, device_id')
    .eq('status', 'active')
    .order('started_at', { ascending: false })
    .limit(limit);
  if (error) return err(`harvests list: ${error.message}`);
  return ok((data ?? []) as CloudHarvestSummary[]);
}

export interface CloudHarvestHistoryItem extends CloudHarvestSummary {
  completed_at: string | null;
  total_weight_grams: number;
  reading_count: number;
}

/**
 * List previously completed harvests for the history browser.
 * Includes aggregated totals so the list can render without a second fetch.
 */
export async function listCompletedHarvests(
  limit = 50,
): Promise<Result<CloudHarvestHistoryItem[]>> {
  const missing = requireClient();
  if (missing) return missing;
  const { data: harvests, error: hErr } = await supabase!
    .from('harvests')
    .select('id, batch_name, workflow_mode, status, total_plants, started_at, completed_at, device_id')
    .eq('status', 'completed')
    .order('completed_at', { ascending: false })
    .limit(limit);
  if (hErr) return err(`history list: ${hErr.message}`);
  const rows = (harvests ?? []) as Array<CloudHarvestSummary & { completed_at: string | null }>;
  if (rows.length === 0) return ok([]);

  const ids = rows.map(r => r.id);
  const { data: readingRows, error: rErr } = await supabase!
    .from('harvest_readings')
    .select('harvest_id, weight_grams')
    .in('harvest_id', ids);
  if (rErr) return err(`history readings: ${rErr.message}`);

  const totals: Record<string, { weight: number; count: number }> = {};
  for (const r of (readingRows ?? []) as { harvest_id: string; weight_grams: string | number }[]) {
    const k = r.harvest_id;
    if (!totals[k]) totals[k] = { weight: 0, count: 0 };
    totals[k].weight += Number(r.weight_grams);
    totals[k].count += 1;
  }

  return ok(
    rows.map(r => ({
      ...r,
      total_weight_grams: Math.round((totals[r.id]?.weight ?? 0) * 10) / 10,
      reading_count: totals[r.id]?.count ?? 0,
    })),
  );
}

/** Count reading rows per active harvest so the resume UI can show progress. */
export async function countReadingsPerHarvest(
  harvestIds: string[],
): Promise<Result<Record<string, number>>> {
  const missing = requireClient();
  if (missing) return missing;
  if (harvestIds.length === 0) return ok({});
  const { data, error } = await supabase!
    .from('harvest_readings')
    .select('harvest_id')
    .in('harvest_id', harvestIds);
  if (error) return err(`readings count: ${error.message}`);
  const counts: Record<string, number> = {};
  for (const row of (data ?? []) as { harvest_id: string }[]) {
    counts[row.harvest_id] = (counts[row.harvest_id] ?? 0) + 1;
  }
  return ok(counts);
}

/**
 * Fetch a complete HarvestSession (config + readings) from Supabase by id.
 * Reconstructs the same shape the rest of the app uses.
 */
export async function loadCloudHarvest(
  harvestId: string,
): Promise<Result<HarvestSession>> {
  const missing = requireClient();
  if (missing) return missing;

  const { data: harvestRow, error: hErr } = await supabase!
    .from('harvests')
    .select('id, batch_name, started_at, status, completed_at')
    .eq('id', harvestId)
    .single();
  if (hErr) return err(`harvests load: ${hErr.message}`);
  if (!harvestRow) return err('harvest not found');

  const { data: strainRows, error: sErr } = await supabase!
    .from('harvest_strains')
    .select('id, strain, plant_count, position')
    .eq('harvest_id', harvestId)
    .order('position', { ascending: true });
  if (sErr) return err(`strains load: ${sErr.message}`);

  const { data: readingRows, error: rErr } = await supabase!
    .from('harvest_readings')
    .select('id, plant_number, strain, tag_id, weight_grams, captured_at')
    .eq('harvest_id', harvestId)
    .order('captured_at', { ascending: true });
  if (rErr) return err(`readings load: ${rErr.message}`);

  const session: HarvestSession = {
    config: {
      id: harvestRow.id,
      batchName: harvestRow.batch_name,
      date: new Date(harvestRow.started_at),
      strains: (strainRows ?? []).map(s => ({
        id: s.id,
        strain: s.strain,
        plantCount: s.plant_count,
      })),
    },
    readings: (readingRows ?? []).map(r => ({
      id: r.id,
      plantNumber: r.plant_number,
      strain: r.strain,
      tagId: r.tag_id,
      weightGrams: Number(r.weight_grams),
      timestamp: new Date(r.captured_at),
    })),
    completed: harvestRow.status === 'completed',
  };
  return ok(session);
}
