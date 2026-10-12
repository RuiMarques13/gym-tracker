import { describe, expect, it } from 'vitest';
import { SEED } from '../../core/seed/seed.generated';
import { loadSeed } from '../../core/seed/seed-loader';
import { createTestDb } from '../../core/testing/test-db';
import { FixedClock } from '../../core/util/clock';
import { EquipmentError, SqliteLookupRepository } from './lookup.repository';
import { ids } from '../../core/util/uuid';
import { toastHtml } from '../../core/ui/toast-text';

describe('SqliteLookupRepository', () => {
  it('lista músculos por região e equipamentos/áreas por nome', async () => {
    const { db, deviceId } = await createTestDb();
    await loadSeed(db, SEED, deviceId);
    const repo = new SqliteLookupRepository(db);
    const muscles = await repo.muscles();
    expect(muscles).toHaveLength(SEED.muscles.length);
    expect(muscles[0].region).toBe('UPPER');
    expect(muscles.at(-1)?.region).toBe('CORE');
    const equipment = (await repo.equipment()).map((e) => e.name);
    expect(equipment).toContain('Passadeira');
    expect((await repo.mobilityAreas()).map((a) => a.name)[0]).toBe('Anca');
  });

  it('adiciona equipamentos teus: sem repetidos, com ID estável e a reativar o que apagaste', async () => {
    const { db, deviceId } = await createTestDb();
    await loadSeed(db, SEED, deviceId);
    const repo = new SqliteLookupRepository(db, new FixedClock(new Date('2026-10-12T10:00:00Z')), deviceId);
    const bosu = await repo.addEquipment('  Bosu   ball ');
    expect(bosu).toEqual({ id: ids.equipment('custom:bosu ball'), name: 'Bosu ball' });
    expect((await repo.equipment()).map((e) => e.name)).toContain('Bosu ball');
    // o mesmo nome (com acentos/maiúsculas diferentes) não cria outro
    expect(await repo.addEquipment('BOSU BALL')).toEqual(bosu);
    // um equipamento da lista de origem também não se repete
    expect((await repo.addEquipment('máquina')).name).toBe('Máquina');
    expect((await repo.equipment()).filter((e) => e.name === 'Máquina')).toHaveLength(1);
    // apagado e criado outra vez volta com o mesmo ID
    await db.run('UPDATE equipment SET deleted_at = ? WHERE id = ?', ['2026-10-12T11:00:00Z', bosu.id]);
    expect((await repo.equipment()).map((e) => e.id)).not.toContain(bosu.id);
    expect(await repo.addEquipment('Bosu ball')).toEqual(bosu);
    expect((await repo.equipment()).map((e) => e.id)).toContain(bosu.id);
    await expect(repo.addEquipment('   ')).rejects.toBeInstanceOf(EquipmentError);
    await expect(repo.addEquipment('x'.repeat(41))).rejects.toBeInstanceOf(EquipmentError);
  });
});

describe('texto dos avisos', () => {
  it('põe a negrito o que está entre «» e escapa o resto', () => {
    expect(toastHtml('«Supino» criado.')).toBe('<b>Supino</b> criado.');
    expect(toastHtml('Criada «A» e «B».')).toBe('Criada <b>A</b> e <b>B</b>.');
    expect(toastHtml('«<img src=x onerror=1>» & co')).toBe('<b>&lt;img src=x onerror=1&gt;</b> &amp; co');
    expect(toastHtml('Alterações guardadas.')).toBe('Alterações guardadas.');
  });
});
