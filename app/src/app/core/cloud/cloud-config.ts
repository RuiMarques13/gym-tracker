/**
 * Projeto Supabase da app. Estes dois valores são públicos por desenho: o URL e a chave
 * «publishable» (antiga «anon») vão sempre dentro da app web. A proteção dos dados está nas
 * políticas RLS e nas funções sync_* (supabase/migrations), não em esconder a chave.
 *
 * NUNCA pôr aqui a chave service_role nem a palavra-passe da base de dados.
 */
export const CLOUD = {
  url: 'https://uvnldzlfpubzdrooxdje.supabase.co',
  publishableKey: 'sb_publishable_NMPLe4n3IwEAvF3oQSAAag_jwMGwF7t',
} as const;

/** Chave onde o supabase-js guarda a sessão no localStorage (sb-<ref>-auth-token). */
export function sessionStorageKey(url: string = CLOUD.url): string {
  const ref = new URL(url).hostname.split('.')[0];
  return `sb-${ref}-auth-token`;
}
