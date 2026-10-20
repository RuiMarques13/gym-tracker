import { expect, test as base, type Page } from '@playwright/test';

/**
 * Base dos testes de ecrã:
 * - sessão de conta simulada (a app exige login), guardada como o supabase-js a guarda;
 * - Supabase inacessível: tudo corre offline, contra a base local do browser;
 * - cada teste começa com a base vazia (contexto novo do browser).
 */
const SUPABASE_REF = 'uvnldzlfpubzdrooxdje';
const USER_ID = '11111111-1111-4111-8111-111111111111';

export const test = base.extend<{ app: App }>({
  page: async ({ page }, use) => {
    await page.route(/supabase\.co/, (r) => r.abort());
    const now = Math.floor(Date.now() / 1000);
    const session = {
      access_token: 'e2e', token_type: 'bearer', expires_in: 86_400, expires_at: now + 30 * 86_400, refresh_token: 'e2e',
      user: { id: USER_ID, email: 'teste@exemplo.pt', aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() },
    };
    await page.addInitScript(([key, value]) => localStorage.setItem(key, value), [`sb-${SUPABASE_REF}-auth-token`, JSON.stringify(session)] as const);
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await use(page);
    expect(errors, 'erros de JavaScript na página').toEqual([]);
  },
  app: async ({ page }, use) => use(new App(page)),
});

export { expect };

export class App {
  constructor(readonly page: Page) {}

  /** Abre a app e salta a introdução (cada teste começa com uma instalação vazia, por isso ela aparece sempre). */
  async open(): Promise<void> {
    await this.page.goto('/');
    await expect(this.page).toHaveURL(/\/bem-vindo/, { timeout: 20_000 });
    await this.page.locator('ion-button', { hasText: 'Saltar' }).click();
    await expect(this.page).toHaveURL(/\/home/);
  }

  /** Junta à tua lista o primeiro resultado da biblioteca para `query` (o nome português também conta na pesquisa). */
  async addFromLibrary(query: string): Promise<void> {
    await this.page.goto('/exercicios/biblioteca');
    // Esperar que a lista filtre (a pesquisa tem atraso): senão o toque pode cair numa linha que vai desaparecer.
    const count = this.page.getByText(/^\d+ exercícios?$/);
    await expect(count).toBeVisible();
    const total = await count.textContent();
    await this.page.locator('ion-searchbar input').fill(query);
    await expect(count).not.toHaveText(total ?? '');
    const add = this.page.locator('ion-item ion-button', { hasText: 'Adicionar' }).first();
    await expect(add).toBeVisible();
    const added = this.page.locator('ion-item ion-button', { hasText: 'Adicionado' });
    const before = await added.count();
    await add.click();
    await expect(added).toHaveCount(before + 1);
  }

  /** Sessão livre com os exercícios da tua lista (todos os que houver). */
  async startFreeSession(): Promise<void> {
    await this.page.goto('/home');
    await this.page.locator('app-week-path button', { hasText: 'SESSÃO LIVRE' }).click();
    const picker = this.page.locator('app-exercise-picker');
    await expect(picker.locator('ion-checkbox').first()).toBeVisible();
    for (const box of await picker.locator('ion-checkbox').all()) await box.click();
    await picker.locator('ion-footer ion-button').click();
    await expect(this.page.locator('app-exercise-card').first()).toBeVisible();
  }

  /** Tamanho real (px) de cada elemento. */
  async sizes(selector: string): Promise<{ w: number; h: number }[]> {
    return this.page.locator(selector).evaluateAll((els) =>
      els.map((e) => { const r = e.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height) }; }));
  }
}
