import { expect, test } from './fixtures';

/** Ecrã Regras e fontes: cada número com a origem; as áreas novas aparecem. */
test('regras e fontes', async ({ page, app }) => {
  await app.open();
  await page.goto('/definicoes/regras');
  const content = page.locator('app-rules');
  for (const area of ['Volume semanal', 'Recuperação por músculo', 'Como a app escolhe as sugestões']) {
    await expect(content.locator('ion-list-header', { hasText: area })).toBeVisible();
  }
  // Filtro «Escolha da app»: a recuperação por músculo fica (não tem fonte); «Fórmula do 1RM» (estudo) sai.
  await content.locator('ion-segment-button', { hasText: 'Escolha da app' }).click();
  await expect(content).toContainText('Descanso por músculo depois de o treinar');
  await expect(content).not.toContainText('Fórmula do 1RM estimado');
});
