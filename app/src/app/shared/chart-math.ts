/** Matemática dos gráficos (pura, testável). */

/** Máximo «redondo» do eixo e passos agradáveis: 1, 2, 5 × 10ⁿ. */
export function niceScale(maxValue: number, ticks = 4): { max: number; step: number } {
  if (!(maxValue > 0)) return { max: ticks, step: 1 };
  const raw = maxValue / ticks;
  const pow = Math.pow(10, Math.floor(Math.log10(raw)));
  const frac = raw / pow;
  const step = (frac <= 1 ? 1 : frac <= 2 ? 2 : frac <= 5 ? 5 : 10) * pow;
  return { max: Math.ceil(maxValue / step) * step, step };
}

/** Intervalo do eixo y para linhas: não força o zero (peso, 1RM), com folga. */
export function lineDomain(values: number[]): { min: number; max: number } {
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  if (lo === hi) return { min: lo - 1, max: hi + 1 };
  const pad = (hi - lo) * 0.15;
  return { min: lo - pad, max: hi + pad };
}

export function formatNumber(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toLocaleString('pt-PT', { maximumFractionDigits: 1 });
}
