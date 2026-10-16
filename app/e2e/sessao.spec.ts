import { expect, test } from './fixtures';

/** Registar séries no ginásio: folha com − / +, série num toque, reserva depois, alvos de toque grandes. */
test.describe('sessão', () => {
  test.beforeEach(async ({ app }) => {
    await app.open();
    await app.addFromLibrary('Supino plano (halteres)');
    await app.startFreeSession();
  });

  test('primeira série pela folha, a seguinte num toque e a reserva depois', async ({ page }) => {
    const card = page.locator('app-exercise-card').first();

    // Sem histórico não há proposta: só «Registar série».
    await expect(card.locator('.quick-main')).toHaveCount(0);
    await card.locator('ion-button', { hasText: 'Registar série' }).click();

    const sheet = page.locator('app-set-sheet');
    const weight = sheet.getByRole('spinbutton', { name: 'Carga (kg)', disabled: false });
    const reps = sheet.getByRole('spinbutton', { name: 'Repetições', disabled: false });
    await weight.fill('60');
    await reps.fill('10');
    await sheet.getByRole('button', { name: 'Mais 2,5 kg' }).click();
    await sheet.getByRole('button', { name: 'Menos uma repetição' }).click();
    await expect(weight).toHaveValue('62.5');
    await expect(reps).toHaveValue('9');
    await sheet.getByRole('group', { name: 'Repetições em reserva' }).getByRole('button', { name: '2', exact: true }).click();
    await sheet.locator('ion-button.save').click();
    await expect(sheet).toHaveCount(0);

    const rows = card.locator('.sets ion-item');
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText('62,5 kg × 9');
    await expect(rows.first()).toContainText('RIR 2');

    // Segunda série: um toque, com os valores da anterior e sem copiar a reserva.
    const quick = card.locator('.quick-main');
    await expect(quick).toHaveText(/62,5 kg × 9/);
    await quick.click();
    await expect(rows).toHaveCount(2);
    await expect(rows.nth(1)).toContainText('62,5 kg × 9');
    await expect(rows.nth(1)).not.toContainText('RIR');

    // O descanso começou.
    await expect(page.getByRole('timer', { name: /^Descanso / })).toBeVisible();

    // A pergunta da reserva é dessa série e grava só a reserva.
    const ask = card.locator('.ask');
    await expect(ask).toContainText('Série 2');
    await ask.getByRole('button', { name: '1', exact: true }).click();
    await expect(ask).toHaveCount(0);
    await expect(rows.nth(1)).toContainText('62,5 kg × 9');
    await expect(rows.nth(1)).toContainText('RIR 1');
  });

  test('a pergunta da reserva pode ser ignorada', async ({ page }) => {
    const card = page.locator('app-exercise-card').first();
    await card.locator('ion-button', { hasText: 'Registar série' }).click();
    const sheet = page.locator('app-set-sheet');
    await sheet.getByRole('spinbutton', { name: 'Carga (kg)', disabled: false }).fill('40');
    await sheet.getByRole('spinbutton', { name: 'Repetições', disabled: false }).fill('12');
    await sheet.locator('ion-button.save').click();
    await card.locator('.quick-main').click();
    await card.getByRole('button', { name: 'Não responder' }).click();
    await expect(card.locator('.ask')).toHaveCount(0);
    await expect(card.locator('.sets ion-item')).toHaveCount(2);
  });

  test('alvos de toque com pelo menos 48 px', async ({ page, app }) => {
    const card = page.locator('app-exercise-card').first();
    await card.locator('ion-button', { hasText: 'Registar série' }).click();
    const sheet = page.locator('app-set-sheet');
    await expect(sheet).toBeVisible();
    for (const s of [...(await app.sizes('app-set-sheet .step')), ...(await app.sizes('app-set-sheet .chip'))]) {
      expect(s.w).toBeGreaterThanOrEqual(48);
      expect(s.h).toBeGreaterThanOrEqual(48);
    }
    await sheet.getByRole('spinbutton', { name: 'Carga (kg)', disabled: false }).fill('40');
    await sheet.getByRole('spinbutton', { name: 'Repetições', disabled: false }).fill('12');
    await sheet.locator('ion-button.save').click();
    await expect(card.locator('.quick-main')).toBeVisible();
    for (const sel of ['app-exercise-card .quick-main', 'app-exercise-card .quick-edit', 'app-exercise-card .icon-btn', 'app-exercise-card .ask .chip']) {
      for (const s of await app.sizes(sel)) {
        expect(s.w, sel).toBeGreaterThanOrEqual(48);
        expect(s.h, sel).toBeGreaterThanOrEqual(48);
      }
    }
  });
});
