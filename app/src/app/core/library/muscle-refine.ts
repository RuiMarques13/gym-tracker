/**
 * Músculos finos. O catálogo e as bases antigas usam «costas» (back), «ombros» (shoulders) e «trapézio»
 * (traps); a app divide-os em dorsais / costas superiores e deltoide anterior / lateral / posterior.
 * A divisão decide-se pelo nome do exercício. Função pura: usada na biblioteca e na migração dos dados.
 */
export const LEGACY_MUSCLES = ['back', 'shoulders', 'traps'] as const;

export interface MuscleSet {
  primary: string[];
  secondary: string[];
}

const norm = (s: string): string => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

type Fine = 'lats' | 'upper_back' | 'front_delt' | 'side_delt' | 'rear_delt';

function backFine(name: string): Fine[] {
  if (/face pull|pull-apart|pull apart|encolh|shrug|superman/.test(name)) return ['upper_back'];
  if (/remada|row|rack pull|bom dia/.test(name)) return ['lats', 'upper_back'];
  return ['lats'];
}

function shoulderFine(name: string): Fine[] {
  if (/face pull|posterior|invertid|reverse|pull-apart|pull apart|rotac|y-raise|dislocate/.test(name)) return ['rear_delt'];
  if (/lateral|lu raise|remada alta|upright/.test(name)) return ['side_delt'];
  if (/frontal/.test(name)) return ['front_delt'];
  if (/desenvolvimento|press|militar|arnold|pike|pino|handstand|push press|bradford|landmine/.test(name)) return ['front_delt', 'side_delt'];
  return ['side_delt'];
}

/** Devolve os músculos do exercício sem chaves antigas. Sem chaves antigas, devolve-os iguais. */
export function refineMuscles(name: string, m: MuscleSet): MuscleSet {
  if (![...m.primary, ...m.secondary].some((k) => (LEGACY_MUSCLES as readonly string[]).includes(k))) return m;
  const n = norm(name);
  const primary: string[] = [];
  const secondary: string[] = [];
  const add = (list: string[], k: string) => {
    if (!list.includes(k)) list.push(k);
  };
  const expand = (k: string, isPrimary: boolean): string[] => {
    if (k === 'traps') return ['upper_back'];
    if (k === 'back') return isPrimary ? backFine(n) : /remada|row/.test(n) ? ['upper_back'] : ['lats'];
    if (k === 'shoulders') return isPrimary ? shoulderFine(n) : ['front_delt'];
    return [k];
  };
  for (const k of m.primary) for (const f of expand(k, true)) add(primary, f);
  for (const k of m.secondary) for (const f of expand(k, false)) add(secondary, f);
  return { primary, secondary: secondary.filter((k) => !primary.includes(k)) };
}
