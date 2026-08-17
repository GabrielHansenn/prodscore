import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import EnrollMFA from '../components/EnrollMFA.js';
import RequireAAL2 from '../components/RequireAAL2.js';
import { useAuthStore } from '../store/authStore.js';
import { changePassword, deleteAccount } from '../services/security.service.js';

// ---------------------------------------------------------------------------
// Modal de confirmação — excluir conta
// ---------------------------------------------------------------------------

function ConfirmDeleteModal({ onConfirm, onCancel }: { onConfirm: () => void | Promise<void>; onCancel: () => void }) {
  const [loading, setLoading] = useState(false);

  const handle = async () => {
    setLoading(true);
    try { await onConfirm(); }
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-6 shadow-xl dark:border-gray-700 dark:bg-gray-900">
        <h3 className="mb-2 text-base font-semibold text-gray-900 dark:text-white">Excluir conta</h3>
        <p className="mb-5 text-sm text-gray-500 dark:text-gray-400">
          Essa ação é permanente. Todos os seus dados, tarefas e histórico de pontos serão apagados.
        </p>
        <div className="flex gap-3">
          <button onClick={onCancel} className="btn-secondary flex-1" disabled={loading}>
            Cancelar
          </button>
          <button
            onClick={() => void handle()}
            disabled={loading}
            className="flex-1 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-60 dark:bg-red-700 dark:hover:bg-red-800"
          >
            {loading ? 'Excluindo...' : 'Excluir permanentemente'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Seção: alterar senha (exige aal2)
// ---------------------------------------------------------------------------

function ChangePasswordForm() {
  const [newPassword,     setNewPassword]     = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error,           setError]           = useState('');
  const [saving,          setSaving]          = useState(false);
  const [saved,           setSaved]           = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPassword.length < 8) {
      setError('A nova senha deve ter no mínimo 8 caracteres.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('As senhas não coincidem.');
      return;
    }

    setSaving(true);
    try {
      await changePassword(newPassword);
      setNewPassword('');
      setConfirmPassword('');
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao alterar a senha.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="space-y-3">
      <div>
        <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">Nova senha</label>
        <input
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          autoComplete="new-password"
          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">Confirmar nova senha</label>
        <input
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          autoComplete="new-password"
          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
        />
      </div>

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </p>
      )}
      {saved && (
        <p className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-600 dark:border-green-800 dark:bg-green-900/20 dark:text-green-400">
          Senha alterada com sucesso!
        </p>
      )}

      <button type="submit" disabled={saving} className="btn-secondary">
        {saving ? 'Salvando...' : 'Alterar senha'}
      </button>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Página principal
// ---------------------------------------------------------------------------

export default function SecurityPage() {
  const logout   = useAuthStore((s) => s.logout);
  const navigate = useNavigate();

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteError,   setDeleteError]   = useState('');

  const handleDeleteAccount = async () => {
    setDeleteError('');
    try {
      await deleteAccount();
      await logout();
      navigate('/', { replace: true });
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Erro ao excluir a conta.');
      setConfirmDelete(false);
    }
  };

  return (
    <main className="mx-auto max-w-2xl px-4 py-6 sm:px-6 sm:py-8">
      <h1 className="mb-1 text-2xl font-bold text-gray-900 dark:text-white">Segurança</h1>
      <p className="mb-6 text-sm text-gray-500 dark:text-gray-400">
        Gerencie a autenticação de dois fatores e outras configurações sensíveis da sua conta.
      </p>

      {/* Autenticação de dois fatores */}
      <div className="card mb-6 p-6">
        <h3 className="mb-4 font-semibold text-gray-900 dark:text-white">Autenticação de dois fatores (2FA)</h3>
        <EnrollMFA />
      </div>

      {/* Alterar senha — exige aal2 */}
      <div className="card mb-6 p-6">
        <h3 className="mb-1 font-semibold text-gray-900 dark:text-white">Alterar senha</h3>
        <p className="mb-4 text-xs text-gray-500 dark:text-gray-400">
          Por segurança, esta ação exige verificação em duas etapas confirmada nesta sessão.
        </p>
        <RequireAAL2>
          <ChangePasswordForm />
        </RequireAAL2>
      </div>

      {/* Zona de risco — excluir conta — exige aal2 */}
      <div className="card border-red-100 p-6 dark:border-red-900/40">
        <h3 className="mb-1 font-semibold text-red-700 dark:text-red-400">Zona de risco</h3>
        <p className="mb-4 text-xs text-gray-500 dark:text-gray-400">
          Por segurança, esta ação exige verificação em duas etapas confirmada nesta sessão.
        </p>
        <RequireAAL2>
          <div>
            {deleteError && (
              <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
                {deleteError}
              </p>
            )}
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="rounded-xl border border-red-200 px-4 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20"
            >
              Excluir conta
            </button>
          </div>
        </RequireAAL2>
      </div>

      {confirmDelete && (
        <ConfirmDeleteModal onConfirm={handleDeleteAccount} onCancel={() => setConfirmDelete(false)} />
      )}

      {/*
        TODO (trabalho futuro): códigos de backup/recuperação de uso único.
        O Supabase não gera automaticamente códigos de recuperação para TOTP —
        seria necessário implementar geração, hash e armazenamento próprios.
      */}
    </main>
  );
}
