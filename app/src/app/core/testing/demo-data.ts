import type { DbAdapter } from '../db/db-adapter';
import { LIBRARY } from '../library/library-data';
import { libraryItemToInput } from '../library/library';
import { loadSeed } from '../seed/seed-loader';
import { SqliteBodyMetricRepository } from '../../data/repositories/body-metric.repository';
import { SqliteExerciseRepository } from '../../data/repositories/sqlite/sqlite-exercise.repository';
import { SqliteSessionRepository } from '../../data/repositories/sqlite/sqlite-session.repository';
import { SqliteWorkoutRepository } from '../../data/repositories/sqlite/sqlite-workout.repository';
import type { PlannedExerciseInput } from '../../data/models/workout';
import type { SideEntry } from '../../data/models/session';
import { ids } from '../util/uuid';
import { FixedClock } from '../util/clock';
import { TEST_SEED } from './test-db';

/**
 * Dados de demonstração: 12 semanas de treino (3–4 sessões por semana) com progressão, deload, semana de
 * doença e faltas, tudo gerado pelos repositórios reais para o resultado ser importável na app.
 * Determinístico (PRNG com semente).
 */

function rng(seed: number): () => number {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Plan {
  key: string;
  sets: number;
  repsLo: number;
  repsHi: number;
  /** Carga inicial (kg); por mão nos halteres. */
  start: number;
  step: number;
  rest: number;
  warmup?: boolean;
  /** Superset com o exercício seguinte. */
  link?: boolean;
}
interface Mob { key: string; reps?: number; seconds?: number }
interface Template { name: string; mobility: Mob[]; main: Plan[] }

const TEMPLATES: Record<string, Template> = {
  Push: {
    name: 'Push',
    mobility: [{ key: 'dislocates-de-ombro-com-banda--band', reps: 10 }, { key: 'alongamento-de-peitoral-na-porta--none', seconds: 30 }],
    main: [
      { key: 'supino-plano--barbell', sets: 4, repsLo: 6, repsHi: 8, start: 60, step: 2.5, rest: 150, warmup: true },
      { key: 'supino-inclinado--dumbbell', sets: 3, repsLo: 8, repsHi: 12, start: 22, step: 2, rest: 120 },
      { key: 'desenvolvimento-sentado-de-pe--dumbbell', sets: 3, repsLo: 8, repsHi: 10, start: 18, step: 2, rest: 120 },
      { key: 'elevacoes-laterais--dumbbell', sets: 3, repsLo: 12, repsHi: 15, start: 8, step: 1, rest: 75 },
      { key: 'pushdown-com-corda--cable', sets: 3, repsLo: 10, repsHi: 15, start: 25, step: 2.5, rest: 60, link: true },
      { key: 'extensao-acima-da-cabeca-com-corda--cable', sets: 3, repsLo: 10, repsHi: 15, start: 20, step: 2.5, rest: 75 },
    ],
  },
  Pull: {
    name: 'Pull',
    mobility: [{ key: 'gato-camelo--none', reps: 10 }, { key: 'rotacao-toracica-em-quadrupedia--none', reps: 8 }],
    main: [
      { key: 'remada-curvada--barbell', sets: 4, repsLo: 6, repsHi: 10, start: 55, step: 2.5, rest: 150, warmup: true },
      { key: 'puxada-a-frente--cable', sets: 3, repsLo: 8, repsHi: 12, start: 50, step: 2.5, rest: 120 },
      { key: 'remada-sentada--cable', sets: 3, repsLo: 10, repsHi: 12, start: 45, step: 2.5, rest: 90 },
      { key: 'face-pull--cable', sets: 3, repsLo: 12, repsHi: 15, start: 20, step: 2.5, rest: 60 },
      { key: 'curl-com-barra-reta--barbell', sets: 3, repsLo: 8, repsHi: 12, start: 30, step: 2.5, rest: 60, link: true },
      { key: 'curl-martelo--dumbbell', sets: 3, repsLo: 10, repsHi: 12, start: 12, step: 1, rest: 75 },
    ],
  },
  Pernas: {
    name: 'Pernas',
    mobility: [{ key: '90-90-de-anca--none', seconds: 45 }, { key: 'agachamento-profundo-manter--none', seconds: 45 }],
    main: [
      { key: 'agachamento-traseiro--barbell', sets: 4, repsLo: 5, repsHi: 8, start: 80, step: 2.5, rest: 180, warmup: true },
      { key: 'leg-press--machine', sets: 3, repsLo: 10, repsHi: 12, start: 140, step: 5, rest: 120 },
      { key: 'peso-morto-romeno--barbell', sets: 3, repsLo: 8, repsHi: 10, start: 70, step: 2.5, rest: 120 },
      { key: 'leg-curl-deitado--machine', sets: 3, repsLo: 10, repsHi: 15, start: 35, step: 2.5, rest: 75 },
      { key: 'gemeos-de-pe--machine', sets: 4, repsLo: 12, repsHi: 15, start: 60, step: 5, rest: 60 },
    ],
  },
  Upper: {
    name: 'Upper',
    mobility: [{ key: 'dislocates-de-ombro-com-banda--band', reps: 10 }],
    main: [
      { key: 'supino-inclinado--barbell', sets: 3, repsLo: 8, repsHi: 10, start: 50, step: 2.5, rest: 120, warmup: true },
      { key: 'remada-no-banco-inclinado-chest-supported--dumbbell', sets: 3, repsLo: 10, repsHi: 12, start: 24, step: 2, rest: 90 },
      { key: 'shoulder-press--machine', sets: 3, repsLo: 10, repsHi: 12, start: 35, step: 2.5, rest: 90 },
      { key: 'crucifixo-invertido-nos-cabos--cable', sets: 3, repsLo: 12, repsHi: 15, start: 12.5, step: 1.25, rest: 60 },
      { key: 'pushdown-com-barra-v--cable', sets: 3, repsLo: 10, repsHi: 12, start: 30, step: 2.5, rest: 45, link: true },
      { key: 'curl-inclinado--dumbbell', sets: 3, repsLo: 10, repsHi: 12, start: 10, step: 1, rest: 75 },
    ],
  },
};

const CARDIO = [
  { key: 'passadeira-caminhada-inclinada-ex-12-3-30--treadmill', minutes: 30, kmh: 5.0, kcalPerMin: 7 },
  { key: 'bicicleta-estatica-vertical--bike', minutes: 35, kmh: 22, kcalPerMin: 8 },
  { key: 'remo-ergometro-continuo--rower', minutes: 25, kmh: 11, kcalPerMin: 9 },
];

/** Semanas (1–12): sessões por dia (0 = segunda). Impar = 4 sessões, par = 3. */
function weekPlan(week: number): { day: number; tpl: string }[] {
  return week % 2 === 1
    ? [{ day: 0, tpl: 'Push' }, { day: 1, tpl: 'Pull' }, { day: 3, tpl: 'Pernas' }, { day: 5, tpl: 'Upper' }]
    : [{ day: 0, tpl: 'Pernas' }, { day: 2, tpl: 'Push' }, { day: 4, tpl: 'Pull' }];
}

export const DEMO_START = '2026-07-13'; // segunda-feira
export const DEMO_WEEKS = 12;
export const DELOAD_WEEK = 6;
export const SICK_WEEK = 9;
/** Exercício que deixa de progredir a partir desta semana (para ver o cartão de estagnação). */
export const STALL_KEY = 'elevacoes-laterais--dumbbell';
export const STALL_FROM = 10;

export interface DemoSummary { sessions: number; sets: number; skipped: number }

const round = (v: number, step: number) => Math.round(v / step) * step;

export async function generateDemo(
  db: DbAdapter, deviceId: string, seedNum = 42,
): Promise<{ summary: DemoSummary; clock: FixedClock }> {
  const clock = new FixedClock(new Date(`${DEMO_START}T06:00:00.000Z`));
  await loadSeed(db, TEST_SEED, deviceId, () => clock.nowIso());
  const exercises = new SqliteExerciseRepository(db, clock, deviceId);
  const workouts = new SqliteWorkoutRepository(db, clock, deviceId);
  const sessions = new SqliteSessionRepository(db, clock, deviceId);
  const body = new SqliteBodyMetricRepository(db, clock, deviceId);
  const rand = rng(seedNum);
  const pick = (a: number, b: number) => a + rand() * (b - a);

  // Exercícios da biblioteca usados nos treinos.
  const keys = new Set<string>();
  for (const t of Object.values(TEMPLATES)) {
    t.main.forEach((p) => keys.add(p.key));
    t.mobility.forEach((m) => keys.add(m.key));
  }
  CARDIO.forEach((c) => keys.add(c.key));
  const exIds = new Map<string, string>();
  for (const k of keys) {
    const item = LIBRARY.items.find((i) => i.key === k);
    if (!item) throw new Error(`Exercício da biblioteca não encontrado: ${k}`);
    const found = await db.query<{ id: string; name: string }>(
      'SELECT id, name FROM exercise WHERE deleted_at IS NULL',
    );
    const same = found.find((r) => r.name.trim().toLowerCase() === item.name.trim().toLowerCase());
    if (same) { exIds.set(k, same.id); continue; }
    await exercises.save(libraryItemToInput(item));
    exIds.set(k, ids.libraryExercise(k));
  }
  const exId = (k: string) => exIds.get(k)!;

  // Treinos (modelos).
  const tplId: Record<string, string> = {};
  for (const t of Object.values(TEMPLATES)) {
    const items: PlannedExerciseInput[] = [
      ...t.mobility.map((m): PlannedExerciseInput => ({
        exerciseId: exId(m.key), block: 'WARMUP', targetSets: 2,
        targetReps: m.reps ?? null, targetDurationSeconds: m.seconds ?? null,
      })),
      ...t.main.map((p): PlannedExerciseInput => ({
        exerciseId: exId(p.key), block: 'MAIN', targetSets: p.sets, targetReps: p.repsLo,
        targetWeightKg: p.start, restSeconds: p.rest, supersetGroup: p.link ? 'A' : null,
      })),
    ];
    // O segundo membro de cada superset também leva o grupo.
    t.main.forEach((p, i) => { if (p.link) items[t.mobility.length + i + 1].supersetGroup = 'A'; });
    tplId[t.name] = (await workouts.save({ name: t.name, items })).id;
  }
  const cardioTpl = (await workouts.save({
    name: 'Cardio',
    items: [{ exerciseId: exId(CARDIO[0].key), block: 'MAIN', targetSets: 1, targetDurationSeconds: 30 * 60 }],
  })).id;

  // Estado de progressão por exercício: carga e repetições actuais.
  const state = new Map<string, { w: number; reps: number }>();
  for (const t of Object.values(TEMPLATES)) for (const p of t.main) state.set(p.key, { w: p.start, reps: p.repsLo });

  const out: DemoSummary = { sessions: 0, sets: 0, skipped: 0 };
  const day0 = Date.parse(`${DEMO_START}T00:00:00.000Z`);

  for (let w = 1; w <= DEMO_WEEKS; w++) {
    const deload = w === DELOAD_WEEK;
    const sick = w === SICK_WEEK;
    let plan = weekPlan(w);
    if (sick) plan = plan.slice(0, 1); // doente: só uma sessão leve
    // Peso corporal: segunda de manhã, com ruído e tendência a descer.
    const monday = new Date(day0 + (w - 1) * 7 * 86400000);
    clock.set(new Date(monday.getTime() + 7 * 3600000));
    await body.add({ date: monday.toISOString().slice(0, 10), type: 'WEIGHT_KG', value: Math.round((82.2 - w * 0.12 + pick(-0.4, 0.4) - (sick ? 0.6 : 0)) * 10) / 10 });
    if (w % 4 === 1) await body.add({ date: monday.toISOString().slice(0, 10), type: 'BODY_FAT_PCT', value: Math.round((19.5 - w * 0.1 + pick(-0.2, 0.2)) * 10) / 10 });

    const todo: { day: number; tpl: string }[] = plan.map((p) => ({ ...p }));
    for (const entry of todo) {
      if (!sick && rand() < 0.07) { out.skipped++; continue; } // falta ocasional
      const tpl = TEMPLATES[entry.tpl];
      const start = new Date(day0 + ((w - 1) * 7 + entry.day) * 86400000 + (17 * 60 + Math.floor(pick(20, 50))) * 60000);
      clock.set(start);
      const s = await sessions.start({ templateId: tplId[tpl.name] });
      const full = await sessions.get(s.id);
      let fatigue = 0;
      let lastSessionRpe = 0;
      for (const ex of full!.exercises) {
        const p = tpl.main.find((x) => exId(x.key) === ex.exerciseId);
        const mob = tpl.mobility.find((x) => exId(x.key) === ex.exerciseId);
        if (mob) {
          for (let i = 0; i < 2; i++) {
            const entries: SideEntry[] = (ex.isUnilateral ? (['LEFT', 'RIGHT'] as const) : (['BOTH'] as const)).map((side) => ({
              side, reps: mob.reps ?? null, durationSeconds: mob.seconds ?? null,
            }));
            await sessions.saveSet({ sessionExerciseId: ex.id, entries });
            clock.advance(((mob.seconds ?? 30) + 25) * 1000);
            out.sets++;
          }
          continue;
        }
        if (!p) continue;
        const st = state.get(p.key)!;
        const scale = deload ? 0.85 : sick ? 0.8 : 1;
        const sets = Math.max(2, p.sets - (deload ? 1 : 0) - (sick ? 1 : 0));
        const wt = Math.max(p.step, round(st.w * scale, p.step >= 2 ? 1.25 : 0.5));
        // Aquecimento no primeiro exercício pesado.
        if (p.warmup) {
          await sessions.saveSet({ sessionExerciseId: ex.id, type: 'WARMUP', entries: [{ side: 'BOTH', weightKg: round(wt * 0.5, 1.25), reps: 8 }] });
          clock.advance(60000);
          out.sets++;
        }
        let allTop = true;
        for (let i = 0; i < sets; i++) {
          const dropoff = i === 0 ? 0 : i === sets - 1 ? Math.floor(pick(1, 3)) : Math.floor(pick(0, 2));
          const stalled = p.key === STALL_KEY && w >= STALL_FROM;
          const noise = stalled ? (pick(-1, 2), 0) : Math.floor(pick(-1, 2)); // -1, 0, +1
          let reps = Math.max(p.repsLo - 2, st.reps + (deload ? 1 : 0) + noise - dropoff - Math.floor(fatigue / 3));
          reps = Math.min(p.repsHi + 1, reps);
          if (reps < p.repsHi) allTop = false;
          const rir = Math.max(0, Math.min(4, Math.round(3 - i * (deload ? 0.3 : 0.8) + pick(-0.6, 0.6) - (p.repsHi - reps < 0 ? 0 : 0))));
          const entries: SideEntry[] = ex.isUnilateral
            ? (['LEFT', 'RIGHT'] as const).map((side) => ({ side, weightKg: wt, reps: side === 'LEFT' ? reps : Math.max(1, reps - (rand() < 0.3 ? 1 : 0)), rir }))
            : [{ side: 'BOTH', weightKg: wt, reps, rir }];
          clock.advance(Math.round(pick(35, 55)) * 1000); // tempo a executar
          await sessions.saveSet({ sessionExerciseId: ex.id, entries });
          out.sets++;
          fatigue++;
          const restSec = ex.supersetGroup && ex.supersetGroup === 'A' && p.link ? 10 : Math.round(p.rest * pick(0.85, 1.15));
          clock.advance(restSec * 1000);
        }
        // Progressão dupla: só avança se atingiu o topo em todas as séries (e não foi deload/doença).
        if (!deload && !sick && !(p.key === STALL_KEY && w >= STALL_FROM)) {
          if (allTop && st.reps >= p.repsHi) { st.w += p.step; st.reps = p.repsLo; }
          else if (rand() < 0.8) st.reps = Math.min(p.repsHi, st.reps + (rand() < 0.5 ? 1 : 2));
        }
        lastSessionRpe += 0;
      }
      clock.advance(60000);
      const rpe = deload ? Math.round(pick(5, 6.5)) : sick ? 5 : Math.round(pick(6.5, 9.2));
      const notes = sick ? 'Constipado, sessão leve.'
        : deload ? 'Semana de deload.'
        : rand() < 0.12 ? ['Dormi mal.', 'Ombro direito um pouco sensível.', 'Boa sessão!', 'Ginásio cheio, esperei pelas máquinas.'][Math.floor(rand() * 4)]
        : null;
      await sessions.finish(s.id, { rpe, notes });
      out.sessions++;
      void lastSessionRpe;
    }

    // Cardio extra em algumas semanas (sábado/domingo à tarde).
    if (!sick && [2, 4, 7, 10, 12].includes(w)) {
      const c = CARDIO[w % CARDIO.length];
      const start = new Date(day0 + ((w - 1) * 7 + 6) * 86400000 + 10 * 3600000);
      clock.set(start);
      const s = await sessions.start({ templateId: cardioTpl });
      const exs = await sessions.get(s.id);
      const cardioSx = exs!.exercises[0];
      await sessions.removeExercise(cardioSx.id);
      const added = await sessions.addExercise(s.id, exId(c.key), 'MAIN');
      const minutes = c.minutes + Math.round(pick(-3, 5));
      clock.advance(minutes * 60000);
      await sessions.saveSet({
        sessionExerciseId: added.id,
        entries: [{
          side: 'BOTH', durationSeconds: minutes * 60,
          distanceM: Math.round((c.kmh * minutes) / 60 * 1000 * pick(0.95, 1.05)),
          caloriesKcal: Math.round(c.kcalPerMin * minutes * pick(0.9, 1.1)),
        }],
      });
      out.sets++;
      await sessions.finish(s.id, { rpe: Math.round(pick(4, 6)) });
      out.sessions++;
    }
  }
  return { summary: out, clock };
}
