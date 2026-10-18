/**
 * Barra de navegação inferior (web no celular):
 * - aparece abaixo de 1024px e some no desktop, onde fica a barra lateral;
 * - em nenhuma tela o fim do conteúdo fica escondido atrás dela.
 *
 * Usa a conta de teste (TEST_EMAIL/TEST_PASSWORD em apps/web/.env.e2e.local).
 */

import { test, expect, type Browser, type BrowserContext, type Page } from '@playwright/test';

const ROUTES = [
  '/dashboard', '/tarefas', '/grupos', '/ranking', '/conquistas',
  '/estatisticas', '/perfil', '/amigos', '/configuracoes/seguranca',
];

const PHONES = [
  { width: 360, height: 740 },
  { width: 390, height: 844 },
  { width: 414, height: 896 },
];

const email    = process.env['TEST_EMAIL'];
const password = process.env['TEST_PASSWORD'];
test.skip(!email || !password || email.startsWith('coloque-'),
  'Defina TEST_EMAIL e TEST_PASSWORD (apps/web/.env.e2e.local) para testar a navegação.');

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

async function openAs(browser: Browser, viewport: { width: number; height: number }, theme: 'light' | 'dark'): Promise<Page> {
  const context = await browser.newContext({ viewport, isMobile: viewport.width < 1024, hasTouch: viewport.width < 1024, storageState });
  await context.addInitScript((t) => localStorage.setItem('prodscore-theme', JSON.stringify({ state: { theme: t }, version: 0 })), theme);
  return context.newPage();
}

/** Rola o <main> até o fim e mede: o último bloco de conteúdo termina acima da barra? */
async function contentClearsBar(page: Page) {
  return page.evaluate(async () => {
    const main = document.querySelector('main')!;
    // Cards carregam depois (meta da semana, sugestões...): rola até o fim
    // repetidas vezes até a altura da página parar de mudar
    let lastHeight = -1;
    for (let i = 0; i < 20 && main.scrollHeight !== lastHeight; i++) {
      lastHeight = main.scrollHeight;
      main.scrollTop = main.scrollHeight;
      await new Promise((r) => setTimeout(r, 300));
    }
    const pill = document.querySelector('[data-testid="bottom-nav"] > div')!.getBoundingClientRect();
    const inner = main.firstElementChild as HTMLElement;
    // Último elemento visível do conteúdo da página
    const blocks = [...inner.querySelectorAll('*')].filter((el) => {
      const r = el.getBoundingClientRect();
      return r.height > 0 && r.width > 0 && getComputedStyle(el).visibility !== 'hidden';
    });
    const lastBottom = Math.max(...blocks.map((el) => el.getBoundingClientRect().bottom));
    return { lastBottom: Math.round(lastBottom), barTop: Math.round(pill.top) };
  });
}

for (const viewport of PHONES) {
  for (const theme of ['light', 'dark'] as const) {
    test(`celular ${viewport.width}px (${theme}): barra visível, sem menu lateral e nada escondido atrás dela`, async ({ browser }) => {
      const page = await openAs(browser, viewport, theme);
      for (const route of ROUTES) {
        await page.goto(route, { waitUntil: 'load' });
        await page.waitForTimeout(1200);
        await expect(page.getByTestId('bottom-nav'), `barra em ${route}`).toBeVisible();
        await expect(page.locator('aside'), `menu lateral em ${route}`).toBeHidden();
        const { lastBottom, barTop } = await contentClearsBar(page);
        expect(lastBottom, `fim do conteúdo de ${route} atrás da barra`).toBeLessThanOrEqual(barTop);
      }
      await page.context().close();
    });
  }
}

test('desktop 1280px: sem barra inferior, com a barra lateral de sempre', async ({ browser }) => {
  const page = await openAs(browser, { width: 1280, height: 800 }, 'light');
  await page.goto('/dashboard');
  await page.waitForTimeout(800);
  await expect(page.getByTestId('bottom-nav')).toBeHidden();
  await expect(page.locator('aside')).toBeVisible();
  // O espaço reservado para a barra é zero no desktop
  const reserved = await page.evaluate(() => getComputedStyle(document.querySelector('main')!).paddingBottom);
  expect(reserved).toBe('0px');
  await page.context().close();
});

test('celular: a barra volta depois de fechar um modal com campo de texto focado', async ({ browser }) => {
  const page = await openAs(browser, PHONES[1]!, 'light');
  await page.goto('/dashboard');
  const nav = page.getByTestId('bottom-nav');

  // O "+" abre o modal e foca o título: a barra some (teclado "aberto")
  await page.getByRole('button', { name: 'Nova tarefa' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(nav).toBeHidden();

  // Fechar o modal remove o campo focado da página: a barra tem que voltar
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(nav).toBeVisible();
  await nav.getByRole('link', { name: 'Grupos' }).click();
  await expect(page).toHaveURL(/\/grupos$/);
  await page.context().close();
});

test('celular: o Menu abre as outras telas e o "+" abre a nova tarefa', async ({ browser }) => {
  const page = await openAs(browser, PHONES[0]!, 'light');
  await page.goto('/dashboard');
  await page.getByRole('button', { name: /^Menu/ }).click();
  const sheet = page.getByRole('dialog');
  await expect(sheet.getByRole('link', { name: 'Ranking' })).toBeVisible();
  await sheet.getByRole('link', { name: 'Ranking' }).click();
  await expect(page).toHaveURL(/\/ranking$/);

  await page.getByRole('button', { name: 'Nova tarefa' }).click();
  await expect(page).toHaveURL(/\/tarefas/);
  await expect(page.getByRole('dialog').getByText('Nova Tarefa')).toBeVisible();
  await page.context().close();
});
