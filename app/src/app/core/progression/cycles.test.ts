import { describe, expect, it } from 'vitest';
import { RULE } from './rules';
import { activeCycle, applyProposal, endDate, planFrom, positionOn, TEMPLATES, totalWeeks, weekReps, weekSets } from './cycles';
import { createTestDb } from '../../data/testing/test-db';
import { FixedClock } from '../util/clock';
import { SqliteCycleRepository } from '../../data/repositories/cycle.repository';

const cyc = (template: Parameters<typeof planFrom>[0], startDate = '2026-10-05') => ({ startDate, plan: planFrom(template), archivedAt: null, updatedAt: '2026-10-01' });

describe('templates', () => {
  it('cada template tem regra, semanas e mesociclos de 3 a 8 semanas', () => {
    for (const t of TEMPLATES) {
      expect(RULE[t.rule], t.id).toBeTruthy();
      for (const b of t.blocks) expect(b.weeks.length).toBeGreaterThanOrEqual(3);
      for (const b of t.blocks) expect(b.weeks.length).toBeLessThanOrEqual(8);
    }
  });
  it('hipertrofia por volume: +20% no máximo e descarga na 4.ª semana', () => {
    const p = planFrom('volume');
    expect(Math.max(...p.blocks[0].weeks.map((w) => w.sets))).toBeLessThanOrEqual(1.2);
    expect(p.blocks[0].weeks[3].type).toBe('deload');
  });
  it('planFrom devolve uma cópia', () => {
    const a = planFrom('linear');
    a.blocks[0].weeks[0].sets = 9;
    expect(planFrom('linear').blocks[0].weeks[0].sets).toBe(1);
  });
});

describe('posição no ciclo', () => {
  const c = cyc('volume');
  it('semana, bloco e próxima descarga', () => {
    const p = positionOn(c, '2026-10-15')!; // 2.ª semana
    expect(p).toMatchObject({ blockIndex: 0, weekIndex: 1, weekNumber: 2, totalWeeks: 12, weekStart: '2026-10-12', nextDeload: '2026-10-26', lastOfBlock: false });
    const q = positionOn(c, '2026-11-08')!; // domingo da 5.ª semana
    expect(q).toMatchObject({ blockIndex: 1, weekIndex: 0, weekNumber: 5 });
    expect(positionOn(c, '2026-10-04')).toBeNull();
    expect(positionOn(c, addWeeks('2026-10-05', 12))).toBeNull();
    expect(endDate(c)).toBe('2026-12-27');
    expect(totalWeeks(c.plan)).toBe(12);
  });
  it('ativo: o não arquivado que contém hoje', () => {
    expect(activeCycle([{ ...c, archivedAt: 'x' }], '2026-10-15')).toBeNull();
    expect(activeCycle([c], '2026-10-15')).toBe(c);
  });
  it('ondulatório e séries', () => {
    const w = planFrom('undulating').blocks[0].weeks[0];
    expect([0, 1, 2, 3].map((i) => weekReps(w, i))).toEqual([[12, 15], [8, 10], [4, 6], [12, 15]]);
    expect(weekSets({ type: 'deload', reps: null, sets: 0.5, rir: 3 }, 3)).toBe(2);
    expect(weekSets({ type: 'overload', reps: null, sets: 1.2, rir: 1 }, 4)).toBe(5);
    expect(weekSets({ type: 'deload', reps: null, sets: 0.5, rir: 3 }, 1)).toBe(1);
  });
  it('proposta de fim de mesociclo mexe só no bloco seguinte e não nas descargas', () => {
    const p = applyProposal(planFrom('volume'), 1, { kind: 'more-volume', factor: 1.1 });
    expect(p.blocks[1].weeks.map((w) => w.sets)).toEqual([1.1, 1.21, 1.32, 0.5]);
    expect(p.blocks[0].weeks[0].sets).toBe(1);
    const r = applyProposal(planFrom('undulating'), 1, { kind: 'range', reps: [5, 8] });
    expect(r.blocks[1].weeks[0]).toMatchObject({ reps: [5, 8] });
    expect(r.blocks[1].weeks[0].undulating).toBeUndefined();
  });
});

describe('repositório', () => {
  it('guarda e lê o plano', async () => {
    const t = await createTestDb();
    const repo = new SqliteCycleRepository(t.db, new FixedClock(new Date('2026-10-15T08:00:00Z')), t.deviceId);
    const c = await repo.save({ name: 'Teste', goal: 'strength', template: 'linear', startDate: '2026-10-05', plan: planFrom('linear') });
    expect((await repo.get(c.id))!.plan.blocks[2].weeks[0].reps).toEqual([3, 6]);
    await repo.archive(c.id);
    expect(await repo.list()).toEqual([]);
    expect(await repo.list({ includeArchived: true })).toHaveLength(1);
    await expect(repo.save({ name: ' ', goal: 'strength', template: 'linear', startDate: '2026-10-05', plan: planFrom('linear') })).rejects.toThrow();
  });
});

function addWeeks(d: string, n: number): string {
  const x = new Date(d + 'T12:00');
  x.setDate(x.getDate() + n * 7);
  return x.toISOString().slice(0, 10);
}
