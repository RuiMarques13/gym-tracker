import { InjectionToken } from '@angular/core';
import type { HrPoint } from './health.logic';

export type HealthAvailability = { available: true } | { available: false; reason: string };

/** Fonte de dados de saúde (Health Connect no Android; HealthKit no iPhone, mais tarde). */
export interface HealthProvider {
  availability(): Promise<HealthAvailability>;
  /** Pede (se faltar) permissão de leitura de FC e calorias. Devolve se ficou autorizado. */
  requestAccess(): Promise<boolean>;
  hasAccess(): Promise<boolean>;
  heartRate(startIso: string, endIso: string): Promise<HrPoint[]>;
  /** Calorias ativas no intervalo (kcal), ou null se não houver. */
  activeCalories(startIso: string, endIso: string): Promise<number | null>;
  openSettings(): Promise<void>;
  readonly sourceName: string;
}

export const HEALTH_PROVIDER = new InjectionToken<HealthProvider>('HealthProvider');
