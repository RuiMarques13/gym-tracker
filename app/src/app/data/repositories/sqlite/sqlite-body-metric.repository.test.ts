import { beforeEach, describe, expect, it } from 'vitest';
import { createTestDb } from '../../../core/testing/test-db';
import { FixedClock } from '../../../core/util/clock';
import { BodyMetricError } from '../../models/body';
import { SqliteBodyMetricRepository } from '../body-metric.repository';

let repo: SqliteBodyMetricRepository;
let clock: FixedClock;
beforeEach(async () => {
  const t = await createTestDb();
  clock = new FixedClock(new Date('2026-10-10T08:00:00.000Z'));
  repo = new SqliteBodyMetricRepository(t.db, clock, t.deviceId);
});

describe('SqliteBodyMetricRepository', () => {
  it('guarda a série temporal e devolve a mais recente de cada tipo', async () => {
    await repo.add({ date: '2026-09-01', type: 'WEIGHT_KG', value: 82 });
    await repo.add({ date: '2026-10-01', type: 'WEIGHT_KG', value: 80.456 });
    await repo.add({ date: '2026-10-01', type: 'BODY_FAT_PCT', value: 18 });
    expect((await repo.list('WEIGHT_KG')).map((m) => [m.date, m.value])).toEqual([['2026-10-01', 80.46], ['2026-09-01', 82]]);
    expect((await repo.latest()).map((m) => [m.type, m.value])).toEqual([['BODY_FAT_PCT', 18], ['WEIGHT_KG', 80.46]]);
  });

  it('duas medições no mesmo dia: vale a última registada; apagar tira da lista', async () => {
    await repo.add({ date: '2026-10-01', type: 'WEIGHT_KG', value: 80 });
    clock.advance(1000);
    const b = await repo.add({ date: '2026-10-01', type: 'WEIGHT_KG', value: 79.5 });
    expect((await repo.latest())[0].value).toBe(79.5);
    await repo.remove(b.id);
    expect((await repo.latest())[0].value).toBe(80);
  });

  it('valida data, valor e limites dos tipos conhecidos; aceita outros tipos', async () => {
    await expect(repo.add({ date: '1/10', type: 'WEIGHT_KG', value: 80 })).rejects.toThrow(BodyMetricError);
    await expect(repo.add({ date: '2026-10-01', type: 'WEIGHT_KG', value: 8 })).rejects.toThrow(/entre/);
    await expect(repo.add({ date: '2026-10-01', type: 'WEIGHT_KG', value: NaN })).rejects.toThrow(/valor/);
    await expect(repo.add({ date: '2026-10-01', type: 'WAIST_CM', value: 85 })).resolves.toBeTruthy();
  });
});
