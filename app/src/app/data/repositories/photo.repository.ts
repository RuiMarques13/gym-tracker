import type { DbAdapter } from '../db/db-adapter';
import type { Clock } from '../../core/util/clock';
import { newId } from '../../core/util/uuid';
import { PhotoError, PhotoPose, ProgressPhoto } from '../models/photo';

export interface PhotoRepository {
  /** Da mais recente para a mais antiga. */
  list(): Promise<ProgressPhoto[]>;
  add(input: { date: string; pose: PhotoPose; note?: string | null; image: string }): Promise<ProgressPhoto>;
  update(id: string, input: { date?: string; pose?: PhotoPose; note?: string | null }): Promise<void>;
  remove(id: string): Promise<void>;
}

const POSES = ['FRONT', 'SIDE', 'BACK', 'OTHER'];
/** Limite de segurança por imagem (≈ 1 MB em texto); a app comprime muito abaixo disto. */
const MAX_IMAGE_CHARS = 1_400_000;

interface Row { id: string; date: string; pose: PhotoPose; note: string | null; image: string }

export class SqlitePhotoRepository implements PhotoRepository {
  constructor(
    private readonly db: DbAdapter,
    private readonly clock: Clock,
    private readonly deviceId: string,
  ) {}

  async list(): Promise<ProgressPhoto[]> {
    return this.db.query<Row>(
      'SELECT id, date, pose, note, image FROM progress_photo WHERE deleted_at IS NULL ORDER BY date DESC, updated_at DESC',
    );
  }

  async add(input: { date: string; pose: PhotoPose; note?: string | null; image: string }): Promise<ProgressPhoto> {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) throw new PhotoError('Data inválida.');
    if (!POSES.includes(input.pose)) throw new PhotoError('Pose inválida.');
    if (!input.image.startsWith('data:image/')) throw new PhotoError('Imagem inválida.');
    if (input.image.length > MAX_IMAGE_CHARS) throw new PhotoError('A imagem é demasiado grande.');
    const id = newId();
    const note = input.note?.trim().slice(0, 300) || null;
    await this.db.run(
      'INSERT INTO progress_photo (id, date, pose, note, image, updated_at, deleted_at, device_id) VALUES (?, ?, ?, ?, ?, ?, NULL, ?)',
      [id, input.date, input.pose, note, input.image, this.clock.nowIso(), this.deviceId],
    );
    return { id, date: input.date, pose: input.pose, note, image: input.image };
  }

  async update(id: string, input: { date?: string; pose?: PhotoPose; note?: string | null }): Promise<void> {
    if (input.date !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(input.date)) throw new PhotoError('Data inválida.');
    if (input.pose !== undefined && !POSES.includes(input.pose)) throw new PhotoError('Pose inválida.');
    const cur = await this.db.query<Row>('SELECT id, date, pose, note, image FROM progress_photo WHERE id = ? AND deleted_at IS NULL', [id]);
    if (!cur.length) return;
    const next = {
      date: input.date ?? cur[0].date,
      pose: input.pose ?? cur[0].pose,
      note: input.note === undefined ? cur[0].note : input.note?.trim().slice(0, 300) || null,
    };
    await this.db.run(
      'UPDATE progress_photo SET date = ?, pose = ?, note = ?, updated_at = ?, device_id = ? WHERE id = ?',
      [next.date, next.pose, next.note, this.clock.nowIso(), this.deviceId, id],
    );
  }

  async remove(id: string): Promise<void> {
    const now = this.clock.nowIso();
    await this.db.run('UPDATE progress_photo SET deleted_at = ?, updated_at = ?, device_id = ? WHERE id = ?', [now, now, this.deviceId, id]);
  }
}
