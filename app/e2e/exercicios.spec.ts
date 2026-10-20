import { expect, test } from './fixtures';

/** Editar os músculos de um exercício: os botões mudam de estado, o boneco acompanha e fica guardado. */
test('mudar músculos principais e secundários muda o boneco e fica guardado', async ({ page, app }) => {
  await app.open();
  await app.addFromLibrary('Supino plano (halteres)');
  await page.goto('/exercicios');
  await page.locator('ion-item', { hasText: 'Dumbbell Bench Press' }).first().click();
  const chip = (name: string) => page.getByRole('button', { name: new RegExp(`^${name}: `) });
  const map = page.locator('app-muscle-map').first();

  await expect(chip('Tríceps')).toHaveAccessibleName(/secundário/);
  await expect(map).toContainText('Tríceps');

  await chip('Tríceps').click(); // secundário → tirar
  await chip('Bíceps').click(); // nada → principal
  await expect(chip('Tríceps')).toHaveAccessibleName(/não trabalha/);
  await expect(chip('Bíceps')).toHaveAccessibleName(/principal/);
  await expect(map).not.toContainText('Tríceps');
  await expect(map).toContainText('Bíceps');

  // botões grandes o suficiente
  for (const s of await app.sizes('.mchip')) expect(s.h).toBeGreaterThanOrEqual(44);

  await page.locator('ion-button', { hasText: 'Guardar' }).click();
  await expect(page).toHaveURL(/\/exercicios$/);
  await page.locator('ion-item', { hasText: 'Dumbbell Bench Press' }).first().click();
  await expect(chip('Bíceps')).toHaveAccessibleName(/principal/);
  await expect(chip('Tríceps')).toHaveAccessibleName(/não trabalha/);
  await expect(map).not.toContainText('Tríceps');
});

/** Num exercício com regra de família, um músculo que a regra não desenha também aparece no boneco. */
test('juntar abdutores a um peso morto pinta-os no boneco', async ({ page, app }) => {
  await app.open();
  await app.addFromLibrary('Conventional Deadlift');
  await page.goto('/exercicios');
  await page.locator('ion-item', { hasText: 'Conventional Deadlift' }).first().click();
  const chip = (name: string) => page.getByRole('button', { name: new RegExp(`^${name}: `) });
  const map = page.locator('app-muscle-map').first();
  await expect(map).not.toContainText('Glúteo médio');
  await chip('Abdutores').click();
  await expect(chip('Abdutores')).toHaveAccessibleName(/principal/);
  await expect(map).toContainText('Glúteo médio');
  await chip('Abdutores').click();
  await expect(chip('Abdutores')).toHaveAccessibleName(/secundário/);
  await expect(map).toContainText('Glúteo médio');
});

