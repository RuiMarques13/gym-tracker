import { Injectable, inject } from '@angular/core';
import { DatabaseService } from '../db/database.service';
import { CLOCK } from '../clock';
import { HEALTH_PROVIDER, type HealthProvider } from './health-provider';
import { deriveCalories, downsample, energyWithin, heartRateRecovery, latestBmr, mifflinBmr, summarize } from '../../core/health/health.logic';
import { BodyProfileService } from './body-profile.service';
import type { BodyProfile } from '../../core/health/calories';
import { SqliteHealthRepository, type SessionHealth } from '../../data/repositories/health.repository';
import type { HealthExtras, HealthRepository } from '../../data/repositories/health.repository';

export type ImportResult =
  | { ok: true; health: SessionHealth }
  | { ok: false; reason: string };

/** Importa do relógio (via Health Connect) tudo o que há do treino: FC, calorias totais/basais/ativas, passos, distância, VO₂ máx. */
export async function importSessionHealth(
  provider: HealthProvider,
  repo: HealthRepository,
  session: { id: string; startedAt: string; endedAt: string | null },
  nowIso: string,
  body: BodyProfile | null = null,
): Promise<ImportResult> {
  const av = await provider.availability();
  if (!av.available) return { ok: false, reason: av.reason };
  if (!(await provider.hasFullAccess())) await provider.requestAccess();
  if (!(await provider.hasAccess())) {
    return { ok: false, reason: 'Sem permissão. Autoriza a leitura de frequência cardíaca e calorias no Health Connect.' };
  }
  const end = session.endedAt ?? nowIso;
  const raw = await provider.readWorkout(session.startedAt, end);

  const inside = raw.heartRate.filter((p) => Date.parse(p.ts) <= Date.parse(end));
  const summary = summarize(downsample(inside));
  const points = downsample(raw.heartRate);
  const recovery = session.endedAt ? heartRateRecovery(raw.heartRate, end) : null;

  const bmr = latestBmr(raw.basal, end) ?? (body ? mifflinBmr(body) : null);
  let cal = deriveCalories({ activeRecords: raw.activeRecords, totalRecords: raw.totalRecords, bmrKcalPerDay: bmr, startIso: session.startedAt, endIso: end });
  // sem registos de energia: o total que o exercício do relógio traz
  if (cal.activeKcal === null && cal.totalKcal === null && raw.exercise?.energyKcal) {
    cal = { totalKcal: null, activeKcal: Math.round(raw.exercise.energyKcal), basalKcal: null, basis: 'watch-active' };
  }
  const steps = Math.round(energyWithin(raw.steps, session.startedAt, end));
  const distance = Math.round(energyWithin(raw.distance, session.startedAt, end));

  const nothing = !points.length && cal.activeKcal === null && cal.totalKcal === null && !steps && !distance;
  if (nothing) {
    return { ok: false, reason: 'O relógio ainda não enviou dados deste treino. A sincronização do Samsung Health pode demorar: abre a app Samsung Health no telemóvel e tenta de novo.' };
  }
  const extras: HealthExtras = {
    caloriesTotalKcal: cal.totalKcal,
    caloriesBasalKcal: cal.basalKcal,
    caloriesBasis: cal.basis,
    steps: steps > 0 ? steps : null,
    distanceM: distance > 0 ? distance : raw.exercise?.distanceM ? Math.round(raw.exercise.distanceM) : null,
    hrEndBpm: recovery?.atEnd ?? null,
    hrRecoveryBpm: recovery?.drop ?? null,
    exerciseType: raw.exercise?.type ?? null,
    exerciseSeconds: raw.exercise?.durationSec ?? null,
    vo2max: raw.vo2Max ? Math.round(raw.vo2Max * 10) / 10 : null,
  };
  const source = raw.exercise?.sourceName ?? provider.sourceName;
  await repo.save(session.id, points, summary, cal.activeKcal, extras, source, nowIso);
  const health = (await repo.summary(session.id))!;
  return { ok: true, health };
}

@Injectable({ providedIn: 'root' })
export class HealthService {
  private readonly provider = inject(HEALTH_PROVIDER);
  private readonly clock = inject(CLOCK);
  private readonly database = inject(DatabaseService);
  private readonly body = inject(BodyProfileService);
  private repoCache?: HealthRepository;

  private get repo(): HealthRepository {
    return (this.repoCache ??= new SqliteHealthRepository(this.database.db));
  }

  availability() { return this.provider.availability(); }
  hasAccess() { return this.provider.hasAccess(); }
  requestAccess() { return this.provider.requestAccess(); }
  openSettings() { return this.provider.openSettings(); }
  summary(sessionId: string) { return this.repo.summary(sessionId); }
  points(sessionId: string) { return this.repo.points(sessionId); }
  clear(sessionId: string) { return this.repo.clear(sessionId); }
  all() { return this.repo.all(); }

  /** FC recente do relógio durante uma atividade (sem pedir permissões). null se não houver leituras. */
  async liveHeartRate(startIso: string): Promise<{ last: number; avg: number } | null> {
    try {
      if (!(await this.provider.availability()).available || !(await this.provider.hasAccess())) return null;
      const pts = downsample(await this.provider.heartRate(startIso, this.clock.nowIso()), 5);
      const s = summarize(pts);
      return pts.length && s.avg !== null ? { last: pts[pts.length - 1].bpm, avg: s.avg } : null;
    } catch {
      return null;
    }
  }

  importForSession(session: { id: string; startedAt: string; endedAt: string | null }): Promise<ImportResult> {
    return importSessionHealth(this.provider, this.repo, session, this.clock.nowIso(), this.body.profile());
  }
}
