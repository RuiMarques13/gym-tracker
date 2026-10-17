import { expect, test } from './fixtures';

/** Fotos são dados de saúde: só saem do dispositivo se o utilizador quiser. */
test.describe('privacidade', () => {
  test.beforeEach(async ({ app }) => {
    await app.open();
  });

  test('fotos não sincronizam por defeito', async ({ page }) => {
    await page.goto('/fotos');
    await expect(page.locator('app-photos')).toContainText('Ficam só neste dispositivo.');

    await page.goto('/conta');
    const toggle = page.locator('ion-toggle', { hasText: 'Sincronizar fotos' });
    await expect(toggle).toBeVisible();
    await expect(toggle).not.toHaveJSProperty('checked', true);
  });

  test('ligar pede confirmação; cancelar deixa desligado', async ({ page }) => {
    await page.goto('/conta');
    const toggle = page.locator('ion-toggle', { hasText: 'Sincronizar fotos' });
    await toggle.click();
    const alert = page.locator('ion-alert');
    await expect(alert).toContainText('Enviar fotos para a nuvem?');
    await alert.getByRole('button', { name: 'Cancelar' }).click();
    await expect(toggle).toHaveJSProperty('checked', false);

    await page.goto('/fotos');
    await expect(page.locator('app-photos')).toContainText('Ficam só neste dispositivo.');
  });

  test('ligar e confirmar muda o aviso no ecrã das fotos', async ({ page }) => {
    await page.goto('/conta');
    await page.locator('ion-toggle', { hasText: 'Sincronizar fotos' }).click();
    await page.locator('ion-alert').getByRole('button', { name: 'Enviar' }).click();
    // Esperar que a definição fique gravada antes de recarregar a página.
    await expect(page.getByRole('status')).toContainText('Fotos a sincronizar.');
    await page.goto('/fotos');
    await expect(page.locator('app-photos')).toContainText('Sincronizam com a tua conta.');
  });
});
