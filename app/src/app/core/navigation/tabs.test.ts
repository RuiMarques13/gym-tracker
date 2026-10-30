import { describe, expect, it } from 'vitest';
import { FEATURES } from '../features';
import { cleanPath, sectionForUrl, tabBarVisible, tabForUrl, tabTarget, TABS } from './tabs';

const tab = (id: string) => TABS.find((t) => t.id === id)!;

describe('TABS', () => {
  it('são 4 separadores, cada um com pelo menos uma secção', () => {
    expect(TABS.map((t) => t.id)).toEqual(['hoje', 'treinos', 'exercicios', 'progresso']);
    for (const t of TABS) expect(t.sections.length).toBeGreaterThan(0);
  });
  it('nenhum caminho aparece em dois separadores', () => {
    const all = TABS.flatMap((t) => t.sections.map((s) => s.path));
    expect(new Set(all).size).toBe(all.length);
  });
  it('a secção Saúde só aparece com o relógio ligado', () => {
    const has = tab('progresso').sections.some((s) => s.path === '/saude');
    expect(has).toBe(FEATURES.watch);
  });
});

describe('cleanPath', () => {
  it('tira query, fragmento e barra final', () => {
    expect(cleanPath('/treinos/?x=1#a')).toBe('/treinos');
    expect(cleanPath('/')).toBe('/');
    expect(cleanPath('')).toBe('/');
  });
});

describe('tabForUrl', () => {
  it('liga cada ecrã antigo ao seu separador', () => {
    expect(tabForUrl('/home')?.id).toBe('hoje');
    expect(tabForUrl('/treinos')?.id).toBe('treinos');
    expect(tabForUrl('/planeados')?.id).toBe('treinos');
    expect(tabForUrl('/ciclos')?.id).toBe('treinos');
    expect(tabForUrl('/exercicios')?.id).toBe('exercicios');
    expect(tabForUrl('/volume')?.id).toBe('progresso');
    expect(tabForUrl('/historico')?.id).toBe('progresso');
    expect(tabForUrl('/graficos')?.id).toBe('progresso');
    expect(tabForUrl('/fotos')?.id).toBe('progresso');
  });
  it('os ecrãs de detalhe ficam no separador da lista', () => {
    expect(tabForUrl('/treinos/novo')?.id).toBe('treinos');
    expect(tabForUrl('/ciclos/abc')?.id).toBe('treinos');
    expect(tabForUrl('/exercicios/abc/historico')?.id).toBe('exercicios');
    expect(tabForUrl('/historico/abc?x=1')?.id).toBe('progresso');
  });
  it('não confunde caminhos com o mesmo início', () => {
    expect(tabForUrl('/homepage')).toBeNull();
    expect(tabForUrl('/treinosx')).toBeNull();
  });
  it('Perfil, Definições e Conta não têm separador', () => {
    expect(tabForUrl('/perfil')).toBeNull();
    expect(tabForUrl('/definicoes/regras')).toBeNull();
    expect(tabForUrl('/conta')).toBeNull();
  });
});

describe('sectionForUrl', () => {
  it('a secção mais específica ganha', () => {
    expect(sectionForUrl('/exercicios/biblioteca')?.section.label).toBe('Biblioteca');
    expect(sectionForUrl('/exercicios/abc')?.section.label).toBe('Os meus');
    expect(sectionForUrl('/planeados')?.section.label).toBe('Semana');
  });
});

describe('tabBarVisible', () => {
  it('esconde no treino em curso e na introdução', () => {
    expect(tabBarVisible('/sessao')).toBe(false);
    expect(tabBarVisible('/sessao/fim/abc')).toBe(false);
    expect(tabBarVisible('/sessao/tempo/x')).toBe(false);
    expect(tabBarVisible('/bem-vindo')).toBe(false);
  });
  it('mostra no resto, incluindo uma sessão aberta pelo histórico', () => {
    expect(tabBarVisible('/home')).toBe(true);
    expect(tabBarVisible('/historico/abc')).toBe(true);
    expect(tabBarVisible('/perfil')).toBe(true);
    expect(tabBarVisible('/definicoes')).toBe(true);
    expect(tabBarVisible('/conta')).toBe(true);
  });
});

describe('tabTarget', () => {
  it('noutro separador vai à última secção usada lá', () => {
    expect(tabTarget(tab('progresso'), '/home', '/graficos')).toBe('/graficos');
  });
  it('sem memória, ou com memória inválida, vai à raiz', () => {
    expect(tabTarget(tab('progresso'), '/home', undefined)).toBe('/volume');
    expect(tabTarget(tab('progresso'), '/home', '/treinos')).toBe('/volume');
    expect(tabTarget(tab('progresso'), '/home', '/historico/abc')).toBe('/volume');
  });
  it('no separador já ativo volta à raiz', () => {
    expect(tabTarget(tab('treinos'), '/ciclos/abc', '/ciclos')).toBe('/treinos');
    expect(tabTarget(tab('progresso'), '/graficos', '/graficos')).toBe('/volume');
  });
});
