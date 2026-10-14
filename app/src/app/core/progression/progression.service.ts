import { inject, Injectable } from '@angular/core';
import {
  EXERCISE_REPOSITORY, METRICS_REPOSITORY, RECOVERY_REPOSITORY, SESSION_REPOSITORY, SUGGESTION_REPOSITORY, WORKOUT_REPOSITORY,
} from '../../data/repositories/providers';
import type { SuggestionKind, SuggestionRecord, SuggestionResponse } from '../../data/repositories/suggestion.repository';
import type { Workout } from '../../data/models/workout';
import { MUSCLE_LABEL } from '../metrics/muscles';
import { performanceTrend, previousVolume, weeklyVolume, type MetricSet } from '../metrics/volume';
import { VOLUME_RULES } from '../metrics/volume-rules';
import { SettingsService } from '../settings/settings.service';
import { CLOCK } from '../util/clock';
import { toLocalDate, weekStartOf } from '../util/week';
import { fatigueSignals, type FatigueSignal } from './fatigue';
import { repRange } from './load';
import { detectStagnation, nextResponse, rangeOptions, volumePlan, type StagSession, type StimulusResponse } from './stagnation';

const DAY = 86_400_000;
const HOME_MAX = 3;

export interface SuggestionOption {
  label: string;
  /** Faixa [min, max] (resposta range) ou id do exercício (resposta swap). */
  value: [number, number] | string;
}

/** Um cartão de sugestão: estagnação de um exercício ou fadiga geral. */
export interface SuggestionCard {
  key: string;
  kind: SuggestionKind;
  exerciseId: string | null;
  exerciseName: string | null;
  episode: string;
  response: StimulusResponse;
  title: string;
  text: string;
  /** Porquê: as regras que levaram aqui (rules.ts). */
  rules: string[];
  /** Sinais de fadiga (quando contam). */
  signals: string[];
  /** Escolhas ao aceitar (faixas ou exercícios); vazio = um só botão. */
  options: SuggestionOption[];
  acceptLabel: string;
  /** Valores a guardar com a resposta. */
  payload: Record<string, unknown>;
}

export interface DeloadState {
  until: Date;
  /** «até quarta, 22 out.» */
  label: string;
}

/**
 * Estagnação, fadiga e descarga (especificação «Progressão e ciclos», fase 3). Lê o histórico, decide com as regras
 * puras de stagnation.ts e fatigue.ts e aplica as respostas aceites aos treinos. Nunca muda um treino sem aceitares.
 */
@Injectable({ providedIn: 'root' })
export class ProgressionService {
  private readonly metrics = inject(METRICS_REPOSITORY);
  private readonly sessions = inject(SESSION_REPOSITORY);
  private readonly recovery = inject(RECOVERY_REPOSITORY);
  private readonly exercises = inject(EXERCISE_REPOSITORY);
  private readonly workouts = inject(WORKOUT_REPOSITORY);
  private readonly suggestions = inject(SUGGESTION_REPOSITORY);
  private readonly settings = inject(SettingsService);
  private readonly clock = inject(CLOCK);

  // --- descarga ------------------------------------------------------------------------------------

  /** Semana de descarga em curso, ou null. */
  deload(): DeloadState | null {
    const raw = this.settings.get('deloadUntil')();
    if (!raw) return null;
    const until = new Date(raw);
    if (until.getTime() <= this.clock.now().getTime()) return null;
    const label = until.toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'short' });
    return { until, label };
  }

  /** Começa uma semana de descarga hoje (7 dias; escolha da app, ver rules.ts `deload.amount`). */
  async startDeload(): Promise<DeloadState> {
    const now = this.clock.now();
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7, 0, 0, 0);
    await this.settings.set('deloadUntil', end.toISOString());
    return this.deload()!;
  }

  async endDeload(): Promise<void> {
    await this.settings.set('deloadUntil', null);
  }

  // --- deteção -------------------------------------------------------------------------------------

  /**
   * Cartões para mostrar. `exerciseIds`: só estes exercícios (fim da sessão); sem isso, os usados nos últimos 14 dias
   * (Home), mais o cartão de fadiga quando a sugestão automática está ligada.
   */
  async cards(scope: { exerciseIds?: string[] } = {}): Promise<SuggestionCard[]> {
    if (this.deload()) return [];
    const now = this.clock.now();
    const md = await this.metrics.metricData(new Date(now.getTime() - 180 * DAY), new Date(now.getTime() + 1000));
    const history = await this.suggestions.since(new Date(now.getTime() - 365 * DAY).toISOString());
    const working = md.sets.filter((s) => s.type === 'working');

    const fatigue = await this.fatigue(working, now);
    // Séries semanais por músculo: a média das últimas 4 semanas ou a última semana, a maior (uma semana a meio não engana).
    const lastWeek = weeklyVolume(md.sets, md.exercises, new Date(now.getTime() - 7 * DAY), now).sets;
    const avg4 = previousVolume(md.sets, md.exercises, now, 4);
    const vol = new Map([...new Set([...lastWeek.keys(), ...avg4.keys()])].map((m) => [m, Math.max(lastWeek.get(m) ?? 0, avg4.get(m) ?? 0)]));
    const maxSets = this.maxSets();
    const threshold = this.settings.get('stagnationSessions')();

    const recentIds = [...new Set(working.filter((s) => s.performedAt.getTime() >= now.getTime() - 14 * DAY).map((s) => s.exerciseId))];
    const ids = scope.exerciseIds ?? recentIds;
    let out: (SuggestionCard & { n: number })[] = [];

    for (const exerciseId of ids) {
      const sessions = sessionsOf(working, exerciseId);
      const stag = detectStagnation(sessions, threshold);
      if (!stag.stagnated || !stag.episode) continue;
      const episode = stag.episode;
      const mine = history.filter((h) => h.kind === 'STAGNATION' && h.exerciseId === exerciseId && h.episode === episode);
      const accepted = mine.filter((h) => h.status === 'ACCEPTED');
      const done = accepted.map((h) => h.response).filter((r): r is SuggestionResponse => !!r);
      // Depois de aceitares uma resposta, a seguinte só vem com nova estagnação: N sessões sem progresso depois disso.
      const lastAccepted = accepted.reduce<string | null>((m, h) => (!m || h.createdAt > m ? h.createdAt : m), null);
      if (lastAccepted && countAfter(sessions, lastAccepted) < threshold) continue;
      const ex = await this.exercises.get(exerciseId);
      if (!ex || ex.archivedAt) continue;
      const muscle = md.exercises.get(exerciseId)?.primaryMuscles[0] ?? null;
      const weekly = muscle ? vol.get(muscle) ?? 0 : 0;
      const response = nextResponse({ fatigue: fatigue.length > 0, weeklySets: weekly, maxSets, done });
      if (mine.some((h) => h.status === 'DECLINED' && h.response === response)) continue; // recusaste: até nova deteção
      out.push({ ...(await this.stagnationCard({
        exerciseId, name: ex.name, episode, response, weekly, maxSets, muscle, sessions: stag.sessionsWithout, fatigue,
        primaryMuscleIds: ex.primaryMuscleIds,
      })), n: stag.sessionsWithout });
    }
    // Home: os 3 exercícios parados há mais tempo (uma sugestão de cada vez; os outros aparecem no fim da sessão).
    out.sort((a, b) => b.n - a.n);
    if (!scope.exerciseIds) out = out.slice(0, HOME_MAX);

    if (!scope.exerciseIds && fatigue.length && this.settings.get('deloadSuggestions')() && !out.some((c) => c.response === 'deload')) {
      const episode = weekStartOf(toLocalDate(now));
      if (!history.some((h) => h.kind === 'FATIGUE' && h.episode === episode)) {
        out.unshift({ n: 0,
          key: `fatigue:${episode}`, kind: 'FATIGUE', exerciseId: null, exerciseName: null, episode, response: 'deload',
          title: 'Sinais de fadiga', text: 'Uma semana de descarga: metade das séries de cada exercício, com a mesma carga, durante 7 dias.',
          rules: ['fatigue.signals', 'deload.when', 'deload.how', 'deload.amount'], signals: fatigue.map((f) => f.text),
          options: [], acceptLabel: 'Começar descarga', payload: { signals: fatigue.map((f) => f.key) },
        });
      }
    }
    return out;
  }

  private async fatigue(working: MetricSet[], now: Date): Promise<FatigueSignal[]> {
    const finished = await this.sessions.listFinished({ limit: 3 });
    const bySession = new Map<string, MetricSet[]>();
    for (const s of working) (bySession.get(s.sessionId) ?? bySession.set(s.sessionId, []).get(s.sessionId)!).push(s);
    const lastSessions = [...bySession.values()]
      .sort((a, b) => b[0].performedAt.getTime() - a[0].performedAt.getTime())
      .slice(0, 2)
      .map((list) => list.map((s) => s.rir));
    const sore = await this.recovery.since(toLocalDate(new Date(now.getTime() - 3 * DAY)));
    const count = new Map<string, number>();
    for (const s of working) count.set(s.exerciseId, (count.get(s.exerciseId) ?? 0) + 1);
    const main = [...count].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([id]) => id);
    return fatigueSignals({
      rpes: finished.map((s) => s.rpe),
      rirBySession: lastSessions,
      levelRirMin: this.levelRirMin(),
      soreness: sore,
      perfTrend: performanceTrend(working, main, now, 3),
    }, (m) => MUSCLE_LABEL[m] ?? m);
  }

  private maxSets(): number {
    const goal = this.settings.get('profileGoal')();
    if (goal === 'hypertrophy') return VOLUME_RULES.goals.hypertrophy[this.settings.get('profileLevel')()].max;
    if (goal === 'cut') return VOLUME_RULES.goals.cut.any.max;
    return VOLUME_RULES.goals.maintenance.under_60.max;
  }

  private levelRirMin(): number {
    const goal = this.settings.get('profileGoal')();
    if (goal === 'hypertrophy') return VOLUME_RULES.goals.hypertrophy[this.settings.get('profileLevel')()].rir[0];
    return goal === 'cut' ? VOLUME_RULES.goals.cut.any.rir[0] : VOLUME_RULES.goals.maintenance.under_60.rir[0];
  }

  private async stagnationCard(c: {
    exerciseId: string; name: string; episode: string; response: StimulusResponse; weekly: number; maxSets: number;
    muscle: string | null; sessions: number; fatigue: FatigueSignal[]; primaryMuscleIds: string[];
  }): Promise<SuggestionCard> {
    const base = {
      key: `stag:${c.exerciseId}:${c.episode}:${c.response}`, kind: 'STAGNATION' as const, exerciseId: c.exerciseId,
      exerciseName: c.name, episode: c.episode, response: c.response,
      title: `${c.name}: sem progresso há ${c.sessions} sessões`, signals: [] as string[], options: [] as SuggestionOption[],
    };
    const label = c.muscle ? (MUSCLE_LABEL[c.muscle] ?? c.muscle).toLowerCase() : 'o músculo';
    switch (c.response) {
      case 'deload':
        return {
          ...base, signals: c.fatigue.map((f) => f.text), rules: ['stagnation.detect', 'fatigue.signals', 'deload.when', 'deload.how', 'deload.amount'],
          text: 'Há sinais de fadiga: primeiro uma semana de descarga, com metade das séries e a mesma carga.',
          acceptLabel: 'Começar descarga', payload: { signals: c.fatigue.map((f) => f.key) },
        };
      case 'volume': {
        const plan = volumePlan(c.weekly, c.maxSets);
        const where = await this.templatesWith(c.exerciseId);
        return {
          ...base, rules: ['stagnation.detect', 'stagnation.volume', 'stagnation.order'],
          text: `Sem sinais de fadiga: sobe o volume de ${label} de ${plan.from} para ${plan.to} séries por semana (+${plan.extra}), ` +
            (where.length ? `acrescentando-as a este exercício em ${where.map((w) => `«${w.name}»`).join(', ')}.` : 'acrescentando-as a este exercício nas próximas sessões.'),
          acceptLabel: `Acrescentar ${plan.extra} ${plan.extra === 1 ? 'série' : 'séries'}`,
          payload: { from: plan.from, to: plan.to, extra: plan.extra, muscle: c.muscle },
        };
      }
      case 'range': {
        const where = await this.templatesWith(c.exerciseId);
        const item = where[0]?.items.find((i) => i.exerciseId === c.exerciseId);
        const [min, max] = item ? repRange(item) : [8, 12];
        const opts = rangeOptions(min, max);
        return {
          ...base, rules: ['stagnation.detect', 'stagnation.range', 'stagnation.order'],
          text: `O volume de ${label} já subiu ou está no máximo: muda a faixa de ${min}–${max} repetições.` +
            (where.length ? '' : ' Este exercício não está em nenhum treino: usa a nova faixa nas próximas sessões.'),
          options: opts.map(([a, b]) => ({ label: `${a}–${b}`, value: [a, b] as [number, number] })),
          acceptLabel: 'Mudar faixa', payload: { from: [min, max] },
        };
      }
      case 'swap': {
        const alts = await this.alternatives(c.exerciseId, c.primaryMuscleIds);
        return {
          ...base, rules: ['stagnation.detect', 'stagnation.swap', 'stagnation.order'],
          text: alts.length
            ? 'Volume e faixa já mudaram: troca por um exercício parecido para o mesmo músculo.'
            : 'Volume e faixa já mudaram: troca por um exercício parecido para o mesmo músculo (adiciona um da biblioteca).',
          options: alts.map((a) => ({ label: a.name, value: a.id })),
          acceptLabel: 'Trocar', payload: {},
        };
      }
    }
  }

  private async templatesWith(exerciseId: string): Promise<Workout[]> {
    const list = await this.workouts.list();
    const out: Workout[] = [];
    for (const w of list) {
      if (w.archivedAt) continue;
      const full = await this.workouts.get(w.id);
      if (full?.items.some((i) => i.exerciseId === exerciseId)) out.push(full);
    }
    return out;
  }

  /** Até 3 exercícios teus de força com um músculo principal em comum, fora dos treinos onde este está. */
  private async alternatives(exerciseId: string, primaryMuscleIds: string[]): Promise<{ id: string; name: string }[]> {
    if (!primaryMuscleIds.length) return [];
    const list = await this.exercises.list({ kind: 'STRENGTH', muscleGroupIds: primaryMuscleIds });
    const inTemplates = new Set((await this.templatesWith(exerciseId)).flatMap((w) => w.items.map((i) => i.exerciseId)));
    return list
      .filter((e) => e.id !== exerciseId && !e.archivedAt && e.primaryMuscleIds.some((m) => primaryMuscleIds.includes(m)))
      .sort((a, b) => Number(inTemplates.has(a.id)) - Number(inTemplates.has(b.id)))
      .slice(0, 3)
      .map((e) => ({ id: e.id, name: e.name }));
  }

  // --- respostas -----------------------------------------------------------------------------------

  /** Aplica a resposta e guarda-a. Devolve uma frase para o aviso. */
  async accept(card: SuggestionCard, option?: SuggestionOption): Promise<string> {
    let message: string;
    const payload: Record<string, unknown> = { ...card.payload };
    switch (card.response) {
      case 'deload': {
        const d = await this.startDeload();
        message = `Semana de descarga até ${d.label}: metade das séries, a mesma carga.`;
        break;
      }
      case 'volume': {
        const extra = Number(card.payload['extra']) || 1;
        const where = await this.templatesWith(card.exerciseId!);
        const changed: string[] = [];
        for (let k = 0; k < extra && where.length; k++) {
          const w = where[k % where.length];
          const item = w.items.find((i) => i.exerciseId === card.exerciseId)!;
          item.targetSets = (item.targetSets ?? 3) + 1;
          if (!changed.includes(w.name)) changed.push(w.name);
        }
        for (const w of where.filter((x) => changed.includes(x.name))) await this.save(w);
        message = changed.length
          ? `+${extra} ${extra === 1 ? 'série' : 'séries'} em ${card.exerciseName} (${changed.map((n) => `«${n}»`).join(', ')}).`
          : `Faz mais ${extra} ${extra === 1 ? 'série' : 'séries'} de ${card.exerciseName} por semana.`;
        break;
      }
      case 'range': {
        const [min, max] = (option?.value as [number, number]) ?? [8, 12];
        payload['to'] = [min, max];
        const where = await this.templatesWith(card.exerciseId!);
        for (const w of where) {
          for (const i of w.items) if (i.exerciseId === card.exerciseId) { i.targetRepsMin = min; i.targetReps = max; }
          await this.save(w);
        }
        message = where.length ? `${card.exerciseName}: faixa ${min}–${max} nos teus treinos.` : `${card.exerciseName}: usa ${min}–${max} repetições.`;
        break;
      }
      case 'swap': {
        const to = option?.value as string | undefined;
        payload['to'] = to ?? null;
        const where = to ? await this.templatesWith(card.exerciseId!) : [];
        for (const w of where) {
          for (const i of w.items) if (i.exerciseId === card.exerciseId) i.exerciseId = to!;
          await this.save(w);
        }
        message = to && where.length ? `${card.exerciseName} trocado por ${option!.label} nos teus treinos.` : 'Escolhe um exercício parecido na próxima sessão.';
        break;
      }
    }
    await this.record(card, 'ACCEPTED', payload);
    return message;
  }

  async decline(card: SuggestionCard): Promise<void> {
    await this.record(card, 'DECLINED', card.payload);
  }

  private async record(card: SuggestionCard, status: SuggestionRecord['status'], payload: Record<string, unknown>): Promise<void> {
    await this.suggestions.record({
      kind: card.kind, exerciseId: card.exerciseId, episode: card.episode, response: card.response, status, payload,
    });
  }

  private async save(w: Workout): Promise<void> {
    await this.workouts.save({
      id: w.id, name: w.name, notes: w.notes,
      items: w.items.map((i) => ({
        id: i.id, exerciseId: i.exerciseId, block: i.block, supersetGroup: i.supersetGroup, targetSets: i.targetSets,
        targetRepsMin: i.targetRepsMin, targetReps: i.targetReps, targetDurationSeconds: i.targetDurationSeconds,
        targetWeightKg: i.targetWeightKg, targetDistanceM: i.targetDistanceM, restSeconds: i.restSeconds,
      })),
    });
  }
}

/** Séries de trabalho de um exercício agrupadas por sessão, da mais recente para a mais antiga. */
export function sessionsOf(sets: MetricSet[], exerciseId: string): StagSession[] {
  const by = new Map<string, StagSession>();
  for (const s of sets) {
    if (s.exerciseId !== exerciseId || s.type !== 'working') continue;
    let e = by.get(s.sessionId);
    if (!e) by.set(s.sessionId, (e = { id: s.sessionId, at: s.performedAt.toISOString(), sets: [] }));
    if (s.performedAt.toISOString() < e.at) e.at = s.performedAt.toISOString();
    e.sets.push({ weightKg: s.weightKg, reps: s.reps, rir: s.rir });
  }
  return [...by.values()].sort((a, b) => (a.at < b.at ? 1 : -1));
}

/** Sessões válidas (2+ séries de trabalho) depois de uma data. */
function countAfter(sessions: StagSession[], iso: string): number {
  return sessions.filter((x) => x.at > iso && x.sets.length >= 2).length;
}
