import { describe, expect, it } from 'vitest';
import { FEATURES } from '../features';
import { NAV_ITEMS, orderedNav, resolveNav } from './nav-items';

const paths = (l: { path: string }[]) => l.map((i) => i.path);

describe('resolveNav', () => {
  it('sem personalização devolve a ordem por defeito', () => {
    expect(paths(resolveNav([], []))).toEqual(paths(NAV_ITEMS));
  });
  it('respeita a ordem e acrescenta ecrãs novos no fim', () => {
    const r = resolveNav(['/historico', '/home'], []);
    expect(paths(r).slice(0, 2)).toEqual(['/historico', '/home']);
    expect(r).toHaveLength(NAV_ITEMS.length);
  });
  it('ignora caminhos desconhecidos e repetidos', () => {
    const r = resolveNav(['/nada', '/home', '/home'], []);
    expect(r).toHaveLength(NAV_ITEMS.length);
  });
  it('esconde itens, mas nunca os bloqueados', () => {
    const r = paths(resolveNav([], ['/graficos', '/definicoes', '/home']));
    expect(r).not.toContain('/graficos');
    expect(r).toContain('/definicoes');
    expect(r).toContain('/home');
  });
  it('orderedNav inclui os escondidos', () => {
    expect(orderedNav([])).toHaveLength(NAV_ITEMS.length);
  });
});

describe('funcionalidades escondidas', () => {
  it('o ecrã Saúde (relógio) só aparece com o relógio ligado', async () => {
    const { ALL_NAV_ITEMS, NAV_ITEMS } = await import('./nav-items');
    expect(ALL_NAV_ITEMS.some((i) => i.path === '/saude')).toBe(true);
    expect(NAV_ITEMS.some((i) => i.path === '/saude')).toBe(FEATURES.watch);
    for (const i of NAV_ITEMS) expect(i.feature === undefined || FEATURES[i.feature], i.path).toBe(true);
  });
});
