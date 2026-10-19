import { beforeEach, describe, expect, it } from 'vitest';
import { loadSeed } from '../../seed/seed-loader';
import { createTestDb, TEST_SEED } from '../../testing/test-db';
import { FixedClock } from '../../../core/util/clock';
import { SqliteLookupRepository } from '../lookup.repository';
import { SqliteExerciseRepository } from './sqlite-exercise.repository';
import { SqliteMetricsRepository } from '../metrics.repository';
import { SqliteSessionRepository } from './sqlite-session.repository';

let metrics: SqliteMetricsRepository;
let sessions: SqliteSessionRepository;
let exercises: SqliteExerciseRepository;
let clock: FixedClock;
let muscle: (name: string) => Promise<string>;
let bench: string, fly: string, hip: string, plank: string;

beforeEach(async () => {
  const t = await createTestDb();
  await loadSeed(t.db, TEST_SEED, t.deviceId);
  clock = new FixedClock(new Date('2026-10-05T12:00:00.000Z')); // segunda
  metrics = new SqliteMetricsRepository(t.db);
  sessions = new SqliteSessionRepository(t.db, clock, t.deviceId);
  exercises = new SqliteExerciseRepository(t.db, clock, t.deviceId);
  const lookup = new SqliteLookupRepository(t.db);
  const all = await lookup.muscles();
  muscle = async (name) => all.find((m) => m.name === name)!.id;
  const [chest, triceps, shoulder] = [await muscle('Peito'), await muscle('Tríceps'), await muscle('Ombros')];
  bench = (await exercises.save({ name: 'T Supino', kind: 'STRENGTH', metricType: 'WEIGHT_REPS', primaryMuscleIds: [chest], secondaryMuscleIds: [triceps, shoulder] })).id;
  fly = (await exercises.save({ name: 'T Abertura', kind: 'STRENGTH', metricType: 'WEIGHT_REPS', primaryMuscleIds: [chest] })).id;
  hip = (await exercises.save({ name: 'T Anca', kind: 'MOBILITY', metricType: 'DURATION', isUnilateral: true })).id;
  plank = (await exercises.save({ name: 'T Prancha', kind: 'MOBILITY', metricType: 'DURATION' })).id;
});

async function session(dayIso: string, build: (id: string) => Promise<void>) {
  clock.set(new Date(dayIso));
  const s = await sessions.start();
  await build(s.id);
  clock.advance(30 * 60_000);
  await sessions.finish(s.id);
}
const work = (sx: string, n: number, extra: { type?: 'WARMUP' | 'WORKING' } = {}) =>
  Promise.all(Array.from({ length: n }, (_, i) => sessions.saveSet({
    sessionExerciseId: sx, type: extra.type, entries: [{ side: 'BOTH', weightKg: 50, reps: 8 + i }],
  }))).then(() => undefined);

describe('séries semanais por grupo muscular', () => {
  it('conta 1 por principal e o peso configurado por secundário, só séries de trabalho de força', async () => {
    await session('2026-10-05T10:00:00.000Z', async (id) => {
      const a = await sessions.addExercise(id, bench);
      for (let i = 0; i < 3; i++) await sessions.saveSet({ sessionExerciseId: a.id, entries: [{ side: 'BOTH', weightKg: 50, reps: 8 }] });
      await sessions.saveSet({ sessionExerciseId: a.id, type: 'WARMUP', entries: [{ side: 'BOTH', weightKg: 20, reps: 10 }] });
      const b = await sessions.addExercise(id, fly);
      await sessions.saveSet({ sessionExerciseId: b.id, entries: [{ side: 'BOTH', weightKg: 10, reps: 12 }] });
      const m = await sessions.addExercise(id, plank);
      await sessions.saveSet({ sessionExerciseId: m.id, entries: [{ side: 'BOTH', durationSeconds: 60 }] });
    });
    const week = await metrics.weeklySetsByMuscle('2026-10-05', 0.5);
    expect(week.map((w) => [w.muscle, w.series])).toEqual([['Peito', 4], ['Ombros', 1.5], ['Tríceps', 1.5]]);
    // outra semana não vê nada, e o peso é configurável
    expect(await metrics.weeklySetsByMuscle('2026-10-12', 0.5)).toEqual([]);
    expect((await metrics.weeklySetsByMuscle('2026-10-05', 0.25)).find((w) => w.muscle === 'Tríceps')?.series).toBe(0.75);
  });

  it('uma série com dois lados conta uma vez e a semana vai de segunda a domingo', async () => {
    const unil = (await exercises.save({ name: 'T Unilateral', kind: 'STRENGTH', metricType: 'WEIGHT_REPS', isUnilateral: true, primaryMuscleIds: [await muscle('Peito')] })).id;
    await session('2026-10-11T10:00:00.000Z', async (id) => { // domingo
      const a = await sessions.addExercise(id, unil);
      await sessions.saveSet({ sessionExerciseId: a.id, entries: [{ side: 'LEFT', weightKg: 10, reps: 8 }, { side: 'RIGHT', weightKg: 10, reps: 8 }] });
    });
    await session('2026-10-12T10:00:00.000Z', async (id) => { // segunda seguinte
      const a = await sessions.addExercise(id, unil);
      await sessions.saveSet({ sessionExerciseId: a.id, entries: [{ side: 'LEFT', weightKg: 10, reps: 8 }] });
    });
    expect((await metrics.weeklySetsByMuscle('2026-10-05', 0.5))[0]).toMatchObject({ muscle: 'Peito', series: 1 });
    expect((await metrics.weeklySetsByMuscle('2026-10-12', 0.5))[0]).toMatchObject({ muscle: 'Peito', series: 1 });
  });

  it('séries apagadas e sessões apagadas deixam de contar', async () => {
    let sx = '';
    let sid = '';
    await session('2026-10-06T10:00:00.000Z', async (id) => {
      sid = id;
      const a = await sessions.addExercise(id, fly);
      sx = a.id;
      await work(a.id, 2);
    });
    expect((await metrics.weeklySetsByMuscle('2026-10-05', 0.5))[0].series).toBe(2);
    await sessions.deleteSet(sx, 1);
    expect((await metrics.weeklySetsByMuscle('2026-10-05', 0.5))[0].series).toBe(1);
    await sessions.discard(sid);
    expect(await metrics.weeklySetsByMuscle('2026-10-05', 0.5)).toEqual([]);
  });
});

describe('mobilidade', () => {
  it('minutos somam os dois lados; sessões e dias distintos', async () => {
    await session('2026-10-05T10:00:00.000Z', async (id) => {
      const a = await sessions.addExercise(id, hip);
      await sessions.saveSet({ sessionExerciseId: a.id, entries: [{ side: 'LEFT', durationSeconds: 90 }, { side: 'RIGHT', durationSeconds: 90 }] });
      const p = await sessions.addExercise(id, plank);
      await sessions.saveSet({ sessionExerciseId: p.id, entries: [{ side: 'BOTH', durationSeconds: 60 }] });
    });
    await session('2026-10-07T10:00:00.000Z', async (id) => {
      const p = await sessions.addExercise(id, plank);
      await sessions.saveSet({ sessionExerciseId: p.id, entries: [{ side: 'BOTH', durationSeconds: 30 }] });
    });
    expect(await metrics.mobilityWeek('2026-10-05')).toEqual({ minutes: 4.5, sessions: 2, activeDays: 2 });
    expect(await metrics.mobilityWeek('2026-10-12')).toEqual({ minutes: 0, sessions: 0, activeDays: 0 });
  });

  it('sequência de dias: conta até ontem se hoje ainda não fizeste', async () => {
    for (const d of ['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-09']) {
      await session(`${d}T10:00:00.000Z`, async (id) => {
        const p = await sessions.addExercise(id, plank);
        await sessions.saveSet({ sessionExerciseId: p.id, entries: [{ side: 'BOTH', durationSeconds: 60 }] });
      });
    }
    expect(await metrics.mobilityStreak('2026-10-07')).toBe(3);
    expect(await metrics.mobilityStreak('2026-10-08')).toBe(3); // hoje sem mobilidade, conta até ontem
    expect(await metrics.mobilityStreak('2026-10-09')).toBe(1);
    expect(await metrics.mobilityStreak('2026-10-10')).toBe(1);
    expect(await metrics.mobilityStreak('2026-10-12')).toBe(0);
  });
});

describe('séries por semana (gráficos)', () => {
  it('força: uma série conta uma vez, só trabalho, e as semanas vazias vêm a zero', async () => {
    await session('2026-10-05T10:00:00.000Z', async (id) => {
      const a = await sessions.addExercise(id, bench);
      await work(a.id, 3);
      await sessions.saveSet({ sessionExerciseId: a.id, type: 'WARMUP', entries: [{ side: 'BOTH', weightKg: 20, reps: 10 }] });
    });
    await session('2026-10-20T10:00:00.000Z', async (id) => {
      const a = await sessions.addExercise(id, fly);
      await work(a.id, 2);
    });
    const w = await metrics.weeklyStrengthSets('2026-09-28', 4);
    expect(w).toEqual([
      { weekStart: '2026-09-28', value: 0 },
      { weekStart: '2026-10-05', value: 3 },
      { weekStart: '2026-10-12', value: 0 },
      { weekStart: '2026-10-19', value: 2 },
    ]);
  });

  it('mobilidade: soma os minutos (os dois lados somam) por semana', async () => {
    await session('2026-10-06T10:00:00.000Z', async (id) => {
      const a = await sessions.addExercise(id, hip);
      await sessions.saveSet({ sessionExerciseId: a.id, entries: [{ side: 'LEFT', durationSeconds: 90 }, { side: 'RIGHT', durationSeconds: 90 }] });
      const b = await sessions.addExercise(id, plank);
      await sessions.saveSet({ sessionExerciseId: b.id, entries: [{ side: 'BOTH', durationSeconds: 60 }] });
    });
    const w = await metrics.weeklyMobilityMinutes('2026-10-05', 2);
    expect(w).toEqual([
      { weekStart: '2026-10-05', value: 4 },
      { weekStart: '2026-10-12', value: 0 },
    ]);
  });
});

describe('métricas por categoria', () => {
  it('soma séries, carga, tempo e distância por categoria e por semana', async () => {
    const jump = (await exercises.save({ name: 'T Salto', kind: 'STRENGTH', category: 'POWER', metricType: 'REPS' })).id;
    const sprint = (await exercises.save({ name: 'T Tiros', kind: 'CARDIO', category: 'HIIT', metricType: 'DURATION' })).id;
    const run = (await exercises.save({ name: 'T Corrida', kind: 'CARDIO', metricType: 'DURATION' })).id;
    const yoga = (await exercises.save({ name: 'T Yoga', kind: 'MOBILITY', category: 'MINDBODY', metricType: 'DURATION' })).id;
    await session('2026-10-06T10:00:00.000Z', async (id) => {
      const a = await sessions.addExercise(id, bench);
      await sessions.saveSet({ sessionExerciseId: a.id, entries: [{ side: 'BOTH', weightKg: 50, reps: 10 }] });
      await sessions.saveSet({ sessionExerciseId: a.id, type: 'WARMUP', entries: [{ side: 'BOTH', weightKg: 20, reps: 10 }] });
      const j = await sessions.addExercise(id, jump);
      await sessions.saveSet({ sessionExerciseId: j.id, entries: [{ side: 'BOTH', reps: 12 }] });
      const t = await sessions.addExercise(id, sprint);
      await sessions.saveSet({ sessionExerciseId: t.id, entries: [{ side: 'BOTH', durationSeconds: 300, distanceM: 1000 }] });
      const r = await sessions.addExercise(id, run);
      await sessions.saveSet({ sessionExerciseId: r.id, entries: [{ side: 'BOTH', durationSeconds: 1200, distanceM: 4000 }] });
      const y = await sessions.addExercise(id, yoga);
      await sessions.saveSet({ sessionExerciseId: y.id, entries: [{ side: 'BOTH', durationSeconds: 600 }] });
    });
    const week = await metrics.categoryWeek('2026-10-05');
    expect(week.map((w) => w.category)).toEqual(['STRENGTH', 'POWER', 'CARDIO', 'HIIT', 'MOBILITY', 'FLEXIBILITY', 'BALANCE', 'MINDBODY']);
    const by = Object.fromEntries(week.map((w) => [w.category, w]));
    expect(by['STRENGTH']).toMatchObject({ sessions: 1, exercises: 1, sets: 1, reps: 10, volumeKg: 500 }); // o aquecimento não conta
    expect(by['POWER']).toMatchObject({ sets: 1, reps: 12, volumeKg: 0 });
    expect(by['HIIT']).toMatchObject({ sets: 1, minutes: 5, distanceKm: 1 });
    expect(by['CARDIO']).toMatchObject({ minutes: 20, distanceKm: 4 });
    expect(by['MINDBODY']).toMatchObject({ minutes: 10 });
    expect(by['BALANCE']).toMatchObject({ sessions: 0, sets: 0, minutes: 0 });

    const sets = await metrics.weeklyCategory('2026-10-05', 2, null, 'sets');
    expect(sets).toEqual([{ weekStart: '2026-10-05', value: 5 }, { weekStart: '2026-10-12', value: 0 }]);
    expect((await metrics.weeklyCategory('2026-10-05', 1, 'HIIT', 'distanceKm'))[0].value).toBe(1);
    expect((await metrics.weeklyCategory('2026-10-05', 1, 'POWER', 'sets'))[0].value).toBe(1);
    expect((await metrics.weeklyCategory('2026-10-05', 1, null, 'minutes'))[0].value).toBe(35);
  });
});

describe('metricData (para o volume por músculo do spec)', () => {
  it('devolve séries com RIR e músculos do spec; lado esquerdo/direito conta uma vez', async () => {
    const unil = (await exercises.save({ name: 'T Uni2', kind: 'STRENGTH', metricType: 'WEIGHT_REPS', isUnilateral: true, primaryMuscleIds: [await muscle('Peito')] })).id;
    await session('2026-10-05T10:00:00.000Z', async (id) => {
      const a = await sessions.addExercise(id, bench);
      await sessions.saveSet({ sessionExerciseId: a.id, entries: [{ side: 'BOTH', weightKg: 50, reps: 8, rir: 2 }] });
      await sessions.saveSet({ sessionExerciseId: a.id, type: 'WARMUP', entries: [{ side: 'BOTH', weightKg: 20, reps: 10 }] });
      const u = await sessions.addExercise(id, unil);
      await sessions.saveSet({ sessionExerciseId: u.id, entries: [{ side: 'LEFT', weightKg: 10, reps: 8 }, { side: 'RIGHT', weightKg: 10, reps: 9 }] });
    });
    const d = await metrics.metricData(new Date('2026-10-01T00:00:00Z'), new Date('2026-10-31T00:00:00Z'));
    expect(d.sets).toHaveLength(3);
    expect(d.sets.filter((s) => s.type === 'working' && s.exerciseId === bench)[0]).toMatchObject({ rir: 2, weightKg: 50, reps: 8 });
    // «Ombros» antigo não tem correspondência; o nome vai junto para as exceções ao peso dos secundários.
    expect(d.exercises.get(bench)).toMatchObject({ id: bench, primaryMuscles: ['peito'], secondaryMuscles: ['triceps'] });
    expect(d.exercises.get(bench)?.name).toBeTruthy();
    expect(d.withoutPrimary).toEqual([]);
  });
});

describe('resumo da semana', () => {
  it('soma tempo ativo (sem pausas), sessões, exercícios distintos e séries de trabalho', async () => {
    await session('2026-10-05T10:00:00.000Z', async (id) => {
      const a = await sessions.addExercise(id, bench);
      await work(a.id, 3);
      await sessions.saveSet({ sessionExerciseId: a.id, type: 'WARMUP', entries: [{ side: 'BOTH', weightKg: 20, reps: 10 }] });
      const b = await sessions.addExercise(id, fly);
      await work(b.id, 2);
    });
    await session('2026-10-12T10:00:00.000Z', async (id) => {
      const a = await sessions.addExercise(id, bench);
      await work(a.id, 1);
    });
    const w = await metrics.weekSummary('2026-10-05');
    expect(w).toMatchObject({ sessions: 1, exercises: 2, sets: 5 });
    expect(w.activeSeconds).toBe(30 * 60);
    expect(await metrics.weekSummary('2026-09-28')).toEqual({ activeSeconds: 0, sessions: 0, exercises: 0, sets: 0 });
  });
});
