import { describe, expect, it } from 'vitest';
import { detectStagnation } from '../../core/progression/stagnation';
import { sessionsOf } from '../../services/progression/progression.service';
import { SqliteMetricsRepository } from '../repositories/metrics.repository';
import { generateDemo, STALL_KEY } from './demo-data';
import { createTestDb } from './test-db';
import { ids } from '../../core/util/uuid';

describe('demo: estagnação', () => {
  it('o exercício parado aparece como estagnado', async () => {
    const { db, deviceId } = await createTestDb();
    await generateDemo(db, deviceId);
    const md = await new SqliteMetricsRepository(db).metricData(new Date('2026-01-01'), new Date('2027-01-01'));
    const working = md.sets.filter((s) => s.type === 'working');
    const stalled = detectStagnation(sessionsOf(working, ids.libraryExercise(STALL_KEY)), 3);
    expect(stalled.stagnated).toBe(true);
  }, 60000);
});
