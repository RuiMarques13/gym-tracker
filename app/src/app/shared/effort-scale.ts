/** Escala de esforço da sessão (0–10, adaptada da CR10 de Borg): o número e o que ele quer dizer. */
export const EFFORT_LEVELS: ReadonlyArray<{ value: number; label: string; hint: string }> = [
  { value: 0, label: 'Repouso', hint: 'Nenhum esforço' },
  { value: 1, label: 'Muito leve', hint: 'Quase não notaste' },
  { value: 2, label: 'Leve', hint: 'Dava para falar à vontade' },
  { value: 3, label: 'Moderado', hint: 'Confortável, respiração normal' },
  { value: 4, label: 'Algo duro', hint: 'Começaste a sentir o esforço' },
  { value: 5, label: 'Duro', hint: 'Exigente, mas sustentável' },
  { value: 6, label: 'Duro+', hint: 'Falar já custava' },
  { value: 7, label: 'Muito duro', hint: 'Foi preciso concentração para acabar' },
  { value: 8, label: 'Muito duro+', hint: 'Perto do teu limite' },
  { value: 9, label: 'Quase máximo', hint: 'Mal aguentaste até ao fim' },
  { value: 10, label: 'Máximo', hint: 'Esforço máximo, nada mais para dar' },
];

export const effortLabel = (v: number | null | undefined): string | null =>
  v === null || v === undefined ? null : (EFFORT_LEVELS.find((l) => l.value === Math.round(v))?.label ?? null);
