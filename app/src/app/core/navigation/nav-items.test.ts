import { describe, expect, it } from 'vitest';
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
