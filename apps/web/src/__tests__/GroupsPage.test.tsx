/**
 * Testes da descrição formatada no card de grupo (página Meus Grupos).
 * O serviço de grupos é mockado; um MemoryRouter de verdade confere que o
 * "ver mais" leva para a tela do grupo.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import userEvent from '@testing-library/user-event';
import { MemberRole, type RichTextDoc } from '@prodscore/shared';
import type { GroupWithMeta } from '../services/group.service';

const mockGetGroups = vi.fn();

vi.mock('../services/group.service.js', () => ({
  getGroups:   () => mockGetGroups(),
  createGroup: vi.fn(),
  joinGroup:   vi.fn(),
}));
vi.mock('../store/authStore.js', () => ({
  useAuthStore: (selector: (s: { user: { id: string } }) => unknown) => selector({ user: { id: 'user-1' } }),
}));

import GroupsPage from '../pages/GroupsPage';

function makeGroup(overrides: Partial<GroupWithMeta> = {}): GroupWithMeta {
  return {
    id:              'grupo-1',
    name:            'Estudos',
    description:     null,
    descriptionRich: null,
    imageUrl:        null,
    ownerId:         'user-1',
    inviteCode:      'ABC123',
    countExternalTasksInMissions: false,
    createdAt:       '2026-10-14T10:00:00.000Z',
    role:            MemberRole.Owner,
    memberCount:     1,
    ...overrides,
  };
}

/** Renderiza a página dentro de um roteador com a rota da tela do grupo */
function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/grupos']}>
      <Routes>
        <Route path="/grupos" element={<GroupsPage />} />
        <Route path="/grupos/:id" element={<p>Tela do grupo</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

const richDoc: RichTextDoc = {
  type: 'doc',
  content: [{ type: 'paragraph', content: [
    { type: 'text', text: 'Grupo', marks: ['bold'] },
    { type: 'text', text: ' de estudos' },
  ] }],
};

/** Simula conteúdo maior que a caixa da prévia (o jsdom não calcula layout) */
function mockOverflow(scrollHeight: number, clientHeight: number) {
  const sh = vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockReturnValue(scrollHeight);
  const ch = vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(clientHeight);
  return () => { sh.mockRestore(); ch.mockRestore(); };
}

describe('GroupsPage — descrição do grupo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renderiza a descrição formatada no card', async () => {
    mockGetGroups.mockResolvedValue([makeGroup({ description: 'Grupo de estudos', descriptionRich: richDoc })]);
    renderPage();

    expect(await screen.findByText('Grupo')).toHaveClass('font-semibold');
  });

  it('grupo antigo (só texto puro) aparece igual, sem interpretar asteriscos', async () => {
    mockGetGroups.mockResolvedValue([makeGroup({ description: 'meta: 2*3*4 horas' })]);
    renderPage();

    expect(await screen.findByText('meta: 2*3*4 horas')).toBeInTheDocument();
  });

  it('texto longo sem espaços quebra em vez de estourar o card', async () => {
    const longo = 'testesteste@@@222'.repeat(20);
    mockGetGroups.mockResolvedValue([makeGroup({ description: longo })]);
    renderPage();

    const container = (await screen.findByText(longo)).closest('div');
    expect(container).toHaveClass('[overflow-wrap:anywhere]');
  });

  it('"ver mais" leva para a tela do grupo', async () => {
    const restore = mockOverflow(200, 40);
    const user = userEvent.setup();
    mockGetGroups.mockResolvedValue([makeGroup({ description: 'descrição longa' })]);
    renderPage();

    await user.click(await screen.findByRole('button', { name: 'ver mais' }));

    expect(screen.getByText('Tela do grupo')).toBeInTheDocument();
    restore();
  });

  it('clicar no card também abre o grupo', async () => {
    const user = userEvent.setup();
    mockGetGroups.mockResolvedValue([makeGroup()]);
    renderPage();

    await user.click(await screen.findByRole('link'));

    expect(screen.getByText('Tela do grupo')).toBeInTheDocument();
  });
});
