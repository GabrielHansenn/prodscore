/**
 * Popup de detalhes da tarefa (o caso do print): ele era desenhado dentro do
 * card — que, concluído, tem opacidade — e por isso ficava transparente, atrás
 * dos outros cards, e dava para abrir vários ao mesmo tempo.
 *
 * Usa a conta de teste (TEST_EMAIL/TEST_PASSWORD em apps/web/.env.e2e.local).
 */

import { test, expect, type Page } from '@playwright/test';

const email    = process.env['TEST_EMAIL'];
const password = process.env['TEST_PASSWORD'];
test.skip(!email || !password || email.startsWith('coloque-'),
  'Defina TEST_EMAIL e TEST_PASSWORD (apps/web/.env.e2e.local) para testar o popup.');

async function login(page: Page) {
  await page.goto('/login');
  const accept = page.getByRole('button', { name: 'Aceitar todos' });
  if (await accept.isVisible().catch(() => false)) await accept.click();
  await page.locator('#email').fill(email!);
  await page.locator('#password').fill(password!);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(/\/dashboard/, { timeout: 20_000 });
}

for (const theme of ['light', 'dark'] as const) {
  test(`desktop (${theme}): popup de tarefa concluída fica por cima de tudo, opaco e sozinho`, async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    await context.addInitScript((t) => localStorage.setItem('prodscore-theme', JSON.stringify({ state: { theme: t }, version: 0 })), theme);
    const page = await context.newPage();
    await login(page);
    await page.goto('/tarefas');

    // Filtro "Concluídas": os cards concluídos são os que tinham opacidade
    await page.getByRole('button', { name: /^Concluídas/ }).click();
    const titles = page.locator('main .card button.text-left');
    await titles.first().waitFor({ timeout: 10_000 }).catch(() => {});
    test.skip(await titles.count() < 2, 'A conta de teste precisa de pelo menos 2 tarefas concluídas.');

    // Ponto de um card visível na tela (o próprio título clicado), que o popup deve cobrir
    const target = (await titles.first().boundingBox())!;
    const point = { x: target.x + 5, y: target.y + target.height / 2 };

    await titles.first().click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toHaveCount(1);

    // 1. Desenhado fora da lista (no <body>), sem herdar opacidade de nenhum ancestral
    const opacity = await dialog.evaluate((el) => {
      let o = 1;
      for (let n: Element | null = el; n; n = n.parentElement) o *= Number(getComputedStyle(n).opacity);
      return { total: o, insideMain: !!el.closest('main') };
    });
    expect(opacity.insideMain).toBe(false);
    expect(opacity.total).toBe(1);

    // 2. Por cima de tudo: onde está o card, quem recebe o clique agora é o fundo do popup
    const onTop = await page.evaluate(({ x, y }) => {
      const el = document.elementFromPoint(x, y);
      if (!el) return 'nada';
      return el.closest('main') ? 'card da lista' : 'fundo do popup';
    }, point);
    expect(onTop).toBe('fundo do popup');

    // 3. Clicar ali só fecha o popup — nunca abre outro
    await page.mouse.click(point.x, point.y);
    await expect(dialog).toHaveCount(0);

    await context.close();
  });
}
