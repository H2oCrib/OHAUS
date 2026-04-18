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
