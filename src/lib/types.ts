export type ProductType = 'Flower' | 'Trim' | 'Popcorn';

export interface StrainConfig {
  id: string;
  strain: string;
  type: ProductType;
  totalUnits: number;
  claimedLbs: number | null;
  partialCount: number;
  partialSizeGrams: number; // expected weight of each partial in grams
}

export interface WeightReading {
  id: string;
  unitNumber: number;
  weightGrams: number;
  timestamp: Date;
  strain: string;
  isPartial: boolean;
  partialSizeGrams?: number;
}

export interface StrainSession {
  config: StrainConfig;
  readings: WeightReading[];
  completed: boolean;
}

export interface StrainSummary {
  strain: string;
  type: ProductType;
  units: number; // total items weighed (full + partial count)
  fullUnits: number;
  partials: number;
  totalGrams: number;
  totalLbs: number;
  claimedLbs: number | null;
  differenceGrams: number | null;
  status: 'VERIFIED' | 'VARIANCE' | null;
}

export type AppPhase = 'connect' | 'setup' | 'weighing' | 'summary';

export interface ScaleReading {
  weight: number;
  unit: string;
  stable: boolean;
  mode: 'G' | 'N' | 'T';
}

export const GRAMS_PER_LB = 453.592;
export const VERIFICATION_TOLERANCE_GRAMS = 5;
