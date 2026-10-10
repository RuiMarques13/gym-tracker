import { Motion, PAD, sideMotion, standing } from './motion-core';

const m = sideMotion;
const STEP = { kind: 'step' as const, d: 'M20 80 H44 V90' };

export const LEG_MOTIONS: Motion[] = [
  // Agachamentos: a carga mantém-se na vertical sobre o meio do pé; é o comprimento dos segmentos que decide a inclinação
  // do tronco (neckX). Fundo = coxa à horizontal, tíbia ~30° à frente.
  m({ id: 'squat', label: 'Agachamento com barra' },
    standing({ at: [44, 90], neckX: 46, uarm: 200, farm: 20 }), standing({ at: [44, 90], shin: 30, thigh: -98, neckX: 46, uarm: 200, farm: 20 }), true),
  m({ id: 'squat-front', label: 'Agachamento frontal' },
    standing({ at: [44, 90], neckX: 44, uarm: 85, farm: 340 }), standing({ at: [44, 90], shin: 30, thigh: -98, neckX: 44, uarm: 85, farm: 340 }), true),
  m({ id: 'goblet', label: 'Agachamento goblet' },
    standing({ at: [44, 90], neckX: 45, reach: [8, 8], elbow: 'down' }), standing({ at: [44, 90], shin: 30, thigh: -98, neckX: 45, reach: [8, 8], elbow: 'down' }), true),
  m({ id: 'squat-bw', label: 'Agachamento' },
    standing({ at: [44, 90], neckX: 43, uarm: 100, farm: 90 }), standing({ at: [44, 90], shin: 30, thigh: -98, neckX: 41, uarm: 90, farm: 90 })),
  m({ id: 'squat-box', label: 'Agachamento ao caixote', props: [{ kind: 'box', d: 'M8 75 H30 V90' }] },
    standing({ at: [44, 90], neckX: 46, uarm: 200, farm: 20 }), standing({ at: [44, 90], shin: 6, thigh: -90, neckX: 48, uarm: 200, farm: 20 }), true),
  m({ id: 'hack', label: 'Hack squat', props: [{ kind: 'machine', d: 'M34 12 L50 90' }] },
    standing({ at: [52, 90], shin: -4, thigh: -4, torso: -12, uarm: 180, farm: 180 }),
    standing({ at: [52, 90], shin: 30, thigh: -90, torso: -12, uarm: 180, farm: 180 })),
  // Prensa: o pé fica fixo na plataforma e é o corpo que se aproxima dela; costas encostadas ao banco inclinado.
  m({ id: 'legpress', label: 'Prensa de pernas', props: [{ kind: 'machine', d: 'M20 90 L64 54 M70 44 L82 58' }] },
    { anchor: 'ankle', at: [72, 54], shin: 229, thigh: 229, torso: -50, uarm: 160, farm: 170, foot: 140 },
    { anchor: 'ankle', at: [72, 54], shin: 290, thigh: 183, torso: -50, uarm: 160, farm: 170, foot: 140 }),
  m({ id: 'lunge', label: 'Afundo' }, standing({ at: [46, 88], leg2: [0, 0], uarm: 178, farm: 178 }),
    standing({ at: [46, 88], shin: 20, thigh: -62, torso: 6, leg2: [32, 86], uarm: 178, farm: 178 }), true),
  m({ id: 'split', label: 'Agachamento búlgaro', props: [{ kind: 'bench', d: 'M4 76 H30 M8 76 V90' }] },
    standing({ at: [52, 90], shin: 2, thigh: -2, torso: 4, leg2: [42, 62], uarm: 178, farm: 178 }),
    standing({ at: [52, 90], shin: 24, thigh: -70, torso: 14, leg2: [64, 98], uarm: 178, farm: 178 }), true),
  m({ id: 'stepup', label: 'Step-up', props: [STEP] },
    standing({ at: [34, 90], shin: 0, thigh: 0, torso: 4, leg2: [0, 0], uarm: 178, farm: 178 }),
    standing({ at: [32, 80], shin: 0, thigh: 2, torso: 4, leg2: [0, 0], uarm: 178, farm: 178 }), true),
  m({ id: 'legext', label: 'Extensão de pernas', props: [{ kind: 'machine', d: 'M24 62 H40 V90 M24 62 V40' }] },
    { anchor: 'hip', at: [34, 62], shin: 0, thigh: -90, torso: 0, uarm: 150, farm: 160 },
    { anchor: 'hip', at: [34, 62], shin: -88, thigh: -90, torso: 0, uarm: 150, farm: 160 }),
  m({ id: 'legcurl-lying', label: 'Leg curl deitado', props: [PAD] },
    { anchor: 'hip', at: [50, 80], shin: 90, thigh: 90, torso: 90, uarm: 20, farm: 20 },
    { anchor: 'hip', at: [50, 80], shin: 170, thigh: 90, torso: 90, uarm: 20, farm: 20 }),
  m({ id: 'legcurl-seated', label: 'Leg curl sentado', props: [{ kind: 'machine', d: 'M24 62 H40 M24 62 V40' }] },
    { anchor: 'hip', at: [34, 62], shin: -88, thigh: -90, torso: 0, uarm: 150, farm: 160 },
    { anchor: 'hip', at: [34, 62], shin: 25, thigh: -90, torso: 0, uarm: 150, farm: 160 }),
  m({ id: 'nordic', label: 'Nordic curl', props: [PAD] },
    { anchor: 'ankle', at: [14, 87], shin: 88, thigh: 2, torso: 2, uarm: 150, farm: 150 },
    { anchor: 'ankle', at: [14, 87], shin: 88, thigh: 62, torso: 72, uarm: 125, farm: 150 }),
  m({ id: 'calf', label: 'Elevação de gémeos', props: [{ kind: 'step', d: 'M32 90 H60' }] },
    standing({ at: [46, 88], uarm: 178, farm: 178 }), standing({ at: [46, 84], foot: 140, uarm: 178, farm: 178 })),
  m({ id: 'calf-seated', label: 'Gémeos sentado', props: [{ kind: 'bench', d: 'M16 72 H42 M22 72 V90' }] },
    { anchor: 'ankle', at: [56, 88], shin: -8, thigh: -92, torso: 0, uarm: 170, farm: 120 },
    { anchor: 'ankle', at: [56, 84], foot: 140, shin: -8, thigh: -92, torso: 0, uarm: 170, farm: 120 }),
  m({ id: 'tibialis', label: 'Elevação da ponta do pé', props: [{ kind: 'wall', d: 'M70 20 V90' }] },
    standing({ at: [52, 88], shin: 4, thigh: 4, torso: 6, uarm: 150, farm: 150 }),
    standing({ at: [52, 88], shin: 4, thigh: 4, torso: 6, foot: 50, uarm: 150, farm: 150 })),
];
