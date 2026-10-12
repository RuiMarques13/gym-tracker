import type { DbAdapter } from '../../core/db/db-adapter';
import { fold } from './sqlite/sqlite-exercise.repository';
import type { Clock } from '../../core/util/clock';
import { ids } from '../../core/util/uuid';
import type { Region } from '../models/enums';

export interface MuscleGroup {
  id: string;
  name: string;
  region: Region | null;
}

export class EquipmentError extends Error {}

export interface NamedItem {
  id: string;
  name: string;
}

/** Listas de apoio aos formulários e filtros (músculos, equipamentos, áreas de mobilidade). */
export interface LookupRepository {
  muscles(): Promise<MuscleGroup[]>;
  equipment(): Promise<NamedItem[]>;
  /** Cria um equipamento teu (ou reativa o que apagaste com o mesmo nome). Nomes repetidos devolvem o que já existe. */
  addEquipment(name: string): Promise<NamedItem>;
  mobilityAreas(): Promise<NamedItem[]>;
}

const REGION_ORDER = "CASE region WHEN 'UPPER' THEN 1 WHEN 'LOWER' THEN 2 WHEN 'CORE' THEN 3 ELSE 4 END";

export class SqliteLookupRepository implements LookupRepository {
  constructor(
    private readonly db: DbAdapter,
    private readonly clock?: Clock,
    private readonly deviceId?: string,
  ) {}

  async addEquipment(rawName: string): Promise<NamedItem> {
    if (!this.clock || !this.deviceId) throw new Error('Repositório só de leitura');
    const name = rawName.replace(/\s+/g, ' ').trim();
    if (!name) throw new EquipmentError('Escreve o nome do equipamento.');
    if (name.length > 40) throw new EquipmentError('O nome do equipamento é demasiado longo (máximo 40 letras).');
    const key = fold(name);
    const existing = (await this.equipment()).find((e) => fold(e.name) === key);
    if (existing) return existing;
    // O ID deriva do nome, por isso o mesmo equipamento criado em dois dispositivos é um só depois do sync.
    const id = ids.equipment(`custom:${key}`);
    const now = this.clock.nowIso();
    await this.db.run(
      `INSERT INTO equipment (id, name, updated_at, deleted_at, device_id) VALUES (?, ?, ?, NULL, ?)
       ON CONFLICT(id) DO UPDATE SET name = excluded.name, deleted_at = NULL,
         updated_at = excluded.updated_at, device_id = excluded.device_id`,
      [id, name, now, this.deviceId],
    );
    return { id, name };
  }

  muscles(): Promise<MuscleGroup[]> {
    return this.db.query<MuscleGroup>(
      `SELECT id, name, region FROM muscle_group WHERE deleted_at IS NULL ORDER BY ${REGION_ORDER}, name`,
    );
  }

  equipment(): Promise<NamedItem[]> {
    return this.db.query<NamedItem>('SELECT id, name FROM equipment WHERE deleted_at IS NULL ORDER BY name');
  }

  mobilityAreas(): Promise<NamedItem[]> {
    return this.db.query<NamedItem>('SELECT id, name FROM mobility_area WHERE deleted_at IS NULL ORDER BY name');
  }
}
