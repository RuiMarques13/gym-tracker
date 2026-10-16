import { Capacitor } from '@capacitor/core';
import type { HealthAvailability, HealthProvider, WorkoutReading } from './health-provider';
import { HEALTH_READ as READ } from '../../core/health/health-permissions';
import type { BmrSample, EnergyRecord, HrPoint } from '../../core/health/health.logic';
/** Minutos de FC lidos depois do fim do treino (recuperação). */
const AFTER_MIN = 2;
const MIN = 60_000;

type Plugin = (typeof import('@capgo/capacitor-health'))['Health'];

/** Health Connect (Android) / HealthKit (iOS) via @capgo/capacitor-health. No browser indica «indisponível». */
export class CapacitorHealthProvider implements HealthProvider {
  readonly sourceName = 'Health Connect';

  /** Devolve o plugin dentro de um objeto: um proxy do Capacitor devolvido de uma função async seria tratado como «thenable». */
  private async plugin(): Promise<{ h: Plugin }> {
    return { h: (await import('@capgo/capacitor-health')).Health };
  }

  async availability(): Promise<HealthAvailability> {
    if (!Capacitor.isNativePlatform()) return { available: false, reason: 'O Health Connect só existe na app Android (no browser não há acesso ao relógio).' };
    try {
      const r = await (await this.plugin()).h.isAvailable();
      return r.available ? { available: true } : { available: false, reason: r.reason ?? 'Health Connect indisponível.' };
    } catch {
      return { available: false, reason: 'Só existe na app Android (no browser não há Health Connect).' };
    }
  }

  async hasAccess(): Promise<boolean> {
    const s = await (await this.plugin()).h.checkAuthorization({ read: [...READ] });
    return s.readAuthorized.includes('heartRate');
  }

  async hasFullAccess(): Promise<boolean> {
    const s = await (await this.plugin()).h.checkAuthorization({ read: [...READ] });
    return READ.every((t) => s.readAuthorized.includes(t));
  }

  async requestAccess(): Promise<boolean> {
    const s = await (await this.plugin()).h.requestAuthorization({ read: [...READ] });
    return s.readAuthorized.includes('heartRate');
  }

  async heartRate(startIso: string, endIso: string): Promise<HrPoint[]> {
    const { h } = await this.plugin();
    const r = await h.readSamples({ dataType: 'heartRate', startDate: startIso, endDate: endIso, limit: 5000, ascending: true });
    return r.samples.map((s) => ({ ts: s.startDate, bpm: Math.round(s.value) }));
  }

  async readWorkout(startIso: string, endIso: string): Promise<WorkoutReading> {
    const { h } = await this.plugin();
    const start = Date.parse(startIso), end = Date.parse(endIso);
    const iso = (ms: number) => new Date(ms).toISOString();
    /** Uma leitura que falhe (sem permissão, sem suporte) não derruba as outras. */
    const read = async (dataType: (typeof READ)[number], from: number, to: number, limit = 1000) => {
      try {
        return (await h.readSamples({ dataType, startDate: iso(from), endDate: iso(to), limit, ascending: true })).samples;
      } catch {
        return [];
      }
    };
    // registos de energia/passos que começam um pouco antes do treino também contam (são proporcionais depois)
    const pad = 30 * MIN;
    const rec = (s: { startDate: string; endDate: string; value: number }): EnergyRecord => ({ startDate: s.startDate, endDate: s.endDate, value: s.value });

    const [hr, active, total, basal, steps, distance, vo2, workouts] = await Promise.all([
      read('heartRate', start, end + AFTER_MIN * MIN, 5000),
      read('calories', start - pad, end + pad),
      read('totalCalories', start - pad, end + pad),
      read('basalCalories', start - 7 * 24 * 60 * MIN, end, 200),
      read('steps', start - pad, end + pad),
      read('distance', start - pad, end + pad),
      read('vo2Max', start - 60 * MIN, end + 6 * 60 * MIN, 50),
      h.queryWorkouts({ startDate: iso(start - 15 * MIN), endDate: iso(end + 15 * MIN), limit: 20, ascending: true }).then((r) => r.workouts).catch(() => []),
    ]);

    // o exercício do relógio com mais sobreposição com o treino
    let exercise: WorkoutReading['exercise'] = null;
    let bestOverlap = 0;
    for (const w of workouts) {
      const ov = Math.min(Date.parse(w.endDate), end) - Math.max(Date.parse(w.startDate), start);
      if (ov > bestOverlap) {
        bestOverlap = ov;
        exercise = { type: String(w.workoutType), durationSec: Math.round(w.duration), energyKcal: w.totalEnergyBurned ?? null, distanceM: w.totalDistance ?? null, sourceName: w.sourceName ?? null };
      }
    }

    return {
      heartRate: hr.map((s) => ({ ts: s.startDate, bpm: Math.round(s.value) })),
      activeRecords: active.map(rec),
      totalRecords: total.map(rec),
      basal: basal.map((s): BmrSample => ({ ts: s.startDate, kcalPerDay: s.value })),
      steps: steps.map(rec),
      distance: distance.map(rec),
      vo2Max: vo2.length ? vo2[vo2.length - 1].value : null,
      exercise,
    };
  }

  async openSettings(): Promise<void> {
    await (await this.plugin()).h.openHealthConnectSettings();
  }
}
