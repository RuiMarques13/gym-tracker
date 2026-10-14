import type { LoadSuggestion } from './load';

/** Frase curta do resumo «Próxima vez» no fim da sessão. */
export function nextTimeText(sg: LoadSuggestion, kg: (x: number) => string): string {
  const reps = `${sg.repsMin}–${sg.repsMax}`;
  switch (sg.action) {
    case 'increase':
      if (sg.weightKg !== null) return `Sobe para ${kg(sg.weightKg)} × ${reps}.`;
      return sg.rangeKg ? `Sobe para ${kg(sg.rangeKg[0])}–${kg(sg.rangeKg[1])} × ${reps}.` : `Sobe a carga.`;
    case 'reps':
      return `Mantém ${kg(sg.weightKg!)} e sobe até ${sg.repsMax} repetições.`;
    case 'decrease':
      return `Baixa para ${kg(sg.weightKg!)} × ${reps}.`;
    case 'hold':
      return `Mantém ${kg(sg.weightKg!)} × ${reps}, tenta mais 1 repetição.`;
    default:
      return `Escolhe uma carga para ${reps} repetições.`;
  }
}
