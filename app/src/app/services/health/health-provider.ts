import { InjectionToken } from '@angular/core';
import type { BmrSample, EnergyRecord, HrPoint } from '../../core/health/health.logic';

export type HealthAvailability = { available: true } | { available: false; reason: string };

/** Tudo o que o relógio guardou sobre um treino (valores em bruto; a lógica em health.logic trata-os). */
export interface WorkoutReading {
  /** FC do treino e dos ~2 min seguintes (para a recuperação). */
  heartRate: HrPoint[];
  /** Calorias ativas gravadas (ActiveCaloriesBurned). */
  activeRecords: EnergyRecord[];
  /** Calorias totais gravadas (TotalCaloriesBurned): é o que o Samsung escreve nos exercícios. */
  totalRecords: EnergyRecord[];
  /** Taxa metabólica de repouso (kcal/dia) dos últimos dias. */
  basal: BmrSample[];
  steps: EnergyRecord[];
  /** Distância em metros. */
  distance: EnergyRecord[];
  /** Última estimativa de VO₂ máx (ml/kg/min) escrita à volta do treino. */
  vo2Max: number | null;
  /** A sessão de exercício registada no relógio que corresponde a este treino. */
  exercise: { type: string; durationSec: number; energyKcal: number | null; distanceM: number | null; sourceName: string | null } | null;
}

/** Fonte de dados de saúde (Health Connect no Android; HealthKit no iPhone, mais tarde). */
export interface HealthProvider {
  availability(): Promise<HealthAvailability>;
  /** Pede (se faltar) permissão de leitura de FC, calorias, passos… Devolve se a FC ficou autorizada (o essencial). */
  requestAccess(): Promise<boolean>;
  /** A FC está autorizada (chega para a FC em direto). */
  hasAccess(): Promise<boolean>;
  /** Todas as leituras (calorias totais/basais, passos, distância, treinos…) estão autorizadas. */
  hasFullAccess(): Promise<boolean>;
  heartRate(startIso: string, endIso: string): Promise<HrPoint[]>;
  /** Lê tudo o que há do treino; leituras sem permissão ou sem dados ficam vazias. */
  readWorkout(startIso: string, endIso: string): Promise<WorkoutReading>;
  openSettings(): Promise<void>;
  readonly sourceName: string;
}

export const HEALTH_PROVIDER = new InjectionToken<HealthProvider>('HealthProvider');
