import { expect, test } from './fixtures';

/** Home: cartão «Hoje», semana em 7 dias, volume e recuperação. */
test('home: hoje, semana e treino feito', async ({ page, app }) => {
  await app.open();
  const today = page.getByRole('region', { name: 'Hoje' });
  await expect(today).toContainText('Sem treino planeado');
  await expect(today).toContainText('Ainda não tens treinos guardados.');
  const week = page.getByRole('region', { name: 'Esta semana' });
  await expect(week).toContainText('0 de 2 treinos');
  await expect(week.getByRole('listitem')).toHaveCount(7);
  await expect(week.getByRole('listitem', { name: /\(hoje\): sem treino$/ })).toHaveCount(1);
  for (const s of await app.sizes('app-home-today .go')) expect(s.h).toBeGreaterThanOrEqual(48);

  // Recuperação abre o detalhe (com a dor) no próprio sítio.
  await page.getByRole('button', { name: /Recuperação/ }).click();
  await expect(page.getByRole('region', { name: 'Recuperação por músculo' })).toBeVisible();

  // Treinar hoje: o dia fica feito e o objetivo sobe.
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
  await expect(week).toContainText('1 de 2 treinos');
  await expect(today).toContainText('Treino de hoje feito');
  await expect(week.getByRole('listitem', { name: /\(hoje\): .*feito$/ })).toHaveCount(1);
});

test('home: sem plano, sugere um treino com os músculos prontos', async ({ page, app }) => {
  await app.open();
  await app.addFromLibrary('Supino plano (halteres)');
  await page.goto('/treinos/novo');
  await page.getByRole('textbox', { name: 'Nome' }).fill('Peito');
  await page.locator('section.block').nth(1).locator('ion-button', { hasText: 'Adicionar' }).click();
  const picker = page.locator('app-exercise-picker');
  await expect(picker.locator('ion-checkbox').first()).toBeVisible();
  await picker.locator('ion-checkbox').first().click();
  await picker.locator('ion-footer ion-button').click();
  await page.locator('app-workout-editor ion-footer ion-button').click();
  await expect(page).toHaveURL(/\/treinos$/);
  await page.goto('/home');
  const today = page.getByRole('region', { name: 'Hoje' });
  await expect(today).toContainText('Prontos para treinar');
  await expect(today).toContainText('Treino que encaixa: Peito (ainda não feito)');
  await expect(today.getByRole('button', { name: 'Começar Peito' })).toBeVisible();
});
