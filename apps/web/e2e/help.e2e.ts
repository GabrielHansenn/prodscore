/**
 * Página de Ajuda no navegador:
 * - os atalhos "?" levam para a seção certa, aberta e visível na tela;
 * - a página cabe em 360px (sem rolagem horizontal) nos dois temas;
 * - dá para chegar nela pelo menu do celular e pela barra lateral.
 *
 * Usa a conta de teste (TEST_EMAIL/TEST_PASSWORD em apps/web/.env.e2e.local).
 */

import { test, expect, type Browser, type BrowserContext, type Page } from '@playwright/test';

const email    = process.env['TEST_EMAIL'];
const password = process.env['TEST_PASSWORD'];
test.skip(!email || !password || email.startsWith('coloque-'),
  'Defina TEST_EMAIL e TEST_PASSWORD (apps/web/.env.e2e.local) para testar a Ajuda.');

let storageState: Awaited<ReturnType<BrowserContext['storageState']>>;

test.beforeAll(async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.goto('/login');
  const accept = page.getByRole('button', { name: 'Aceitar todos' });
  if (await accept.isVisible().catch(() => false)) await accept.click();
  await page.locator('#email').fill(email!);
  await page.locator('#password').fill(password!);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(/\/dashboard/, { timeout: 20_000 });
  storageState = await context.storageState();
  await context.close();
});

async function openAs(browser: Browser, width: number, theme: 'light' | 'dark' = 'light'): Promise<Page> {
  const mobile = width < 1024;
  const context = await browser.newContext({ viewport: { width, height: mobile ? 760 : 800 }, isMobile: mobile, hasTouch: mobile, storageState });
  await context.addInitScript((t) => localStorage.setItem('prodscore-theme', JSON.stringify({ state: { theme: t }, version: 0 })), theme);
  return context.newPage();
}

/** A seção abriu e o título dela está dentro da tela */
async function expectSectionOpen(page: Page, id: string) {
  await expect(page).toHaveURL(new RegExp(`/ajuda#${id}$`));
  const section = page.locator(`section#${id}`);
  await expect(section.getByRole('button').first()).toHaveAttribute('aria-expanded', 'true');
  await expect(section.locator(`#${id}-conteudo`)).toBeVisible();
  await expect(section.getByRole('heading').first()).toBeInViewport();
}

test('atalhos "?" do Início (sequência e meta semanal) e do Ranking abrem a seção certa', async ({ browser }) => {
  const page = await openAs(browser, 360);

  await page.goto('/dashboard');
  await page.getByRole('link', { name: 'Ajuda: sequência de dias e freeze' }).click();
  await expectSectionOpen(page, 'sequencia');

  await page.goto('/dashboard');
  await page.getByRole('link', { name: 'Ajuda: meta semanal' }).click();
  await expectSectionOpen(page, 'meta-semanal');

  await page.goto('/ranking');
  await page.getByRole('link', { name: 'Ajuda: como os rankings funcionam' }).click();
  await expectSectionOpen(page, 'rankings');

  await page.context().close();
});

const API_URL = process.env['API_URL'] ?? 'http://localhost:3333';

test('atalho "?" da aba Missões do grupo abre a seção de missões', async ({ browser }) => {
  const page = await openAs(browser, 360);
  await page.goto('/dashboard');

  // Grupo temporário (a conta de teste pode não ter nenhum), apagado no fim
  const token = await page.evaluate(() => {
    const key = Object.keys(localStorage).find((k) => k.startsWith('sb-') && k.endsWith('-auth-token'));
    return key ? (JSON.parse(localStorage.getItem(key)!) as { access_token: string }).access_token : null;
  });
  expect(token, 'token do Supabase após o login').toBeTruthy();
  const headers = { Authorization: `Bearer ${token}` };
  const created = await page.request.post(`${API_URL}/groups`, { headers, data: { name: '[E2E] Ajuda - missões' } });
  expect(created.ok(), await created.text()).toBe(true);
  const { grupo } = await created.json() as { grupo: { id: string } };

  try {
    await page.goto(`/grupos/${grupo.id}?aba=missoes`);
    await page.getByRole('link', { name: 'Ajuda: como as missões funcionam' }).click();
    await expectSectionOpen(page, 'missoes');
  } finally {
    await page.request.delete(`${API_URL}/groups/${grupo.id}`, { headers });
    await page.context().close();
  }
});

for (const theme of ['light', 'dark'] as const) {
  test(`360px (${theme}): página inteira aberta cabe na tela, sem rolagem horizontal`, async ({ browser }) => {
    const page = await openAs(browser, 360, theme);
    await page.goto('/ajuda');
    await expect(page.getByRole('heading', { name: 'Ajuda', level: 1 })).toBeVisible();

    // Abre todas as seções (a primeira já vem aberta)
    const toggles = page.locator('section[id] h2 button[aria-expanded="false"]');
    while (await toggles.count() > 0) await toggles.first().click();
    await expect(page.getByTestId('calc-result')).toBeVisible();
    await page.waitForTimeout(800); // conquistas e recompensas vêm da API

    const overflow = await page.evaluate(() => {
      const main = document.querySelector('main')!;
      return Math.max(document.documentElement.scrollWidth, main.scrollWidth) - window.innerWidth;
    });
    expect(overflow, 'rolagem horizontal').toBeLessThanOrEqual(0);
    await page.context().close();
  });
}

test('celular: Ajuda no Menu da barra inferior e "?" no cabeçalho', async ({ browser }) => {
  const page = await openAs(browser, 360);
  await page.goto('/dashboard');
  await page.getByRole('button', { name: /^Menu/ }).click();
  await page.getByRole('dialog').getByRole('link', { name: 'Ajuda' }).click();
  await expect(page).toHaveURL(/\/ajuda$/);
  // Tela do Menu: o botão Menu fica destacado
  await expect(page.getByRole('button', { name: /^Menu, tela atual/ })).toBeVisible();

  await page.goto('/tarefas');
  await page.getByRole('banner').getByRole('link', { name: 'Ajuda: como funcionam os pontos' }).click();
  await expect(page).toHaveURL(/\/ajuda$/);
  await page.context().close();
});

test('desktop: item Ajuda na barra lateral', async ({ browser }) => {
  const page = await openAs(browser, 1280);
  await page.goto('/dashboard');
  await page.locator('aside').getByRole('link', { name: 'Ajuda', exact: true }).click();
  await expect(page).toHaveURL(/\/ajuda$/);
  await page.context().close();
});

test('calculadora no navegador: tarefa difícil, urgente, com atraso', async ({ browser }) => {
  const page = await openAs(browser, 390);
  await page.goto('/ajuda#calculadora');
  const calc = page.locator('section#calculadora');
  await calc.getByRole('radiogroup', { name: 'Dificuldade' }).getByRole('radio', { name: 'Difícil' }).click();
  await calc.getByRole('radiogroup', { name: 'Prioridade' }).getByRole('radio', { name: 'Urgente' }).click();
  await calc.getByRole('radiogroup', { name: 'Entrega' }).getByRole('radio', { name: 'Com atraso' }).click();
  await calc.getByLabel('Quantas horas de atraso?').fill('30');
  // Mesma conta do sistema: (50 × 1,25 = 62) − 35% (faixa de 24 a 48 h) = 40
  await expect(page.getByTestId('calc-result')).toHaveText('40 pontos');
  await page.context().close();
});
