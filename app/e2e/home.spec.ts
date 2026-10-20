import { expect, test } from './fixtures';

/** Home: caminho da semana, sequência e objetivo, e o botão grande para começar. */
test('caminho da semana com hoje, sequência e treino feito', async ({ page, app }) => {
  await app.open();
  const path = page.getByRole('list', { name: 'Caminho da semana' });
  await expect(path.getByRole('button', { name: 'Começar sessão livre' })).toBeVisible();
  await expect(page.getByLabel(/^Sequência: 0 semanas seguidas$/)).toBeVisible();
  await expect(page.getByLabel(/^Esta semana: 0 de 2 treinos$/)).toBeVisible();
  for (const s of await app.sizes('app-week-path .btn')) expect(s.h).toBeGreaterThanOrEqual(48);

  // Treinar hoje: o passo de hoje fica feito e o objetivo sobe.
  await app.addFromLibrary('Supino plano (halteres)');
  await app.startFreeSession();
  const card = page.locator('app-exercise-card').first();
  await card.locator('ion-button', { hasText: 'Registar série' }).click();
  const sheet = page.locator('app-set-sheet');
  await sheet.getByRole('spinbutton', { name: 'Carga (kg)', disabled: false }).fill('30');
  await sheet.getByRole('spinbutton', { name: 'Repetições', disabled: false }).fill('10');
  await sheet.locator('ion-button.save').click();
  await page.locator('ion-button.finish').click();
  await page.locator('ion-modal ion-footer ion-button', { hasText: 'Terminar e guardar' }).click();
  await page.getByRole('button', { name: 'CONTINUAR' }).click();
  await expect(page).toHaveURL(/\/home/);
  await expect(page.getByLabel(/^Esta semana: 1 de 2 treinos$/)).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Feito por hoje' })).toBeVisible();
  await expect(path).toContainText('feito');
});
