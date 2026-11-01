import { groupSets, type Session } from '../../data/models/session';
import { cleanPath, tabBarVisible } from '../navigation/tabs';

/**
 * Sem atividade há este tempo, o treino conta como esquecido: a barra deixa de mostrar o tempo a correr.
 * Escolha da app: é o mesmo limite que a Home já usa para propor terminar na última série.
 */
export const STALE_AFTER_MS = 4 * 3600_000;

export interface ActiveBarInfo {
  name: string;
  /** «12 min», «1 h 05». */
  elapsed: string;
  /** Séries registadas (esquerdo e direito contam uma). */
  sets: number;
  /** Sem séries nem início há mais de 4 h: provavelmente esqueceste-te de terminar. */
  stale: boolean;
}

/** 0–59 min → «N min»; a partir de 1 h → «1 h 05». */
export function formatElapsed(seconds: number): string {
  const min = Math.max(0, Math.floor(seconds / 60));
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')}`;
}

/** O que a barra «Treino em curso» mostra para a sessão aberta. */
export function activeBarInfo(s: Session, nowMs: number): ActiveBarInfo {
  const seconds = (nowMs - Date.parse(s.startedAt)) / 1000 - s.pausedSeconds;
  const last = Date.parse(s.lastActivityAt ?? s.startedAt);
  return {
    name: s.templateName ?? 'Sessão livre',
    elapsed: formatElapsed(seconds),
    sets: s.exercises.reduce((n, ex) => n + groupSets(ex.sets).length, 0),
    stale: nowMs - last >= STALE_AFTER_MS,
  };
}

/**
 * A barra aparece com a dos separadores, menos na Home (que já tem o cartão «Sessão em curso»).
 * Na sessão a barra dos separadores já está escondida, por isso esta também.
 */
export function activeBarVisible(url: string): boolean {
  return tabBarVisible(url) && cleanPath(url) !== '/home' && cleanPath(url) !== '/';
}
