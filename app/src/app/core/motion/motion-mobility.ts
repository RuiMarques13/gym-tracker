import { frontMotion, joints, lying, Motion, PAD, Pose, sideMotion, standing } from './motion-core';

const m = sideMotion;
const f = frontMotion;
const WALL = { kind: 'wall' as const, d: 'M78 14 V90' };
const quad = (over: Partial<Pose> = {}): Pose => ({
  anchor: 'hip', at: [40, 66], shin: 90, thigh: 0, torso: 90, uarm: 180, farm: 180, leg2: [0, 90], ...over,
});

/** A mão segura o ponto `to` do corpo da própria pose (tornozelo da perna livre, joelho…). */
const grab = (p: Pose, to: 'ankle2' | 'knee' | 'knee2', elbow: 'down' | 'up' | 'back' | 'front' = 'back'): Pose => {
  const j = joints(p);
  const t = j[to] ?? j.knee;
  return { ...p, hand: [t[0], t[1]], elbow };
};
const DOME = { kind: 'step' as const, d: 'M26 90 Q46 76 66 90 Z' };

export const MOBILITY_MOTIONS: Motion[] = [
  m({ id: 'mob-9090', label: '90/90 da anca', props: [PAD] },
    { anchor: 'hip', at: [40, 82], shin: 90, thigh: -90, torso: 0, uarm: 100, farm: 100, leg2: [90, 90] },
    { anchor: 'hip', at: [40, 82], shin: 90, thigh: -90, torso: 38, uarm: 100, farm: 100, leg2: [90, 90] }),
  m({ id: 'mob-couch', label: 'Alongamento dos flexores da anca (couch stretch)', props: [{ kind: 'wall', d: 'M16 30 V90' }] },
    { anchor: 'ankle', at: [66, 90], shin: 6, thigh: -80, torso: 4, uarm: 150, farm: 20, leg2: [41, 143] },
    { anchor: 'ankle', at: [66, 90], shin: 6, thigh: -80, torso: -6, uarm: 150, farm: 20, leg2: [41, 143] }),
  m({ id: 'mob-wgs', label: 'World’s greatest stretch', props: [PAD] },
    { anchor: 'ankle', at: [60, 88], shin: 12, thigh: -66, torso: 52, uarm: 175, farm: 175, leg2: [74, 84] },
    { anchor: 'ankle', at: [60, 88], shin: 12, thigh: -66, torso: 40, uarm: 8, farm: 4, leg2: [74, 84] }),
  m({ id: 'mob-pigeon', label: 'Pombo', props: [PAD] },
    { anchor: 'hip', at: [44, 80], shin: 100, thigh: -80, torso: 30, uarm: 120, farm: 120, leg2: [90, 90] },
    { anchor: 'hip', at: [44, 80], shin: 100, thigh: -80, torso: 84, uarm: 92, farm: 92, leg2: [90, 90] }),
  m({ id: 'mob-squat', label: 'Agachamento profundo', props: [] },
    standing({ shin: 30, thigh: -108, torso: 24, uarm: 150, farm: 15 }), standing({ shin: 34, thigh: -112, torso: 34, uarm: 150, farm: 15 })),
  m({ id: 'mob-ankle', label: 'Mobilidade do tornozelo na parede', props: [{ kind: 'wall', d: 'M76 12 V90' }] },
    standing({ at: [48, 90], shin: 4, thigh: 2, torso: 4, uarm: 80, farm: 80 }),
    standing({ at: [48, 90], shin: 26, thigh: 12, torso: 14, uarm: 80, farm: 80 })),
  m({ id: 'mob-catcamel', label: 'Gato-camelo', props: [PAD] },
    quad({ torso: 78, bend: 24 }), quad({ torso: 102, bend: -24 })),
  m({ id: 'mob-thoracic', label: 'Rotação torácica', props: [PAD] },
    quad({ uarm: 150, farm: 300 }), quad({ uarm: 28, farm: 300 })),
  m({ id: 'mob-openbook', label: 'Open book', props: [PAD] },
    lying({ at: [40, 84], shin: 20, thigh: 150, uarm: 0, farm: 0 }), lying({ at: [40, 84], shin: 20, thigh: 150, uarm: 90, farm: 90 })),
  f({ id: 'mob-pec', label: 'Alongamento do peitoral na porta', props: [{ kind: 'wall', d: 'M30 6 V90' }] },
    { ua: [86, 8], fa: [180, 8] }, { ua: [104, 8], fa: [180, 8] }),
  f({ id: 'mob-dislocate', label: 'Dislocates', props: [] }, { ua: [14, 14], fa: [14, 14] }, { ua: [172, 172], fa: [172, 172] }, true),
  m({ id: 'mob-child', label: 'Posição da criança', props: [PAD] },
    { anchor: 'ankle', at: [18, 88], shin: 88, thigh: 0, torso: 0, uarm: 178, farm: 178 },
    { anchor: 'ankle', at: [18, 88], shin: 88, thigh: -56, torso: 86, uarm: 92, farm: 92 }),
  m({ id: 'mob-hamstring', label: 'Alongamento de isquiotibiais' },
    standing({ uarm: 175, farm: 175 }), standing({ shin: 4, thigh: -6, torso: 64, bend: 24, uarm: 175, farm: 175 })),
  f({ id: 'mob-cossack', label: 'Cossack squat' }, { leg: [10, 10] }, { hipY: 70, leg: [62, 62], ua: [40, -40], fa: [60, -60] }),

  // ---- mobilidade dinâmica ----
  m({ id: 'mob-hipcar', label: 'Círculos de anca (CARs)' },
    standing({ uarm: 150, farm: 20, leg2: [-85, 0] }), standing({ uarm: 150, farm: 20, leg2: [-8, 125] })),
  f({ id: 'mob-shouldercar', label: 'Círculos de ombro (CARs)' }, { ua: [8, 8], fa: [8, 8] }, { ua: [8, 170], fa: [8, 175] }),

  // ---- alongamento estático ----
  m({ id: 'mob-quad', label: 'Alongamento de quadríceps em pé' },
    grab(standing({ torso: 0, leg2: [2, 125] }), 'ankle2'), grab(standing({ torso: -8, leg2: [8, 150] }), 'ankle2')),
  m({ id: 'mob-calf', label: 'Alongamento de gémeos na parede', props: [{ kind: 'wall', d: 'M80 12 V90' }] },
    { anchor: 'ankle', at: [28, 90], shin: 14, thigh: 14, torso: 14, uarm: 76, farm: 86, leg2: [-40, -8] },
    { anchor: 'ankle', at: [28, 90], shin: 22, thigh: 22, torso: 22, uarm: 76, farm: 86, leg2: [-40, -8] }),
  m({ id: 'mob-butterfly', label: 'Borboleta (adutores)', props: [PAD] },
    { anchor: 'hip', at: [40, 80], shin: 97, thigh: -75, torso: 4, uarm: 120, farm: 100, leg2: [-75, 97] },
    { anchor: 'hip', at: [40, 80], shin: 97, thigh: -75, torso: 48, uarm: 125, farm: 105, leg2: [-75, 97] }),
  m({ id: 'mob-fig4', label: 'Figura 4 (glúteos)', props: [PAD] },
    grab(lying({ at: [48, 82], shin: 6, thigh: 150, leg2: [128, 238] }), 'knee'),
    grab(lying({ at: [48, 82], shin: 6, thigh: 178, leg2: [150, 250] }), 'knee')),
  m({ id: 'mob-triceps', label: 'Alongamento de tríceps e ombro' },
    standing({ torso: 0, uarm: 4, farm: 140 }), standing({ torso: 0, uarm: 4, farm: 206 })),
  f({ id: 'mob-neck', label: 'Alongamento de pescoço' },
    { ua: [8, 150], fa: [8, 215] }, { tilt: 10, ua: [8, 150], fa: [8, 215] }),

  // ---- equilíbrio e estabilidade ----
  m({ id: 'mob-balance', label: 'Equilíbrio num pé' },
    standing({ torso: -2, uarm: 100, farm: 98, leg2: [-84, 2] }), standing({ torso: 3, uarm: 122, farm: 120, leg2: [-84, 2] })),
  m({ id: 'mob-star', label: 'Star excursion' },
    standing({ shin: 6, thigh: -8, torso: 14, uarm: 80, farm: 80, leg2: [-62, -62] }),
    standing({ shin: 10, thigh: -12, torso: 30, uarm: 250, farm: 250, leg2: [40, 40] })),
  m({ id: 'mob-bosu', label: 'Equilíbrio em bosu', props: [DOME] },
    standing({ at: [43, 81], torso: -2, uarm: 100, farm: 98 }), standing({ at: [49, 81], torso: 3, uarm: 122, farm: 120 })),

  // ---- yoga e pilates ----
  m({ id: 'mob-dog', label: 'Cão a olhar para baixo', props: [PAD] },
    { anchor: 'ankle', at: [22, 90], shin: 26, thigh: 26, torso: 152, hand: [74, 90], elbow: 'up' },
    { anchor: 'ankle', at: [22, 90], shin: 34, thigh: 34, torso: 146, hand: [74, 90], elbow: 'up' }),
  m({ id: 'mob-cobra', label: 'Cobra', props: [PAD] },
    { anchor: 'hip', at: [44, 82], shin: 90, thigh: 90, torso: 84, hand: [74, 86], elbow: 'back' },
    { anchor: 'hip', at: [44, 82], shin: 90, thigh: 90, torso: 58, bend: -22, hand: [74, 86], elbow: 'back' }),
  f({ id: 'mob-warrior', label: 'Guerreiro II' },
    { hipY: 58, leg: [38, 38], ua: [90, 90], fa: [90, 90] }, { hipY: 64, leg: [46, 46], ua: [90, 90], fa: [90, 90] }),
  m({ id: 'mob-sun', label: 'Saudação ao sol' },
    standing({ uarm: 70, farm: 40 }), standing({ torso: 118, bend: 28, uarm: 175, farm: 178 })),
  m({ id: 'mob-hundred', label: 'The hundred', props: [PAD] },
    lying({ at: [44, 82], shin: 120, thigh: 120, torso: 90, bend: -34, uarm: 258, farm: 258 }),
    lying({ at: [44, 82], shin: 120, thigh: 120, torso: 90, bend: -34, uarm: 280, farm: 280 })),
  m({ id: 'mob-rollup', label: 'Roll-up', props: [PAD] },
    lying({ at: [44, 82], shin: 90, thigh: 90, torso: 88, uarm: 90, farm: 90 }),
    lying({ at: [44, 82], shin: 90, thigh: 90, torso: -4, bend: -52, uarm: 262, farm: 262 })),
];

// ---- Cardio ----
const run = (a: number, b: number, arm: number): [Pose, Pose] => [
  { anchor: 'hip', at: [46, 54], shin: -2, thigh: -a, torso: 8, uarm: 180 + arm, farm: 40 - arm / 2, leg2: [b, b * 3 - 20] },
  { anchor: 'hip', at: [46, 54], shin: b * 3 - 20, thigh: b, torso: 8, uarm: 180 - arm, farm: 40 + arm / 2, leg2: [-a, -2] },
];

export const CARDIO_MOTIONS: Motion[] = [
  m({ id: 'run', label: 'Corrida', props: [{ kind: 'pad', d: 'M8 90 H92' }] }, ...run(62, 22, 80)),
  m({ id: 'walk', label: 'Caminhada' }, ...run(26, 14, 40)),
  m({ id: 'bike', label: 'Bicicleta', props: [{ kind: 'machine', d: 'M30 56 L52 78 M18 58 H34 M62 66 L70 56 H78' }] },
    { anchor: 'hip', at: [30, 54], shin: -6, thigh: -78, torso: 40, uarm: 100, farm: 130, leg2: [-8, 20] },
    { anchor: 'hip', at: [30, 54], shin: 14, thigh: -22, torso: 40, uarm: 100, farm: 130, leg2: [-78, -6] }),
  m({ id: 'rower', label: 'Remo', props: [{ kind: 'pad', d: 'M10 84 H92' }] },
    { anchor: 'hip', at: [50, 78], shin: -30, thigh: -150, torso: 24, uarm: 85, farm: 85 },
    { anchor: 'hip', at: [30, 78], shin: -84, thigh: -84, torso: -26, uarm: 235, farm: 100 }),
  m({ id: 'elliptical', label: 'Elíptica', props: [{ kind: 'machine', d: 'M66 20 V60' }] },
    { anchor: 'hip', at: [44, 54], shin: -4, thigh: -30, torso: 4, uarm: 120, farm: 150, leg2: [20, 12] },
    { anchor: 'hip', at: [44, 54], shin: 12, thigh: 20, torso: 4, uarm: 200, farm: 130, leg2: [-30, -4] }),
  m({ id: 'stairs', label: 'Escadas', props: [{ kind: 'step', d: 'M24 82 H44 V90 M56 74 H76 V82' }] },
    { anchor: 'hip', at: [46, 50], shin: -4, thigh: -70, torso: 14, uarm: 140, farm: 120, leg2: [10, 12] },
    { anchor: 'hip', at: [46, 50], shin: 12, thigh: 10, torso: 14, uarm: 220, farm: 140, leg2: [-70, -4] }),
  m({ id: 'skierg', label: 'Ski erg' },
    standing({ uarm: 30, farm: 30 }), standing({ shin: 12, thigh: -34, torso: 40, uarm: 170, farm: 170 }), true),
];
