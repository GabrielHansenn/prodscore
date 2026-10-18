/**
 * Testes da navegação do celular: regras de aba ativa por rota, barra
 * escondida no chat e com teclado aberto, botão "+" e menu com o resto das
 * telas. (A visibilidade por largura — só abaixo de 1024px — é coberta pelo
 * teste do Playwright, que roda num navegador de verdade.)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within, fireEvent, act, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';

const { mockGetUnreadCounts, mockLogout } = vi.hoisted(() => ({
  mockGetUnreadCounts: vi.fn(),
  mockLogout:          vi.fn(),
}));

vi.mock('../services/message.service.js', () => ({ getUnreadCounts: mockGetUnreadCounts }));
vi.mock('../store/authStore.js', () => ({
  useAuthStore: (selector: (s: object) => unknown) =>
    selector({ user: { username: 'gabriel', level: 5, avatarUrl: null }, logout: mockLogout }),
}));
vi.mock('../lib/supabase.js', () => ({ supabase: {} }));

import BottomNav from '../components/BottomNav';
import { activeMobileTab, hidesBottomNav } from '../lib/mobileNav';
import { useChatStore } from '../store/chatStore';

/** Mostra o endereço atual, para conferir para onde os botões levam */
function LocationProbe() {
  const { pathname, search } = useLocation();
  return <p data-testid="location">{pathname}{search}</p>;
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="*" element={<><BottomNav /><LocationProbe /></>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetUnreadCounts.mockResolvedValue({});
  useChatStore.setState({ unread: {} });
  document.documentElement.style.removeProperty('--bottom-nav-height');
});

describe('activeMobileTab — aba destacada conforme a rota', () => {
  it.each([
    ['/dashboard', 'inicio'],
    ['/tarefas', 'tarefas'],
    ['/grupos', 'grupos'],
    ['/grupos/abc-123', 'grupos'],
    ['/grupos/abc-123/configuracoes', 'grupos'],
    ['/ranking', 'menu'],
    ['/perfil', 'menu'],
    ['/amigos', 'menu'],
    ['/amigos/u1', 'menu'],
    ['/conquistas', 'menu'],
    ['/estatisticas', 'menu'],
    ['/configuracoes/seguranca', 'menu'],
    ['/rota-que-nao-existe', null],
  ])('%s → %s', (path, tab) => {
    expect(activeMobileTab(path)).toBe(tab);
  });

  it('não confunde rotas com o mesmo começo (/tarefasx não é Tarefas)', () => {
    expect(activeMobileTab('/tarefasx')).toBeNull();
  });
});

describe('hidesBottomNav', () => {
  it('esconde no chat com amigo e mostra no resto', () => {
    expect(hidesBottomNav('/amigos/u1/chat')).toBe(true);
    expect(hidesBottomNav('/amigos/u1')).toBe(false);
    expect(hidesBottomNav('/grupos/g1')).toBe(false);
  });
});

describe('BottomNav', () => {
  it('tem as abas Início, Tarefas, Grupos, Menu e o botão de nova tarefa', () => {
    renderAt('/dashboard');
    const nav = screen.getByRole('navigation', { name: 'Navegação principal' });
    expect(within(nav).getByRole('link', { name: 'Início' })).toBeInTheDocument();
    expect(within(nav).getByRole('link', { name: 'Tarefas' })).toBeInTheDocument();
    expect(within(nav).getByRole('link', { name: 'Grupos' })).toBeInTheDocument();
    expect(within(nav).getByRole('button', { name: 'Nova tarefa' })).toBeInTheDocument();
    expect(within(nav).getByRole('button', { name: 'Menu' })).toBeInTheDocument();
  });

  it('só aparece no celular: some a partir de 1024px (lg:hidden)', () => {
    renderAt('/dashboard');
    expect(screen.getByTestId('bottom-nav')).toHaveClass('lg:hidden');
  });

  it.each([
    ['/dashboard', 'Início'],
    ['/tarefas', 'Tarefas'],
    ['/grupos/abc', 'Grupos'],
  ])('em %s a aba "%s" é a página atual (aria-current)', (path, label) => {
    renderAt(path);
    expect(screen.getByRole('link', { name: label })).toHaveAttribute('aria-current', 'page');
    for (const other of ['Início', 'Tarefas', 'Grupos'].filter((l) => l !== label)) {
      expect(screen.getByRole('link', { name: other })).not.toHaveAttribute('aria-current');
    }
  });

  it('telas do menu (ex: Ranking) destacam o botão Menu e avisam o leitor de tela', () => {
    renderAt('/ranking');
    expect(screen.getByRole('button', { name: 'Menu, tela atual' })).toBeInTheDocument();
  });

  it('o "+" abre a criação de tarefa', async () => {
    renderAt('/dashboard');
    await userEvent.click(screen.getByRole('button', { name: 'Nova tarefa' }));
    expect(screen.getByTestId('location')).toHaveTextContent('/tarefas?nova=1');
  });

  it('o Menu abre a folha com as outras telas, e escolher uma fecha a folha', async () => {
    renderAt('/dashboard');
    await userEvent.click(screen.getByRole('button', { name: 'Menu' }));

    const sheet = screen.getByRole('dialog', { name: 'gabriel' });
    for (const label of ['Ranking', 'Perfil', 'Amigos', 'Conquistas', 'Estatísticas', 'Segurança']) {
      expect(within(sheet).getByRole('link', { name: label })).toBeInTheDocument();
    }
    expect(within(sheet).getByRole('radiogroup', { name: 'Tema da interface' })).toBeInTheDocument();
    expect(within(sheet).getByRole('button', { name: /Sair/ })).toBeInTheDocument();

    await userEvent.click(within(sheet).getByRole('link', { name: 'Conquistas' }));
    expect(screen.getByTestId('location')).toHaveTextContent('/conquistas');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('arrastar o menu para baixo fecha; um toque curto não', async () => {
    renderAt('/dashboard');
    await userEvent.click(screen.getByRole('button', { name: 'Menu' }));
    const handle = document.querySelector('[data-drag-handle]')!;

    // Movimento curto (menos que um arraste): continua aberto
    fireEvent.touchStart(handle, { touches: [{ clientY: 100 }] });
    fireEvent.touchMove(handle, { touches: [{ clientY: 112 }] });
    fireEvent.touchEnd(handle);
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    // Arrastou bastante para baixo: fecha
    fireEvent.touchStart(handle, { touches: [{ clientY: 100 }] });
    fireEvent.touchMove(handle, { touches: [{ clientY: 180 }] });
    fireEvent.touchMove(handle, { touches: [{ clientY: 260 }] });
    fireEvent.touchEnd(handle);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('Esc fecha o menu', async () => {
    renderAt('/dashboard');
    await userEvent.click(screen.getByRole('button', { name: 'Menu' }));
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('mostra o total de mensagens não lidas no Menu e em Amigos', async () => {
    mockGetUnreadCounts.mockResolvedValue({ a: 2, b: 1 });
    renderAt('/dashboard');

    expect(await screen.findByRole('button', { name: 'Menu, 3 mensagens não lidas' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /^Menu/ }));
    expect(screen.getByRole('link', { name: 'Amigos, 3 mensagens não lidas' })).toBeInTheDocument();
  });

  it('some no chat com amigo e libera o espaço reservado', () => {
    renderAt('/amigos/u1/chat');
    expect(screen.queryByRole('navigation', { name: 'Navegação principal' })).not.toBeInTheDocument();
    expect(document.documentElement.style.getPropertyValue('--bottom-nav-height')).toBe('0px');
  });

  it('some com o teclado aberto (campo de texto com foco num aparelho de toque)', async () => {
    const original = window.matchMedia;
    window.matchMedia = ((query: string) => ({
      matches: query === '(pointer: coarse)', media: query, onchange: null,
      addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn(),
    })) as typeof window.matchMedia;

    render(
      <MemoryRouter initialEntries={['/tarefas']}>
        <BottomNav />
        <input aria-label="Título" />
      </MemoryRouter>,
    );
    expect(screen.getByRole('navigation', { name: 'Navegação principal' })).toBeInTheDocument();

    act(() => { fireEvent.focusIn(screen.getByLabelText('Título')); });
    expect(screen.queryByRole('navigation', { name: 'Navegação principal' })).not.toBeInTheDocument();

    window.matchMedia = original;
  });

  it('volta quando o campo focado sai da página sem focusout (modal fechado no Safari)', async () => {
    const original = window.matchMedia;
    window.matchMedia = ((query: string) => ({
      matches: query === '(pointer: coarse)', media: query, onchange: null,
      addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn(),
    })) as typeof window.matchMedia;

    function FakeModal({ open }: { open: boolean }) {
      return open ? <input aria-label="Título" autoFocus /> : null;
    }
    const ui = (open: boolean) => (
      <MemoryRouter initialEntries={['/dashboard']}>
        <BottomNav />
        <FakeModal open={open} />
      </MemoryRouter>
    );
    const { rerender } = render(ui(true));
    act(() => { fireEvent.focusIn(screen.getByLabelText('Título')); });
    expect(screen.queryByRole('navigation', { name: 'Navegação principal' })).not.toBeInTheDocument();

    // Como no WebKit: o campo some e nenhum focusout é disparado
    const stopFocusOut = (e: Event) => e.stopImmediatePropagation();
    document.addEventListener('focusout', stopFocusOut, true);
    rerender(ui(false));
    document.removeEventListener('focusout', stopFocusOut, true);

    expect(await screen.findByRole('navigation', { name: 'Navegação principal' })).toBeInTheDocument();
    window.matchMedia = original;
  });
});
