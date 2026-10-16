import type { DbAdapter } from '../db/db-adapter';
import type { Clock } from '../../core/util/clock';
import { ids } from '../../core/util/uuid';

export type SuggestionKind = 'STAGNATION' | 'FATIGUE';
export type SuggestionResponse = 'deload' | 'volume' | 'range' | 'swap';
export type SuggestionStatus = 'ACCEPTED' | 'DECLINED';

/** Uma resposta tua a uma sugestão (aceite ou recusada). */
export interface SuggestionRecord {
  id: string;
  kind: SuggestionKind;
  exerciseId: string | null;
  episode: string;
  response: SuggestionResponse | null;
  status: SuggestionStatus;
  payload: Record<string, unknown> | null;
  createdAt: string;
}

export interface SuggestionRepository {
  /** Respostas criadas desde `sinceIso`, da mais recente para a mais antiga. */
  since(sinceIso: string): Promise<SuggestionRecord[]>;
  /** Guarda (ou substitui) a resposta a uma sugestão. */
  record(input: Omit<SuggestionRecord, 'id' | 'createdAt'>): Promise<SuggestionRecord>;
}

interface Row {
  id: string; kind: SuggestionKind; exercise_id: string | null; episode: string; response: SuggestionResponse | null;
  status: SuggestionStatus; payload: string | null; created_at: string;
}

export class SqliteSuggestionRepository implements SuggestionRepository {
  constructor(
    private readonly db: DbAdapter,
    private readonly clock: Clock,
    private readonly deviceId: string,
  ) {}

  async since(sinceIso: string): Promise<SuggestionRecord[]> {
    const rows = await this.db.query<Row>(
      `SELECT id, kind, exercise_id, episode, response, status, payload, created_at FROM suggestion
       WHERE deleted_at IS NULL AND created_at >= ? ORDER BY created_at DESC`,
      [sinceIso],
    );
    return rows.map(toRecord);
  }

  async record(input: Omit<SuggestionRecord, 'id' | 'createdAt'>): Promise<SuggestionRecord> {
    const now = this.clock.nowIso();
    const id = ids.suggestion(input.kind, input.exerciseId, input.episode, input.response);
    await this.db.run(
      `INSERT INTO suggestion (id, kind, exercise_id, episode, response, status, payload, created_at, updated_at, deleted_at, device_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)
       ON CONFLICT(id) DO UPDATE SET status = excluded.status, payload = excluded.payload, deleted_at = NULL,
         updated_at = excluded.updated_at, device_id = excluded.device_id`,
      [id, input.kind, input.exerciseId, input.episode, input.response, input.status,
        input.payload ? JSON.stringify(input.payload) : null, now, now, this.deviceId],
    );
    return { ...input, id, createdAt: now };
  }
}

function toRecord(r: Row): SuggestionRecord {
  let payload: Record<string, unknown> | null = null;
  try { payload = r.payload ? (JSON.parse(r.payload) as Record<string, unknown>) : null; } catch { payload = null; }
  return {
    id: r.id, kind: r.kind, exerciseId: r.exercise_id, episode: r.episode, response: r.response, status: r.status,
    payload, createdAt: r.created_at,
  };
}
