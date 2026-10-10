import { describe, expect, it } from 'vitest';
import { joints, motionFor, MOTIONS } from './motion';

describe('animações', () => {
  it('todas as poses cabem na figura (0–100) e os membros mantêm o comprimento', () => {
    for (const m of Object.values(MOTIONS)) {
      for (const pose of [m.from, m.to]) {
        const j = joints(pose);
        for (const [x, y] of [j.ankle, j.knee, j.hip, j.neck, j.head, j.elbow, j.wrist]) {
          expect(x, `${m.id} x`).toBeGreaterThanOrEqual(0);
          expect(x, `${m.id} x`).toBeLessThanOrEqual(100);
          expect(y, `${m.id} y`).toBeGreaterThanOrEqual(0);
          expect(y, `${m.id} y`).toBeLessThanOrEqual(100);
        }
        const d = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[1] - b[1]);
        expect(d(j.ankle, j.knee)).toBeCloseTo(17, 5);
        expect(d(j.hip, j.neck)).toBeCloseTo(24, 5);
      }
    }
  });

  it('escolhe o padrão pelo nome e, sem pista no nome, pelo músculo principal', () => {
    expect(motionFor('Supino plano (halteres)', ['peito'])?.id).toBe('bench');
    expect(motionFor('Puxada à frente', ['costas_dorsais'])?.id).toBe('pull');
    expect(motionFor('Remada curvada', ['costas_dorsais', 'costas_superiores'])?.id).toBe('row');
    expect(motionFor('Agachamento búlgaro', ['quadriceps'])?.id).toBe('lunge');
    expect(motionFor('Peso morto romeno', ['isquiotibiais'])?.id).toBe('hinge');
    expect(motionFor('Elevação lateral', ['deltoide_lateral'])?.id).toBe('lateral');
    expect(motionFor('Curl martelo', ['biceps'])?.id).toBe('curl');
    expect(motionFor('Extensão de tríceps na polia', ['triceps'])?.id).toBe('triceps');
    expect(motionFor('Hip thrust', ['gluteos'])?.id).toBe('hipthrust');
    expect(motionFor('Exercício esquisito', ['gemeos'])?.id).toBe('calf');
    expect(motionFor('Exercício esquisito', [])).toBeNull();
    expect(motionFor('Agachamento', ['quadriceps'], 'MOBILITY')).toBeNull();
    expect(motionFor('Corrida', [], 'CARDIO')).toBeNull();
  });
});
