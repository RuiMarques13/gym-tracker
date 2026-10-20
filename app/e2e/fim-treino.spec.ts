import { expect, test, type App } from './fixtures';
import type { Page } from '@playwright/test';

/** Regista uma série pela folha. */
async function logSet(page: Page, kg: string, reps: string): Promise<void> {
  const card = page.locator('app-exercise-card').first();
  const register = card.locator('ion-button', { hasText: 'Registar série' });
  if (await register.count()) await register.click();
  else await card.locator('.quick-edit').click();
  const sheet = page.locator('app-set-sheet');
  await sheet.getByRole('spinbutton', { name: 'Carga (kg)', disabled: false }).fill(kg);
  await sheet.getByRole('spinbutton', { name: 'Repetições', disabled: false }).fill(reps);
  await sheet.locator('ion-button.save').click();
  await expect(sheet).toHaveCount(0);
}

async function finish(page: Page): Promise<void> {
  await page.locator('ion-button.finish').click();
  await page.locator('ion-modal ion-footer ion-button', { hasText: 'Terminar e guardar' }).click();
  await expect(page).toHaveURL(/\/sessao\/fim\//);
  await expect(page.getByRole('heading', { name: 'Treino feito!' })).toBeVisible();
}

/** Fim do treino: ecrã de festa com números, sequência semanal e recordes (a partir da segunda sessão). */
test('fim do treino e recorde na sessão seguinte', async ({ page, app }: { page: Page; app: App }) => {
  await app.open();
  await app.addFromLibrary('Supino plano (halteres)');

  await app.startFreeSession();
  await logSet(page, '30', '10');
  await finish(page);
  const streak = page.getByRole('region', { name: 'Sequência semanal' });
  await expect(streak).toContainText('1 de 2 esta semana');
  await expect(page.locator('.record')).toHaveCount(0); // primeira vez não é recorde
  await page.getByRole('button', { name: 'CONTINUAR' }).click();
  await expect(page).toHaveURL(/\/home/);

  await app.startFreeSession();
  await logSet(page, '32.5', '10');
  await expect(page.locator('app-celebration')).toContainText('Novo recorde!');
  await finish(page);
  await expect(page.locator('.record')).toContainText('Dumbbell Bench Press · 32,5 kg × 10 (+2,5 kg)');
  await expect(streak).toContainText('1 de 2 esta semana'); // dois treinos no mesmo dia contam um dia
});
