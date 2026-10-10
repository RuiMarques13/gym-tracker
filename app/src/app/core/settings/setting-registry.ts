import type { SettingScope } from '../../data/models/enums';

/**
 * Registo central de definições. Acrescentar uma definição é acrescentar
 * uma entrada aqui: não precisa de migração da base.
 *
 * - scope ACCOUNT sincroniza; DEVICE fica neste dispositivo; LAYOUT depende do formato de ecrã.
 * - schemaVersion sobe quando o formato do valor muda; migrate converte valores antigos.
 */
export interface SettingDef<T> {
  key: string;
  scope: SettingScope;
  schemaVersion: number;
  defaultValue: T;
  validate: (value: unknown) => value is T;
  migrate?: (value: unknown, fromVersion: number) => unknown;
  label?: string;
}

const isOneOf =
  <T extends string>(...opts: T[]) =>
  (v: unknown): v is T =>
    typeof v === 'string' && (opts as string[]).includes(v);
const isIntInRange =
  (min: number, max: number) =>
  (v: unknown): v is number =>
    Number.isInteger(v) && (v as number) >= min && (v as number) <= max;
const isNumberInRange =
  (min: number, max: number) =>
  (v: unknown): v is number =>
    typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
const isBool = (v: unknown): v is boolean => typeof v === 'boolean';
const isIsoOrNull = (v: unknown): v is string | null =>
  v === null || (typeof v === 'string' && !Number.isNaN(Date.parse(v)));
const isStringArray = (v: unknown): v is string[] =>
  Array.isArray(v) && v.every((x) => typeof x === 'string');

function def<T>(d: SettingDef<T>): SettingDef<T> {
  return d;
}

export const SETTINGS = {
  theme: def<'system' | 'light' | 'dark'>({
    key: 'ui.theme', scope: 'DEVICE', schemaVersion: 1, defaultValue: 'system',
    validate: isOneOf('system', 'light', 'dark'), label: 'Tema',
  }),
  weightUnit: def<'kg' | 'lb'>({
    key: 'units.weight', scope: 'ACCOUNT', schemaVersion: 1, defaultValue: 'kg',
    validate: isOneOf('kg', 'lb'), label: 'Unidade de peso',
  }),
  defaultRestSeconds: def<number>({
    key: 'timer.defaultRestSeconds', scope: 'ACCOUNT', schemaVersion: 1, defaultValue: 90,
    validate: isIntInRange(0, 1800), label: 'Descanso por defeito (s)',
  }),
  timerSound: def<boolean>({
    key: 'timer.sound', scope: 'DEVICE', schemaVersion: 1, defaultValue: true,
    validate: isBool, label: 'Som no fim do temporizador',
  }),
  timerVibrate: def<boolean>({
    key: 'timer.vibrate', scope: 'DEVICE', schemaVersion: 1, defaultValue: true,
    validate: isBool, label: 'Vibrar no fim do temporizador',
  }),
  secondaryMuscleWeight: def<number>({
    key: 'metrics.secondaryMuscleWeight', scope: 'ACCOUNT', schemaVersion: 1, defaultValue: 0.5,
    validate: isNumberInRange(0, 1), label: 'Peso das séries em músculos secundários',
  }),
  showRomScore: def<boolean>({
    key: 'mobility.showRomScore', scope: 'ACCOUNT', schemaVersion: 1, defaultValue: true,
    validate: isBool, label: 'Mostrar nota de amplitude na mobilidade',
  }),
  lastExportAt: def<string | null>({
    key: 'backup.lastExportAt', scope: 'DEVICE', schemaVersion: 1, defaultValue: null,
    validate: isIsoOrNull, label: 'Última exportação',
  }),
  profileName: def<string>({
    key: 'profile.name', scope: 'ACCOUNT', schemaVersion: 1, defaultValue: '',
    validate: (v): v is string => typeof v === 'string' && v.length <= 80, label: 'Nome',
  }),
  profileBirthDate: def<string | null>({
    key: 'profile.birthDate', scope: 'ACCOUNT', schemaVersion: 1, defaultValue: null,
    validate: (v): v is string | null => v === null || (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)),
    label: 'Data de nascimento',
  }),
  profileSex: def<'F' | 'M' | 'O' | null>({
    key: 'profile.sex', scope: 'ACCOUNT', schemaVersion: 1, defaultValue: null,
    validate: (v): v is 'F' | 'M' | 'O' | null => v === null || v === 'F' || v === 'M' || v === 'O', label: 'Sexo',
  }),
  profileHeightCm: def<number | null>({
    key: 'profile.heightCm', scope: 'ACCOUNT', schemaVersion: 1, defaultValue: null,
    validate: (v): v is number | null => v === null || isNumberInRange(50, 260)(v), label: 'Altura (cm)',
  }),
  onboardingDone: def<boolean>({
    key: 'onboarding.done', scope: 'ACCOUNT', schemaVersion: 1, defaultValue: false,
    validate: isBool, label: 'Introdução concluída',
  }),
  watchChecklist: def<string[]>({
    key: 'watch.checklist', scope: 'DEVICE', schemaVersion: 1, defaultValue: [],
    validate: isStringArray, label: 'Passos do relógio concluídos',
  }),
  navOrder: def<string[]>({
    key: 'nav.order', scope: 'ACCOUNT', schemaVersion: 1, defaultValue: [],
    validate: isStringArray, label: 'Ordem do menu',
  }),
  navHidden: def<string[]>({
    key: 'nav.hidden', scope: 'ACCOUNT', schemaVersion: 1, defaultValue: [],
    validate: isStringArray, label: 'Ecrãs escondidos do menu',
  }),
  homeWidgets: def<string[]>({
    key: 'home.widgets', scope: 'LAYOUT', schemaVersion: 1,
    defaultValue: ['next-workout', 'weekly-sets', 'mobility-minutes'],
    validate: isStringArray, label: 'Widgets da Home',
  }),
} as const;

export type SettingName = keyof typeof SETTINGS;
export type SettingValue<K extends SettingName> = (typeof SETTINGS)[K]['defaultValue'];

export const ALL_SETTINGS: SettingDef<unknown>[] = Object.values(SETTINGS) as SettingDef<unknown>[];

/** Garante que não há chaves repetidas no registo (verificado nos testes). */
export function assertRegistryValid(defs: SettingDef<unknown>[] = ALL_SETTINGS): void {
  const seen = new Set<string>();
  for (const d of defs) {
    if (seen.has(d.key)) throw new Error(`Definição repetida: ${d.key}`);
    seen.add(d.key);
    if (!d.validate(d.defaultValue)) throw new Error(`Valor por defeito inválido: ${d.key}`);
  }
}
