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
  /** Pesos desenhados (discos), um por ponto (as mãos, quando o exercício leva carga). */
  weights: Pt[];
  /** Mãos (pulsos) e pés (tornozelos): onde se desenha o implemento e de onde sai a seta de trajetória. */
  hands: Pt[];
  feet: Pt[];
}

export interface Prop {
  kind: 'bench' | 'incline' | 'pad' | 'bar' | 'cable' | 'step' | 'wall' | 'machine' | 'box';
  d: string;
}

export interface Motion {
  id: string;
  label: string;
  /** Onde está a polia/âncora do cabo ou elástico (por defeito, ao lado do boneco, à altura das mãos). */
  pulley?: Pt;
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
  /** Ângulos absolutos do braço e do antebraço (FK). Ignorados se houver `reach`. */
  uarm?: number;
  farm?: number;
  /**
   * Posição do pulso relativa ao ombro, em coordenadas do desenho (x para a frente, y para baixo). Quando existe, o braço
   * é calculado por cinemática inversa (2 ossos): é assim que a trajetória da carga (vertical no supino, recta na
   * puxada…) é definida, em vez de ângulos soltos. `elbow` diz para onde o cotovelo aponta.
   */
  reach?: Pt;
  /** Alternativa a `reach`: posição do pulso no desenho (a carga fica nesse ponto, p. ex. barra sobre o meio do pé). */
  hand?: Pt;
  elbow?: 'down' | 'up' | 'back' | 'front';
  /**
   * Faz o tronco inclinar-se o necessário para o pescoço ficar nesta abcissa (a barra às costas ou nas mãos mantém-se na
   * vertical sobre o meio do pé, e é o comprimento dos segmentos que decide o ângulo das costas).
   */
  neckX?: number;
  /** Segunda perna (coxa, canela), mesma convenção da cadeia ancorada na anca: 0 = a direito para baixo. */
  leg2?: [number, number];
  /** Direção do pé a partir do tornozelo (90 = plano, para a frente). */
  foot?: number;
}

export const L = { shin: 20, thigh: 21, torso: 24, uarm: 13.5, farm: 15 };
const rad = (d: number) => (d * Math.PI) / 180;
export const dir = (deg: number): Pt => [Math.sin(rad(deg)), -Math.cos(rad(deg))];
const add = (p: Pt, d: Pt, len: number): Pt => [p[0] + d[0] * len, p[1] + d[1] * len];
const sub = (p: Pt, d: Pt, len: number): Pt => [p[0] - d[0] * len, p[1] - d[1] * len];

export interface Joints {
  ankle: Pt; knee: Pt; hip: Pt; mid: Pt; neck: Pt; head: Pt; elbow: Pt; wrist: Pt;
  knee2?: Pt; ankle2?: Pt; toe: Pt;
}

const PREFER: Record<'down' | 'up' | 'back' | 'front', Pt> = { down: [0, 1], up: [0, -1], back: [-1, 0], front: [1, 0] };

/** Cinemática inversa de dois ossos: cotovelo e pulso para o pulso ficar em `shoulder + reach` (limitado ao alcance do braço). */
export function armIK(shoulder: Pt, reach: Pt, side: 'down' | 'up' | 'back' | 'front'): [Pt, Pt] {
  const a = L.uarm, b = L.farm;
  const maxD = a + b - 0.05;
  let d = Math.hypot(reach[0], reach[1]);
  const u: Pt = d < 1e-6 ? [0, -1] : [reach[0] / d, reach[1] / d];
  d = Math.min(Math.max(d, Math.abs(a - b) + 0.05), maxD);
  const x = (d * d + a * a - b * b) / (2 * d);
  const h = Math.sqrt(Math.max(0, a * a - x * x));
  const base: Pt = [shoulder[0] + u[0] * x, shoulder[1] + u[1] * x];
  const perp: Pt = [-u[1], u[0]];
  const c1: Pt = [base[0] + perp[0] * h, base[1] + perp[1] * h];
  const c2: Pt = [base[0] - perp[0] * h, base[1] - perp[1] * h];
  const pref = PREFER[side];
  const score = (c: Pt) => (c[0] - shoulder[0]) * pref[0] + (c[1] - shoulder[1]) * pref[1];
  const elbow = score(c1) >= score(c2) ? c1 : c2;
  return [elbow, [shoulder[0] + u[0] * d, shoulder[1] + u[1] * d]];
}

/** Ângulo do tronco (graus) que põe o pescoço em `x`, dada a anca (bissecção; o tronco só se inclina para a frente). */
function torsoForNeckX(hipX: number, x: number, bend: number): number {
  const neckAt = (t: number) => hipX + Math.sin(rad(t)) * L.torso / 2 + Math.sin(rad(t + bend)) * L.torso / 2;
  let lo = -40, hi = 100;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (neckAt(mid) < x) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

export function joints(p: Pose): Joints {
  if (p.neckX !== undefined) {
    // anca com o tronco provisório; depois afina-se o ângulo
    const probe = joints({ ...p, neckX: undefined });
    return joints({ ...p, neckX: undefined, torso: torsoForNeckX(probe.hip[0], p.neckX, p.bend ?? 0) });
  }
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
  let elbow: Pt, wrist: Pt;
  if (p.reach || p.hand) {
    const reach: Pt = p.reach ?? [p.hand![0] - neck[0], p.hand![1] - neck[1]];
    [elbow, wrist] = armIK(neck, reach, p.elbow ?? 'down');
  } else {
    elbow = add(neck, dir(p.uarm ?? 180), L.uarm);
    wrist = add(elbow, dir(p.farm ?? 180), L.farm);
  }
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
    hands: [[r1(j.wrist[0]), r1(j.wrist[1])]],
    feet: [[r1(j.ankle[0]), r1(j.ankle[1])], ...(j.ankle2 ? [[r1(j.ankle2[0]), r1(j.ankle2[1])] as Pt] : [])],
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
    hands: [wL, wR].map((w) => [r1(w[0]), r1(w[1])] as Pt),
    feet: [legL, legR].map((w) => [r1(w[0]), r1(w[1])] as Pt),
  };
}

// ---------- fábrica ----------
export interface Spec {
  id: string;
  label: string;
  props?: Prop[];
  pulley?: Pt;
}

const mix = (a: number, b: number): number => (a + b) / 2;
const mixPose = (a: Pose, b: Pose): Pose => ({
  anchor: a.anchor, at: [mix(a.at[0], b.at[0]), mix(a.at[1], b.at[1])],
  shin: mix(a.shin, b.shin), thigh: mix(a.thigh, b.thigh), torso: mix(a.torso, b.torso),
  bend: mix(a.bend ?? 0, b.bend ?? 0),
  uarm: a.uarm !== undefined && b.uarm !== undefined ? mix(a.uarm, b.uarm) : undefined,
  farm: a.farm !== undefined && b.farm !== undefined ? mix(a.farm, b.farm) : undefined,
  reach: a.reach && b.reach ? [mix(a.reach[0], b.reach[0]), mix(a.reach[1], b.reach[1])] : undefined,
  hand: a.hand && b.hand ? [mix(a.hand[0], b.hand[0]), mix(a.hand[1], b.hand[1])] : undefined,
  neckX: a.neckX !== undefined && b.neckX !== undefined ? mix(a.neckX, b.neckX) : undefined,
  elbow: a.elbow,
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
  id: s.id, label: s.label, pulley: s.pulley, props: s.props ?? [], from: side(a, weight), mid: side(mixPose(a, b), weight), to: side(b, weight),
});
export const frontMotion = (s: Spec, a: FrontPose, b: FrontPose, weight = false): Motion => ({
  id: s.id, label: s.label, pulley: s.pulley, props: s.props ?? [], from: front(a, weight), mid: front(mixFront(a, b), weight), to: front(b, weight),
});

/**
 * Banco (ou encosto) desenhado ao longo do tronco da pose: a linha do banco acompanha a coluna, por isso o ângulo do
 * banco é sempre o do tronco. Inclui a almofada do assento e os pés do banco.
 */
export function benchAlong(p: Pose, opts: { kind?: Prop['kind']; seat?: boolean } = {}): Prop[] {
  const j = joints(p);
  const t: Pt = [j.neck[0] - j.hip[0], j.neck[1] - j.hip[1]];
  const len = Math.hypot(t[0], t[1]) || 1;
  const u: Pt = [t[0] / len, t[1] / len];
  let n: Pt = [-u[1], u[0]];
  if (n[1] < 0) n = [-n[0], -n[1]];
  const kind = opts.kind ?? 'bench';
  const r = (v: number) => Math.round(v * 10) / 10;
  const lo: Pt = [j.hip[0] - u[0] * 6 + n[0] * 4.5, j.hip[1] - u[1] * 6 + n[1] * 4.5];
  const hi: Pt = [j.neck[0] + u[0] * 9 + n[0] * 4.5, j.neck[1] + u[1] * 9 + n[1] * 4.5];
  const floor = 90;
  const parts = [`M${r(lo[0])} ${r(lo[1])} L${r(hi[0])} ${r(hi[1])}`];
  // assento (pequeno, horizontal) e pés do banco
  const seatY = lo[1];
  if (opts.seat !== false) parts.push(`M${r(lo[0])} ${r(seatY)} H${r(lo[0] + 14)}`);
  if (seatY < floor - 1) parts.push(`M${r(lo[0] + 4)} ${r(seatY)} V${floor}`);
  if (hi[1] < floor - 1 && Math.abs(hi[1] - lo[1]) > 6) parts.push(`M${r(hi[0])} ${r(hi[1])} V${floor}`);
  return [{ kind, d: parts.join(' ') }];
}

/** Assento (sem encosto) sob a anca de uma pose sentada: linha horizontal até ao joelho e o pé do banco. */
export function seatAt(p: Pose, kind: Prop['kind'] = 'bench'): Prop[] {
  const j = joints(p);
  const r = (v: number) => Math.round(v * 10) / 10;
  const y = j.hip[1] + 5;
  return [{ kind, d: `M${r(j.hip[0] - 8)} ${r(y)} H${r(j.knee[0] - 2)} M${r(j.hip[0] - 3)} ${r(y)} V90` }];
}

export const BENCH: Prop = { kind: 'bench', d: 'M20 76 H72 M26 76 V90 M66 76 V90' };
export const PAD: Prop = { kind: 'pad', d: 'M10 88 H82' };
