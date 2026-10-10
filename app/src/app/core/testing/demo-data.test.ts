import { writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { MIGRATIONS } from '../db/migrations';
import { exportData, parseExport } from '../merge/merge';
import { generateDemo } from './demo-data';
import { createTestDb } from './test-db';

describe('dados de demonstração (12 semanas)', () => {
  it('gera sessões válidas e exportáveis', async () => {
    const { db, deviceId } = await createTestDb();
    const { summary, clock } = await generateDemo(db, deviceId);
    expect(summary.sessions).toBeGreaterThanOrEqual(30);
    expect(summary.sessions).toBeLessThanOrEqual(46);
    const [{ n }] = await db.query<{ n: number }>('SELECT COUNT(*) AS n FROM session WHERE ended_at IS NOT NULL AND deleted_at IS NULL');
    expect(n).toBe(summary.sessions);
    const schemaVersion = MIGRATIONS.at(-1)!.version;
    const file = await exportData(db, { schemaVersion, deviceId, nowIso: clock.nowIso() });
    const text = JSON.stringify(file);
    expect(() => parseExport(text, schemaVersion)).not.toThrow();
    if (process.env['DEMO_OUT']) writeFileSync(process.env['DEMO_OUT'], text);
  }, 60000);
});
