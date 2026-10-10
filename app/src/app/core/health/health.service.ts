import { Injectable, inject } from '@angular/core';
import { DatabaseService } from '../db/database.service';
import { CLOCK } from '../util/clock';
import { HEALTH_PROVIDER, type HealthProvider } from './health-provider';
import { downsample, summarize } from './health.logic';
import { SqliteHealthRepository, type SessionHealth } from '../../data/repositories/health.repository';
import type { HealthRepository } from '../../data/repositories/health.repository';

export type ImportResult =
  | { ok: true; health: SessionHealth }
  | { ok: false; reason: string };

/** Importa a frequência cardíaca e as calorias de uma sessão a partir do relógio (via Health Connect). */
export async function importSessionHealth(
  provider: HealthProvider,
  repo: HealthRepository,
  session: { id: string; startedAt: string; endedAt: string | null },
  nowIso: string,
): Promise<ImportResult> {
  const av = await provider.availability();
  if (!av.available) return { ok: false, reason: av.reason };
  if (!(await provider.hasAccess()) && !(await provider.requestAccess())) {
    return { ok: false, reason: 'Sem permissão. Autoriza a leitura de frequência cardíaca no Health Connect.' };
  }
  const end = session.endedAt ?? nowIso;
  const raw = await provider.heartRate(session.startedAt, end);
  const points = downsample(raw);
  const kcal = await provider.activeCalories(session.startedAt, end);
  if (!points.length && kcal === null) {
    return { ok: false, reason: 'O relógio ainda não enviou dados deste treino. A sincronização do Samsung Health pode demorar; tenta daqui a pouco.' };
  }
  await repo.save(session.id, points, summarize(points), kcal, provider.sourceName, nowIso);
  const health = (await repo.summary(session.id))!;
  return { ok: true, health };
}

@Injectable({ providedIn: 'root' })
export class HealthService {
  private readonly provider = inject(HEALTH_PROVIDER);
  private readonly clock = inject(CLOCK);
  private readonly database = inject(DatabaseService);
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

  importForSession(session: { id: string; startedAt: string; endedAt: string | null }): Promise<ImportResult> {
    return importSessionHealth(this.provider, this.repo, session, this.clock.nowIso());
  }
}
