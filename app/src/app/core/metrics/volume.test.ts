import { describe, expect, it } from 'vitest';
import { SPEC_MUSCLES } from './muscles';
import { e1rm, MetricExercise, MetricProfile, MetricSet, recommend, sessionWarnings, weeklyVolume, weekProgress } from './volume';

const NOW = new Date('2026-10-10T12:00:00Z');
const day = (n: number) => new Date(NOW.getTime() - n * 86_400_000);
const ex = new Map<string, MetricExercise>([
  ['supino', { id: 'supino', primaryMuscles: ['peito'], secondaryMuscles: ['triceps', 'deltoide_anterior'] }],
  ['curl', { id: 'curl', primaryMuscles: ['biceps'], secondaryMuscles: ['antebracos'] }],
  ['quad', { id: 'quad', primaryMuscles: ['quadriceps'], secondaryMuscles: [] }],
  ['nada', { id: 'nada', primaryMuscles: [], secondaryMuscles: ['triceps'] }],
]);
const set = (p: Partial<MetricSet>): MetricSet => ({
  exerciseId: 'supino', weightKg: 50, reps: 8, rir: 2, type: 'working', performedAt: day(1), sessionId: 's1', ...p,
});
const many = (n: number, p: Partial<MetricSet>) => Array.from({ length: n }, () => set(p));
const vol = (sets: MetricSet[], missing?: (id: string) => void) => weeklyVolume(sets, ex, day(7), NOW, undefined, missing);
const profile = (p: Partial<MetricProfile>): MetricProfile => ({
  goal: 'hypertrophy', level: 'intermediate', birthYear: 1996, goalChangedAt: NOW, ...p,
});
const rec = (p: MetricProfile, sets: MetricSet[], muscle: string) =>
  recommend(p, sets, ex, SPEC_MUSCLES.map((m) => ({ id: m.id, label: m.label })), ['supino'], NOW).find((r) => r.muscle === muscle)!;

describe('volume semanal (aceitação do spec)', () => {
  it('1. supino + curl: contagem fracionária', () => {
    const v = vol([...many(3, {}), ...many(3, { exerciseId: 'curl', rir: 1 })]).sets;
    expect(v.get('peito')).toBe(3);
    expect(v.get('triceps')).toBe(1.5);
    expect(v.get('deltoide_anterior')).toBe(1.5);
    expect(v.get('biceps')).toBe(3);
    expect(v.get('antebracos')).toBe(1.5);
  });
  it('2. aquecimento não conta', () => expect(vol(many(3, { type: 'warmup' })).sets.size).toBe(0));
  it('3. 4 reps ou RIR 4 não contam', () => {
    expect(vol([set({ reps: 4 }), set({ rir: 4 })]).sets.size).toBe(0);
  });
  it('4. sem RIR e 8 reps conta', () => expect(vol([set({ rir: null })]).sets.get('peito')).toBe(1));
  it('5. e1RM', () => {
    expect(e1rm({ weightKg: 100, reps: 5, rir: 0 })).toBeCloseTo(116.667, 2);
    expect(e1rm({ weightKg: 100, reps: 8, rir: 3 })).toBeNull();
  });
  it('6. hipertrofia intermédio com 8 séries de peito → below, pede ~6', () => {
    const r = rec(profile({}), many(8, {}), 'peito');
    expect(r.status).toBe('below');
    expect(r.message).toContain('~6 séries');
  });
  it('7. manutenção < 60 anos, média anterior 15 → alvo 5', () => {
    const until = NOW;
    const prev: MetricSet[] = [];
    for (let w = 1; w <= 4; w++) prev.push(...many(15, { exerciseId: 'quad', performedAt: new Date(until.getTime() - (w * 7 - 3) * 86_400_000), sessionId: 'w' + w }));
    expect(rec(profile({ goal: 'maintenance', goalChangedAt: until }), prev, 'quadriceps').range.target).toBe(5);
  });
  it('8. manutenção 65 anos → 4/6/10', () => {
    const r = rec(profile({ goal: 'maintenance', birthYear: 2026 - 65 }), [], 'peito').range;
    expect([r.min, r.target, r.max]).toEqual([4, 6, 10]);
  });
  it('9. cut com volume anterior 16 e duas semanas de queda → alvo 12', () => {
    const goalChangedAt = day(21);
    const sets: MetricSet[] = [];
    // volume anterior: 16 séries/semana de peito nas 4 semanas antes de goalChangedAt (semanas 4..7 atrás)
    for (let w = 4; w <= 7; w++) sets.push(...many(16, { performedAt: day(w * 7 - 3), sessionId: 'p' + w, weightKg: 100, reps: 8, rir: 0 }));
    // e1RM do supino a cair >2% semana a semana nas últimas 3 semanas
    sets.push(set({ weightKg: 100, reps: 5, rir: 0, performedAt: day(24), sessionId: 'x0' }));
    sets.push(set({ weightKg: 95, reps: 5, rir: 0, performedAt: day(17), sessionId: 'x1' }));
    sets.push(set({ weightKg: 90, reps: 5, rir: 0, performedAt: day(10), sessionId: 'x2' }));
    sets.push(set({ weightKg: 85, reps: 5, rir: 0, performedAt: day(3), sessionId: 'x3' }));
    const r = rec(profile({ goal: 'cut', goalChangedAt }), sets, 'peito');
    expect(r.range.target).toBe(12);
    expect(r.message).toContain('reduzido 25%');
  });
  it('10. 12 séries diretas de quadríceps numa sessão → aviso', () => {
    const w = sessionWarnings(many(12, { exerciseId: 'quad' }), ex, { quadriceps: 'Quadríceps' });
    expect(w).toHaveLength(1);
    expect(w[0]).toContain('12 séries diretas de Quadríceps');
  });
  it('11. exercício sem músculos primários é ignorado e assinalado', () => {
    const missing: string[] = [];
    const v = vol([set({ exerciseId: 'nada' })], (id) => missing.push(id));
    expect(v.sets.size).toBe(0);
    expect(missing).toEqual(['nada']);
  });
});

describe('alvo da semana contra o progresso real', () => {
  // semana de segunda 5 out a domingo 11 out de 2026; «hoje» é quinta 8 out ao meio-dia (hora local)
  const monday = new Date(2026, 9, 5);
  const at = (d: number, h = 10) => new Date(2026, 9, 5 + d, h);
  const targets = new Map([['peito', 10], ['biceps', 6]]);
  const now = at(3, 12);

  it('soma o feito dia a dia, limita cada músculo ao seu alvo e deixa o futuro vazio', () => {
    const sets = [
      ...many(4, { performedAt: at(0) }),                       // seg: 4 peito (+2 tríceps/ombro que não têm alvo)
      ...many(3, { exerciseId: 'curl', performedAt: at(2) }),   // qua: 3 bíceps
      ...many(9, { performedAt: at(3, 9) }),                    // qui: +9 peito → 13, limitado a 10
      ...many(5, { performedAt: at(4) }),                       // sex (futuro, não conta)
    ];
    const w = weekProgress(sets, ex, targets, monday, now);
    expect(w.target).toBe(16);
    expect(w.today).toBe(3);
    expect(w.points.map((p) => p.real)).toEqual([0, 4, 4, 7, 13 /* peito limitado a 10 + bíceps 3 */, null, null, null]);
    expect(w.done).toBe(13);
    expect(w.points.map((p) => p.pace)).toEqual([0, 2.3, 4.6, 6.9, 9.1, 11.4, 13.7, 16].map((v) => Math.round(v * 10) / 10));
  });

  it('sem treinos fica a zero e o ritmo continua a subir até ao alvo', () => {
    const w = weekProgress([], ex, targets, monday, at(0, 8));
    expect(w.today).toBe(0);
    expect(w.done).toBe(0);
    expect(w.points[7].pace).toBe(16);
    expect(w.points[1].real).toBe(0);
    expect(w.points[2].real).toBeNull();
  });

  it('ignora aquecimentos e séries de outra semana', () => {
    const sets = [set({ performedAt: at(1), type: 'warmup' }), set({ performedAt: at(-2) }), set({ performedAt: at(8) })];
    expect(weekProgress(sets, ex, targets, monday, now).done).toBe(0);
  });
});
