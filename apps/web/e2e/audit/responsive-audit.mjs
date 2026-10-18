/**
 * Vistoria de responsividade do web (navegador de celular) com Playwright.
 *
 * Uso (dentro de apps/web, com `npm run dev:web` e `npm run dev:api` rodando):
 *   node e2e/audit/responsive-audit.mjs seed              cria dados de teste ([E2E]) na conta de teste
 *   node e2e/audit/responsive-audit.mjs audit antes       screenshots + medições → e2e-artifacts/responsividade/antes
 *   node e2e/audit/responsive-audit.mjs audit depois      idem, depois das correções (inclui 1280x800)
 *   node e2e/audit/responsive-audit.mjs cleanup           apaga as tarefas e o grupo [E2E]
 *
 * Credenciais: TEST_EMAIL e TEST_PASSWORD em apps/web/.env.e2e.local (ignorado
 * pelo git). Nunca coloque credenciais no código.
 */

import { chromium } from '@playwright/test';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const WEB_DIR   = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT_DIR   = join(WEB_DIR, 'e2e-artifacts');
const AUTH_FILE = join(OUT_DIR, '.auth.json');
const SEED_FILE = join(OUT_DIR, 'seed.json');
const BASE_URL  = process.env.BASE_URL ?? 'http://localhost:5173';
const API_URL   = process.env.API_URL  ?? 'http://localhost:3333';
const TAG       = '[E2E]';

// ---------------------------------------------------------------------------
// Credenciais (só do ambiente / .env.e2e.local)
// ---------------------------------------------------------------------------

function loadEnvFile() {
  const file = join(WEB_DIR, '.env.e2e.local');
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}
loadEnvFile();

function credentials() {
  const email = process.env.TEST_EMAIL;
  const password = process.env.TEST_PASSWORD;
  if (!email || !password || email.startsWith('coloque-')) {
    console.error('TEST_EMAIL / TEST_PASSWORD não definidas (apps/web/.env.e2e.local).');
    process.exit(1);
  }
  return { email, password };
}

// ---------------------------------------------------------------------------
// Login e token
// ---------------------------------------------------------------------------

async function dismissConsent(page) {
  const accept = page.getByRole('button', { name: 'Aceitar todos' });
  if (await accept.isVisible().catch(() => false)) await accept.click();
}

async function login(browser) {
  const { email, password } = credentials();
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.goto(`${BASE_URL}/login`);
  await dismissConsent(page);
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(password);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(/\/dashboard/, { timeout: 20_000 });
  mkdirSync(OUT_DIR, { recursive: true });
  await context.storageState({ path: AUTH_FILE });
  const token = await page.evaluate(() => {
    const key = Object.keys(localStorage).find((k) => k.startsWith('sb-') && k.endsWith('-auth-token'));
    return key ? JSON.parse(localStorage.getItem(key)).access_token : null;
  });
  await context.close();
  if (!token) throw new Error('Token do Supabase não encontrado após o login.');
  return token;
}

async function apiCall(token, method, path, body) {
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status} ${JSON.stringify(data)}`);
  return data;
}

// ---------------------------------------------------------------------------
// Dados de teste
// ---------------------------------------------------------------------------

const LONG_WORD = 'Supercalifragilisticexpialidocious_SemEspacos_ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const LONG_TEXT = 'Texto longo para testar quebra de linha no celular: ' + 'lorem ipsum dolor sit amet '.repeat(12);
const doc = (text) => ({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] });

async function seed(token) {
  const day = 86_400_000;
  const created = { tasks: [], groupId: null };

  const tasks = [
    { title: `${TAG} Tarefa com um título bem comprido para ver como a lista se comporta no celular com várias palavras`, difficulty: 'hard', priority: 'urgent', dueDate: new Date(Date.now() + day).toISOString() },
    { title: `${TAG} ${LONG_WORD}`, difficulty: 'epic', priority: 'high', description: LONG_TEXT },
    // A API não aceita prazo no passado — "prazo hoje" é o mais próximo de atrasada
    { title: `${TAG} Prazo para daqui a pouco`, difficulty: 'easy', priority: 'low', dueDate: new Date(Date.now() + 3_600_000).toISOString() },
    ...Array.from({ length: 9 }, (_, i) => ({ title: `${TAG} Tarefa de lista longa ${i + 1}`, difficulty: ['easy', 'medium', 'hard'][i % 3], priority: 'medium' })),
  ];
  for (const t of tasks) {
    const { tarefa } = await apiCall(token, 'POST', '/tasks', t);
    created.tasks.push(tarefa.id);
  }
  // Concluídas: alimentam estatísticas, gráficos e transações
  for (const id of created.tasks.slice(3, 8)) await apiCall(token, 'PATCH', `/tasks/${id}/complete`);

  const { grupo } = await apiCall(token, 'POST', '/groups', {
    name: `${TAG} Grupo de Estudos Avançados de Engenharia de Software e Produtividade Pessoal`,
    description: LONG_TEXT,
  });
  created.groupId = grupo.id;

  for (const title of [`${TAG} Tarefa do grupo com nome comprido para conferir a quebra`, `${TAG} ${LONG_WORD}`, `${TAG} Revisar`]) {
    const { tarefa } = await apiCall(token, 'POST', '/tasks', { title, difficulty: 'medium', priority: 'medium', groupId: grupo.id });
    created.tasks.push(tarefa.id);
  }
  await apiCall(token, 'PATCH', `/tasks/${created.tasks.at(-1)}/complete`);
  await apiCall(token, 'POST', `/groups/${grupo.id}/missions`, {
    title: `${TAG} Missão coletiva com um título também bem comprido para testar`,
    description: LONG_TEXT.slice(0, 200), targetValue: 10, rewardPoints: 50,
  });
  for (let i = 0; i < 12; i++) {
    const text = i === 5 ? `Mensagem longa: ${LONG_TEXT} https://exemplo.com/${LONG_WORD}` : `Mensagem ${i + 1} do chat de teste`;
    await apiCall(token, 'POST', `/groups/${grupo.id}/chat/messages`, { content: doc(text) });
  }

  writeFileSync(SEED_FILE, JSON.stringify(created, null, 2));
  console.log(`Seed ok: ${created.tasks.length} tarefas, grupo ${created.groupId}`);
}

/** Apaga tudo que começa com [E2E] (inclusive sobras de uma execução que falhou no meio) */
async function cleanup(token) {
  const { tarefas } = await apiCall(token, 'GET', '/tasks');
  const tasks = tarefas.filter((t) => t.title.startsWith(TAG));
  for (const t of tasks) await apiCall(token, 'DELETE', `/tasks/${t.id}`).catch((e) => console.log(e.message));
  const { grupos } = await apiCall(token, 'GET', '/groups');
  const groups = grupos.filter((g) => g.name.startsWith(TAG));
  for (const g of groups) await apiCall(token, 'DELETE', `/groups/${g.id}`).catch((e) => console.log(e.message));
  if (existsSync(SEED_FILE)) writeFileSync(SEED_FILE, JSON.stringify({ tasks: [], groupId: null }));
  console.log(`Limpeza ok: ${tasks.length} tarefas e ${groups.length} grupo(s) [E2E] apagados `
    + '(pontos, conquistas e transações geradas pelas conclusões continuam na conta).');
}

// ---------------------------------------------------------------------------
// Medições feitas dentro da página
// ---------------------------------------------------------------------------

function measure() {
  const vw = document.documentElement.clientWidth;
  const vh = window.innerHeight;
  const describe = (el) => {
    const cls = typeof el.className === 'string' ? el.className.trim().split(/\s+/).slice(0, 6).join('.') : '';
    const text = (el.getAttribute('aria-label') || el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 50);
    return `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}${cls ? '.' + cls : ''}${text ? ` "${text}"` : ''}`;
  };
  const visible = (el) => {
    const st = getComputedStyle(el);
    if (st.display === 'none' || st.visibility === 'hidden' || Number(st.opacity) === 0) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  // Elementos dentro do menu lateral fechado (fora da tela de propósito) não contam
  const inClosedDrawer = (el) => !!el.closest('.-translate-x-full');
  // Dentro de um container que corta/rola na horizontal, o excesso não vaza para a página
  const clippedByAncestor = (el) => {
    for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
      const ox = getComputedStyle(a).overflowX;
      if (ox !== 'visible') {
        const r = a.getBoundingClientRect();
        if (r.left >= -1 && r.right <= vw + 1) return true;
      }
    }
    return false;
  };

  const all = [...document.querySelectorAll('body *')].filter(visible);

  const overflowing = all.filter((el) => {
    if (inClosedDrawer(el)) return false;
    const r = el.getBoundingClientRect();
    return (r.right > vw + 1 || r.left < -1) && !clippedByAncestor(el);
  });
  const outermost = overflowing.filter((el) => !overflowing.includes(el.parentElement))
    .slice(0, 8).map((el) => ({ el: describe(el), left: Math.round(el.getBoundingClientRect().left), right: Math.round(el.getBoundingClientRect().right) }));

  // Elemento que passa da borda direita do container que o recorta:
  // - container é <main>/<body> com rolagem → a PÁGINA rola na horizontal
  // - container com overflow hidden/clip → conteúdo CORTADO (some sem aviso)
  // - outro container com rolagem → faixa com rolagem lateral interna
  const pageScroll = [], cut = [], innerScroll = [];
  for (const el of all) {
    if (inClosedDrawer(el)) continue;
    let box = null;
    for (let a = el.parentElement; a && a !== document.documentElement; a = a.parentElement) {
      if (getComputedStyle(a).overflowX !== 'visible') { box = a; break; }
    }
    if (!box) continue;
    const r = el.getBoundingClientRect();
    const b = box.getBoundingClientRect();
    const excess = Math.round(r.right - Math.min(b.right, vw));
    if (excess <= 1) continue;
    const ox = getComputedStyle(box).overflowX;
    const entry = { el: describe(el), container: describe(box).slice(0, 70), excess };
    if (box.matches('main, body')) pageScroll.push(entry);
    else if (ox === 'hidden' || ox === 'clip') cut.push(entry);
    else innerScroll.push(entry);
  }
  // Mantém só o elemento mais externo de cada grupo (o filho de quem já foi listado é redundante)
  const outer = (list) => list.filter((e, i) => !list.slice(0, i).some((p) => p.container === e.container && p.excess >= e.excess)).slice(0, 6);

  const scrollers = [...document.querySelectorAll('main, [role="dialog"], body')]
    .map((el) => ({ el: describe(el), extra: el.scrollWidth - el.clientWidth }))
    .filter((s) => s.extra > 1 && getComputedStyle(document.querySelector('main') ?? document.body).overflowX !== 'hidden');

  const textCut = all.filter((el) => {
    if (inClosedDrawer(el) || el.children.length > 0) return false;
    const st = getComputedStyle(el);
    return st.overflowX === 'hidden' && st.textOverflow !== 'ellipsis' && el.scrollWidth > el.clientWidth + 1;
  }).slice(0, 6).map(describe);

  const interactive = all.filter((el) => el.matches('a[href], button, [role="button"], [role="tab"], select, input[type="checkbox"], input[type="radio"], summary')
    && !inClosedDrawer(el) && !el.closest('.prose, p'));
  const smallTargets = interactive.filter((el) => {
    const r = el.getBoundingClientRect();
    return (r.width < 44 || r.height < 44) && r.top < vh * 3;
  }).map((el) => {
    const r = el.getBoundingClientRect();
    return `${describe(el)} [${Math.round(r.width)}x${Math.round(r.height)}]`;
  });

  const smallInputs = all.filter((el) => el.matches('input:not([type="checkbox"]):not([type="radio"]):not([type="file"]):not([type="hidden"]), textarea, select, [contenteditable="true"]')
    && !inClosedDrawer(el) && parseFloat(getComputedStyle(el).fontSize) < 16)
    .map((el) => `${describe(el)} [${getComputedStyle(el).fontSize}]`);

  const fixed = all.filter((el) => ['fixed', 'sticky'].includes(getComputedStyle(el).position) && !inClosedDrawer(el))
    .map((el) => { const r = el.getBoundingClientRect(); return `${describe(el)} [${Math.round(r.top)},${Math.round(r.bottom)}]`; })
    .slice(0, 6);

  const dialogs = [...document.querySelectorAll('[role="dialog"]')].filter(visible).map((el) => {
    const r = el.getBoundingClientRect();
    const st = getComputedStyle(el);
    return { el: describe(el), top: Math.round(r.top), bottom: Math.round(r.bottom), width: Math.round(r.width),
      scrollsInside: ['auto', 'scroll'].includes(st.overflowY), fits: r.top >= -1 && r.bottom <= vh + 1 && r.right <= vw + 1 };
  });

  // Conteúdo escondido abaixo da dobra sem rolagem possível (100vh maior que a área visível)
  const main = document.querySelector('main');
  const mainBottom = main ? Math.round(main.getBoundingClientRect().bottom) : null;

  return {
    viewport: { vw, vh },
    horizontalScroll: document.documentElement.scrollWidth > vw + 1,
    docScrollWidth: document.documentElement.scrollWidth,
    scrollers, overflowing: outermost, textCut,
    pageScroll: outer(pageScroll), cut: outer(cut), innerScroll: outer(innerScroll),
    smallTargets: { count: smallTargets.length, samples: smallTargets.slice(0, 10) },
    smallInputs, fixed, dialogs, mainBottom,
  };
}

// ---------------------------------------------------------------------------
// Telas e estados
// ---------------------------------------------------------------------------

const clickByRole = (role, name) => async (page) => {
  await page.getByRole(role, { name }).first().click();
  await page.waitForTimeout(500);
};

function authScreens(groupId, width) {
  const mobileNav = width < 1024;
  const g = groupId ? `/grupos/${groupId}` : null;
  return [
    { name: 'dashboard', path: '/dashboard' },
    ...(mobileNav ? [{ name: 'dashboard-menu-aberto', path: '/dashboard', act: clickByRole('button', /^Menu/) }] : []),
    // No celular há dois sinos: o do cabeçalho e o do menu lateral fechado (fora da tela)
    { name: 'dashboard-notificacoes', path: '/dashboard', act: async (p) => {
      await p.locator(`${mobileNav ? 'header' : 'aside'} button[aria-label^="Notificações"]`).first().click();
      await p.waitForTimeout(500);
    } },
    { name: 'tarefas', path: '/tarefas' },
    { name: 'tarefas-nova', path: '/tarefas?nova=1' },
    { name: 'tarefas-nova-erro', path: '/tarefas?nova=1', act: async (p) => { await p.locator('[role="dialog"] button[type="submit"]').first().click(); await p.waitForTimeout(400); } },
    { name: 'tarefas-detalhe', path: '/tarefas', act: async (p) => { await p.getByText(/Tarefa com um título bem comprido/).first().click(); await p.waitForTimeout(500); } },
    { name: 'grupos', path: '/grupos' },
    { name: 'grupos-criar', path: '/grupos', act: clickByRole('button', /Criar Grupo/i) },
    ...(g ? ['membros', 'ranking', 'missoes', 'tarefas', 'desempenho', 'chat'].map((aba) => ({
      name: `grupo-${aba}`, path: `${g}?aba=${aba}`, wait: aba === 'desempenho' ? 2000 : 900,
    })) : []),
    ...(g ? [{ name: 'grupo-configuracoes', path: `${g}/configuracoes` }] : []),
    { name: 'ranking-global', path: '/ranking' },
    { name: 'ranking-semanal', path: '/ranking', act: clickByRole('button', /^Semanal/) },
    { name: 'ranking-amigos', path: '/ranking', act: clickByRole('button', /^Amigos/) },
    { name: 'conquistas', path: '/conquistas' },
    { name: 'estatisticas', path: '/estatisticas', wait: 2500 },
    { name: 'estatisticas-personalizado', path: '/estatisticas', wait: 2500, act: clickByRole('button', 'Personalizado') },
    { name: 'perfil', path: '/perfil' },
    { name: 'perfil-editar', path: '/perfil', act: clickByRole('button', 'Editar perfil') },
    { name: 'perfil-editar-erro', path: '/perfil', act: async (p) => { await clickByRole('button', 'Editar perfil')(p); await p.getByLabel('Nome de usuário').fill('a b'); await p.waitForTimeout(300); } },
    { name: 'perfil-descartar', path: '/perfil', act: async (p) => { await clickByRole('button', 'Editar perfil')(p); await p.getByLabel(/^Bio/).fill('mudou'); await clickByRole('button', 'Cancelar')(p); } },
    { name: 'amigos', path: '/amigos' },
    { name: 'seguranca', path: '/configuracoes/seguranca' },
    { name: 'nao-encontrada-logado', path: '/rota-que-nao-existe' },
  ];
}

const publicScreens = [
  { name: 'landing', path: '/' },
  { name: 'login', path: '/login' },
  { name: 'login-erro', path: '/login', act: async (p) => { await p.locator('button[type="submit"]').click(); await p.waitForTimeout(300); } },
  { name: 'cadastro', path: '/cadastro' },
  { name: 'cadastro-erro', path: '/cadastro', act: async (p) => { await p.locator('button[type="submit"]').last().click(); await p.waitForTimeout(300); } },
  { name: 'esqueci-senha', path: '/esqueci-senha' },
  { name: 'politica-privacidade', path: '/politica-de-privacidade' },
  { name: 'redefinir-senha', path: '/redefinir-senha' },
  { name: 'nao-encontrada', path: '/rota-que-nao-existe' },
];

const PHONE_VIEWPORTS = [
  { label: '360x740', width: 360, height: 740 },
  { label: '390x844', width: 390, height: 844 },
  { label: '414x896', width: 414, height: 896 },
  { label: '768x1024', width: 768, height: 1024 },
];
const DESKTOP_VIEWPORT = { label: '1280x800', width: 1280, height: 800 };

async function capture(browser, { viewport, theme, screens, authenticated, outDir, report, consentBannerShot }) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    isMobile: viewport.width < 1024,
    hasTouch: viewport.width < 1024,
    deviceScaleFactor: 1,
    ...(authenticated ? { storageState: AUTH_FILE } : {}),
  });
  await context.addInitScript((t) => {
    localStorage.setItem('prodscore-theme', JSON.stringify({ state: { theme: t }, version: 0 }));
  }, theme);
  const page = await context.newPage();
  let consentHandled = false;

  for (const screen of screens) {
    const key = `${viewport.label}/${theme}/${screen.name}`;
    try {
      await page.goto(`${BASE_URL}${screen.path}`, { waitUntil: 'load' });
      await page.waitForTimeout(screen.wait ?? 900);
      if (!consentHandled) {
        if (consentBannerShot) await page.screenshot({ path: join(outDir, `${viewport.label}-${theme}-banner-cookies.png`) });
        await dismissConsent(page);
        consentHandled = true;
      }
      if (screen.act) await screen.act(page);
      const m = await page.evaluate(measure);
      const file = `${viewport.label}-${theme}-${screen.name}.png`;
      await page.screenshot({ path: join(outDir, file) });
      // Segunda imagem rolada até o fim (o conteúdo rola dentro de <main>, não do documento)
      const scrolled = await page.evaluate(() => {
        const el = document.querySelector('main') ?? document.scrollingElement;
        if (!el || el.scrollHeight <= el.clientHeight + 4) return false;
        el.scrollTop = el.scrollHeight;
        window.scrollTo(0, document.body.scrollHeight);
        return true;
      });
      if (scrolled) {
        await page.waitForTimeout(250);
        await page.screenshot({ path: join(outDir, file.replace('.png', '-fim.png')) });
      }
      report[key] = { ...m, screenshot: file };
    } catch (err) {
      report[key] = { error: String(err.message ?? err).slice(0, 300) };
    }
  }
  await context.close();
}

async function audit(browser, phase) {
  const outDir = join(OUT_DIR, 'responsividade', phase);
  mkdirSync(outDir, { recursive: true });
  const seedData = existsSync(SEED_FILE) ? JSON.parse(readFileSync(SEED_FILE, 'utf8')) : { groupId: null };
  const viewports = [...PHONE_VIEWPORTS, DESKTOP_VIEWPORT];
  const report = {};

  for (const viewport of viewports) {
    for (const theme of ['light', 'dark']) {
      await capture(browser, { viewport, theme, screens: publicScreens, authenticated: false, outDir, report, consentBannerShot: true });
      await capture(browser, { viewport, theme, screens: authScreens(seedData.groupId, viewport.width), authenticated: true, outDir, report });
      console.log(`${phase} ${viewport.label} ${theme} ok`);
    }
  }
  writeFileSync(join(outDir, 'relatorio.json'), JSON.stringify(report, null, 2));
  console.log(`Relatório: ${join(outDir, 'relatorio.json')}`);
}

// ---------------------------------------------------------------------------

const [command = 'audit', phase = 'antes'] = process.argv.slice(2);
const browser = await chromium.launch();
try {
  const token = await login(browser);
  if (command === 'seed') await seed(token);
  else if (command === 'cleanup') await cleanup(token);
  else if (command === 'empty') {
    // Estados de lista vazia: roda só algumas telas antes de criar os dados
    const outDir = join(OUT_DIR, 'responsividade', 'vazio');
    mkdirSync(outDir, { recursive: true });
    const report = {};
    const screens = authScreens(null, 390).filter((s) => ['dashboard', 'tarefas', 'grupos', 'estatisticas', 'conquistas', 'amigos', 'ranking-amigos'].includes(s.name));
    await capture(browser, { viewport: PHONE_VIEWPORTS[1], theme: 'light', screens, authenticated: true, outDir, report });
    writeFileSync(join(outDir, 'relatorio.json'), JSON.stringify(report, null, 2));
    console.log('Estados vazios ok');
  } else await audit(browser, phase);
} finally {
  await browser.close();
}
