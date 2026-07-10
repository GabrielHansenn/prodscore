import { useEffect, useState, type FormEvent } from 'react';
import { MemberRole } from '@prodscore/shared';
import { useNavigate } from 'react-router-dom';
import {
  getGroups,
  createGroup,
  joinGroup,
  type GroupWithMeta,
} from '../services/group.service.js';
import { UsersIcon, UserIcon, CalendarIcon } from '../components/icons.js';

function CreateGroupModal({ onClose, onCreate }: { onClose: () => void; onCreate: (g: GroupWithMeta) => void }) {
  const [name,        setName]        = useState('');
  const [description, setDescription] = useState('');
  const [error,       setError]       = useState('');
  const [loading,     setLoading]     = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setError('Nome do grupo é obrigatório.'); return; }
    setError('');
    setLoading(true);
    try {
      const desc  = description.trim();
      const grupo = await createGroup({ name: name.trim(), ...(desc ? { description: desc } : {}) });
      onCreate({ ...grupo, role: MemberRole.Owner, memberCount: 1 });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar grupo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-xl dark:border-gray-700 dark:bg-gray-900">
        <h2 className="mb-5 text-lg font-semibold text-gray-900 dark:text-white">Criar Grupo</h2>
        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">Nome do grupo</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Devs Produtivos"
              maxLength={60}
              className="input w-full"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">Descrição (opcional)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Do que se trata este grupo?"
              className="input w-full resize-none"
            />
          </div>
          {error && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600 dark:border-red-800/40 dark:bg-red-900/20 dark:text-red-400">{error}</p>}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancelar</button>
            <button type="submit" disabled={loading} className="btn-primary flex-1">
              {loading ? 'Criando...' : 'Criar Grupo'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function JoinGroupModal({ onClose, onJoined }: { onClose: () => void; onJoined: (g: GroupWithMeta) => void }) {
  const [code,    setCode]    = useState('');
  const [error,   setError]   = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (code.trim().length < 4) { setError('Código inválido.'); return; }
    setError('');
    setLoading(true);
    try {
      const grupo = await joinGroup(code.trim());
      onJoined({ ...grupo, role: MemberRole.Member, memberCount: 0 });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Código de convite inválido.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-6 shadow-xl dark:border-gray-700 dark:bg-gray-900">
        <h2 className="mb-2 text-lg font-semibold text-gray-900 dark:text-white">Entrar com Código</h2>
        <p className="mb-5 text-xs text-gray-500 dark:text-gray-400">Cole o código de convite compartilhado pelo dono do grupo.</p>
        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="EX: AB12CD"
            maxLength={8}
            className="w-full rounded-xl border border-gray-300 bg-white px-3 py-3.5 text-center font-mono text-xl font-bold tracking-widest text-gray-900 placeholder-gray-300 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:placeholder-gray-600"
          />
          {error && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600 dark:border-red-800/40 dark:bg-red-900/20 dark:text-red-400">{error}</p>}
          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancelar</button>
            <button type="submit" disabled={loading} className="btn-primary flex-1">
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const ROLE_LABELS: Record<MemberRole, string> = {
  [MemberRole.Owner]:  'Dono',
  [MemberRole.Admin]:  'Admin',
  [MemberRole.Member]: 'Membro',
};

const ROLE_STYLES: Record<MemberRole, string> = {
  [MemberRole.Owner]:  'bg-amber-100 text-amber-700',
  [MemberRole.Admin]:  'bg-brand-100 text-brand-700',
  [MemberRole.Member]: 'bg-gray-100 text-gray-600',
};

function GroupCard({ group, onClick }: { group: GroupWithMeta; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="card w-full p-5 text-left transition-shadow hover:shadow-card-hover"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          {group.imageUrl ? (
            <img src={group.imageUrl} alt="" className="h-10 w-10 rounded-xl object-cover" />
          ) : (
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-100">
              <UsersIcon className="h-5 w-5 text-brand-600" />
            </div>
          )}
          <div className="min-w-0">
            <h3 className="truncate font-semibold text-gray-900 dark:text-white">{group.name}</h3>
            {group.description && (
              <p className="mt-0.5 truncate text-xs text-gray-500 dark:text-gray-400">{group.description}</p>
            )}
          </div>
        </div>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${ROLE_STYLES[group.role]}`}>
          {ROLE_LABELS[group.role]}
        </span>
      </div>
      <div className="mt-4 flex items-center gap-4 text-xs text-gray-400 dark:text-gray-500">
        <span className="flex items-center gap-1">
          <UserIcon className="h-3.5 w-3.5" />
          {group.memberCount} {group.memberCount === 1 ? 'membro' : 'membros'}
        </span>
        <span className="flex items-center gap-1">
          <CalendarIcon className="h-3.5 w-3.5" />
          {new Date(group.createdAt).toLocaleDateString('pt-BR')}
        </span>
      </div>
    </button>
  );
}

export default function GroupsPage() {
  const navigate = useNavigate();
  const [groups,     setGroups]     = useState<GroupWithMeta[]>([]);
  const [isLoading,  setIsLoading]  = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin,   setShowJoin]   = useState(false);

  useEffect(() => {
    void (async () => {
      try   { setGroups(await getGroups()); }
      finally { setIsLoading(false); }
    })();
  }, []);

  return (
    <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Meus Grupos</h1>
          <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">Colabore e compita com outros jogadores</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowJoin(true)} className="btn-secondary">
            Entrar com Código
          </button>
          <button onClick={() => setShowCreate(true)} className="btn-primary">
            + Criar Grupo
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-brand-600" />
        </div>
      ) : groups.length === 0 ? (
        <div className="card py-16 text-center">
          <UsersIcon className="mx-auto h-12 w-12 text-gray-300" />
          <p className="mt-3 font-medium text-gray-600">Você ainda não está em nenhum grupo</p>
          <p className="mt-1 text-sm text-gray-400">Crie um grupo ou entre com um código de convite.</p>
          <div className="mt-6 flex justify-center gap-3">
            <button onClick={() => setShowJoin(true)} className="btn-secondary">Entrar com Código</button>
            <button onClick={() => setShowCreate(true)} className="btn-primary">Criar Grupo</button>
          </div>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {groups.map((g) => (
            <GroupCard key={g.id} group={g} onClick={() => navigate(`/grupos/${g.id}`)} />
          ))}
        </div>
      )}

      {showCreate && (
        <CreateGroupModal onClose={() => setShowCreate(false)} onCreate={(g) => setGroups((prev) => [g, ...prev])} />
      )}
      {showJoin && (
        <JoinGroupModal
          onClose={() => setShowJoin(false)}
          onJoined={(g) => { setGroups((prev) => [g, ...prev]); navigate(`/grupos/${g.id}`); }}
        />
      )}
    </main>
  );
}
