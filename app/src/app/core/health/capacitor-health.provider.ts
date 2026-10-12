import { Capacitor } from '@capacitor/core';
import type { HealthAvailability, HealthProvider } from './health-provider';
import { energyWithin, type HrPoint } from './health.logic';

const READ = ['heartRate', 'calories'] as const;

/** Health Connect (Android) / HealthKit (iOS) via @capgo/capacitor-health. No browser indica «indisponível». */
export class CapacitorHealthProvider implements HealthProvider {
  readonly sourceName = 'Health Connect';

  /** Devolve o plugin dentro de um objeto: um proxy do Capacitor devolvido de uma função async seria tratado como «thenable». */
  private async plugin(): Promise<{ h: (typeof import('@capgo/capacitor-health'))['Health'] }> {
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

  async requestAccess(): Promise<boolean> {
    const s = await (await this.plugin()).h.requestAuthorization({ read: [...READ] });
    return s.readAuthorized.includes('heartRate');
  }

  async heartRate(startIso: string, endIso: string): Promise<HrPoint[]> {
    const { h } = await this.plugin();
    const out: HrPoint[] = [];
    const r = await h.readSamples({ dataType: 'heartRate', startDate: startIso, endDate: endIso, limit: 5000, ascending: true });
    for (const s of r.samples) out.push({ ts: s.startDate, bpm: Math.round(s.value) });
    return out;
  }

  async activeCalories(startIso: string, endIso: string): Promise<number | null> {
    const { h } = await this.plugin();
    const r = await h.readSamples({ dataType: 'calories', startDate: startIso, endDate: endIso, limit: 1000, ascending: true });
    // proporcional à parte de cada registo que cai dentro do treino (o Samsung escreve em blocos que o ultrapassam)
    const total = energyWithin(r.samples, startIso, endIso);
    return total > 0 ? Math.round(total) : null;
  }

  async openSettings(): Promise<void> {
    await (await this.plugin()).h.openHealthConnectSettings();
  }
}
