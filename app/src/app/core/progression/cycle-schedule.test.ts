import { describe, expect, it } from 'vitest';
import { desiredDays, diffSchedule, frequencyWarnings, slotOfDay, conflictKey } from './cycle-schedule';
import { planFrom } from './cycles';
import { ids } from '../util/uuid';
import type { ScheduledWorkout } from '../../data/models/scheduled';
import type { CycleScheduledRow } from '../../data/repositories/scheduled.repository';

const A = 'a0000000-0000-5000-8000-000000000001', B = 'b0000000-0000-5000-8000-000000000002';
const cycle = () => {
  const plan = planFrom('volume');
  for (const b of plan.blocks) b.pattern = [A, null, B, null, A, null, null];
  return { id: 'c1', startDate: '2026-10-05', plan };
};
const sw = (date: string, templateId: string, cycleId: string | null = null, status: ScheduledWorkout['status'] = 'PLANNED', id = `m-${date}`): ScheduledWorkout =>
  ({ id, date, templateId, templateName: templateId === A ? 'Push' : 'Pull', status, cycleId });
const row = (d: { id: string; date: string; templateId: string }, cycleId: string | null, deleted = false, status: CycleScheduledRow['status'] = 'PLANNED'): CycleScheduledRow =>
  ({ id: d.id, date: d.date, templateId: d.templateId, status, cycleId, deleted });

describe('semana-tipo → Planeados', () => {
  it('cria os dias de hoje em diante, com exceção de uma semana', () => {
    const c = cycle();
    c.plan.blocks[0].weeks[3].days = [A, null, null, null, null, null, null]; // descarga com 1 dia
    const d = desiredDays(c, '2026-10-15');
    expect(d[0]).toMatchObject({ date: '2026-10-16', templateId: A });
    expect(d.filter((x) => x.date >= '2026-10-26' && x.date <= '2026-11-01')).toHaveLength(1);
    expect(d.length).toBe(1 + 3 + 1 + 8 * 3); // sexta desta semana, semana 3 (3), semana 4 (1) e as 8 do resto
    expect(d[0].id).toBe(ids.cycleScheduled('c1', '2026-10-16', A));
  });
  it('não duplica, respeita o que apagaste ou moveste e tira o que saiu da semana-tipo', () => {
    const c = cycle();
    const d = desiredDays(c, '2026-10-15');
    const state = [row(d[0], 'c1'), row(d[1], 'c1', true), row(d[2], null), { id: 'old', date: '2026-10-20', templateId: B, status: 'PLANNED' as const, cycleId: 'c1', deleted: false }];
    const diff = diffSchedule('c1', d, state, [], {}, '2026-10-15');
    expect(diff.create.map((x) => x.id)).not.toContain(d[0].id);
    expect(diff.create.map((x) => x.id)).not.toContain(d[1].id);
    expect(diff.create.map((x) => x.id)).not.toContain(d[2].id);
    expect(diff.create).toHaveLength(d.length - 3);
    expect(diff.remove).toEqual(['old']);
  });
  it('conflito com planeado teu: pergunta; depois cumpre a escolha', () => {
    const c = cycle();
    const d = desiredDays(c, '2026-10-15');
    const mine = [sw(d[0].date, B)];
    const ask = diffSchedule('c1', d, [], mine, {}, '2026-10-15');
    expect(ask.conflicts).toHaveLength(1);
    expect(ask.create.map((x) => x.date)).not.toContain(d[0].date);
    const key = conflictKey(d[0].date, d[0].templateId);
    expect(diffSchedule('c1', d, [], mine, { [key]: 'mine' }, '2026-10-15').create.map((x) => x.date)).not.toContain(d[0].date);
    const cyc = diffSchedule('c1', d, [], mine, { [key]: 'cycle' }, '2026-10-15');
    expect(cyc.removeMine).toEqual([mine[0].id]);
    expect(cyc.create.map((x) => x.date)).toContain(d[0].date);
    expect(diffSchedule('c1', d, [], mine, { [key]: 'both' }, '2026-10-15').removeMine).toEqual([]);
  });
  it('o mesmo treino já planeado à mão não é conflito nem duplica', () => {
    const d = desiredDays(cycle(), '2026-10-15');
    const diff = diffSchedule('c1', d, [], [sw(d[0].date, A)], {}, '2026-10-15');
    expect(diff.conflicts).toEqual([]);
    expect(diff.create.map((x) => x.date)).not.toContain(d[0].date);
  });
  it('frequência e ondulatório', () => {
    const muscles = new Map([[A, ['peito', 'triceps']], [B, ['costas_dorsais', 'biceps']]]);
    expect(frequencyWarnings([A, null, B, null, A, null, null], muscles)).toEqual(['costas_dorsais']);
    expect(slotOfDay([A, null, B, null, A, null, null], 4)).toBe(2);
    expect(slotOfDay([A, null, B, null, A, null, null], 1)).toBeNull();
  });
});
