import { expect, test } from './fixtures';

/** Navegação: 4 separadores em baixo, secções no topo, avatar para o Perfil, barra escondida no treino. */
test('separadores, secções e avatar', async ({ page, app }) => {
  await app.open();
  const bar = page.locator('app-tab-bar');
  const tab = (name: string) => bar.getByRole('button', { name });
  const current = page.locator('.ion-page:not(.ion-page-hidden)');

  await expect(bar.getByRole('button')).toHaveCount(4);
  await expect(tab('Hoje')).toHaveAttribute('aria-current', 'page');

  // Alvos de toque grandes.
  for (const s of await app.sizes('app-tab-bar .tab')) expect(s.h).toBeGreaterThanOrEqual(56);

  // Treinos → secção Ciclos.
  await tab('Treinos').click();
  await expect(page).toHaveURL(/\/treinos$/);
  await current.locator('app-section-tabs ion-segment-button', { hasText: 'Ciclos' }).click();
  await expect(page).toHaveURL(/\/ciclos$/);

  // Progresso abre na Semana; o Histórico está lá.
  await tab('Progresso').click();
  await expect(page).toHaveURL(/\/volume$/);
  await current.locator('app-section-tabs ion-segment-button', { hasText: 'Histórico' }).click();
  await expect(page).toHaveURL(/\/historico$/);

  // Voltar a Treinos reabre a última secção usada (Ciclos); tocar de novo volta à raiz.
  await tab('Treinos').click();
  await expect(page).toHaveURL(/\/ciclos$/);
  await tab('Treinos').click();
  await expect(page).toHaveURL(/\/treinos$/);

  // Exercícios: Os meus · Biblioteca.
  await tab('Exercícios').click();
  await current.locator('app-section-tabs ion-segment-button', { hasText: 'Biblioteca' }).click();
  await expect(page).toHaveURL(/\/exercicios\/biblioteca$/);
  await expect(tab('Exercícios')).toHaveAttribute('aria-current', 'page');

  // Avatar → Perfil, com Conta e Definições; nenhum separador ativo.
  await current.locator('app-avatar-button a').click();
  await expect(page).toHaveURL(/\/perfil$/);
  await expect(bar.locator('[aria-current="page"]')).toHaveCount(0);
  await current.locator('ion-item', { hasText: 'Definições' }).click();
  await expect(page).toHaveURL(/\/definicoes$/);
  await expect(page.locator('ion-item', { hasText: 'Personalizar menu' })).toHaveCount(0);

  // O ecrã antigo do menu leva às Definições.
  await page.goto('/definicoes/menu');
  await expect(page).toHaveURL(/\/definicoes$/);
});

test('a barra esconde-se durante o treino', async ({ page, app }) => {
  await app.open();
  await app.addFromLibrary('Dumbbell Bench Press');
  await app.startFreeSession();
  await expect(page).toHaveURL(/\/sessao/);
  await expect(page.locator('app-tab-bar')).toHaveCount(0);
});
