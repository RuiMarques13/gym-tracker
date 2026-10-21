import { describe, expect, it } from 'vitest';
import { INDIRECT_OVERRIDES } from '../metrics/indirect';
import { E1RM_MAX_REPS } from '../metrics/one-rm';
import { GROUP_DEFAULTS } from '../session/group-format';
import { SORENESS_ADJUST } from '../metrics/recovery';
import { VOLUME_RULES } from '../metrics/volume-rules';
import { SETTINGS } from '../settings/setting-registry';
import { AREA_LABEL, REF, RULE, RULES } from './rules';
import { SUGGEST } from './suggestions';

/**
 * Regras e fontes: cada número da app tem marca («estudo» = `source`, ou «escolha da app» = `app»), e o texto que se
 * mostra no ecrã Regras e fontes bate certo com o valor que o código usa.
 */
describe('catálogo de regras', () => {
  it('chaves únicas, área conhecida, título e valor preenchidos', () => {
    expect(new Set(RULES.map((r) => r.key)).size).toBe(RULES.length);
    for (const r of RULES) {
      expect(AREA_LABEL[r.area], r.key).toBeTruthy();
      expect(r.title.trim(), r.key).not.toBe('');
      expect(r.value.trim(), r.key).not.toBe('');
    }
  });

  it('regras marcadas como estudo têm pelo menos uma fonte', () => {
    for (const r of RULES) if (r.mark === 'source') expect(r.refs.length, r.key).toBeGreaterThan(0);
  });

  it('todas as fontes têm nome e ligação https', () => {
    for (const [k, ref] of Object.entries(REF)) {
      expect(ref.label.trim(), k).not.toBe('');
      expect(ref.url, k).toMatch(/^https:\/\//);
    }
  });

  it('a definição de cada regra editável existe', () => {
    for (const r of RULES) if (r.setting) expect(r.setting in SETTINGS, `${r.key} → ${r.setting}`).toBe(true);
  });

  it('cada área tem pelo menos uma regra', () => {
    for (const area of Object.keys(AREA_LABEL)) expect(RULES.some((r) => r.area === area), area).toBe(true);
  });
});

/** O texto diz o que o código faz: se mudares um número, muda também a regra. */
describe('texto das regras = valores do código', () => {
  const says = (key: string, ...parts: (string | number)[]) => {
    for (const p of parts) expect(RULE[key].value, `${key}: «${p}»`).toContain(String(p).replace('.', ','));
  };

  it('volume da hipertrofia por nível', () => {
    const h = VOLUME_RULES.goals.hypertrophy;
    says('volume.hypertrophy',
      `${h.beginner.min}–${h.beginner.max} (alvo ${h.beginner.target})`,
      `${h.intermediate.min}–${h.intermediate.max} (alvo ${h.intermediate.target})`,
      `${h.advanced.min}–${h.advanced.max} (alvo ${h.advanced.target})`);
    says('volume.advancedMax', h.advanced.max);
  });

  it('reserva alvo por nível', () => {
    const h = VOLUME_RULES.goals.hypertrophy;
    says('volume.rir', `${h.beginner.rir[0]}–${h.beginner.rir[1]}`, `${h.intermediate.rir[0]}–${h.intermediate.rir[1]}`, `${h.advanced.rir[0]}–${h.advanced.rir[1]}`);
  });

  it('séries efetivas, secundárias e por sessão', () => {
    const e = VOLUME_RULES.effective_set;
    says('volume.effective', `${e.reps_min}–${e.reps_max}`, `até ${e.rir_max}`);
    says('volume.indirect', VOLUME_RULES.indirect_set_weight);
    for (const o of INDIRECT_OVERRIDES) {
      const label = o.muscle === 'isquiotibiais' ? 'isquiotibiais contam' : 'adutores contam';
      says(o.rule, `${label} ${o.weight}`);
    }
    expect(SETTINGS.secondaryMuscleWeight.defaultValue).toBe(VOLUME_RULES.indirect_set_weight);
    says('volume.perSession', VOLUME_RULES.max_direct_sets_per_session);
  });

  it('manutenção e definição', () => {
    const m = VOLUME_RULES.goals.maintenance;
    says('volume.maintenance', `${m.under_60.min}–${m.under_60.max}`, `${m['60_plus'].min}–${m['60_plus'].max}`, `alvo ${m['60_plus'].target}`);
    expect(m.under_60.target_ratio_of_previous).toBeCloseTo(1 / 3, 1);
    const c = VOLUME_RULES.goals.cut.any;
    says('volume.cut', `${c.min} e ${c.max}`, `${c.on_performance_drop_weeks} semanas`, `${c.volume_reduction * 100}%`);
  });

  it('recuperação: ajuste pela dor', () => {
    const fmt = (h: number) => (h > 0 ? `+${h} h` : h < 0 ? `−${-h} h` : '0');
    says('recovery.soreness', ...Object.values(SORENESS_ADJUST).map(fmt));
  });

  it('formatos de grupo: valores por defeito', () => {
    const d = GROUP_DEFAULTS;
    says('groups.tabata', `${d.TABATA.workSeconds} s de trabalho`, `${d.TABATA.restSeconds} s de descanso`, `${d.TABATA.rounds} rondas`);
    says('groups.defaults', `EMOM ${d.EMOM.rounds} min`, `AMRAP ${d.AMRAP.durationSeconds! / 60} min`,
      `intervalos ${d.INTERVALS.workSeconds} s / ${d.INTERVALS.restSeconds} s × ${d.INTERVALS.rounds}`,
      `circuito ${d.CIRCUIT.rounds} voltas com ${d.CIRCUIT.roundRestSeconds} s`);
  });

  it('sequência semanal', () => {
    says('streak.week', `pelo menos ${SETTINGS.streakSessionsPerWeek.defaultValue} dias`);
  });

  it('recordes: mesma janela do 1RM estimado', () => {
    says('records.what', `até ${E1RM_MAX_REPS} repetições`);
  });

  it('janelas das sugestões', () => {
    says('suggest.windows', `${SUGGEST.historyDays} dias`, `últimos ${SUGGEST.recentDays} dias`, `máximo ${SUGGEST.homeMax} cartões`, `média de ${SUGGEST.volumeAvgWeeks}`);
  });
});
