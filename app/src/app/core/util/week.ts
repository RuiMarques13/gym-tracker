/** Datas «YYYY-MM-DD» na hora local, e semanas de segunda a domingo. */

export function toLocalDate(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Constrói uma data local a partir de «YYYY-MM-DD» (meio-dia, para escapar às mudanças de hora). */
export function fromLocalDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d, 12);
}

export function addDays(s: string, n: number): string {
  const d = fromLocalDate(s);
  d.setDate(d.getDate() + n);
  return toLocalDate(d);
}

/** Segunda-feira da semana a que a data pertence. */
export function weekStartOf(s: string): string {
  const d = fromLocalDate(s);
  const dow = (d.getDay() + 6) % 7; // segunda = 0
  return addDays(s, -dow);
}

export function weekDays(weekStart: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
}
