import { rulesWithSecondaryWeight } from '../../core/metrics/volume-rules';
import { inject, Injectable } from '@angular/core';
import {
  BODY_METRIC_REPOSITORY, EXERCISE_REPOSITORY, METRICS_REPOSITORY, RECOVERY_REPOSITORY, SESSION_REPOSITORY, SUGGESTION_REPOSITORY, WORKOUT_REPOSITORY,
} from '../repositories';
import type { SuggestionKind, SuggestionRecord } from '../../data/repositories/suggestion.repository';
import type { Workout } from '../../data/models/workout';
import { MUSCLE_LABEL } from '../../core/metrics/muscles';
import { performanceTrend, type Level, type MetricSet } from '../../core/metrics/volume';
import { fourWeekChange, PACE, paceBand, paceMessage, paceStatus, weeklyPace, type WeightRecord } from '../../core/progression/body';
import { consistentMonths, levelSuggestion } from '../../core/progression/level';
import { SettingsService } from '../settings/settings.service';
import { CLOCK } from '../clock';
import { toLocalDate, weekStartOf } from '../../core/util/week';
import { fatigueSignals, type FatigueSignal } from '../../core/progression/fatigue';
import { repRange } from '../../core/progression/load';
import { defaultRepRange } from '../../core/progression/goals';
import { rangeOptions, volumePlan, type StimulusResponse } from '../../core/progression/stagnation';
import {
  goalVolumeLimits, mainExerciseIds, pickStagnationCards, recentExerciseIds, recentSessionsRir, sessionsOf, stagnationDecision, SUGGEST,
  weeklySetsByMuscle,
} from '../../core/progression/suggestions';

const DAY = 86_400_000;

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

/** Aviso informativo (ritmo de peso, nível sugerido): uma ação opcional e «OK». */
export interface Notice {
  key: string;
  title: string;
  text: string;
  rules: string[];
  action: { label: string; level?: Level } | null;
}

const LEVEL_LABEL: Record<Level, string> = { beginner: 'Iniciante', intermediate: 'Intermédio', advanced: 'Avançado' };

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
  private readonly body = inject(BODY_METRIC_REPOSITORY);
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
   * Cartões para mostrar. `exerciseIds`: só estes exercícios (fim da sessão); sem isso, os usados nos últimos SUGGEST.recentDays dias
   * (Home), mais o cartão de fadiga quando a sugestão automática está ligada.
   */
  async cards(scope: { exerciseIds?: string[]; all?: boolean } = {}): Promise<SuggestionCard[]> {
    if (this.deload()) return [];
    const now = this.clock.now();
    const md = await this.metrics.metricData(new Date(now.getTime() - SUGGEST.historyDays * DAY), new Date(now.getTime() + 1000));
    const history = await this.suggestions.since(new Date(now.getTime() - SUGGEST.responsesDays * DAY).toISOString());
    const working = md.sets.filter((s) => s.type === 'working');

    const fatigue = await this.fatigue(working, now);
    const vol = weeklySetsByMuscle(md.sets, md.exercises, now, rulesWithSecondaryWeight(this.settings.get('secondaryMuscleWeight')()));
    const { maxSets } = this.limits();
    const threshold = this.settings.get('stagnationSessions')();
    const ids = scope.exerciseIds ?? recentExerciseIds(working, now);
    const found: (SuggestionCard & { sessionsWithout: number })[] = [];

    for (const exerciseId of ids) {
      const sessions = sessionsOf(working, exerciseId);
      const muscle = md.exercises.get(exerciseId)?.primaryMuscles[0] ?? null;
      const weekly = muscle ? vol.get(muscle) ?? 0 : 0;
      const decision = stagnationDecision({
        sessions, threshold, fatigue: fatigue.length > 0, weeklySets: weekly, maxSets,
        responses: history.filter((h) => h.exerciseId === exerciseId),
      });
      if (!decision) continue;
      const ex = await this.exercises.get(exerciseId);
      if (!ex || ex.archivedAt) continue;
      found.push({ ...(await this.stagnationCard({
        exerciseId, name: ex.name, episode: decision.episode, response: decision.response, weekly, maxSets, muscle,
        sessions: decision.sessionsWithout, fatigue, primaryMuscleIds: ex.primaryMuscleIds,
      })), sessionsWithout: decision.sessionsWithout });
    }
    // Home: os parados há mais tempo, no máximo SUGGEST.homeMax (os outros aparecem no fim da sessão).
    const out: SuggestionCard[] = pickStagnationCards(found, !scope.exerciseIds && !scope.all).map(({ sessionsWithout: _, ...c }) => c);
    // A ganhar massa, com o peso parado 4 semanas: juntar o sinal da alimentação (rules.ts `pace.stall`).
    if (out.length && this.settings.get('profileGoal')() === 'hypertrophy') {
      const change = fourWeekChange(await this.weights(), toLocalDate(now));
      if (change !== null && change < PACE.stallTotal) {
        for (const c of out) {
          c.text += ` O teu peso subiu menos de 0,25% em 4 semanas: revê também a alimentação.`;
          c.rules = [...c.rules, 'pace.stall'];
        }
      }
    }

    if (!scope.exerciseIds && fatigue.length && this.settings.get('deloadSuggestions')() && !out.some((c) => c.response === 'deload')) {
      const episode = weekStartOf(toLocalDate(now));
      if (!history.some((h) => h.kind === 'FATIGUE' && h.episode === episode)) {
        out.unshift({
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
    const sore = await this.recovery.since(toLocalDate(new Date(now.getTime() - SUGGEST.sorenessDays * DAY)));
    return fatigueSignals({
      rpes: finished.map((s) => s.rpe),
      rirBySession: recentSessionsRir(working),
      levelRirMin: this.limits().rirMin,
      soreness: sore,
      perfTrend: performanceTrend(working, mainExerciseIds(working), now, 3),
    }, (m) => MUSCLE_LABEL[m] ?? m);
  }

  private limits(): { maxSets: number; rirMin: number } {
    return goalVolumeLimits(this.settings.get('profileGoal')(), this.settings.get('profileLevel')());
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
        const fallback = defaultRepRange(this.settings.get('profileGoal')(), this.settings.get('profileLevel')());
        const [min, max] = item ? repRange(item, fallback) : fallback;
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

  private async weights(): Promise<WeightRecord[]> {
    return (await this.body.list('WEIGHT_KG', 120)).map((m) => ({ date: m.date, value: m.value }));
  }

  // --- avisos (ritmo de peso, nível) -----------------------------------------------------------------

  /** Avisos para a Home: ritmo de peso fora da faixa do objetivo e nível sugerido pelo histórico. */
  async notices(): Promise<Notice[]> {
    const now = this.clock.now();
    const today = toLocalDate(now);
    const goal = this.settings.get('profileGoal')();
    const level = this.settings.get('profileLevel')();
    const dismissed = new Set(this.settings.get('dismissedNotices')());
    const out: Notice[] = [];

    const pace = weeklyPace(await this.weights(), today);
    const band = paceBand(goal, level);
    if (pace !== null && band) {
      const msg = paceMessage(goal, level, pace);
      const key = `pace:${weekStartOf(today)}:${paceStatus(pace, band)}`;
      if (msg && !dismissed.has(key)) {
        out.push({ key, title: 'Ritmo de peso', text: msg, rules: ['pace.measure', band.rule], action: null });
      }
    }

    const md = await this.metrics.metricData(new Date(now.getTime() - 4 * 365 * DAY), new Date(now.getTime() + 1000));
    const days = [...new Set(md.sets.map((s) => toLocalDate(s.performedAt)))];
    const months = consistentMonths(days, today);
    const sug = levelSuggestion(level, months);
    if (sug && !dismissed.has(`level:${sug}`)) {
      const m = Math.floor(months);
      out.push({
        key: `level:${sug}`, title: `Nível: ${LEVEL_LABEL[sug]}?`,
        text: `Treinas com regularidade há ${m} ${m === 1 ? 'mês' : 'meses'}. O ACSM 2009 chama ${sug === 'intermediate' ? 'intermédio a quem tem cerca de 6 meses' : 'avançado a quem tem anos'} de treino consistente. Mudar o nível muda as faixas de séries por semana${goal === 'strength' || goal === 'endurance' ? ' e as repetições por defeito' : ''}.`,
        rules: ['level.definition', 'level.suggest'], action: { label: `Passar a ${LEVEL_LABEL[sug].toLowerCase()}`, level: sug },
      });
    }
    return out;
  }

  async acceptNotice(n: Notice): Promise<string | null> {
    await this.dismissNotice(n);
    if (n.action?.level) {
      await this.settings.set('profileLevel', n.action.level);
      return `Nível: ${LEVEL_LABEL[n.action.level].toLowerCase()}.`;
    }
    return null;
  }

  async dismissNotice(n: Notice): Promise<void> {
    const cur = this.settings.get('dismissedNotices')();
    if (!cur.includes(n.key)) await this.settings.set('dismissedNotices', [...cur, n.key].slice(-200));
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
