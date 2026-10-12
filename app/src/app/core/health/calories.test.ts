import { describe, expect, it } from 'vitest';
import { cardioActivity, cardioMet, estimateActiveKcal, estimateFromMet, keytelKcalPerMin, walkingMet } from './calories';
import { energyWithin } from './health.logic';

describe('calorias estimadas', () => {
  it('MET da marcha sobe com a velocidade (ACSM)', () => {
    expect(walkingMet(3.9)).toBeCloseTo(2.86, 1);
    expect(walkingMet(5.5)).toBeGreaterThan(walkingMet(3.9));
  });

  it('reconhece a atividade pelo nome', () => {
    expect(cardioActivity('Caminhada')).toBe('walk');
    expect(cardioActivity('Corrida na passadeira')).toBe('run');
    expect(cardioActivity('Bicicleta estática')).toBe('bike');
    expect(cardioActivity('Elíptica')).toBe('elliptical');
    expect(cardioActivity('Qualquer coisa')).toBe('other');
    expect(cardioMet('Corrida', 10)).toBeGreaterThan(cardioMet('Caminhada', 5));
  });

  it('por MET: só conta o que passa do repouso e precisa do peso', () => {
    expect(estimateFromMet(null, [{ seconds: 3600, met: 5 }])).toBeNull();
    // 5 MET durante 1 h com 80 kg → (5−1)·80 = 320
    expect(estimateFromMet(80, [{ seconds: 3600, met: 5 }])).toBe(320);
    expect(estimateFromMet(80, [{ seconds: 3600, met: 1 }])).toBe(0);
  });

  it('Keytel: mais FC, mais gasto; homem ≠ mulher', () => {
    const m = { weightKg: 75, age: 35, sex: 'M' as const };
    expect(keytelKcalPerMin(130, m)).toBeGreaterThan(keytelKcalPerMin(100, m));
    expect(keytelKcalPerMin(120, m)).toBeGreaterThan(keytelKcalPerMin(120, { ...m, sex: 'F' }));
  });

  it('usa a FC média quando há perfil completo, senão os MET', () => {
    const body = { weightKg: 75, heightCm: 178, age: 35, sex: 'M' as const };
    const seg = [{ seconds: 1200, met: 3 }];
    const hr = estimateActiveKcal({ body, totalSeconds: 1200, avgHr: 111, segments: seg });
    expect(hr?.basis).toBe('heart-rate');
    const met = estimateActiveKcal({ body: { ...body, sex: null }, totalSeconds: 1200, avgHr: 111, segments: seg });
    expect(met?.basis).toBe('met');
    expect(estimateActiveKcal({ body: { ...body, weightKg: null }, totalSeconds: 1200, segments: seg })).toBeNull();
  });
});

describe('energyWithin', () => {
  const T = (m: number) => new Date(Date.UTC(2026, 0, 1, 10, m)).toISOString();
  it('conta a parte proporcional dos registos que ultrapassam o treino', () => {
    // registo de 10 min com 100 kcal; só metade cai dentro do treino (10:05–10:20)
    const r = [{ startDate: T(0), endDate: T(10), value: 100 }, { startDate: T(10), endDate: T(20), value: 100 }, { startDate: T(20), endDate: T(30), value: 100 }];
    expect(energyWithin(r, T(5), T(20))).toBeCloseTo(50 + 100, 5);
  });
  it('ignora registos fora do intervalo e valores inválidos', () => {
    expect(energyWithin([{ startDate: T(40), endDate: T(50), value: 100 }, { startDate: T(0), endDate: T(10), value: NaN }], T(0), T(30))).toBe(0);
    expect(energyWithin([], T(0), T(30))).toBe(0);
  });
});
