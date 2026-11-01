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

test('Progresso → Corpo: peso e acesso às fotos', async ({ page, app }) => {
  await app.open();
  await page.locator('app-tab-bar').getByRole('button', { name: 'Progresso' }).click();
  const current = page.locator('.ion-page:not(.ion-page-hidden)');
  await current.locator('app-section-tabs ion-segment-button', { hasText: 'Corpo' }).click();
  await expect(page).toHaveURL(/\/corpo$/);

  const body = page.locator('app-body-measurements');
  await body.locator('ion-input input[type="number"]').fill('80.5');
  await body.locator('ion-button', { hasText: 'Registar' }).click();
  await expect(body.locator('h2.big')).toContainText('80,5');

  await page.locator('a.photos').click();
  await expect(page).toHaveURL(/\/corpo\/fotos$/);
  await expect(page.locator('app-tab-bar [aria-current="page"]')).toHaveText(/Progresso/);

  // O caminho antigo das fotos continua a funcionar.
  await page.goto('/fotos');
  await expect(page).toHaveURL(/\/corpo\/fotos$/);

  // As medições já não estão no Perfil.
  await page.goto('/perfil');
  await expect(page.locator('app-body-measurements')).toHaveCount(0);
  await expect(page.locator('ion-item', { hasText: 'Peso, medidas e fotos' })).toBeVisible();
});

test('barra «Treino em curso» fora da sessão', async ({ page, app }) => {
  await app.open();
  await app.addFromLibrary('Dumbbell Bench Press');
  await app.startFreeSession();

  await page.goto('/treinos');
  const bar = page.locator('app-active-session-bar');
  await expect(bar).toContainText('Treino em curso');
  await expect(bar).toContainText('Sessão livre');
  await expect(bar).toContainText('0 séries');
  const [size] = await app.sizes('app-active-session-bar button');
  expect(size.h).toBeGreaterThanOrEqual(48);

  // Na Home não aparece: lá está o cartão «Sessão em curso».
  await page.locator('app-tab-bar').getByRole('button', { name: 'Hoje' }).click();
  await expect(page).toHaveURL(/\/home$/);
  await expect(bar).toHaveCount(0);

  // Tocar volta ao treino, e lá a barra (e os separadores) somem.
  await page.locator('app-tab-bar').getByRole('button', { name: 'Progresso' }).click();
  await bar.locator('button').click();
  await expect(page).toHaveURL(/\/sessao$/);
  await expect(bar).toHaveCount(0);
  await expect(page.locator('app-tab-bar')).toHaveCount(0);
});
