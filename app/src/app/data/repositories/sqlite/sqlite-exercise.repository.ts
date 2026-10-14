import type { DbAdapter, SqlValue } from '../../../core/db/db-adapter';
import type { Clock } from '../../../core/util/clock';
import type { Mechanic } from '../../models/enums';
import { ids, newId } from '../../../core/util/uuid';
import {
  Category, Kind, KIND_OF_CATEGORY, MetricType, METRICS_BY_KIND, MovementType, Region, defaultCategory, isCategory, resolveCategory,
} from '../../models/enums';
import { Exercise, ExerciseFilter, ExerciseInput, ExerciseValidationError } from '../../models/exercise';
import type { ExerciseRepository } from '../exercise.repository';

interface ExerciseRow {
  id: string;
  name: string;
  kind: Kind;
  category: Category | null;
  metric_type: MetricType;
  is_unilateral: number;
  is_isometric: number;
  mechanic: Mechanic | null;
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

const unique = (xs: string[]) => [...new Set(xs)];
const emptyToNull = (s: string | null | undefined) => (s && s.trim() ? s.trim() : null);

/** Remove acentos e passa a minúsculas, para a pesquisa ignorar «é» vs «e». */
export function fold(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

export class SqliteExerciseRepository implements ExerciseRepository {
  constructor(
    private readonly db: DbAdapter,
    private readonly clock: Clock,
    private readonly deviceId: string,
  ) {}

  async save(input: ExerciseInput): Promise<Exercise> {
    const name = input.name?.trim() ?? '';
    if (!name) throw new ExerciseValidationError('name', 'O nome é obrigatório.');
    if (!METRICS_BY_KIND[input.kind]?.includes(input.metricType)) {
      throw new ExerciseValidationError(
        'metricType',
        input.kind === 'CARDIO'
          ? 'Cardio mede-se por duração (com distância e calorias opcionais).'
          : 'Mobilidade mede-se por repetições ou duração, não por carga.',
      );
    }
    if (input.category != null && (!isCategory(input.category) || KIND_OF_CATEGORY[input.category] !== input.kind)) {
      throw new ExerciseValidationError('category', 'A categoria não corresponde ao tipo do exercício.');
    }
    const category = resolveCategory(input.kind, input.category);
    const id = input.id ?? newId();
    await this.assertNameFree(name, id);

    const isMobility = input.kind === 'MOBILITY';
    const isStrength = input.kind === 'STRENGTH';
    const primary = isMobility ? [] : unique(input.primaryMuscleIds ?? []);
    const secondary = isMobility ? [] : unique(input.secondaryMuscleIds ?? []).filter((m) => !primary.includes(m));
    const areas = isMobility ? unique(input.mobilityAreaIds ?? []) : [];
    const now = this.clock.nowIso();

    await this.db.transaction(async (tx) => {
      // Upsert: também reativa uma linha apagada ou arquivada com o mesmo id (ex.: biblioteca).
      await tx.run(
        `INSERT INTO exercise (id, name, kind, category, metric_type, is_unilateral, region, movement_type, is_isometric,
           equipment_id, default_rest_seconds, mechanic, notes, video_url, archived_at, updated_at, deleted_at, device_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, NULL, ?)
         ON CONFLICT(id) DO UPDATE SET name = excluded.name, kind = excluded.kind, category = excluded.category,
           metric_type = excluded.metric_type, is_unilateral = excluded.is_unilateral, region = excluded.region,
           movement_type = excluded.movement_type, is_isometric = excluded.is_isometric,
           equipment_id = excluded.equipment_id, default_rest_seconds = excluded.default_rest_seconds,
           mechanic = excluded.mechanic, notes = excluded.notes, video_url = excluded.video_url, archived_at = NULL,
           updated_at = excluded.updated_at, deleted_at = NULL, device_id = excluded.device_id`,
        [
          id, name, input.kind, category, input.metricType, input.kind !== 'CARDIO' && input.isUnilateral ? 1 : 0, input.region ?? null,
          isStrength ? (input.movementType ?? null) : null, isStrength && input.isIsometric ? 1 : 0, input.equipmentId ?? null,
          input.defaultRestSeconds ?? null, isStrength ? (input.mechanic ?? null) : null, emptyToNull(input.notes), emptyToNull(input.videoUrl), now, this.deviceId,
        ],
      );
      await this.syncLinks(
        tx, 'exercise_muscle', 'muscle_group_id', id,
        [...primary.map((m) => ({ ref: m, primary: 1 })), ...secondary.map((m) => ({ ref: m, primary: 0 }))],
        (ref) => ids.exerciseMuscle(id, ref), now,
      );
      await this.syncLinks(
        tx, 'exercise_mobility_area', 'mobility_area_id', id,
        areas.map((a) => ({ ref: a })), (ref) => ids.exerciseMobilityArea(id, ref), now,
      );
    });
    return (await this.get(id))!;
  }

  async archive(id: string): Promise<void> {
    const now = this.clock.nowIso();
    await this.db.run(
      'UPDATE exercise SET archived_at = ?, updated_at = ?, device_id = ? WHERE id = ? AND deleted_at IS NULL',
      [now, now, this.deviceId, id],
    );
  }

  async restore(id: string): Promise<void> {
    const ex = await this.get(id);
    if (!ex) return;
    await this.assertNameFree(ex.name, id);
    await this.db.run('UPDATE exercise SET archived_at = NULL, updated_at = ?, device_id = ? WHERE id = ?', [
      this.clock.nowIso(), this.deviceId, id,
    ]);
  }

  async isUsed(id: string): Promise<boolean> {
    const rows = await this.db.query<{ n: number }>(
      `SELECT (SELECT COUNT(*) FROM planned_exercise WHERE exercise_id = ? AND deleted_at IS NULL)
            + (SELECT COUNT(*) FROM session_exercise WHERE exercise_id = ? AND deleted_at IS NULL) AS n`,
      [id, id],
    );
    return (rows[0]?.n ?? 0) > 0;
  }

  async remove(id: string): Promise<void> {
    if (await this.isUsed(id)) {
      throw new ExerciseValidationError('usage', 'Este exercício já foi usado. Arquiva-o em vez de o apagar.');
    }
    const now = this.clock.nowIso();
    // Soft delete (deleted_at) para o sync propagar a remoção; as ligações vão com ele.
    await this.db.transaction(async (tx) => {
      for (const table of ['exercise_muscle', 'exercise_mobility_area']) {
        await tx.run(
          `UPDATE ${table} SET deleted_at = ?, updated_at = ?, device_id = ? WHERE exercise_id = ? AND deleted_at IS NULL`,
          [now, now, this.deviceId, id],
        );
      }
      await tx.run('UPDATE exercise SET deleted_at = ?, updated_at = ?, device_id = ? WHERE id = ?', [
        now, now, this.deviceId, id,
      ]);
    });
  }

  /** Nome único entre exercícios ativos (sem contar arquivados nem o próprio). */
  private async assertNameFree(name: string, selfId: string): Promise<void> {
    const rows = await this.db.query<{ id: string; name: string }>(
      'SELECT id, name FROM exercise WHERE deleted_at IS NULL AND archived_at IS NULL AND id <> ?',
      [selfId],
    );
    const target = fold(name.trim());
    if (rows.some((r) => fold(r.name.trim()) === target)) {
      throw new ExerciseValidationError('name', `Já tens um exercício chamado «${name.trim()}».`);
    }
  }

  /**
   * Acerta uma tabela de ligação para o conjunto pedido. IDs determinísticos, por isso
   * ligar, desligar e voltar a ligar reutiliza a mesma linha (e converge no sync).
   */
  private async syncLinks(
    tx: DbAdapter,
    table: string,
    refColumn: string,
    exerciseId: string,
    wanted: { ref: string; primary?: number }[],
    linkId: (ref: string) => string,
    now: string,
  ): Promise<void> {
    const hasPrimary = table === 'exercise_muscle';
    const current = await tx.query<{ id: string; ref: string; deleted_at: string | null; is_primary?: number }>(
      `SELECT id, ${refColumn} AS ref, deleted_at${hasPrimary ? ', is_primary' : ''} FROM ${table} WHERE exercise_id = ?`,
      [exerciseId],
    );
    const wantedRefs = new Set(wanted.map((w) => w.ref));
    for (const row of current) {
      if (!wantedRefs.has(row.ref) && row.deleted_at === null) {
        await tx.run(`UPDATE ${table} SET deleted_at = ?, updated_at = ?, device_id = ? WHERE id = ?`, [
          now, now, this.deviceId, row.id,
        ]);
      }
    }
    for (const w of wanted) {
      const existing = current.find((c) => c.ref === w.ref);
      const unchanged =
        existing && existing.deleted_at === null && (!hasPrimary || existing.is_primary === w.primary);
      if (unchanged) continue;
      const cols = ['id', 'exercise_id', refColumn, ...(hasPrimary ? ['is_primary'] : [])];
      const vals: SqlValue[] = [linkId(w.ref), exerciseId, w.ref, ...(hasPrimary ? [w.primary ?? 0] : [])];
      await tx.run(
        `INSERT INTO ${table} (${cols.join(', ')}, updated_at, deleted_at, device_id)
         VALUES (${cols.map(() => '?').join(', ')}, ?, NULL, ?)
         ON CONFLICT(id) DO UPDATE SET ${hasPrimary ? 'is_primary = excluded.is_primary, ' : ''}
           deleted_at = NULL, updated_at = excluded.updated_at, device_id = excluded.device_id`,
        [...vals, now, this.deviceId],
      );
    }
  }

  async list(filter: ExerciseFilter = {}): Promise<Exercise[]> {
    const where: string[] = ['e.deleted_at IS NULL'];
    const params: SqlValue[] = [];

    if (!filter.includeArchived) where.push('e.archived_at IS NULL');
    if (filter.kind) {
      where.push('e.kind = ?');
      params.push(filter.kind);
    }
    if (filter.category) {
      // Sem categoria guardada vale a por omissão do kind (a primeira de cada kind).
      where.push('(e.category = ? OR (e.category IS NULL AND e.kind = ? AND ? = 1))');
      const k = KIND_OF_CATEGORY[filter.category];
      params.push(filter.category, k, defaultCategory(k) === filter.category ? 1 : 0);
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
    if (filter.sort === 'recent') {
      matched.sort((a, b) => b.updated_at.localeCompare(a.updated_at) || a.name.localeCompare(b.name, 'pt'));
    } else {
      matched.sort((a, b) => a.name.localeCompare(b.name, 'pt', { sensitivity: 'base' }));
    }
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
      category: resolveCategory(r.kind, r.category),
      metricType: r.metric_type,
      isUnilateral: r.is_unilateral === 1,
      isIsometric: r.is_isometric === 1,
      mechanic: r.mechanic ?? null,
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
