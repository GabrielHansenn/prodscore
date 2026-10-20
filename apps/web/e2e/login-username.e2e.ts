/**
 * Login com NOME DE USUÁRIO (além do e-mail), no navegador de verdade:
 * - entra com o @ da conta de teste;
 * - senha errada mostra a mensagem na tela (o 401 do login não pode
 *   recarregar a página, como acontece com sessão vencida).
 *
 * Usa a conta de teste (TEST_EMAIL/TEST_PASSWORD em apps/web/.env.e2e.local).
 */

import { test, expect, type Browser, type Page } from '@playwright/test';

const email    = process.env['TEST_EMAIL'];
const password = process.env['TEST_PASSWORD'];
test.skip(!email || !password || email.startsWith('coloque-'),
  'Defina TEST_EMAIL e TEST_PASSWORD (apps/web/.env.e2e.local) para testar o login.');

/** Sessão de navegador nova (ninguém logado) — evita depender do "Sair" entre as etapas */
async function freshPage(browser: Browser): Promise<Page> {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  return context.newPage();
}

async function fillLogin(page: Page, login: string, pass: string) {
  await page.goto('/login');
  const accept = page.getByRole('button', { name: 'Aceitar todos' });
  if (await accept.isVisible().catch(() => false)) await accept.click();
  await page.getByLabel('E-mail ou nome de usuário').fill(login);
  await page.locator('#password').fill(pass);
  await page.getByRole('button', { name: 'Entrar' }).click();
}

test('entra com o nome de usuário e, com senha errada, mostra o erro sem recarregar', async ({ browser }) => {
  // 1. Descobre o nome de usuário da conta de teste (entrando pelo e-mail)
  let page = await freshPage(browser);
  await fillLogin(page, email!, password!);
  await page.waitForURL(/\/dashboard/, { timeout: 20_000 });
  const username = (await page.locator('aside p.truncate').first().innerText()).trim();
  expect(username.length).toBeGreaterThan(2);
  await page.context().close();

  // 2. Entra com o nome de usuário
  page = await freshPage(browser);
  await fillLogin(page, username, password!);
  await page.waitForURL(/\/dashboard/, { timeout: 20_000 });
  await expect(page.locator('aside p.truncate').first()).toHaveText(username);
  await page.context().close();

  // 3. Senha errada: a mensagem aparece e o que foi digitado continua no campo
  //    (se a página recarregasse, o campo voltaria vazio)
  page = await freshPage(browser);
  await fillLogin(page, username, 'senha-errada-123');
  await expect(page.getByText('E-mail, usuário ou senha incorretos.')).toBeVisible();
  await expect(page.getByLabel('E-mail ou nome de usuário')).toHaveValue(username);
  await page.context().close();
});
