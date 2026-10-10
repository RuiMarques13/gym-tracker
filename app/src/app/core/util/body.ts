/** IMC = kg / m². Calculado, nunca guardado. */
export function bmi(weightKg: number | null | undefined, heightCm: number | null | undefined): number | null {
  if (!weightKg || !heightCm) return null;
  const m = heightCm / 100;
  return Math.round((weightKg / (m * m)) * 10) / 10;
}

export function bmiLabel(v: number): string {
  if (v < 18.5) return 'abaixo do peso';
  if (v < 25) return 'peso normal';
  if (v < 30) return 'excesso de peso';
  return 'obesidade';
}

/** Idade em anos completos a `today` («YYYY-MM-DD»); null se a data não existe ou é futura. */
export function ageOn(birthDate: string | null | undefined, today: string): number | null {
  if (!birthDate || !/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) return null;
  const [by, bm, bd] = birthDate.split('-').map(Number);
  const [ty, tm, td] = today.split('-').map(Number);
  let age = ty - by;
  if (tm < bm || (tm === bm && td < bd)) age--;
  return age >= 0 ? age : null;
}
