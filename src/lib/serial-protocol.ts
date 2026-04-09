import type { ScaleReading } from './types';

export const SERIAL_CONFIG: SerialOptions = {
  baudRate: 9600,
  dataBits: 8,
  parity: 'none' as ParityType,
  stopBits: 1,
  flowControl: 'none' as FlowControlType,
};

export const CMD = {
  IMMEDIATE_PRINT: 'IP\r\n',
  CONTINUOUS_PRINT: 'CP\r\n',
  STOP_CONTINUOUS: '0P\r\n',
  STABILITY_PRINT: 'SP\r\n',
  TARE: 'T\r\n',
  ZERO: 'Z\r\n',
} as const;

/**
 * Parse an OHAUS ASCII weight response.
 * Format: "    125.5 g   G\r\n"
 */
export function parseWeightResponse(raw: string): ScaleReading | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length < 2) return null;

  const weight = parseFloat(parts[0]);
  if (isNaN(weight)) return null;

  const unit = parts[1] || 'g';
  const hasQuestion = parts.includes('?');
  const mode = (parts.find(p => /^[GNT]$/.test(p)) || 'G') as 'G' | 'N' | 'T';

  return { weight, unit, stable: !hasQuestion, mode };
}
