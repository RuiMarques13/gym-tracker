import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { HEALTH_PERMISSION, HEALTH_READ } from './health-permissions';

const here = dirname(fileURLToPath(import.meta.url));
const APP_MANIFEST = join(here, '../../../../android/app/src/main/AndroidManifest.xml');
const PLUGIN_MANIFEST = join(here, '../../../../node_modules/@capgo/capacitor-health/android/src/main/AndroidManifest.xml');

const healthPerms = (xml: string, removed: boolean) =>
  [...xml.matchAll(/<uses-permission\s+android:name="(android\.permission\.health\.[A-Z_0-9]+)"([^>]*)\/>/g)]
    .filter((m) => m[2].includes('tools:node="remove"') === removed)
    .map((m) => m[1]);

describe('Health Connect: só as permissões que a app lê', () => {
  const app = readFileSync(APP_MANIFEST, 'utf8');

  it('cada tipo lido tem permissão e nenhuma é de escrita', () => {
    for (const t of HEALTH_READ) expect(HEALTH_PERMISSION[t], t).toMatch(/\.READ_/);
  });

  it('o manifest da app não retira nenhuma permissão que a app usa', () => {
    const removed = healthPerms(app, true);
    for (const t of HEALTH_READ) expect(removed, t).not.toContain(HEALTH_PERMISSION[t]);
  });

  it.runIf(existsSync(PLUGIN_MANIFEST))('todas as outras permissões declaradas pelo plugin são retiradas', () => {
    const declared = healthPerms(readFileSync(PLUGIN_MANIFEST, 'utf8'), false);
    const used = new Set(Object.values(HEALTH_PERMISSION));
    const removed = new Set(healthPerms(app, true));
    const leftover = declared.filter((p) => !used.has(p) && !removed.has(p));
    expect(leftover).toEqual([]);
  });

  it('sem cópia de segurança automática do Android (base com dados de saúde e fotos)', () => {
    expect(app).toContain('android:allowBackup="false"');
  });
});
