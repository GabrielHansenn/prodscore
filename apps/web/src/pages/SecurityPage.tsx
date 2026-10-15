import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { validatePassword, validatePasswordConfirmation } from '@prodscore/shared';
import EnrollMFA from '../components/EnrollMFA.js';
import FormFeedback from '../components/FormFeedback.js';
import Modal from '../components/Modal.js';
import PasswordField from '../components/PasswordField.js';
import { useAuthStore } from '../store/authStore.js';
import { changePassword, deleteAccount } from '../services/security.service.js';
import { getApiErrorCode, getFriendlyErrorMessage } from '../lib/errors.js';

/** Erros da API que pertencem ao campo "Senha atual" (ver requireSensitiveAuth) */
const CURRENT_PASSWORD_ERRORS = new Set(['SENHA_ATUAL_INCORRETA', 'SENHA_ATUAL_OBRIGATORIA']);

// ---------------------------------------------------------------------------
// Modal de confirmação — excluir conta
// ---------------------------------------------------------------------------

function ConfirmDeleteModal({ onDeleted, onCancel }: { onDeleted: () => Promise<void>; onCancel: () => void }) {
  const [password, setPassword] = useState('');
  const [fieldError, setFieldError] = useState('');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);

  const handleDelete = async (e: FormEvent) => {
    e.preventDefault();
    if (!password) { setFieldError('Digite sua senha atual para confirmar.'); return; }

    setFieldError('');
    setError('');
    setLoading(true);
    try {
      await deleteAccount(password);
      await onDeleted();
    } catch (err) {
      const message = getFriendlyErrorMessage(err, 'Erro ao excluir a conta.');
      if (CURRENT_PASSWORD_ERRORS.has(getApiErrorCode(err) ?? '')) setFieldError(message);
      else setError(message);
      setLoading(false);
    }
  };

  return (
    <Modal
      onClose={() => { if (!loading) onCancel(); }}
      labelledBy="delete-account-title"
      className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-6 shadow-xl dark:border-gray-700 dark:bg-gray-900"
    >
      <form onSubmit={(e) => void handleDelete(e)} className="space-y-4">
        <div>
          <h3 id="delete-account-title" className="mb-2 text-base font-semibold text-gray-900 dark:text-white">Excluir conta</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Essa ação é permanente. Todos os seus dados, tarefas e histórico de pontos serão apagados.
          </p>
        </div>

        <PasswordField
          id="delete-current-password"
          label="Senha atual"
          value={password}
          onChange={(v) => { setPassword(v); setFieldError(''); }}
          autoComplete="current-password"
          error={fieldError}
        />

        {error && <FormFeedback variant="error" message={error} />}

        <div className="flex gap-3">
          <button type="button" onClick={onCancel} className="btn-secondary flex-1" disabled={loading}>
            Cancelar
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex-1 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-60 dark:bg-red-700 dark:hover:bg-red-800"
          >
            {loading ? 'Excluindo...' : 'Excluir permanentemente'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Seção: alterar senha
// ---------------------------------------------------------------------------

type PasswordFormErrors = { current?: string | undefined; next?: string | undefined; confirm?: string | undefined };

function ChangePasswordForm() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword,     setNewPassword]     = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fieldErrors,     setFieldErrors]     = useState<PasswordFormErrors>({});
  const [error,           setError]           = useState('');
  const [saving,          setSaving]          = useState(false);
  const [saved,           setSaved]           = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSaved(false);

    const errs: PasswordFormErrors = {
      current: currentPassword ? undefined : 'Digite sua senha atual.',
      next:    validatePassword(newPassword) ?? undefined,
      confirm: validatePasswordConfirmation(newPassword, confirmPassword) ?? undefined,
    };
    if (!errs.next && currentPassword && newPassword === currentPassword) {
      errs.next = 'A nova senha precisa ser diferente da atual.';
    }
    setFieldErrors(errs);
    if (errs.current || errs.next || errs.confirm) return;

    setSaving(true);
    try {
      await changePassword(currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setSaved(true);
    } catch (err) {
      const message = getFriendlyErrorMessage(err, 'Erro ao alterar a senha.');
      if (CURRENT_PASSWORD_ERRORS.has(getApiErrorCode(err) ?? '')) setFieldErrors({ current: message });
      else setError(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="space-y-3" noValidate>
      <PasswordField
        id="current-password"
        label="Senha atual"
        value={currentPassword}
        onChange={(v) => { setCurrentPassword(v); setFieldErrors((p) => ({ ...p, current: undefined })); }}
        autoComplete="current-password"
        error={fieldErrors.current}
      />
      <PasswordField
        id="new-password"
        label="Nova senha"
        value={newPassword}
        onChange={(v) => { setNewPassword(v); setFieldErrors((p) => ({ ...p, next: undefined })); }}
        autoComplete="new-password"
        error={fieldErrors.next}
        hint="Mínimo 8 caracteres, com letras e números"
      />
      <PasswordField
        id="confirm-new-password"
        label="Confirmar nova senha"
        value={confirmPassword}
        onChange={(v) => { setConfirmPassword(v); setFieldErrors((p) => ({ ...p, confirm: undefined })); }}
        autoComplete="new-password"
        error={fieldErrors.confirm}
      />

      {error && <FormFeedback variant="error" message={error} />}
      {saved && <FormFeedback variant="success" message="Senha alterada com sucesso!" />}

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

  const handleDeleted = async () => {
    await logout();
    navigate('/', { replace: true });
  };

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold text-gray-900 dark:text-white">Segurança</h1>
      <p className="mb-6 text-sm text-gray-500 dark:text-gray-400">
        Gerencie a autenticação de dois fatores, sua senha e sua conta.
      </p>

      {/* Autenticação de dois fatores */}
      <div className="card mb-6 p-6">
        <h3 className="mb-4 font-semibold text-gray-900 dark:text-white">Autenticação de dois fatores (2FA)</h3>
        <div className="max-w-3xl">
          <EnrollMFA />
        </div>
      </div>

      {/* Alterar senha — confirma com a senha atual (e o 2FA, para quem tem) */}
      <div className="card mb-6 p-6">
        <h3 className="mb-1 font-semibold text-gray-900 dark:text-white">Alterar senha</h3>
        <p className="mb-4 text-xs text-gray-500 dark:text-gray-400">
          Para sua segurança, confirme com a senha atual.
        </p>
        <div className="max-w-md">
          <ChangePasswordForm />
        </div>
      </div>

      {/* Zona de risco — excluir conta */}
      <div className="card border-red-100 p-6 dark:border-red-900/40">
        <h3 className="mb-1 font-semibold text-red-700 dark:text-red-400">Zona de risco</h3>
        <p className="mb-4 text-xs text-gray-500 dark:text-gray-400">
          Excluir a conta apaga todos os seus dados. Você vai confirmar com a senha atual.
        </p>
        <button
          type="button"
          onClick={() => setConfirmDelete(true)}
          className="rounded-xl border border-red-200 px-4 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20"
        >
          Excluir conta
        </button>
      </div>

      {confirmDelete && (
        <ConfirmDeleteModal onDeleted={handleDeleted} onCancel={() => setConfirmDelete(false)} />
      )}

      {/*
        TODO (trabalho futuro): códigos de backup/recuperação de uso único.
        O Supabase não gera automaticamente códigos de recuperação para TOTP —
        seria necessário implementar geração, hash e armazenamento próprios.
      */}
    </div>
  );
}
