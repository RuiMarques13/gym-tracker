/**
 * Funcionalidades ligadas ou escondidas. Uma funcionalidade escondida sai do menu, das Definições e das rotas,
 * mas o código e os dados ficam: voltar a ligar é mudar aqui para `true`.
 */
export const FEATURES = {
  /** Relógio e Health Connect (ecrã Saúde, configurar relógio, importar FC e calorias). Escondido até melhorar. */
  watch: false,
} as const;

export type Feature = keyof typeof FEATURES;

export const isEnabled = (f: Feature | undefined): boolean => !f || FEATURES[f];
