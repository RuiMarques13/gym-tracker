import { BENCH, benchAlong, frontMotion, lying, Motion, PAD, Pose, seatAt, sideMotion, standing } from './motion-core';

const m = sideMotion;
const f = frontMotion;
const INCLINE = { kind: 'incline' as const, d: 'M18 78 L52 54 M26 78 V90 M56 54 V90' };

export const UPPER_MOTIONS: Motion[] = [
  // ---- Peito ----
  // ---- Supinos (biomecânica): a carga sobe e desce numa linha quase vertical sobre o peito; no fundo o antebraço fica
  // vertical (pulso sobre o cotovelo) e o cotovelo para o lado dos pés; em cima o braço fica esticado. O banco acompanha o
  // tronco: horizontal (0°), inclinado (~35° acima da horizontal) e declinado (~15° abaixo).
  ...[
    { id: 'bench', label: 'Supino', pose: lying({ at: [30, 72] }), lock: [-3, -21.3] as [number, number], touch: [-3, -6.5] as [number, number], elbow: 'down' as const },
    { id: 'bench-incline', label: 'Supino inclinado', pose: { anchor: 'hip', at: [46, 71], shin: 0, thigh: -90, torso: -55 } as Pose, lock: [6, -21.3] as [number, number], touch: [6, -1] as [number, number], elbow: 'down' as const },
    { id: 'bench-decline', label: 'Supino declinado', pose: lying({ at: [26, 64], torso: 105 }), lock: [-4, -21.3] as [number, number], touch: [-4, -6] as [number, number], elbow: 'down' as const },
  ].map((b) => m({ id: b.id, label: b.label, props: benchAlong(b.pose) },
    { ...b.pose, reach: b.lock, elbow: b.elbow }, { ...b.pose, reach: b.touch, elbow: b.elbow }, true)),
  // Chest press (máquina): costas encostadas, as mãos empurram em linha recta à frente do peito (perpendicular ao encosto).
  ...[
    { id: 'chestpress', label: 'Chest press', torso: -3, from: [4, 9], to: [26, 9] },
    { id: 'chestpress-incline', label: 'Chest press inclinado', torso: -24, from: [4, 9], to: [23, -3] },
    { id: 'chestpress-decline', label: 'Chest press declinado', torso: -3, from: [4, 7], to: [24, 19] },
  ].map((c) => {
    const base: Pose = { anchor: 'hip', at: [36, 70], shin: 2, thigh: -90, torso: c.torso };
    return m({ id: c.id, label: c.label, props: benchAlong(base, { kind: 'machine' }) },
      { ...base, reach: c.from as [number, number], elbow: 'back' }, { ...base, reach: c.to as [number, number], elbow: 'back' }, true);
  }),
  m({ id: 'chestpress-standing', label: 'Chest press de pé', pulley: [6, 38] },
    standing({ shin: 6, thigh: -4, torso: 12, reach: [3, 10], elbow: 'back' }), standing({ shin: 6, thigh: -4, torso: 12, reach: [26, 8], elbow: 'back' }), true),
  f({ id: 'fly', label: 'Abertura (vista de frente)' }, { ua: [88, 88], fa: [60, 60] }, { ua: [30, 30], fa: [10, 10] }, true),
  m({ id: 'pullover', label: 'Pullover', props: [BENCH] }, lying({ uarm: 0, farm: 0 }), lying({ uarm: 80, farm: 92 }), true),
  m({ id: 'pushup', label: 'Flexão', props: [PAD] },
    { anchor: 'ankle', at: [10, 88], shin: 70, thigh: 70, torso: 72, uarm: 180, farm: 180 },
    { anchor: 'ankle', at: [10, 88], shin: 78, thigh: 78, torso: 80, uarm: 100, farm: 195 }),
  m({ id: 'dips', label: 'Paralelas', props: [{ kind: 'bar', d: 'M40 48 H66' }] },
    { anchor: 'hip', at: [50, 52], shin: 70, thigh: 12, torso: 4, uarm: 178, farm: 180 },
    { anchor: 'hip', at: [50, 64], shin: 70, thigh: 12, torso: 12, uarm: 205, farm: 70 }),
  m({ id: 'pushup-pike', label: 'Flexão em pike', props: [PAD] },
    { anchor: 'ankle', at: [28, 88], shin: 12, thigh: 24, torso: 8, uarm: 170, farm: 170 },
    { anchor: 'ankle', at: [28, 88], shin: 12, thigh: 24, torso: 40, uarm: 100, farm: 190 }),
  // ---- Costas ----
  // Remadas: a barra/halter sobe numa linha vertical (rente ao corpo) até à parte baixa do peito/abdómen, com o cotovelo para
  // trás; o tronco quase paralelo ao chão e a carga sobre o meio do pé.
  m({ id: 'row-bent', label: 'Remada curvada' },
    standing({ at: [44, 90], shin: 8, thigh: -40, neckX: 52, hand: [49.5, 69], elbow: 'back' }),
    standing({ at: [44, 90], shin: 8, thigh: -40, neckX: 52, hand: [49.5, 50], elbow: 'back' }), true),
  m({ id: 'row-one', label: 'Remada unilateral', props: [{ kind: 'bench', d: 'M62 56 H92 M68 56 V90' }] },
    standing({ at: [40, 90], shin: 4, thigh: -34, torso: 74, reach: [0, 28], elbow: 'back' }),
    standing({ at: [40, 90], shin: 4, thigh: -34, torso: 74, reach: [0, 9], elbow: 'back' }), true),
  m({ id: 'row-seated', label: 'Remada sentada', pulley: [96, 59],
      props: seatAt({ anchor: 'hip', at: [32, 70], shin: 2, thigh: -90, torso: 4 }) },
    { anchor: 'hip', at: [32, 70], shin: 2, thigh: -90, torso: 8, reach: [24, 13], elbow: 'back' },
    { anchor: 'hip', at: [32, 70], shin: 2, thigh: -90, torso: -6, reach: [5, 13], elbow: 'back' }, true),
  m({ id: 'pulldown', label: 'Puxada', pulley: [50, 4],
      props: [...seatAt({ anchor: 'hip', at: [36, 70], shin: 2, thigh: -90, torso: -8 }), { kind: 'machine', d: 'M52 62 H66' }] },
    { anchor: 'hip', at: [36, 70], shin: 2, thigh: -90, torso: -4, reach: [5, -27], elbow: 'back' },
    { anchor: 'hip', at: [36, 70], shin: 2, thigh: -90, torso: -12, reach: [6, 6], elbow: 'down' }, true),
  // Barra fixa: as mãos ficam na barra; é o corpo que sobe até o queixo passar a barra.
  m({ id: 'pullup', label: 'Barra fixa', props: [{ kind: 'bar', d: 'M30 6 H68' }] },
    { anchor: 'hip', at: [46, 57], shin: 100, thigh: 0, torso: 0, hand: [50, 6], elbow: 'down' },
    { anchor: 'hip', at: [46, 43], shin: 100, thigh: 0, torso: 0, hand: [50, 6], elbow: 'down' }),
  m({ id: 'straightarm', label: 'Pullover no cabo', props: [{ kind: 'cable', d: 'M52 4 V22' }] },
    standing({ shin: 3, thigh: -3, torso: 22, uarm: 40, farm: 40 }), standing({ shin: 3, thigh: -3, torso: 22, uarm: 170, farm: 170 })),
  m({ id: 'hyper', label: 'Hiperextensão', props: [{ kind: 'pad', d: 'M30 52 H54 M42 52 V90' }] },
    { anchor: 'hip', at: [48, 52], shin: 88, thigh: 92, torso: 148, bend: 0, uarm: 190, farm: 190 },
    { anchor: 'hip', at: [48, 52], shin: 88, thigh: 92, torso: 92, bend: 0, uarm: 190, farm: 190 }),
  f({ id: 'shrug', label: 'Encolhimento' }, { ua: [8, 8], fa: [8, 8] }, { ua: [8, 8], fa: [8, 8], shrug: 5 }, true),
  // ---- Ombros ----
  // Press de ombros: trajetória vertical, ligeiramente à frente da cara; em cima a carga fica sobre o ombro, anca e pé.
  m({ id: 'press', label: 'Desenvolvimento' },
    standing({ reach: [7, -7], elbow: 'down' }), standing({ reach: [6, -21], elbow: 'down' }), true),
  m({ id: 'press-seated', label: 'Desenvolvimento sentado', props: [{ kind: 'bench', d: 'M24 24 V64 M24 64 H48 M30 64 V90' }] },
    { anchor: 'hip', at: [30, 64], shin: 4, thigh: -90, torso: 0, reach: [7, -7], elbow: 'down' },
    { anchor: 'hip', at: [30, 64], shin: 4, thigh: -90, torso: 0, reach: [6, -21], elbow: 'down' }, true),
  f({ id: 'lateral', label: 'Elevação lateral' }, { ua: [10, 10], fa: [10, 10] }, { ua: [88, 88], fa: [88, 88] }, true),
  m({ id: 'front-raise', label: 'Elevação frontal' }, standing({ uarm: 178, farm: 178 }), standing({ uarm: 92, farm: 92 }), true),
  f({ id: 'rear-raise', label: 'Elevação posterior' }, { lean: 72, ua: [12, 12], fa: [12, 12] }, { lean: 72, ua: [88, 88], fa: [88, 88] }, true),
  m({ id: 'upright', label: 'Remada alta' }, standing({ uarm: 178, farm: 178 }), standing({ uarm: 78, farm: 205 }), true),
  m({ id: 'facepull', label: 'Face pull', props: [{ kind: 'cable', d: 'M60 38 H94' }] },
    standing({ uarm: 90, farm: 90 }), standing({ uarm: 252, farm: 52 })),
  f({ id: 'rotation-ext', label: 'Rotação externa' }, { ua: [8, 8], fa: [-80, -80] }, { ua: [8, 8], fa: [80, 80] }, true),
  // ---- Braços ----
  m({ id: 'curl', label: 'Curl' }, standing({ uarm: 182, farm: 182 }), standing({ uarm: 186, farm: 30 }), true),
  m({ id: 'curl-preacher', label: 'Curl no banco Scott', props: [{ kind: 'incline', d: 'M52 80 L66 62 H50' }] },
    standing({ at: [36, 90], uarm: 150, farm: 150 }), standing({ at: [36, 90], uarm: 150, farm: -30 }), true),
  m({ id: 'curl-hammer', label: 'Curl martelo' }, standing({ uarm: 182, farm: 182 }), standing({ uarm: 186, farm: 30 }), true),
  m({ id: 'wrist-curl', label: 'Curl de pulso', props: [{ kind: 'bench', d: 'M30 70 H70' }] },
    { anchor: 'hip', at: [30, 62], shin: 4, thigh: -90, torso: 12, uarm: 150, farm: 105 },
    { anchor: 'hip', at: [30, 62], shin: 4, thigh: -90, torso: 12, uarm: 150, farm: 70 }, true),
  m({ id: 'pushdown', label: 'Extensão de tríceps no cabo', props: [{ kind: 'cable', d: 'M57 4 V42' }] },
    standing({ uarm: 178, farm: 82 }), standing({ uarm: 178, farm: 176 }), true),
  m({ id: 'tri-overhead', label: 'Extensão acima da cabeça' }, standing({ uarm: 2, farm: 232 }), standing({ uarm: 2, farm: 315 }), true),
  m({ id: 'skull', label: 'Skull crusher', props: [BENCH] }, lying({ uarm: 4, farm: 128 }), lying({ uarm: 4, farm: 4 }), true),
  m({ id: 'kickback-tri', label: 'Kickback de tríceps' },
    standing({ shin: 6, thigh: -14, torso: 78, uarm: 266, farm: 185 }), standing({ shin: 6, thigh: -14, torso: 78, uarm: 266, farm: 268 }), true),
  m({ id: 'hang', label: 'Suspensão na barra', props: [{ kind: 'bar', d: 'M30 6 H68' }] },
    { anchor: 'hip', at: [46, 57], shin: 100, thigh: 0, torso: 0, hand: [50, 6], elbow: 'down' },
    { anchor: 'hip', at: [46, 58], shin: 104, thigh: 2, torso: 0, hand: [50, 6], elbow: 'down' }, false),
];
