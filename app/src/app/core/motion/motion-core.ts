/**
 * Núcleo das animações esquemáticas (viewBox 0 0 100 100). Uma animação = duas «frames» entre as quais o
 * desenho vai e volta. Há dois construtores de frames:
 *  - side(): boneco de lado por cinemática direta (ângulos em graus: 0 = para cima, 90 = para a direita);
 *  - front(): boneco de frente (braços e pernas abrem para os lados), para elevações laterais, aberturas, abdução…
 */
export type Pt = [number, number];

export interface Frame {
  /** Polilinhas do corpo (mesmo número e mesmo nº de pontos nas duas frames). */
  lines: string[];
  head: Pt;
  /** Pesos desenhados (discos), um por ponto. */
  weights: Pt[];
}

export interface Prop {
  kind: 'bench' | 'incline' | 'pad' | 'bar' | 'cable' | 'step' | 'wall' | 'machine' | 'box';
  d: string;
}

export interface Motion {
  id: string;
  label: string;
  from: Frame;
  /** Frame intermédia (interpolada pelos ângulos, para os membros não encolherem a meio do arco). */
  mid: Frame;
  to: Frame;
  props: Prop[];
}

// ---------- vista lateral ----------
export interface Pose {
  /** Ponto fixo da cadeia: tornozelo ou anca. */
  anchor: 'ankle' | 'hip';
  at: Pt;
  shin: number;
  thigh: number;
  torso: number;
  /** Curvatura da coluna: o ângulo da metade de cima do tronco soma-se a `torso`. */
  bend?: number;
  uarm: number;
  farm: number;
  /** Segunda perna (coxa, canela), mesma convenção da cadeia ancorada na anca: 0 = a direito para baixo. */
  leg2?: [number, number];
  /** Direção do pé a partir do tornozelo (90 = plano, para a frente). */
  foot?: number;
}

export const L = { shin: 17, thigh: 18, torso: 24, uarm: 11, farm: 11 };
const rad = (d: number) => (d * Math.PI) / 180;
export const dir = (deg: number): Pt => [Math.sin(rad(deg)), -Math.cos(rad(deg))];
const add = (p: Pt, d: Pt, len: number): Pt => [p[0] + d[0] * len, p[1] + d[1] * len];
const sub = (p: Pt, d: Pt, len: number): Pt => [p[0] - d[0] * len, p[1] - d[1] * len];

export interface Joints {
  ankle: Pt; knee: Pt; hip: Pt; mid: Pt; neck: Pt; head: Pt; elbow: Pt; wrist: Pt;
  knee2?: Pt; ankle2?: Pt; toe: Pt;
}

export function joints(p: Pose): Joints {
  let ankle: Pt, knee: Pt, hip: Pt;
  if (p.anchor === 'ankle') {
    ankle = p.at;
    knee = add(ankle, dir(p.shin), L.shin);
    hip = add(knee, dir(p.thigh), L.thigh);
  } else {
    hip = p.at;
    knee = sub(hip, dir(p.thigh), L.thigh);
    ankle = sub(knee, dir(p.shin), L.shin);
  }
  const upper = p.torso + (p.bend ?? 0);
  const mid = add(hip, dir(p.torso), L.torso / 2);
  const neck = add(mid, dir(upper), L.torso / 2);
  const head = add(neck, dir(upper), 7);
  const elbow = add(neck, dir(p.uarm), L.uarm);
  const wrist = add(elbow, dir(p.farm), L.farm);
  let knee2: Pt | undefined, ankle2: Pt | undefined;
  if (p.leg2) {
    knee2 = sub(hip, dir(p.leg2[0]), L.thigh);
    ankle2 = sub(knee2, dir(p.leg2[1]), L.shin);
  }
  const toe = add(ankle, dir(p.foot ?? 90), 7);
  return { ankle, knee, hip, mid, neck, head, elbow, wrist, knee2, ankle2, toe };
}

const r1 = (n: number) => Math.round(n * 10) / 10;
export const pts = (...p: Pt[]): string => p.map((q) => `${r1(q[0])},${r1(q[1])}`).join(' ');

/** Frame de lado. `weight` desenha um disco no pulso (carga nas mãos). */
export function side(p: Pose, weight = false): Frame {
  const j = joints(p);
  return {
    lines: [
      pts(j.toe, j.ankle, j.knee, j.hip), pts(j.hip, j.mid, j.neck), pts(j.neck, j.elbow, j.wrist),
      ...(j.knee2 && j.ankle2 ? [pts(j.hip, j.knee2, j.ankle2)] : []),
    ],
    head: [r1(j.head[0]), r1(j.head[1])],
    weights: weight ? [[r1(j.wrist[0]), r1(j.wrist[1])]] : [],
  };
}

/** De pé, de lado, pés em `at` (por defeito x=46, chão em y=90). */
export const standing = (over: Partial<Pose> = {}): Pose => ({
  anchor: 'ankle', at: [46, 90], shin: 0, thigh: 0, torso: 0, uarm: 180, farm: 180, ...over,
});
/** Deitado de costas, cabeça à direita; joelhos fletidos com os pés no chão. */
export const lying = (over: Partial<Pose> = {}): Pose => ({
  anchor: 'hip', at: [30, 72], shin: 0, thigh: 92, torso: 90, uarm: 0, farm: 0, ...over,
});

// ---------- vista frontal ----------
export interface FrontPose {
  /** Altura da anca (pés no chão = 90). */
  hipY?: number;
  /** Inclinação do tronco para a frente (0 = direito, 80 = quase horizontal): encurta o tronco. */
  lean?: number;
  /** Inclinação lateral do tronco, em graus (positivo = para a direita do desenho). */
  tilt?: number;
  /** Ombros elevados (encolhimento), em unidades. */
  shrug?: number;
  /** Ângulo do braço (esq., dir.): 0 = ao longo do corpo, 90 = na horizontal, 180 = por cima da cabeça. */
  ua?: [number, number];
  /** Ângulo absoluto do antebraço, mesma convenção. */
  fa?: [number, number];
  /** Abertura de cada perna (0 = junta). */
  leg?: [number, number];
}

const fdir = (a: number, side: 1 | -1): Pt => [side * Math.sin(rad(a)), Math.cos(rad(a))];

export function front(p: FrontPose, weight = false): Frame {
  const hipY = p.hipY ?? 56;
  const lean = p.lean ?? 0;
  const tl = L.torso * Math.cos(rad(lean));
  const sy = hipY - tl + (p.lean ? 0 : 0) - (p.shrug ?? 0);
  const [ul, ur] = p.ua ?? [8, 8];
  const [fl, fr] = p.fa ?? [8, 8];
  const [gl, gr] = p.leg ?? [0, 0];
  const hipL: Pt = [46, hipY], hipR: Pt = [54, hipY];
  const legLen = 90 - hipY;
  const legL = add(hipL, fdir(gl, -1), legLen);
  const legR = add(hipR, fdir(gr, 1), legLen);
  const kneeL = add(hipL, fdir(gl, -1), legLen / 2);
  const kneeR = add(hipR, fdir(gr, 1), legLen / 2);
  const sx = Math.sin(rad(p.tilt ?? 0)) * tl;
  const shL: Pt = [44 + sx, sy + 1], shR: Pt = [56 + sx, sy + 1];
  const eL = add(shL, fdir(ul, -1), L.uarm), eR = add(shR, fdir(ur, 1), L.uarm);
  const wL = add(eL, fdir(fl, -1), L.farm), wR = add(eR, fdir(fr, 1), L.farm);
  return {
    lines: [
      pts(legL, kneeL, hipL, hipR, kneeR, legR),
      pts([50, hipY], [50 + sx, sy]),
      pts(wL, eL, shL, shR, eR, wR),
    ],
    head: [r1(50 + sx + (p.tilt ? Math.sin(rad(p.tilt)) * 7 : 0)), r1(sy - 7 + lean / 25)],
    weights: weight ? [wL, wR].map((w) => [r1(w[0]), r1(w[1])] as Pt) : [],
  };
}

// ---------- fábrica ----------
export interface Spec {
  id: string;
  label: string;
  props?: Prop[];
}

const mix = (a: number, b: number): number => (a + b) / 2;
const mixPose = (a: Pose, b: Pose): Pose => ({
  anchor: a.anchor, at: [mix(a.at[0], b.at[0]), mix(a.at[1], b.at[1])],
  shin: mix(a.shin, b.shin), thigh: mix(a.thigh, b.thigh), torso: mix(a.torso, b.torso),
  bend: mix(a.bend ?? 0, b.bend ?? 0), uarm: mix(a.uarm, b.uarm), farm: mix(a.farm, b.farm),
  leg2: a.leg2 && b.leg2 ? [mix(a.leg2[0], b.leg2[0]), mix(a.leg2[1], b.leg2[1])] : undefined,
  foot: mix(a.foot ?? 90, b.foot ?? 90),
});
const D2: [number, number] = [8, 8];
const mixFront = (a: FrontPose, b: FrontPose): FrontPose => {
  const m2 = (x?: [number, number], y?: [number, number], d: [number, number] = D2): [number, number] => [
    mix((x ?? d)[0], (y ?? d)[0]), mix((x ?? d)[1], (y ?? d)[1]),
  ];
  return {
    hipY: mix(a.hipY ?? 56, b.hipY ?? 56), lean: mix(a.lean ?? 0, b.lean ?? 0), tilt: mix(a.tilt ?? 0, b.tilt ?? 0), shrug: mix(a.shrug ?? 0, b.shrug ?? 0),
    ua: m2(a.ua, b.ua), fa: m2(a.fa, b.fa), leg: m2(a.leg, b.leg, [0, 0]),
  };
};

export const sideMotion = (s: Spec, a: Pose, b: Pose, weight = false): Motion => ({
  id: s.id, label: s.label, props: s.props ?? [], from: side(a, weight), mid: side(mixPose(a, b), weight), to: side(b, weight),
});
export const frontMotion = (s: Spec, a: FrontPose, b: FrontPose, weight = false): Motion => ({
  id: s.id, label: s.label, props: s.props ?? [], from: front(a, weight), mid: front(mixFront(a, b), weight), to: front(b, weight),
});

export const BENCH: Prop = { kind: 'bench', d: 'M20 76 H72 M26 76 V90 M66 76 V90' };
export const PAD: Prop = { kind: 'pad', d: 'M10 88 H82' };
