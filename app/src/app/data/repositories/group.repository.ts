import type { GroupConfig } from '../../core/session/group-format';
import type { ExerciseGroup, GroupResult } from '../models/group';

/** Formatos dos grupos de exercícios (superset, circuito, por tempo) de um treino ou de uma sessão. */
export interface GroupRepository {
  forTemplate(templateId: string): Promise<ExerciseGroup[]>;
  forSession(sessionId: string): Promise<ExerciseGroup[]>;
  /** Acerta os grupos de um treino: grava estes (por letra) e apaga os que já não existem. Superset simples não precisa de linha. */
  saveForTemplate(templateId: string, groups: { groupKey: string; config: GroupConfig }[]): Promise<void>;
  /** Formato de um grupo numa sessão (criado se ainda não existe, ex.: sessão livre). */
  saveForSession(sessionId: string, groupKey: string, config: GroupConfig): Promise<ExerciseGroup>;
  saveResult(sessionId: string, groupKey: string, result: GroupResult): Promise<void>;
  /** Último resultado do mesmo grupo do mesmo treino, numa sessão terminada antes desta. */
  lastResult(templateId: string, groupKey: string, beforeSessionId: string): Promise<GroupResult | null>;
}
