import type { Block } from '../models/enums';
import type {
  ExerciseHistoryEntry, FinishInput, Session, SessionDetailsInput, SessionExercise, SessionSet, SessionSummary, SetInput,
} from '../models/session';

export interface SessionRepository {
  /** A sessão em curso (sem ended_at), se existir. Só pode haver uma. */
  getActive(): Promise<Session | null>;
  get(id: string): Promise<Session | null>;
  /** Começa uma sessão a partir de um treino (com snapshot dos alvos) ou livre (sem treino). */
  start(options?: { templateId?: string | null; scheduledId?: string | null }): Promise<Session>;
  addExercise(sessionId: string, exerciseId: string, block?: Block): Promise<SessionExercise>;
  removeExercise(sessionExerciseId: string): Promise<void>;
  /** Cria ou atualiza uma série (as duas linhas, nos unilaterais). Também corrige sessões já terminadas. */
  saveSet(input: SetInput): Promise<SessionExercise>;
  deleteSet(sessionExerciseId: string, position: number): Promise<SessionExercise>;
  finish(id: string, input?: FinishInput): Promise<Session>;
  /** Sessões terminadas, da mais recente para a mais antiga. */
  listFinished(options?: { limit?: number; offset?: number }): Promise<SessionSummary[]>;
  /** O que fizeste num exercício, sessão a sessão (terminadas), da mais recente para a mais antiga. */
  exerciseHistory(exerciseId: string, options?: { limit?: number }): Promise<ExerciseHistoryEntry[]>;
  /** Corrige o esforço e as notas (sessão em curso ou terminada). */
  updateDetails(id: string, input: SessionDetailsInput): Promise<Session>;
  /** Descarta a sessão (fica apagada, não aparece no histórico). */
  discard(id: string): Promise<void>;
  /** Séries da sessão anterior mais recente que tenha este exercício, para pré-preencher. */
  previousSets(exerciseId: string, excludeSessionId?: string): Promise<SessionSet[]>;
}
