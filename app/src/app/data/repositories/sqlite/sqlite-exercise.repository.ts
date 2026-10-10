import type { DbAdapter, SqlValue } from '../../../core/db/db-adapter';
import type { Kind, MetricType, MovementType, Region } from '../../models/enums';
import type { Exercise, ExerciseFilter } from '../../models/exercise';
import type { ExerciseRepository } from '../exercise.repository';

interface ExerciseRow {
  id: string;
  name: string;
  kind: Kind;
  metric_type: MetricType;
  is_unilateral: number;
  is_isometric: number;
  region: Region | null;
  movement_type: MovementType | null;
  equipment_id: string | null;
  equipment_name: string | null;
  default_rest_seconds: number | null;
  notes: string | null;
  video_url: string | null;
  archived_at: string | null;
  updated_at: string;
}

const placeholders = (n: number) => Array(n).fill('?').join(', ');

/** Remove acentos e passa a minúsculas, para a pesquisa ignorar «é» vs «e». */
export function fold(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

export class SqliteExerciseRepository implements ExerciseRepository {
  constructor(private readonly db: DbAdapter) {}

  async list(filter: ExerciseFilter = {}): Promise<Exercise[]> {
    const where: string[] = ['e.deleted_at IS NULL'];
    const params: SqlValue[] = [];

    if (!filter.includeArchived) where.push('e.archived_at IS NULL');
    if (filter.kind) {
      where.push('e.kind = ?');
      params.push(filter.kind);
    }
    if (filter.region) {
      where.push('e.region = ?');
      params.push(filter.region);
    }
    if (filter.movementType) {
      where.push('e.movement_type = ?');
      params.push(filter.movementType);
    }
    if (filter.isometric !== undefined) {
      where.push('e.is_isometric = ?');
      params.push(filter.isometric ? 1 : 0);
    }
    if (filter.unilateral !== undefined) {
      where.push('e.is_unilateral = ?');
      params.push(filter.unilateral ? 1 : 0);
    }
    if (filter.equipmentIds?.length) {
      where.push(`e.equipment_id IN (${placeholders(filter.equipmentIds.length)})`);
      params.push(...filter.equipmentIds);
    }
    // Grupo muscular inclui principal e secundários.
    if (filter.muscleGroupIds?.length) {
      where.push(`EXISTS (SELECT 1 FROM exercise_muscle em WHERE em.exercise_id = e.id
        AND em.deleted_at IS NULL AND em.muscle_group_id IN (${placeholders(filter.muscleGroupIds.length)}))`);
      params.push(...filter.muscleGroupIds);
    }
    if (filter.mobilityAreaIds?.length) {
      where.push(`EXISTS (SELECT 1 FROM exercise_mobility_area ea WHERE ea.exercise_id = e.id
        AND ea.deleted_at IS NULL AND ea.mobility_area_id IN (${placeholders(filter.mobilityAreaIds.length)}))`);
      params.push(...filter.mobilityAreaIds);
    }

    const rows = await this.db.query<ExerciseRow>(
      `SELECT e.*, eq.name AS equipment_name
       FROM exercise e LEFT JOIN equipment eq ON eq.id = e.equipment_id AND eq.deleted_at IS NULL
       WHERE ${where.join(' AND ')}`,
      params,
    );

    // Pesquisa por nome em JS: o SQLite não ignora acentos e o catálogo é pequeno.
    const q = filter.q?.trim() ? fold(filter.q.trim()) : null;
    const matched = q ? rows.filter((r) => fold(r.name).includes(q)) : rows;
    matched.sort((a, b) => a.name.localeCompare(b.name, 'pt', { sensitivity: 'base' }));
    return this.withRelations(matched);
  }

  async get(id: string): Promise<Exercise | null> {
    const rows = await this.db.query<ExerciseRow>(
      `SELECT e.*, eq.name AS equipment_name
       FROM exercise e LEFT JOIN equipment eq ON eq.id = e.equipment_id AND eq.deleted_at IS NULL
       WHERE e.id = ? AND e.deleted_at IS NULL`,
      [id],
    );
    if (!rows.length) return null;
    return (await this.withRelations(rows))[0];
  }

  private async withRelations(rows: ExerciseRow[]): Promise<Exercise[]> {
    if (!rows.length) return [];
    const idList = rows.map((r) => r.id);
    const muscles = await this.db.query<{ exercise_id: string; muscle_group_id: string; is_primary: number }>(
      `SELECT exercise_id, muscle_group_id, is_primary FROM exercise_muscle
       WHERE deleted_at IS NULL AND exercise_id IN (${placeholders(idList.length)})`,
      idList,
    );
    const areas = await this.db.query<{ exercise_id: string; mobility_area_id: string }>(
      `SELECT exercise_id, mobility_area_id FROM exercise_mobility_area
       WHERE deleted_at IS NULL AND exercise_id IN (${placeholders(idList.length)})`,
      idList,
    );
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      kind: r.kind,
      metricType: r.metric_type,
      isUnilateral: r.is_unilateral === 1,
      isIsometric: r.is_isometric === 1,
      region: r.region,
      movementType: r.movement_type,
      equipmentId: r.equipment_id,
      equipmentName: r.equipment_name,
      defaultRestSeconds: r.default_rest_seconds,
      notes: r.notes,
      videoUrl: r.video_url,
      archivedAt: r.archived_at,
      updatedAt: r.updated_at,
      primaryMuscleIds: muscles.filter((m) => m.exercise_id === r.id && m.is_primary === 1).map((m) => m.muscle_group_id),
      secondaryMuscleIds: muscles.filter((m) => m.exercise_id === r.id && m.is_primary === 0).map((m) => m.muscle_group_id),
      mobilityAreaIds: areas.filter((a) => a.exercise_id === r.id).map((a) => a.mobility_area_id),
    }));
  }
}
