export interface BodyMetric {
  id: string;
  /** «YYYY-MM-DD» */
  date: string;
  type: string;
  value: number;
}

/** Tipos conhecidos. A tabela aceita outros: o tipo é só texto. */
export const BODY_TYPES = [
  { type: 'WEIGHT_KG', label: 'Peso', unit: 'kg', min: 20, max: 400 },
  { type: 'BODY_FAT_PCT', label: 'Gordura corporal', unit: '%', min: 1, max: 80 },
  { type: 'LEAN_MASS_KG', label: 'Massa magra', unit: 'kg', min: 10, max: 250 },
] as const;
export type BodyType = (typeof BODY_TYPES)[number]['type'];

export class BodyMetricError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BodyMetricError';
  }
}
