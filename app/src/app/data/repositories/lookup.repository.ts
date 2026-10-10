import type { DbAdapter } from '../../core/db/db-adapter';
import type { Region } from '../models/enums';

export interface MuscleGroup {
  id: string;
  name: string;
  region: Region | null;
}

export interface NamedItem {
  id: string;
  name: string;
}

/** Listas de apoio aos formulários e filtros (músculos, equipamentos, áreas de mobilidade). */
export interface LookupRepository {
  muscles(): Promise<MuscleGroup[]>;
  equipment(): Promise<NamedItem[]>;
  mobilityAreas(): Promise<NamedItem[]>;
}

const REGION_ORDER = "CASE region WHEN 'UPPER' THEN 1 WHEN 'LOWER' THEN 2 WHEN 'CORE' THEN 3 ELSE 4 END";

export class SqliteLookupRepository implements LookupRepository {
  constructor(private readonly db: DbAdapter) {}

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
