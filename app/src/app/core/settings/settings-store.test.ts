import { describe, expect, it } from 'vitest';
import { createTestDb } from '../testing/test-db';
import { FixedClock } from '../util/clock';
import { ids } from '../util/uuid';
import { assertRegistryValid, SETTINGS } from './setting-registry';
import { SettingsStore } from './settings-store';

const clock = () => new FixedClock(new Date('2026-10-10T08:00:00.000Z'));

describe('registo de definições', () => {
  it('não tem chaves repetidas e os valores por defeito são válidos', () => {
    expect(() => assertRegistryValid()).not.toThrow();
  });
});

describe('SettingsStore', () => {
  it('devolve o valor por defeito quando nada foi gravado', async () => {
    const { db, deviceId } = await createTestDb();
    const store = new SettingsStore(db, clock(), deviceId);
    expect(await store.get(SETTINGS.secondaryMuscleWeight)).toBe(0.5);
    expect(await store.get(SETTINGS.theme)).toBe('system');
  });

  it('grava e lê, atualizando updated_at e device_id', async () => {
    const { db, deviceId } = await createTestDb();
    const c = clock();
    const store = new SettingsStore(db, c, deviceId);
    await store.set(SETTINGS.defaultRestSeconds, 120);
    c.advance(60_000);
    await store.set(SETTINGS.defaultRestSeconds, 75);
    expect(await store.get(SETTINGS.defaultRestSeconds)).toBe(75);
    const rows = await db.query<Record<string, unknown>>('SELECT * FROM setting');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ scope: 'ACCOUNT', scope_ref: null, updated_at: '2026-10-10T08:01:00.000Z', device_id: deviceId });
  });

  it('rejeita valores inválidos', async () => {
    const { db, deviceId } = await createTestDb();
    const store = new SettingsStore(db, clock(), deviceId);
    await expect(store.set(SETTINGS.secondaryMuscleWeight, 3)).rejects.toThrow();
    await expect(store.set(SETTINGS.theme, 'pink' as never)).rejects.toThrow();
  });

  it('definições de conta têm o mesmo id em dispositivos diferentes', async () => {
    const a = await createTestDb();
    const b = await createTestDb();
    await new SettingsStore(a.db, clock(), a.deviceId).set(SETTINGS.weightUnit, 'kg');
    await new SettingsStore(b.db, clock(), b.deviceId).set(SETTINGS.weightUnit, 'lb');
    const idA = (await a.db.query<{ id: string }>('SELECT id FROM setting'))[0].id;
    const idB = (await b.db.query<{ id: string }>('SELECT id FROM setting'))[0].id;
    expect(idA).toBe(idB);
    expect(idA).toBe(ids.setting('ACCOUNT', null, 'units.weight'));
  });

  it('definições de dispositivo ficam presas ao device_id', async () => {
    const { db, deviceId } = await createTestDb();
    await new SettingsStore(db, clock(), deviceId).set(SETTINGS.theme, 'dark');
    const other = new SettingsStore(db, clock(), 'outro-dispositivo');
    expect(await other.get(SETTINGS.theme)).toBe('system');
    expect(await new SettingsStore(db, clock(), deviceId).get(SETTINGS.theme)).toBe('dark');
  });

  it('layout depende do formato de ecrã', async () => {
    const { db, deviceId } = await createTestDb();
    const store = new SettingsStore(db, clock(), deviceId);
    await store.set(SETTINGS.homeWidgets, ['weekly-sets'], 'desktop');
    expect(await store.get(SETTINGS.homeWidgets, 'desktop')).toEqual(['weekly-sets']);
    expect(await store.get(SETTINGS.homeWidgets, 'phone')).toEqual(SETTINGS.homeWidgets.defaultValue);
  });

  it('reset volta ao defeito com soft delete', async () => {
    const { db, deviceId } = await createTestDb();
    const store = new SettingsStore(db, clock(), deviceId);
    await store.set(SETTINGS.timerSound, false);
    await store.reset(SETTINGS.timerSound);
    expect(await store.get(SETTINGS.timerSound)).toBe(true);
    const row = (await db.query<{ deleted_at: string | null }>('SELECT deleted_at FROM setting'))[0];
    expect(row.deleted_at).not.toBeNull();
  });

  it('valor corrompido ou de versão antiga sem migração usa o defeito', async () => {
    const { db, deviceId } = await createTestDb();
    const store = new SettingsStore(db, clock(), deviceId);
    expect(store.decode(SETTINGS.defaultRestSeconds, 'não é json')).toBe(90);
    expect(store.decode(SETTINGS.defaultRestSeconds, '{"v":1,"value":"abc"}')).toBe(90);
    expect(store.decode({ ...SETTINGS.defaultRestSeconds, schemaVersion: 2 }, '{"v":1,"value":60}')).toBe(90);
    const migrating = { ...SETTINGS.defaultRestSeconds, schemaVersion: 2, migrate: (v: unknown) => (v as number) * 2 };
    expect(store.decode(migrating, '{"v":1,"value":60}')).toBe(120);
  });
});
