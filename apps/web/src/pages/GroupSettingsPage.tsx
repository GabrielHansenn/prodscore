import { useEffect, useState, type FormEvent } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MemberRole } from '@prodscore/shared';
import {
  getGroupDetail,
  getGroupMembers,
  updateGroupInfo,
  regenerateInviteCode,
  updateMemberRole,
  kickMember,
  leaveGroup,
  deleteGroup,
  type GroupDetails,
  type GroupMember,
} from '../services/group.service.js';
import { useAuthStore } from '../store/authStore.js';
import { FlameIcon, CogIcon, TrashIcon } from '../components/icons.js';

const ROLE_LABELS: Record<MemberRole, string> = {
  [MemberRole.Owner]:  'Dono',
  [MemberRole.Admin]:  'Admin',
  [MemberRole.Member]: 'Membro',
};

const ROLE_STYLES: Record<MemberRole, string> = {
  [MemberRole.Owner]:  'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400',
  [MemberRole.Admin]:  'bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-400',
  [MemberRole.Member]: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
};

// ---------------------------------------------------------------------------
// Modal de confirmação genérico
// ---------------------------------------------------------------------------

function ConfirmModal({
  title,
  message,
  confirmLabel = 'Confirmar',
  danger = false,
  onConfirm,
  onCancel,
}: {
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}) {
  const [loading, setLoading] = useState(false);

  const handle = async () => {
    setLoading(true);
    try { await onConfirm(); }
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-6 shadow-xl dark:border-gray-700 dark:bg-gray-900">
        <h3 className="mb-2 text-base font-semibold text-gray-900 dark:text-white">{title}</h3>
        <p className="mb-5 text-sm text-gray-500 dark:text-gray-400">{message}</p>
        <div className="flex gap-3">
          <button onClick={onCancel} className="btn-secondary flex-1" disabled={loading}>
            Cancelar
          </button>
          <button
            onClick={() => void handle()}
            disabled={loading}
            className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors disabled:opacity-60 ${
              danger
                ? 'bg-red-600 text-white hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-800'
                : 'btn-primary'
            }`}
          >
            {loading ? 'Aguarde…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Seção: Informações do grupo
// ---------------------------------------------------------------------------

function GroupInfoSection({
  group,
  isOwnerOrAdmin,
  onSaved,
}: {
  group: GroupDetails;
  isOwnerOrAdmin: boolean;
  onSaved: (updated: GroupDetails) => void;
}) {
  const { id } = useParams<{ id: string }>();
  const [name,        setName]        = useState(group.name);
  const [description, setDescription] = useState(group.description ?? '');
  const [imageUrl,    setImageUrl]    = useState(group.imageUrl ?? '');
  const [saving,      setSaving]      = useState(false);
  const [feedback,    setFeedback]    = useState<{ type: 'ok' | 'err'; msg: string } | null>(null);

  const dirty =
    name !== group.name ||
    description !== (group.description ?? '') ||
    imageUrl !== (group.imageUrl ?? '');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!id || !dirty) return;
    setSaving(true);
    setFeedback(null);
    try {
      const trimmedName = name.trim();
      const updated = await updateGroupInfo(id, {
        ...(trimmedName ? { name: trimmedName } : {}),
        description: description.trim() || null,
        imageUrl:    imageUrl.trim() || null,
      });
      onSaved({ ...group, ...updated });
      setFeedback({ type: 'ok', msg: 'Informações salvas com sucesso.' });
    } catch (err) {
      setFeedback({ type: 'err', msg: err instanceof Error ? err.message : 'Erro ao salvar.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="card p-6">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
        Informações do Grupo
      </h2>

      {isOwnerOrAdmin ? (
        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">Nome *</label>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={100}
              className="input w-full"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">Descrição</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              maxLength={500}
              placeholder="Opcional"
              className="input w-full resize-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">URL da imagem</label>
            <input
              type="url"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://..."
              className="input w-full"
            />
          </div>

          {feedback && (
            <p className={`rounded-lg px-3 py-2 text-xs ${
              feedback.type === 'ok'
                ? 'bg-lime-50 text-lime-700 dark:bg-lime-900/30 dark:text-lime-400'
                : 'bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400'
            }`}>
              {feedback.msg}
            </p>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving || !dirty}
              className="btn-primary disabled:opacity-50"
            >
              {saving ? 'Salvando…' : 'Salvar alterações'}
            </button>
          </div>
        </form>
      ) : (
        <div className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
          <p><span className="font-medium">Nome:</span> {group.name}</p>
          {group.description && <p><span className="font-medium">Descrição:</span> {group.description}</p>}
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Seção: Código de convite
// ---------------------------------------------------------------------------

function InviteCodeSection({
  inviteCode,
  isOwnerOrAdmin,
  groupId,
  onNewCode,
}: {
  inviteCode: string;
  isOwnerOrAdmin: boolean;
  groupId: string;
  onNewCode: (code: string) => void;
}) {
  const [copied,     setCopied]     = useState(false);
  const [loading,    setLoading]    = useState(false);
  const [confirm,    setConfirm]    = useState(false);
  const [currentCode, setCurrentCode] = useState(inviteCode);

  const copy = async () => {
    await navigator.clipboard.writeText(currentCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const regen = async () => {
    setLoading(true);
    try {
      const newCode = await regenerateInviteCode(groupId);
      setCurrentCode(newCode);
      onNewCode(newCode);
      setConfirm(false);
    } catch {
      // erro silencioso — o modal fecha e o usuário pode tentar de novo
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="card p-6">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
        Código de Convite
      </h2>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 dark:border-gray-700 dark:bg-gray-800">
          <span className="font-mono text-xl font-bold tracking-widest text-brand-600 dark:text-brand-400">
            {currentCode}
          </span>
        </div>

        <button
          onClick={() => void copy()}
          className="btn-secondary"
        >
          {copied ? '✓ Copiado!' : 'Copiar'}
        </button>

        {isOwnerOrAdmin && (
          <button
            onClick={() => setConfirm(true)}
            className="rounded-xl border border-orange-200 bg-orange-50 px-4 py-2 text-sm font-medium text-orange-700 transition-colors hover:bg-orange-100 dark:border-orange-800/40 dark:bg-orange-900/20 dark:text-orange-400 dark:hover:bg-orange-900/40"
          >
            Gerar novo código
          </button>
        )}
      </div>

      <p className="mt-3 text-xs text-gray-400 dark:text-gray-500">
        Compartilhe este código para convidar pessoas para o grupo.
        {isOwnerOrAdmin && ' Ao gerar um novo código, o anterior deixa de funcionar.'}
      </p>

      {confirm && (
        <ConfirmModal
          title="Gerar novo código?"
          message="O código atual deixará de funcionar. Qualquer pessoa com o link antigo não conseguirá mais entrar."
          confirmLabel={loading ? 'Gerando…' : 'Gerar novo código'}
          onConfirm={regen}
          onCancel={() => setConfirm(false)}
        />
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Seção: Membros
// ---------------------------------------------------------------------------

function MembersSection({
  members,
  myRole,
  myUserId,
  groupId,
  onMembersChange,
}: {
  members: GroupMember[];
  myRole: MemberRole | undefined;
  myUserId: string | undefined;
  groupId: string;
  onMembersChange: (members: GroupMember[]) => void;
}) {
  const isOwner        = myRole === MemberRole.Owner;
  const isOwnerOrAdmin = isOwner || myRole === MemberRole.Admin;

  const [pendingAction, setPendingAction] = useState<{
    type: 'role' | 'kick';
    member: GroupMember;
    newRole?: 'admin' | 'member';
  } | null>(null);

  const [error, setError] = useState('');

  const confirmAction = async () => {
    if (!pendingAction) return;
    setError('');
    try {
      if (pendingAction.type === 'kick') {
        await kickMember(groupId, pendingAction.member.userId);
        onMembersChange(members.filter((m) => m.userId !== pendingAction.member.userId));
      } else if (pendingAction.type === 'role' && pendingAction.newRole) {
        await updateMemberRole(groupId, pendingAction.member.userId, pendingAction.newRole);
        onMembersChange(
          members.map((m) =>
            m.userId === pendingAction.member.userId
              ? { ...m, role: pendingAction.newRole === 'admin' ? MemberRole.Admin : MemberRole.Member }
              : m,
          ),
        );
      }
      setPendingAction(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Operação falhou.');
      setPendingAction(null);
    }
  };

  const canPromote  = (m: GroupMember) => isOwner && m.role === MemberRole.Member && m.userId !== myUserId;
  const canDemote   = (m: GroupMember) => isOwner && m.role === MemberRole.Admin  && m.userId !== myUserId;
  const canKick     = (m: GroupMember) => {
    if (m.role === MemberRole.Owner)  return false;
    if (m.userId === myUserId)        return false;
    if (!isOwnerOrAdmin)              return false;
    if (myRole === MemberRole.Admin && m.role === MemberRole.Admin) return false;
    return true;
  };

  return (
    <section className="card overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700/50">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
          Membros ({members.length})
        </h2>
      </div>

      {error && (
        <p className="mx-6 mt-4 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600 dark:bg-red-900/30 dark:text-red-400">
          {error}
        </p>
      )}

      <div className="divide-y divide-gray-100 dark:divide-gray-700/50">
        {members.map((m) => {
          const isMe = m.userId === myUserId;
          return (
            <div
              key={m.userId}
              className={`flex items-center justify-between gap-3 px-6 py-4 transition-colors ${
                isMe ? 'bg-brand-50 dark:bg-brand-900/10' : ''
              }`}
            >
              <div className="flex min-w-0 items-center gap-3">
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                  isMe
                    ? 'bg-brand-200 text-brand-800 dark:bg-brand-700 dark:text-white'
                    : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
                }`}>
                  {m.avatarUrl
                    ? <img src={m.avatarUrl} alt="" className="h-9 w-9 rounded-full object-cover" />
                    : m.username.charAt(0).toUpperCase()
                  }
                </div>
                <div className="min-w-0">
                  <p className={`truncate text-sm font-medium ${isMe ? 'text-brand-700 dark:text-brand-400' : 'text-gray-800 dark:text-gray-200'}`}>
                    {m.username}
                    {isMe && <span className="ml-1.5 text-xs font-normal text-brand-400">(você)</span>}
                  </p>
                  <p className="flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500">
                    <FlameIcon className="h-3 w-3 text-amber-500" />
                    {m.currentStreak} dias · Nível {m.level}
                  </p>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${ROLE_STYLES[m.role]}`}>
                  {ROLE_LABELS[m.role]}
                </span>

                {/* Ações de role — apenas owner vê, para membros non-self non-owner */}
                {canPromote(m) && (
                  <button
                    onClick={() => setPendingAction({ type: 'role', member: m, newRole: 'admin' })}
                    className="rounded-lg border border-brand-200 px-2 py-1 text-xs font-medium text-brand-700 transition-colors hover:bg-brand-50 dark:border-brand-700/50 dark:text-brand-400 dark:hover:bg-brand-900/30"
                  >
                    Promover a Admin
                  </button>
                )}
                {canDemote(m) && (
                  <button
                    onClick={() => setPendingAction({ type: 'role', member: m, newRole: 'member' })}
                    className="rounded-lg border border-gray-200 px-2 py-1 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800"
                  >
                    Rebaixar
                  </button>
                )}
                {canKick(m) && (
                  <button
                    onClick={() => setPendingAction({ type: 'kick', member: m })}
                    className="rounded-lg border border-red-200 px-2 py-1 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 dark:border-red-800/40 dark:text-red-400 dark:hover:bg-red-900/20"
                  >
                    Remover
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {pendingAction && (
        <ConfirmModal
          title={pendingAction.type === 'kick'
            ? `Remover ${pendingAction.member.username}?`
            : pendingAction.newRole === 'admin'
              ? `Promover ${pendingAction.member.username} a Admin?`
              : `Rebaixar ${pendingAction.member.username} a Membro?`
          }
          message={pendingAction.type === 'kick'
            ? `${pendingAction.member.username} será removido do grupo e perderá acesso imediatamente.`
            : pendingAction.newRole === 'admin'
              ? `${pendingAction.member.username} poderá gerenciar membros e criar missões.`
              : `${pendingAction.member.username} perderá os privilégios de administrador.`
          }
          confirmLabel={pendingAction.type === 'kick' ? 'Remover' : 'Confirmar'}
          danger={pendingAction.type === 'kick'}
          onConfirm={confirmAction}
          onCancel={() => setPendingAction(null)}
        />
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Seção: Zona de Perigo
// ---------------------------------------------------------------------------

function DangerZoneSection({
  group,
  myRole,
  groupId,
}: {
  group: GroupDetails;
  myRole: MemberRole | undefined;
  groupId: string;
}) {
  const navigate = useNavigate();
  const isOwner  = myRole === MemberRole.Owner;

  const [confirmLeave,  setConfirmLeave]  = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteInput,   setDeleteInput]   = useState('');
  const [error,         setError]         = useState('');

  const handleLeave = async () => {
    try {
      await leaveGroup(groupId);
      navigate('/grupos');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao sair do grupo.');
      setConfirmLeave(false);
    }
  };

  const handleDelete = async () => {
    if (deleteInput !== group.name) return;
    try {
      await deleteGroup(groupId);
      navigate('/grupos');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao excluir grupo.');
      setConfirmDelete(false);
    }
  };

  return (
    <section className="card overflow-hidden border-red-200 dark:border-red-900/40">
      <div className="border-b border-red-100 bg-red-50 px-6 py-4 dark:border-red-900/30 dark:bg-red-900/10">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-red-500 dark:text-red-400">
          Zona de Perigo
        </h2>
      </div>

      {error && (
        <p className="mx-6 mt-4 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600 dark:bg-red-900/30 dark:text-red-400">
          {error}
        </p>
      )}

      <div className="divide-y divide-red-100 dark:divide-red-900/30">
        {/* Sair do grupo — apenas para não-owners */}
        {!isOwner && (
          <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-5">
            <div>
              <p className="text-sm font-medium text-gray-800 dark:text-gray-200">Sair do grupo</p>
              <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                Você perderá acesso ao grupo e às missões coletivas.
              </p>
            </div>
            <button
              onClick={() => setConfirmLeave(true)}
              className="rounded-xl border border-red-300 px-4 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-900/20"
            >
              Sair do grupo
            </button>
          </div>
        )}

        {/* Excluir grupo — apenas para owner */}
        {isOwner && (
          <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-5">
            <div>
              <p className="text-sm font-medium text-gray-800 dark:text-gray-200">Excluir grupo</p>
              <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                Ação irreversível. Todos os membros, missões e histórico serão apagados.
              </p>
            </div>
            <button
              onClick={() => setConfirmDelete(true)}
              className="flex items-center gap-1.5 rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-800"
            >
              <TrashIcon className="h-4 w-4" />
              Excluir grupo
            </button>
          </div>
        )}
      </div>

      {/* Modal: Confirmar saída */}
      {confirmLeave && (
        <ConfirmModal
          title="Sair do grupo?"
          message="Você perderá acesso ao grupo e às missões coletivas. Será necessário um novo convite para retornar."
          confirmLabel="Sair do grupo"
          danger
          onConfirm={handleLeave}
          onCancel={() => setConfirmLeave(false)}
        />
      )}

      {/* Modal: Confirmar exclusão — requer digitar o nome */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-6 shadow-xl dark:border-gray-700 dark:bg-gray-900">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-red-100 dark:bg-red-900/30">
              <TrashIcon className="h-6 w-6 text-red-600 dark:text-red-400" />
            </div>
            <h3 className="mb-1 text-base font-semibold text-gray-900 dark:text-white">Excluir grupo?</h3>
            <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
              Esta ação é <strong>irreversível</strong>. Para confirmar, digite o nome do grupo:
            </p>
            <p className="mb-2 rounded-lg bg-gray-50 px-3 py-2 font-mono text-sm font-medium text-gray-800 dark:bg-gray-800 dark:text-gray-200">
              {group.name}
            </p>
            <input
              value={deleteInput}
              onChange={(e) => setDeleteInput(e.target.value)}
              placeholder="Digite o nome do grupo"
              className="input mb-4 w-full"
              autoFocus
            />
            <div className="flex gap-3">
              <button onClick={() => { setConfirmDelete(false); setDeleteInput(''); }} className="btn-secondary flex-1">
                Cancelar
              </button>
              <button
                onClick={() => void handleDelete()}
                disabled={deleteInput !== group.name}
                className="flex-1 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-40 dark:bg-red-700 dark:hover:bg-red-800"
              >
                Excluir definitivamente
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Página principal
// ---------------------------------------------------------------------------

export default function GroupSettingsPage() {
  const { id }    = useParams<{ id: string }>();
  const navigate  = useNavigate();
  const { user }  = useAuthStore();

  const [group,   setGroup]   = useState<GroupDetails | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  useEffect(() => {
    if (!id) return;
    void (async () => {
      const [detailRes, memsRes] = await Promise.allSettled([
        getGroupDetail(id),
        getGroupMembers(id),
      ]);

      if (detailRes.status === 'rejected') {
        setError('Não foi possível carregar o grupo.');
        setLoading(false);
        return;
      }

      setGroup(detailRes.value);
      if (memsRes.status === 'fulfilled') setMembers(memsRes.value);

      setLoading(false);
    })();
  }, [id]);

  // GroupDetails já inclui o role do usuário atual — não depende do array members
  const myRole         = group?.role;
  const isOwnerOrAdmin = myRole === MemberRole.Owner || myRole === MemberRole.Admin;

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-gray-200 border-t-brand-600" />
      </div>
    );
  }

  if (error || !group) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <button onClick={() => navigate(`/grupos/${id ?? ''}`)} className="mb-4 text-xs text-gray-400 hover:text-gray-700">
          ← Voltar ao grupo
        </button>
        <div className="rounded-xl border border-red-200 bg-red-50 p-8 text-center dark:border-red-800/40 dark:bg-red-900/20">
          <p className="font-medium text-red-600 dark:text-red-400">{error || 'Grupo não encontrado.'}</p>
          <button onClick={() => navigate('/grupos')} className="btn-secondary mt-4">Voltar para grupos</button>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8">

      {/* Voltar */}
      <button
        onClick={() => navigate(`/grupos/${id ?? ''}`)}
        className="mb-5 flex items-center gap-1.5 text-xs text-gray-400 transition-colors hover:text-gray-600 dark:hover:text-gray-300"
      >
        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
        </svg>
        Voltar ao grupo
      </button>

      {/* Cabeçalho */}
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100 dark:bg-gray-800">
          <CogIcon className="h-5 w-5 text-gray-600 dark:text-gray-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Configurações</h1>
          <p className="text-sm text-gray-400 dark:text-gray-500">{group.name}</p>
        </div>
      </div>

      <div className="space-y-5">
        {/* Informações do grupo */}
        <GroupInfoSection
          group={group}
          isOwnerOrAdmin={isOwnerOrAdmin}
          onSaved={(updated) => setGroup(updated)}
        />

        {/* Código de convite */}
        {group.inviteCode && id && (
          <InviteCodeSection
            inviteCode={group.inviteCode}
            isOwnerOrAdmin={isOwnerOrAdmin}
            groupId={id}
            onNewCode={(code) => setGroup((g) => g ? { ...g, inviteCode: code } : g)}
          />
        )}

        {/* Membros — apenas admin/owner */}
        {isOwnerOrAdmin && id && (
          <MembersSection
            members={members}
            myRole={myRole}
            myUserId={user?.id}
            groupId={id}
            onMembersChange={setMembers}
          />
        )}

        {/* Zona de perigo — sempre visível para membros */}
        {id && (
          <DangerZoneSection
            group={group}
            myRole={myRole}
            groupId={id}
          />
        )}
      </div>
    </main>
  );
}
