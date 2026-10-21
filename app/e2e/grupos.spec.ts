import { expect, test, type App } from './fixtures';
import type { Page } from '@playwright/test';

/** Cria um treino com dois exercícios ligados e escolhe o formato do grupo. */
async function groupWorkout(page: Page, app: App, setFormat: (sheet: ReturnType<Page['locator']>) => Promise<void>): Promise<void> {
  await app.addFromLibrary('Supino plano (halteres)');
  await app.addFromLibrary('Conventional Deadlift');
  await page.goto('/treinos/novo');
  await page.getByRole('textbox', { name: 'Nome' }).fill('Grupo');
  await page.locator('section.block').nth(1).locator('ion-button', { hasText: 'Adicionar' }).click();
  const picker = page.locator('app-exercise-picker');
  await expect(picker.locator('ion-checkbox').first()).toBeVisible();
  for (const box of await picker.locator('ion-checkbox').all()) await box.click();
  await picker.locator('ion-footer ion-button').click();
  await page.getByRole('button', { name: 'Fazer superset com o anterior' }).last().click();
  await page.getByRole('button', { name: /^Formato do grupo A: Superset/ }).click();
  const sheet = page.locator('app-group-format-sheet');
  await setFormat(sheet);
  await sheet.getByRole('button', { name: 'Guardar formato' }).click();
  await page.locator('app-workout-editor ion-footer ion-button').click();
  await expect(page).toHaveURL(/\/treinos$/);
  await page.getByRole('button', { name: 'Iniciar treino' }).first().click();
  await expect(page).toHaveURL(/\/sessao/);
}

test('circuito: depois de registar, abre o exercício seguinte e conta as voltas', async ({ page, app }) => {
  await app.open();
  await groupWorkout(page, app, async (sheet) => {
    await sheet.getByRole('radio', { name: /^Circuito/ }).click();
    await expect(sheet).toContainText('Circuito · 3 voltas · 90 s entre voltas');
  });
  const cards = page.locator('app-exercise-card');
  await expect(cards.first()).toContainText('Circuito A · 1/2 · volta 1 de 3');
  await cards.first().locator('.quick-main').click();
  // O segundo do circuito abre sozinho, sem descanso.
  await expect(cards.nth(1).locator('section.card')).toBeVisible();
  await expect(page.getByRole('timer', { name: /^Descanso / })).toHaveCount(0);
});

test('treino por tempo: temporizador, rondas guardadas e fora das séries', async ({ page, app }) => {
  await app.open();
  await groupWorkout(page, app, async (sheet) => {
    await sheet.getByRole('radio', { name: /^Intervalos/ }).click();
    for (let i = 0; i < 7; i++) await sheet.getByRole('button', { name: 'Menos Trabalho' }).click(); // 40 → 5 s
    for (let i = 0; i < 4; i++) await sheet.getByRole('button', { name: 'Menos Descanso' }).click(); // 20 → 0 s
    for (let i = 0; i < 7; i++) await sheet.getByRole('button', { name: 'Menos Rondas' }).click(); // 8 → 1
    await expect(sheet).toContainText('Intervalos · 5 s / 0 s × 1');
  });
  const timed = page.locator('section.timed');
  await expect(timed).toContainText('Intervalos · 5 s / 0 s × 1');
  await expect(page.locator('app-exercise-card')).toHaveCount(0); // os exercícios do grupo não têm cartão de séries
  await timed.getByRole('button', { name: 'COMEÇAR' }).click();
  await expect(page).toHaveURL(/\/sessao\/tempo\/A/);
  await page.locator('app-timed').getByRole('button', { name: 'Começar', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Feito!' })).toBeVisible({ timeout: 15_000 });
  await page.locator('app-timed').getByRole('button', { name: 'GUARDAR', exact: true }).click();
  await expect(page).toHaveURL(/\/sessao$/);
  await expect(timed).toContainText('Feito: 1 ronda');
  await expect(page.locator('.bar')).toContainText('0 séries');
});
