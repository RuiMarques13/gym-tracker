// GERADO por tools/import-excel/build-seed.mjs a partir de catalog.json. Não editar à mão.
import { SeedData } from './seed-types';

export const SEED: SeedData = {
  "version": 2,
  "equipment": [
    {
      "key": "machine",
      "name": "Máquina"
    },
    {
      "key": "cable",
      "name": "Cabo"
    },
    {
      "key": "dumbbell",
      "name": "Haltere"
    },
    {
      "key": "barbell",
      "name": "Barra"
    },
    {
      "key": "bodyweight",
      "name": "Peso corporal"
    },
    {
      "key": "band",
      "name": "Banda elástica"
    },
    {
      "key": "kettlebell",
      "name": "Kettlebell"
    },
    {
      "key": "other",
      "name": "Outro"
    }
  ],
  "muscles": [
    {
      "key": "quadriceps",
      "name": "Quadríceps",
      "region": "LOWER"
    },
    {
      "key": "glutes",
      "name": "Glúteos",
      "region": "LOWER"
    },
    {
      "key": "hamstrings",
      "name": "Isquiotibiais",
      "region": "LOWER"
    },
    {
      "key": "adductors",
      "name": "Adutores",
      "region": "LOWER"
    },
    {
      "key": "calves",
      "name": "Gémeos",
      "region": "LOWER"
    },
    {
      "key": "chest",
      "name": "Peito",
      "region": "UPPER"
    },
    {
      "key": "back",
      "name": "Costas",
      "region": "UPPER"
    },
    {
      "key": "shoulders",
      "name": "Ombros",
      "region": "UPPER"
    },
    {
      "key": "biceps",
      "name": "Bíceps",
      "region": "UPPER"
    },
    {
      "key": "triceps",
      "name": "Tríceps",
      "region": "UPPER"
    },
    {
      "key": "forearms",
      "name": "Antebraços",
      "region": "UPPER"
    },
    {
      "key": "abs",
      "name": "Abdominais",
      "region": "CORE"
    },
    {
      "key": "lower_back",
      "name": "Lombar",
      "region": "CORE"
    },
    {
      "key": "abductors",
      "name": "Abdutores",
      "region": "LOWER"
    },
    {
      "key": "tibialis",
      "name": "Tibial anterior",
      "region": "LOWER"
    },
    {
      "key": "traps",
      "name": "Trapézio",
      "region": "UPPER"
    },
    {
      "key": "obliques",
      "name": "Oblíquos",
      "region": "CORE"
    }
  ],
  "mobilityAreas": [
    {
      "key": "hip",
      "name": "Anca"
    },
    {
      "key": "shoulder",
      "name": "Ombro"
    },
    {
      "key": "ankle",
      "name": "Tornozelo"
    },
    {
      "key": "thoracic",
      "name": "Coluna torácica"
    },
    {
      "key": "lumbar",
      "name": "Coluna lombar"
    },
    {
      "key": "neck",
      "name": "Pescoço"
    },
    {
      "key": "wrist",
      "name": "Punho"
    },
    {
      "key": "knee",
      "name": "Joelho"
    }
  ],
  "exercises": [
    {
      "name": "Squat",
      "kind": "STRENGTH",
      "metricType": "WEIGHT_REPS",
      "isUnilateral": false,
      "isIsometric": false,
      "region": "LOWER",
      "movementType": "PUSH",
      "equipment": null,
      "defaultRestSeconds": null,
      "primary": [
        "quadriceps"
      ],
      "secondary": [
        "glutes"
      ],
      "mobilityAreas": []
    },
    {
      "name": "Sumo Squat",
      "kind": "STRENGTH",
      "metricType": "WEIGHT_REPS",
      "isUnilateral": false,
      "isIsometric": false,
      "region": "LOWER",
      "movementType": "PUSH",
      "equipment": null,
      "defaultRestSeconds": null,
      "primary": [
        "adductors"
      ],
      "secondary": [
        "glutes"
      ],
      "mobilityAreas": []
    },
    {
      "name": "RDL",
      "kind": "STRENGTH",
      "metricType": "WEIGHT_REPS",
      "isUnilateral": false,
      "isIsometric": false,
      "region": "LOWER",
      "movementType": "PULL",
      "equipment": null,
      "defaultRestSeconds": null,
      "primary": [
        "hamstrings"
      ],
      "secondary": [
        "glutes"
      ],
      "mobilityAreas": []
    },
    {
      "name": "Bulgarian Split Squat",
      "kind": "STRENGTH",
      "metricType": "WEIGHT_REPS",
      "isUnilateral": true,
      "isIsometric": false,
      "region": "LOWER",
      "movementType": "PUSH",
      "equipment": null,
      "defaultRestSeconds": null,
      "primary": [
        "quadriceps"
      ],
      "secondary": [
        "glutes"
      ],
      "mobilityAreas": []
    },
    {
      "name": "Lunges",
      "kind": "STRENGTH",
      "metricType": "WEIGHT_REPS",
      "isUnilateral": true,
      "isIsometric": false,
      "region": "LOWER",
      "movementType": "PUSH",
      "equipment": null,
      "defaultRestSeconds": null,
      "primary": [
        "quadriceps"
      ],
      "secondary": [
        "glutes"
      ],
      "mobilityAreas": []
    },
    {
      "name": "DB Stiff",
      "kind": "STRENGTH",
      "metricType": "WEIGHT_REPS",
      "isUnilateral": false,
      "isIsometric": false,
      "region": "LOWER",
      "movementType": "PULL",
      "equipment": "dumbbell",
      "defaultRestSeconds": null,
      "primary": [
        "hamstrings"
      ],
      "secondary": [],
      "mobilityAreas": []
    },
    {
      "name": "Hip Thrust",
      "kind": "STRENGTH",
      "metricType": "WEIGHT_REPS",
      "isUnilateral": false,
      "isIsometric": false,
      "region": "LOWER",
      "movementType": "PULL",
      "equipment": null,
      "defaultRestSeconds": null,
      "primary": [
        "glutes"
      ],
      "secondary": [],
      "mobilityAreas": []
    },
    {
      "name": "1 Leg Hip Thrust",
      "kind": "STRENGTH",
      "metricType": "WEIGHT_REPS",
      "isUnilateral": true,
      "isIsometric": false,
      "region": "LOWER",
      "movementType": "PULL",
      "equipment": null,
      "defaultRestSeconds": null,
      "primary": [
        "glutes"
      ],
      "secondary": [],
      "mobilityAreas": []
    },
    {
      "name": "M Chest Press",
      "kind": "STRENGTH",
      "metricType": "WEIGHT_REPS",
      "isUnilateral": false,
      "isIsometric": false,
      "region": "UPPER",
      "movementType": "PUSH",
      "equipment": "machine",
      "defaultRestSeconds": null,
      "primary": [
        "chest"
      ],
      "secondary": [],
      "mobilityAreas": []
    },
    {
      "name": "DB Incline Chest Press",
      "kind": "STRENGTH",
      "metricType": "WEIGHT_REPS",
      "isUnilateral": false,
      "isIsometric": false,
      "region": "UPPER",
      "movementType": "PUSH",
      "equipment": "dumbbell",
      "defaultRestSeconds": null,
      "primary": [
        "chest"
      ],
      "secondary": [],
      "mobilityAreas": []
    },
    {
      "name": "DB Chest Press",
      "kind": "STRENGTH",
      "metricType": "WEIGHT_REPS",
      "isUnilateral": false,
      "isIsometric": false,
      "region": "UPPER",
      "movementType": "PUSH",
      "equipment": "dumbbell",
      "defaultRestSeconds": null,
      "primary": [
        "chest"
      ],
      "secondary": [],
      "mobilityAreas": []
    },
    {
      "name": "DB Chest Fly",
      "kind": "STRENGTH",
      "metricType": "WEIGHT_REPS",
      "isUnilateral": false,
      "isIsometric": false,
      "region": "UPPER",
      "movementType": "PUSH",
      "equipment": "dumbbell",
      "defaultRestSeconds": null,
      "primary": [
        "chest"
      ],
      "secondary": [],
      "mobilityAreas": []
    },
    {
      "name": "C Chest Fly",
      "kind": "STRENGTH",
      "metricType": "WEIGHT_REPS",
      "isUnilateral": false,
      "isIsometric": false,
      "region": "UPPER",
      "movementType": "PUSH",
      "equipment": "cable",
      "defaultRestSeconds": null,
      "primary": [
        "chest"
      ],
      "secondary": [],
      "mobilityAreas": []
    },
    {
      "name": "DB Biceps curl",
      "kind": "STRENGTH",
      "metricType": "WEIGHT_REPS",
      "isUnilateral": false,
      "isIsometric": false,
      "region": "UPPER",
      "movementType": "PULL",
      "equipment": "dumbbell",
      "defaultRestSeconds": null,
      "primary": [
        "biceps"
      ],
      "secondary": [],
      "mobilityAreas": []
    },
    {
      "name": "DB Biceps Hammer curl",
      "kind": "STRENGTH",
      "metricType": "WEIGHT_REPS",
      "isUnilateral": false,
      "isIsometric": false,
      "region": "UPPER",
      "movementType": "PULL",
      "equipment": "dumbbell",
      "defaultRestSeconds": null,
      "primary": [
        "biceps"
      ],
      "secondary": [],
      "mobilityAreas": []
    },
    {
      "name": "C Biceps curl",
      "kind": "STRENGTH",
      "metricType": "WEIGHT_REPS",
      "isUnilateral": false,
      "isIsometric": false,
      "region": "UPPER",
      "movementType": "PULL",
      "equipment": "cable",
      "defaultRestSeconds": null,
      "primary": [
        "biceps"
      ],
      "secondary": [],
      "mobilityAreas": []
    },
    {
      "name": "DB Triceps Extension",
      "kind": "STRENGTH",
      "metricType": "WEIGHT_REPS",
      "isUnilateral": false,
      "isIsometric": false,
      "region": "UPPER",
      "movementType": "PUSH",
      "equipment": "dumbbell",
      "defaultRestSeconds": null,
      "primary": [
        "triceps"
      ],
      "secondary": [],
      "mobilityAreas": []
    },
    {
      "name": "C Triceps Extension",
      "kind": "STRENGTH",
      "metricType": "WEIGHT_REPS",
      "isUnilateral": false,
      "isIsometric": false,
      "region": "UPPER",
      "movementType": "PUSH",
      "equipment": "cable",
      "defaultRestSeconds": null,
      "primary": [
        "triceps"
      ],
      "secondary": [],
      "mobilityAreas": []
    },
    {
      "name": "C Overhead Triceps Extension",
      "kind": "STRENGTH",
      "metricType": "WEIGHT_REPS",
      "isUnilateral": false,
      "isIsometric": false,
      "region": "UPPER",
      "movementType": "PUSH",
      "equipment": "cable",
      "defaultRestSeconds": null,
      "primary": [
        "triceps"
      ],
      "secondary": [],
      "mobilityAreas": []
    },
    {
      "name": "M Pulldown Neutra",
      "kind": "STRENGTH",
      "metricType": "WEIGHT_REPS",
      "isUnilateral": false,
      "isIsometric": false,
      "region": "UPPER",
      "movementType": "PULL",
      "equipment": "machine",
      "defaultRestSeconds": null,
      "primary": [
        "back"
      ],
      "secondary": [],
      "mobilityAreas": []
    },
    {
      "name": "M Pulldown Aberta",
      "kind": "STRENGTH",
      "metricType": "WEIGHT_REPS",
      "isUnilateral": false,
      "isIsometric": false,
      "region": "UPPER",
      "movementType": "PULL",
      "equipment": "machine",
      "defaultRestSeconds": null,
      "primary": [
        "back"
      ],
      "secondary": [],
      "mobilityAreas": []
    },
    {
      "name": "M Low Row",
      "kind": "STRENGTH",
      "metricType": "WEIGHT_REPS",
      "isUnilateral": false,
      "isIsometric": false,
      "region": "UPPER",
      "movementType": "PULL",
      "equipment": "machine",
      "defaultRestSeconds": null,
      "primary": [
        "back"
      ],
      "secondary": [],
      "mobilityAreas": []
    },
    {
      "name": "M High Row",
      "kind": "STRENGTH",
      "metricType": "WEIGHT_REPS",
      "isUnilateral": false,
      "isIsometric": false,
      "region": "UPPER",
      "movementType": "PULL",
      "equipment": "machine",
      "defaultRestSeconds": null,
      "primary": [
        "back"
      ],
      "secondary": [],
      "mobilityAreas": []
    },
    {
      "name": "C Pullover",
      "kind": "STRENGTH",
      "metricType": "WEIGHT_REPS",
      "isUnilateral": false,
      "isIsometric": false,
      "region": "UPPER",
      "movementType": "PULL",
      "equipment": "cable",
      "defaultRestSeconds": null,
      "primary": [
        "back"
      ],
      "secondary": [],
      "mobilityAreas": []
    },
    {
      "name": "DB Bent Row",
      "kind": "STRENGTH",
      "metricType": "WEIGHT_REPS",
      "isUnilateral": false,
      "isIsometric": false,
      "region": "UPPER",
      "movementType": "PULL",
      "equipment": "dumbbell",
      "defaultRestSeconds": null,
      "primary": [
        "back"
      ],
      "secondary": [],
      "mobilityAreas": []
    },
    {
      "name": "90/90 de anca",
      "kind": "MOBILITY",
      "metricType": "DURATION",
      "isUnilateral": true,
      "isIsometric": false,
      "region": null,
      "movementType": null,
      "equipment": null,
      "defaultRestSeconds": null,
      "primary": [],
      "secondary": [],
      "mobilityAreas": [
        "hip"
      ]
    },
    {
      "name": "Alongamento de flexores da anca (couch stretch)",
      "kind": "MOBILITY",
      "metricType": "DURATION",
      "isUnilateral": true,
      "isIsometric": false,
      "region": null,
      "movementType": null,
      "equipment": null,
      "defaultRestSeconds": null,
      "primary": [],
      "secondary": [],
      "mobilityAreas": [
        "hip"
      ]
    },
    {
      "name": "World's greatest stretch",
      "kind": "MOBILITY",
      "metricType": "REPS",
      "isUnilateral": true,
      "isIsometric": false,
      "region": null,
      "movementType": null,
      "equipment": null,
      "defaultRestSeconds": null,
      "primary": [],
      "secondary": [],
      "mobilityAreas": [
        "hip",
        "thoracic"
      ]
    },
    {
      "name": "Pombo (pigeon)",
      "kind": "MOBILITY",
      "metricType": "DURATION",
      "isUnilateral": true,
      "isIsometric": false,
      "region": null,
      "movementType": null,
      "equipment": null,
      "defaultRestSeconds": null,
      "primary": [],
      "secondary": [],
      "mobilityAreas": [
        "hip"
      ]
    },
    {
      "name": "Agachamento profundo (manter)",
      "kind": "MOBILITY",
      "metricType": "DURATION",
      "isUnilateral": false,
      "isIsometric": false,
      "region": null,
      "movementType": null,
      "equipment": null,
      "defaultRestSeconds": null,
      "primary": [],
      "secondary": [],
      "mobilityAreas": [
        "hip",
        "ankle"
      ]
    },
    {
      "name": "Cossack squat",
      "kind": "MOBILITY",
      "metricType": "REPS",
      "isUnilateral": true,
      "isIsometric": false,
      "region": null,
      "movementType": null,
      "equipment": null,
      "defaultRestSeconds": null,
      "primary": [],
      "secondary": [],
      "mobilityAreas": [
        "hip"
      ]
    },
    {
      "name": "Mobilidade de tornozelo na parede",
      "kind": "MOBILITY",
      "metricType": "REPS",
      "isUnilateral": true,
      "isIsometric": false,
      "region": null,
      "movementType": null,
      "equipment": null,
      "defaultRestSeconds": null,
      "primary": [],
      "secondary": [],
      "mobilityAreas": [
        "ankle"
      ]
    },
    {
      "name": "Gato-camelo",
      "kind": "MOBILITY",
      "metricType": "REPS",
      "isUnilateral": false,
      "isIsometric": false,
      "region": null,
      "movementType": null,
      "equipment": null,
      "defaultRestSeconds": null,
      "primary": [],
      "secondary": [],
      "mobilityAreas": [
        "thoracic",
        "lumbar"
      ]
    },
    {
      "name": "Rotação torácica em quadrupedia",
      "kind": "MOBILITY",
      "metricType": "REPS",
      "isUnilateral": true,
      "isIsometric": false,
      "region": null,
      "movementType": null,
      "equipment": null,
      "defaultRestSeconds": null,
      "primary": [],
      "secondary": [],
      "mobilityAreas": [
        "thoracic"
      ]
    },
    {
      "name": "Rotação torácica deitado (open book)",
      "kind": "MOBILITY",
      "metricType": "REPS",
      "isUnilateral": true,
      "isIsometric": false,
      "region": null,
      "movementType": null,
      "equipment": null,
      "defaultRestSeconds": null,
      "primary": [],
      "secondary": [],
      "mobilityAreas": [
        "thoracic"
      ]
    },
    {
      "name": "Alongamento de peitoral na porta",
      "kind": "MOBILITY",
      "metricType": "DURATION",
      "isUnilateral": true,
      "isIsometric": false,
      "region": null,
      "movementType": null,
      "equipment": null,
      "defaultRestSeconds": null,
      "primary": [],
      "secondary": [],
      "mobilityAreas": [
        "shoulder"
      ]
    },
    {
      "name": "Dislocates de ombro com banda",
      "kind": "MOBILITY",
      "metricType": "REPS",
      "isUnilateral": false,
      "isIsometric": false,
      "region": null,
      "movementType": null,
      "equipment": "band",
      "defaultRestSeconds": null,
      "primary": [],
      "secondary": [],
      "mobilityAreas": [
        "shoulder"
      ]
    },
    {
      "name": "Posição da criança",
      "kind": "MOBILITY",
      "metricType": "DURATION",
      "isUnilateral": false,
      "isIsometric": false,
      "region": null,
      "movementType": null,
      "equipment": null,
      "defaultRestSeconds": null,
      "primary": [],
      "secondary": [],
      "mobilityAreas": [
        "lumbar",
        "shoulder"
      ]
    },
    {
      "name": "Alongamento de isquiotibiais",
      "kind": "MOBILITY",
      "metricType": "DURATION",
      "isUnilateral": true,
      "isIsometric": false,
      "region": null,
      "movementType": null,
      "equipment": null,
      "defaultRestSeconds": null,
      "primary": [],
      "secondary": [],
      "mobilityAreas": [
        "hip"
      ]
    }
  ]
};
