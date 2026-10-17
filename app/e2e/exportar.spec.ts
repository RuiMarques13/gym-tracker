import { readFile } from 'node:fs/promises';
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

/** Cópia de segurança: as fotos só entram no ficheiro se o utilizador escolher. */
const PNG_1PX = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

async function addPhoto(page: Page): Promise<void> {
  await page.goto('/fotos');
  await page.locator('app-photos input[type="file"]').setInputFiles({ name: 'frente.png', mimeType: 'image/png', buffer: PNG_1PX });
  await expect(page.locator('app-photos .thumb')).toHaveCount(1);
}

async function exportFile(page: Page, choice: 'Com fotos' | 'Sem fotos' | null): Promise<Record<string, unknown[]>> {
  await page.goto('/definicoes');
  const download = page.waitForEvent('download');
  await page.locator('ion-button', { hasText: 'Exportar' }).click();
  if (choice) {
    const alert = page.locator('ion-alert');
    await expect(alert).toContainText('Incluir as fotos?');
    await alert.getByRole('button', { name: choice }).click();
  }
  const file = JSON.parse(await readFile((await (await download).path())!, 'utf8')) as { tables: Record<string, unknown[]> };
  return file.tables;
}

test.describe('exportar', () => {
  test.beforeEach(async ({ app }) => {
    await app.open();
  });

  test('sem fotos guardadas, exporta sem perguntar', async ({ page }) => {
    const tables = await exportFile(page, null);
    expect(tables['progress_photo'] ?? []).toEqual([]);
    expect(tables['exercise']).toBeDefined();
  });

  test('com fotos, pergunta; «Sem fotos» deixa-as de fora', async ({ page }) => {
    await addPhoto(page);
    const tables = await exportFile(page, 'Sem fotos');
    expect(tables['progress_photo']).toBeUndefined();
    await expect(page.locator('app-settings')).toContainText('sem fotos');
  });

  test('«Com fotos» inclui-as', async ({ page }) => {
    await addPhoto(page);
    const tables = await exportFile(page, 'Com fotos');
    expect(tables['progress_photo']).toHaveLength(1);
  });
});
