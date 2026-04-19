import ExcelJS from 'exceljs';
import type { HarvestSession, HarvestStrainConfig, WetWeightReading } from './types';

/**
 * Parse a wet-weight harvest .xlsx exported by `exportWetExcel` back into a
 * `HarvestSession`. Round-trip is lossy: IDs, sub-second timestamps, and
 * device/user metadata are not preserved — we regenerate UUIDs and rebuild
 * timestamps from the "Date:" header in Summary + per-row time-of-day strings
 * in Detail.
 *
 * Returns null on any structural mismatch. Callers should treat that as
 * "file doesn't look like a ScaleSync wet-weight export".
 */
export async function parseHarvestXlsx(file: File): Promise<HarvestSession | null> {
  const buffer = await file.arrayBuffer();
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(buffer);
  } catch {
    return null;
  }

  const summary = wb.getWorksheet('Summary');
  const detail = wb.getWorksheet('Detail');
  if (!summary || !detail) return null;

  // ── Summary: batch name + date + strain list ──
  const batchName = cellString(summary.getCell('A2'));
  if (!batchName) return null;

  const dateLabel = cellString(summary.getCell('A3'));
  const harvestDate = parseDateLabel(dateLabel) ?? new Date();

  // Header row is 5, strain rows start at 6, GRAND TOTAL closes the block.
  const strains: HarvestStrainConfig[] = [];
  const strainIdByName = new Map<string, string>();
  for (let r = 6; r <= summary.rowCount; r++) {
    const name = cellString(summary.getCell(r, 1));
    if (!name || /grand\s*total/i.test(name)) break;
    const expected = cellNumber(summary.getCell(r, 2));
    if (expected == null) continue;
    const id = crypto.randomUUID();
    strains.push({ id, strain: name, plantCount: expected });
    strainIdByName.set(name, id);
  }
  if (strains.length === 0) return null;

  // ── Detail: per-strain blocks with plant rows ──
  const readings: WetWeightReading[] = [];
  let currentStrain: string | null = null;
  let inRows = false;

  for (let r = 1; r <= detail.rowCount; r++) {
    const c1 = cellString(detail.getCell(r, 1));
    const c2 = detail.getCell(r, 2).value;
    const c3 = detail.getCell(r, 3).value;
    const c4 = detail.getCell(r, 4).value;

    if (!c1 && c2 == null && c3 == null && c4 == null) {
      inRows = false;
      continue;
    }

    // Strain block header: "STRAIN — N plants"
    const strainHeaderMatch = c1.match(/^(.+?)\s+[—–-]\s+\d+\s+plants?\s*$/i);
    if (strainHeaderMatch) {
      currentStrain = strainHeaderMatch[1].trim();
      if (!strainIdByName.has(currentStrain)) {
        // Strain appeared in Detail but not Summary — register it.
        const id = crypto.randomUUID();
        strains.push({ id, strain: currentStrain, plantCount: 0 });
        strainIdByName.set(currentStrain, id);
      }
      inRows = false;
      continue;
    }

    // Column header row "# | METRC Tag | Weight (g) | Timestamp"
    if (c1 === '#' || /metrc\s*tag/i.test(cellString(detail.getCell(r, 2)))) {
      inRows = true;
      continue;
    }

    // Subtotal row ends the block
    if (/subtotal/i.test(c1)) {
      inRows = false;
      continue;
    }

    if (!inRows || !currentStrain) continue;

    const plantNumber = Number(c1);
    if (!Number.isFinite(plantNumber)) continue;

    const tagId = typeof c2 === 'string' ? c2 : c2 != null ? String(c2) : '';
    const weightGrams = typeof c3 === 'number' ? c3 : Number(c3);
    if (!Number.isFinite(weightGrams)) continue;

    const timestamp = buildTimestamp(harvestDate, c4) ?? new Date(harvestDate);

    readings.push({
      id: crypto.randomUUID(),
      tagId,
      strain: currentStrain,
      weightGrams,
      timestamp,
      plantNumber,
    });
  }

  if (readings.length === 0) return null;

  return {
    config: {
      id: crypto.randomUUID(),
      batchName,
      date: harvestDate,
      strains,
    },
    readings,
    completed: true,
  };
}

function cellString(cell: ExcelJS.Cell): string {
  const v = cell.value;
  if (v == null) return '';
  if (typeof v === 'string') return v.trim();
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (v instanceof Date) return v.toISOString();
  // Rich text or formula result
  if (typeof v === 'object' && 'richText' in v && Array.isArray(v.richText)) {
    return v.richText.map(t => t.text).join('').trim();
  }
  if (typeof v === 'object' && 'result' in v && v.result != null) return String(v.result);
  if (typeof v === 'object' && 'text' in v && typeof v.text === 'string') return v.text.trim();
  return '';
}

function cellNumber(cell: ExcelJS.Cell): number | null {
  const v = cell.value;
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  if (typeof v === 'object' && v != null && 'result' in v && typeof v.result === 'number') return v.result;
  return null;
}

function parseDateLabel(s: string): Date | null {
  // "Date: 4/17/2026" or "4/17/2026"
  const m = s.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (!m) return null;
  const month = parseInt(m[1], 10);
  const day = parseInt(m[2], 10);
  let year = parseInt(m[3], 10);
  if (year < 100) year += 2000;
  const d = new Date(year, month - 1, day);
  return Number.isFinite(d.getTime()) ? d : null;
}

function buildTimestamp(harvestDate: Date, raw: ExcelJS.CellValue): Date | null {
  if (raw == null) return null;
  // Strings like "1:05:26 PM"
  if (typeof raw === 'string') {
    const m = raw.match(/^\s*(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?\s*$/i);
    if (!m) return null;
    let h = parseInt(m[1], 10);
    const min = parseInt(m[2], 10);
    const sec = m[3] ? parseInt(m[3], 10) : 0;
    const ampm = m[4]?.toUpperCase();
    if (ampm === 'PM' && h < 12) h += 12;
    if (ampm === 'AM' && h === 12) h = 0;
    const d = new Date(harvestDate);
    d.setHours(h, min, sec, 0);
    return d;
  }
  if (raw instanceof Date) return raw;
  if (typeof raw === 'number') {
    // Excel day-fraction — convert to ms within harvest date.
    const d = new Date(harvestDate);
    const ms = Math.round(raw * 24 * 60 * 60 * 1000);
    d.setHours(0, 0, 0, 0);
    return new Date(d.getTime() + ms);
  }
  return null;
}
