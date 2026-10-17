/**
 * Prevenção de regressão de responsividade: abre as rotas principais em um
 * celular de 360px e falha se a página (ou a área de conteúdo <main>, que é
 * quem rola no layout logado) tiver rolagem horizontal.
 *
 * Rolagem horizontal no celular quase sempre é um texto longo ou um bloco com
 * largura fixa empurrando o layout — foi o que a vistoria de responsividade
 * encontrou em cards de grupo e de missão.
 */

import { test, expect, type Page } from '@playwright/test';

const PUBLIC_ROUTES = ['/', '/login', '/cadastro', '/esqueci-senha', '/politica-de-privacidade'];

const AUTH_ROUTES = [
  '/dashboard', '/tarefas', '/grupos', '/ranking', '/conquistas',
  '/estatisticas', '/perfil', '/amigos', '/configuracoes/seguranca',
];

const GROUP_TABS = ['membros', 'ranking', 'missoes', 'tarefas', 'desempenho', 'chat'];

/** Quanto a página e o <main> passam da largura visível (0 = sem rolagem horizontal) */
async function horizontalOverflow(page: Page) {
  return page.evaluate(() => {
    const doc  = document.documentElement;
    const main = document.querySelector('main');
    return {
      page: doc.scrollWidth - doc.clientWidth,
      main: main ? main.scrollWidth - main.clientWidth : 0,
    };
  });
}

/**
 * Blocos que passam da borda direita da tela mesmo sem gerar rolagem (cortados
 * por um pai com overflow hidden — ex: card de missão maior que o painel).
 * Ignora o menu lateral fechado (fora da tela de propósito) e o conteúdo de
 * faixas com rolagem lateral intencional (overflow-x auto/scroll).
 */
async function blocksPastRightEdge(page: Page) {
  return page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const insideHorizontalScroller = (el: Element) => {
      for (let a = el.parentElement; a && a.tagName !== 'MAIN' && a !== document.body; a = a.parentElement) {
        if (['auto', 'scroll'].includes(getComputedStyle(a).overflowX)) return true;
      }
      return false;
    };
    const offenders: string[] = [];
    for (const el of document.querySelectorAll('main *, [role="dialog"] *')) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0 || r.right <= vw + 1) continue;
      if (el.closest('.-translate-x-full') || insideHorizontalScroller(el)) continue;
      // Só o mais externo: o filho de um bloco já listado é redundante
      if (el.parentElement && el.parentElement.getBoundingClientRect().right > vw + 1) continue;
      const cls = typeof el.className === 'string' ? el.className.split(/\s+/).slice(0, 4).join('.') : '';
      offenders.push(`${el.tagName.toLowerCase()}.${cls} (+${Math.round(r.right - vw)}px)`);
    }
    return offenders.slice(0, 5);
  });
}

async function expectNoHorizontalScroll(page: Page, route: string) {
  await page.goto(route, { waitUntil: 'load' });
  // Gráficos e listas carregam depois do primeiro render
  await page.waitForTimeout(1500);
  const overflow = await horizontalOverflow(page);
  expect(overflow, `rolagem horizontal em ${route}`).toEqual({ page: 0, main: 0 });
  expect(await blocksPastRightEdge(page), `blocos passando da borda direita em ${route}`).toEqual([]);
}

async function dismissCookieBanner(page: Page) {
  const accept = page.getByRole('button', { name: 'Aceitar todos' });
  if (await accept.isVisible().catch(() => false)) await accept.click();
}

test.describe('sem rolagem horizontal em 360px — telas públicas', () => {
  for (const route of PUBLIC_ROUTES) {
    test(route, async ({ page }) => {
      await expectNoHorizontalScroll(page, route);
    });
  }
});

test.describe('sem rolagem horizontal em 360px — telas logadas', () => {
  const email    = process.env['TEST_EMAIL'];
  const password = process.env['TEST_PASSWORD'];
  test.skip(!email || !password || email.startsWith('coloque-'),
    'Defina TEST_EMAIL e TEST_PASSWORD (apps/web/.env.e2e.local) para verificar as telas logadas.');

  let storageState: Awaited<ReturnType<import('@playwright/test').BrowserContext['storageState']>>;
  let groupPath: string | null = null;

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 360, height: 740 } });
    const page = await context.newPage();
    await page.goto('/login');
    await dismissCookieBanner(page);
    await page.locator('#email').fill(email!);
    await page.locator('#password').fill(password!);
    await page.locator('button[type="submit"]').click();
    await page.waitForURL(/\/dashboard/, { timeout: 20_000 });
    storageState = await context.storageState();

    // Primeiro grupo da conta, para verificar a tela do grupo em cada aba
    await page.goto('/grupos');
    const firstGroup = page.locator('main [role="link"]').first();
    // A lista chega depois do primeiro render — espera até 8 s antes de concluir que não há grupo
    const hasGroup = await firstGroup.waitFor({ state: 'visible', timeout: 8000 }).then(() => true, () => false);
    if (hasGroup) {
      await firstGroup.click();
      await page.waitForURL(/\/grupos\/[^/?]+/);
      groupPath = new URL(page.url()).pathname;
    }
    await context.close();
  });

  test.use({ storageState: async ({}, use) => { await use(storageState); } });

  for (const route of AUTH_ROUTES) {
    test(route, async ({ page }) => {
      await expectNoHorizontalScroll(page, route);
    });
  }

  // A conta de teste não tem amigos: a lista vem simulada (resposta da API
  // interceptada) com um nome comprido — foi esse caso que esmagava a linha
  test('/amigos — lista simulada com nome longo', async ({ page }) => {
    const friendUser = (id: string, username: string) =>
      ({ id, username, avatarUrl: null, level: 3, totalPoints: 1547, currentStreak: 2 });
    await page.route(/\/friends(\?.*)?$/, (route) => route.fulfill({ json: { amigos: [
      { friendshipId: 'f1', since: '2026-10-01T00:00:00Z', user: friendUser('u1', 'NomeDeUsuarioBemComprido_2026_x') },
      { friendshipId: 'f2', since: '2026-10-02T00:00:00Z', user: friendUser('u2', 'ana') },
    ] } }));
    await page.route(/\/friends\/requests/, (route) => route.fulfill({ json: { pedidos: [] } }));
    await expectNoHorizontalScroll(page, '/amigos');
    // O nome não pode ser esmagado pelos botões (antes ficava com ~0 px)
    const nameWidth = await page.locator('main li p.truncate').first().evaluate((el) => el.getBoundingClientRect().width);
    expect(nameWidth, 'largura do nome do amigo').toBeGreaterThan(120);
  });

  for (const tab of GROUP_TABS) {
    test(`grupo — aba ${tab}`, async ({ page }) => {
      test.skip(!groupPath, 'A conta de teste não participa de nenhum grupo.');
      await expectNoHorizontalScroll(page, `${groupPath}?aba=${tab}`);
    });
  }
});
