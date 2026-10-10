/**
 * Animações esquemáticas dos exercícios: um boneco de lado (viewBox 0 0 100 100) que passa entre duas poses.
 * A pose define-se por ângulos (cinemática direta), não por coordenadas, para os membros não mudarem de comprimento.
 * Ângulos em graus: 0 = para cima, 90 = para a direita (+x), 180 = para baixo. Cada ângulo é a direção «de baixo para cima»
 * ao longo da cadeia: tornozelo→joelho (canela), joelho→anca (coxa), anca→pescoço (tronco), pescoço→cotovelo, cotovelo→pulso.
 */
export interface Pose {
  /** Ponto fixo da cadeia (ancora no tornozelo ou na anca). */
  anchor: 'ankle' | 'hip';
  at: [number, number];
  shin: number;
  thigh: number;
  torso: number;
  uarm: number;
  farm: number;
  /** O braço fica a um lado (sem desenho de carga) — usado em exercícios sem pesos nas mãos. */
}

export interface Prop {
  kind: 'bench' | 'incline' | 'pad' | 'bar' | 'cable' | 'step';
  d: string;
}

export interface Motion {
  id: string;
  label: string;
  from: Pose;
  to: Pose;
  /** Elementos fixos (banco, barra de puxada…). */
  props: Prop[];
  /** Mostrar o peso (disco) no pulso. */
  weight: boolean;
}

const L = { shin: 17, thigh: 18, torso: 24, uarm: 11, farm: 11 };
const rad = (d: number) => (d * Math.PI) / 180;
const dir = (deg: number): [number, number] => [Math.sin(rad(deg)), -Math.cos(rad(deg))];
const add = (p: [number, number], d: [number, number], len: number): [number, number] => [p[0] + d[0] * len, p[1] + d[1] * len];
const sub = (p: [number, number], d: [number, number], len: number): [number, number] => [p[0] - d[0] * len, p[1] - d[1] * len];

export interface Joints {
  ankle: [number, number];
  knee: [number, number];
  hip: [number, number];
  neck: [number, number];
  head: [number, number];
  elbow: [number, number];
  wrist: [number, number];
}

export function joints(p: Pose): Joints {
  let ankle: [number, number], knee: [number, number], hip: [number, number];
  if (p.anchor === 'ankle') {
    ankle = p.at;
    knee = add(ankle, dir(p.shin), L.shin);
    hip = add(knee, dir(p.thigh), L.thigh);
  } else {
    hip = p.at;
    knee = sub(hip, dir(p.thigh), L.thigh);
    ankle = sub(knee, dir(p.shin), L.shin);
  }
  const neck = add(hip, dir(p.torso), L.torso);
  const head = add(neck, dir(p.torso), 7);
  const elbow = add(neck, dir(p.uarm), L.uarm);
  const wrist = add(elbow, dir(p.farm), L.farm);
  return { ankle, knee, hip, neck, head, elbow, wrist };
}

const pt = (p: [number, number]) => `${round(p[0])},${round(p[1])}`;
const round = (n: number) => Math.round(n * 10) / 10;

/** Pontos das polilinhas do corpo: perna, tronco, braço. */
export function bodyPoints(j: Joints): { leg: string; torso: string; arm: string; head: string; wrist: string } {
  return {
    leg: [j.ankle, j.knee, j.hip].map(pt).join(' '),
    torso: [j.hip, j.neck].map(pt).join(' '),
    arm: [j.neck, j.elbow, j.wrist].map(pt).join(' '),
    head: pt(j.head),
    wrist: pt(j.wrist),
  };
}

const standing = (over: Partial<Pose> = {}): Pose => ({
  anchor: 'ankle', at: [46, 90], shin: 0, thigh: 0, torso: 0, uarm: 180, farm: 180, ...over,
});

/** Deitado de costas, cabeça à direita; os pés ficam no chão (y ≈ 86). */
const lying = (over: Partial<Pose> = {}): Pose => ({
  anchor: 'hip', at: [34, 72], shin: 0, thigh: 92, torso: 90, uarm: 0, farm: 0, ...over,
});

const BENCH: Prop = { kind: 'bench', d: 'M22 76 H74 M28 76 V90 M68 76 V90' };
const FLOOR_PAD: Prop = { kind: 'pad', d: 'M12 88 H80' };

export const MOTIONS: Record<string, Motion> = {
  squat: {
    id: 'squat', label: 'Agachamento', weight: true, props: [],
    from: standing({ uarm: 200, farm: 20 }),
    to: standing({ shin: 28, thigh: -95, torso: 30, uarm: 205, farm: 25 }),
  },
  hinge: {
    id: 'hinge', label: 'Peso morto', weight: true, props: [],
    from: standing({ shin: 4, thigh: -2, torso: 2, uarm: 178, farm: 178 }),
    to: standing({ shin: 8, thigh: -28, torso: 78, uarm: 185, farm: 185 }),
  },
  bench: {
    id: 'bench', label: 'Supino', weight: true, props: [BENCH],
    from: lying({ uarm: 0, farm: 0 }),
    to: lying({ uarm: 125, farm: 5 }),
  },
  overhead: {
    id: 'overhead', label: 'Desenvolvimento', weight: true, props: [],
    from: standing({ uarm: 200, farm: 10 }),
    to: standing({ uarm: 5, farm: 0 }),
  },
  row: {
    id: 'row', label: 'Remada', weight: true, props: [],
    from: standing({ shin: 10, thigh: -24, torso: 62, uarm: 178, farm: 180 }),
    to: standing({ shin: 10, thigh: -24, torso: 62, uarm: 255, farm: 330 }),
  },
  pull: {
    id: 'pull', label: 'Puxada', weight: false, props: [{ kind: 'bar', d: 'M30 22 H66' }, { kind: 'pad', d: 'M36 75 H58' }],
    from: { anchor: 'hip', at: [46, 72], shin: 5, thigh: -92, torso: 6, uarm: 0, farm: 0 },
    to: { anchor: 'hip', at: [46, 72], shin: 5, thigh: -92, torso: -8, uarm: 200, farm: 25 },
  },
  curl: {
    id: 'curl', label: 'Curl', weight: true, props: [],
    from: standing({ uarm: 182, farm: 182 }),
    to: standing({ uarm: 186, farm: 20 }),
  },
  triceps: {
    id: 'triceps', label: 'Tríceps', weight: false, props: [{ kind: 'cable', d: 'M62 8 V38' }],
    from: standing({ uarm: 175, farm: 330 }),
    to: standing({ uarm: 182, farm: 180 }),
  },
  lateral: {
    id: 'lateral', label: 'Elevação lateral', weight: true, props: [],
    from: standing({ uarm: 175, farm: 175 }),
    to: standing({ uarm: 92, farm: 92 }),
  },
  lunge: {
    id: 'lunge', label: 'Afundo', weight: true, props: [],
    from: standing({ at: [40, 88], uarm: 178, farm: 178 }),
    to: standing({ at: [40, 88], shin: 20, thigh: -62, torso: 6, uarm: 178, farm: 178 }),
  },
  calf: {
    id: 'calf', label: 'Gémeos', weight: false, props: [{ kind: 'step', d: 'M32 90 H60' }],
    from: standing({ at: [46, 88], uarm: 178, farm: 178 }),
    to: standing({ at: [46, 84], uarm: 178, farm: 178 }),
  },
  crunch: {
    id: 'crunch', label: 'Abdominal', weight: false, props: [FLOOR_PAD],
    from: lying({ at: [34, 83], shin: 20, thigh: 150, torso: 92, uarm: 85, farm: 85 }),
    to: lying({ at: [34, 83], shin: 20, thigh: 150, torso: 55, uarm: 55, farm: 55 }),
  },
  hipthrust: {
    id: 'hipthrust', label: 'Elevação de anca', weight: false, props: [{ kind: 'bench', d: 'M50 74 H76 M62 74 V90' }],
    from: { anchor: 'ankle', at: [20, 90], shin: 8, thigh: 112, torso: 68, uarm: 250, farm: 250 },
    to: { anchor: 'ankle', at: [20, 90], shin: 8, thigh: 88, torso: 80, uarm: 250, farm: 250 },
  },
  pushup: {
    id: 'pushup', label: 'Flexão', weight: false, props: [FLOOR_PAD],
    from: { anchor: 'ankle', at: [10, 88], shin: 70, thigh: 70, torso: 72, uarm: 180, farm: 180 },
    to: { anchor: 'ankle', at: [10, 88], shin: 78, thigh: 78, torso: 80, uarm: 100, farm: 195 },
  },
};

const norm = (s: string): string => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Nome (e, em último caso, músculo principal) → padrão de movimento. Mobilidade e cardio não têm animação. */
const BY_NAME: Array<[RegExp, string]> = [
  [/afundo|lunge|passada|bulgaro|avanco|step-?up/, 'lunge'],
  [/hip thrust|elevacao de anca|ponte de gluteo|glute bridge|kickback/, 'hipthrust'],
  [/peso morto|deadlift|romeno|good morning|bom dia|stiff|hiperext|swing|rack pull/, 'hinge'],
  [/agachamento|squat|hack|leg press|goblet|prensa/, 'squat'],
  [/flexoes|flexao|push-?up|\bdips?\b|paralelas/, 'pushup'],
  [/puxada|dominada|pulldown|pull-?up|chin-?up/, 'pull'],
  [/remada alta|elevacao lateral|lateral raise|elevacao frontal|posterior|face pull|crucifixo invertido/, 'lateral'],
  [/remada|\brow\b|encolh|shrug/, 'row'],
  [/desenvolvimento|press militar|shoulder press|arnold|push press|pike|landmine press/, 'overhead'],
  [/supino|chest press|crossover|abertura|\bfly\b|flye|peck|pullover/, 'bench'],
  [/curl|rosca/, 'curl'],
  [/triceps|pushdown|skull|frances|extensao de braco|kickback de triceps/, 'triceps'],
  [/gemeos|calf|panturrilha/, 'calf'],
  [/abdominal|crunch|sit-?up|elevacao de pernas|russian|prancha|core/, 'crunch'],
];
const BY_MUSCLE: Record<string, string> = {
  peito: 'bench', costas_dorsais: 'pull', costas_superiores: 'row', deltoide_anterior: 'overhead', deltoide_lateral: 'lateral',
  deltoide_posterior: 'lateral', biceps: 'curl', triceps: 'triceps', quadriceps: 'squat', isquiotibiais: 'hinge',
  gluteos: 'hipthrust', gemeos: 'calf', abdominais: 'crunch', lombares: 'hinge',
};

export function motionFor(name: string, primaryMuscles: readonly string[], kind: 'STRENGTH' | 'MOBILITY' | 'CARDIO' = 'STRENGTH'): Motion | null {
  if (kind !== 'STRENGTH') return null;
  const n = norm(name);
  for (const [re, id] of BY_NAME) if (re.test(n)) return MOTIONS[id];
  for (const m of primaryMuscles) if (BY_MUSCLE[m]) return MOTIONS[BY_MUSCLE[m]];
  return null;
}
