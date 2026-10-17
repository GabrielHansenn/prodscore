import { useId, useState, type FormEvent } from 'react';
import axios from 'axios';
import { validateUsername, USERNAME_RULES_HINT, MAX_BIO_LENGTH, type User } from '@prodscore/shared';
import { api } from '../../services/api.js';
import { getFriendlyErrorMessage } from '../../lib/errors.js';
import { useImageUpload, uploadToAvatarsBucket, IMAGE_UPLOAD_HELP_TEXT } from '../../lib/useImageUpload.js';
import { showToast } from '../../store/toastStore.js';
import FormFeedback from '../FormFeedback.js';
import Modal from '../Modal.js';
import Spinner from '../Spinner.js';
import { CameraIcon, LockClosedIcon } from '../icons.js';

interface ProfileEditFormProps {
  user:     Pick<User, 'id' | 'username' | 'email' | 'bio' | 'avatarUrl'>;
  /** Sai do modo de edição sem salvar (a confirmação, se havia alterações, já foi feita) */
  onCancel: () => void;
  /** Chamado depois de salvar com sucesso — a página recarrega a sessão e sai da edição */
  onSaved:  () => Promise<void> | void;
}

/**
 * Formulário de edição do perfil ("Meu Perfil" > Editar perfil): avatar com
 * trocar/remover, nome de usuário validado enquanto digita, bio com contador
 * de caracteres, e-mail somente leitura e Cancelar/Salvar lado a lado no
 * rodapé. Salvar só habilita quando algo mudou e todos os campos são válidos;
 * cancelar com alterações não salvas pede confirmação antes.
 */
export default function ProfileEditForm({ user, onCancel, onSaved }: ProfileEditFormProps) {
  const ids = useId();
  const fieldId = (name: string) => `${ids}-${name}`;

  const [username,      setUsername]      = useState(user.username);
  const [bio,           setBio]           = useState(user.bio ?? '');
  const [removeAvatar,  setRemoveAvatar]  = useState(false);
  const [usernameTaken, setUsernameTaken] = useState<string | null>(null);
  const [saveError,     setSaveError]     = useState('');
  const [saving,        setSaving]        = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const avatar = useImageUpload();

  const trimmedUsername = username.trim();
  const trimmedBio      = bio.trim();

  // Valida enquanto digita, mas só depois que o valor difere do salvo
  // (campo intocado nunca mostra erro)
  const usernameError = usernameTaken
    ?? (username !== user.username ? validateUsername(username) : null);
  const bioTooLong = bio.length > MAX_BIO_LENGTH;

  const avatarChanged = avatar.file !== null || (removeAvatar && user.avatarUrl !== null);
  const isDirty = trimmedUsername !== user.username
    || trimmedBio !== (user.bio ?? '').trim()
    || avatarChanged;
  const canSave = isDirty && !usernameError && !bioTooLong && !saving;

  // O que o avatar mostra agora: prévia da foto nova, nada (removida) ou a foto salva
  const shownAvatar = avatar.previewUrl ?? (removeAvatar ? null : user.avatarUrl);

  const pickPhoto = () => avatar.inputRef.current?.click();

  const handleRemovePhoto = () => {
    avatar.clear();
    setRemoveAvatar(true);
  };

  const handleCancel = () => {
    if (isDirty) setConfirmDiscard(true);
    else onCancel();
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canSave) return;

    setSaveError('');
    setSaving(true);
    try {
      let avatarUrl: string | null | undefined;
      if (avatar.file) avatarUrl = await uploadToAvatarsBucket(user.id, avatar.file, 'avatar');
      else if (removeAvatar && user.avatarUrl) avatarUrl = null;

      await api.patch('/users/me', {
        username: trimmedUsername,
        bio:      trimmedBio || null,
        ...(avatarUrl !== undefined ? { avatarUrl } : {}),
      });

      avatar.clear();
      showToast('Perfil atualizado com sucesso!');
      await onSaved();
    } catch (err) {
      // 409 = nome de usuário já em uso: mostra no próprio campo, não como erro genérico
      if (axios.isAxiosError(err) && err.response?.status === 409) {
        setUsernameTaken('Este nome de usuário já está em uso. Escolha outro.');
      } else {
        setSaveError(err instanceof Error && !axios.isAxiosError(err)
          ? err.message
          : getFriendlyErrorMessage(err, 'Não foi possível salvar o perfil. Tente novamente.'));
      }
    } finally {
      setSaving(false);
    }
  };

  const usernameHelpId  = fieldId('username-help');
  const usernameErrorId = fieldId('username-error');
  const bioCounterId    = fieldId('bio-counter');
  const avatarHelpId    = fieldId('avatar-help');

  return (
    <div className="card mx-auto mb-6 w-full max-w-[720px]">
      <form onSubmit={(e) => void handleSubmit(e)} noValidate aria-labelledby={fieldId('title')}>
        <div className="p-6 sm:p-8">
          <h2 id={fieldId('title')} className="text-lg font-semibold text-gray-900">Editar perfil</h2>
          <p className="mt-0.5 text-sm text-gray-500">Essas informações aparecem para seus amigos e nos grupos.</p>

          {/* Foto de perfil */}
          <div className="mt-6 flex flex-col items-center text-center">
            <button
              type="button"
              onClick={pickPhoto}
              aria-label="Trocar foto de perfil"
              aria-describedby={avatarHelpId}
              className="group relative h-28 w-28 overflow-hidden rounded-3xl bg-brand-100 outline-none ring-offset-2 transition focus-visible:ring-2 focus-visible:ring-brand-500 dark:bg-brand-900/30 dark:ring-offset-[#1c1b32]"
            >
              {shownAvatar ? (
                <img src={shownAvatar} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="flex h-full w-full items-center justify-center text-4xl font-bold text-brand-700 dark:text-brand-300">
                  {(trimmedUsername || user.username).charAt(0).toUpperCase()}
                </span>
              )}
              {/* Véu ao passar o mouse ou focar (desktop) */}
              <span className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/55 text-xs font-semibold text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                <CameraIcon className="h-6 w-6" />
                Trocar foto
              </span>
              {/* Selo sempre visível: tela de toque não tem "passar o mouse" */}
              <span aria-hidden="true" className="absolute bottom-1.5 right-1.5 flex h-8 w-8 items-center justify-center rounded-full bg-brand-600 text-white shadow-brand group-hover:opacity-0">
                <CameraIcon className="h-4 w-4" />
              </span>
            </button>
            <input
              ref={avatar.inputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="sr-only"
              tabIndex={-1}
              aria-hidden="true"
              onChange={(e) => { avatar.handleFileChange(e); setRemoveAvatar(false); }}
            />

            <p id={avatarHelpId} className="mt-3 text-xs text-gray-500">{IMAGE_UPLOAD_HELP_TEXT}</p>
            {avatar.file && <p className="mt-1 text-xs font-medium text-brand-600 dark:text-brand-400">Nova foto — será salva ao clicar em "Salvar alterações"</p>}
            {shownAvatar && (
              <button
                type="button"
                onClick={handleRemovePhoto}
                className="mt-1 inline-flex min-h-[44px] items-center rounded-lg px-3 text-sm font-medium text-red-600 transition hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 dark:text-red-400 dark:hover:bg-red-900/20"
              >
                Remover foto
              </button>
            )}
            {avatar.error && <p className="mt-1 text-xs text-red-600 dark:text-red-400" role="alert">{avatar.error}</p>}
          </div>

          <div className="mt-6 space-y-5">
            {/* Nome de usuário */}
            <div>
              <label htmlFor={fieldId('username')} className="mb-1.5 block text-sm font-medium text-gray-700">Nome de usuário</label>
              <input
                id={fieldId('username')}
                type="text"
                value={username}
                onChange={(e) => { setUsername(e.target.value); setUsernameTaken(null); }}
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                aria-invalid={usernameError ? true : undefined}
                aria-describedby={`${usernameHelpId}${usernameError ? ` ${usernameErrorId}` : ''}`}
                className={`input ${usernameError ? 'border-red-400 focus:border-red-500 focus:ring-red-500/20' : ''}`}
              />
              <p id={usernameHelpId} className="mt-1.5 text-xs text-gray-500">{USERNAME_RULES_HINT}</p>
              {/* Região aria-live sempre montada, para o leitor de tela anunciar a mensagem quando ela aparece */}
              <p id={usernameErrorId} className="text-xs text-red-600 dark:text-red-400" aria-live="polite">
                {usernameError ?? ''}
              </p>
            </div>

            {/* Bio */}
            <div>
              <label htmlFor={fieldId('bio')} className="mb-1.5 block text-sm font-medium text-gray-700">
                Bio <span className="font-normal text-gray-400">(opcional)</span>
              </label>
              <textarea
                id={fieldId('bio')}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                rows={4}
                maxLength={MAX_BIO_LENGTH}
                placeholder="Conte um pouco sobre você..."
                aria-describedby={bioCounterId}
                aria-invalid={bioTooLong ? true : undefined}
                className="input resize-y"
              />
              <p
                id={bioCounterId}
                className={`mt-1.5 text-right text-xs ${bio.length >= MAX_BIO_LENGTH ? 'text-amber-700 dark:text-amber-400' : 'text-gray-500'}`}
              >
                {bio.length}/{MAX_BIO_LENGTH} caracteres
              </p>
            </div>

            {/* E-mail (somente leitura) */}
            <div>
              <label htmlFor={fieldId('email')} className="mb-1.5 block text-sm font-medium text-gray-700">E-mail</label>
              <div className="relative">
                <input
                  id={fieldId('email')}
                  type="email"
                  value={user.email}
                  readOnly
                  aria-describedby={fieldId('email-help')}
                  className="input cursor-default bg-gray-50 pr-10 text-gray-500 dark:bg-white/5"
                />
                <LockClosedIcon className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              </div>
              <p id={fieldId('email-help')} className="mt-1.5 text-xs text-gray-500">O e-mail não pode ser alterado por aqui.</p>
            </div>

            {saveError && <FormFeedback variant="error" message={saveError} />}
          </div>
        </div>

        {/* Ações: lado a lado à direita (desktop), largura total e empilhadas no celular */}
        <div className="flex flex-col-reverse gap-3 border-t border-gray-100 px-6 py-4 sm:flex-row sm:justify-end sm:px-8 dark:border-gray-800">
          <button type="button" onClick={handleCancel} disabled={saving} className="btn-secondary w-full sm:w-auto">
            Cancelar
          </button>
          <button type="submit" disabled={!canSave} aria-busy={saving} className="btn-primary w-full sm:w-auto">
            {saving && <Spinner size="sm" label="Salvando" />}
            {saving ? (avatar.file ? 'Enviando foto…' : 'Salvando…') : 'Salvar alterações'}
          </button>
        </div>
      </form>

      {confirmDiscard && (
        <Modal onClose={() => setConfirmDiscard(false)} labelledBy={fieldId('discard-title')}>
          <h2 id={fieldId('discard-title')} className="text-lg font-semibold text-gray-900">Descartar alterações?</h2>
          <p className="mt-2 text-sm text-gray-500">As alterações que você fez no perfil ainda não foram salvas e serão perdidas.</p>
          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button type="button" onClick={() => setConfirmDiscard(false)} className="btn-secondary w-full sm:w-auto">
              Continuar editando
            </button>
            <button
              type="button"
              onClick={() => { setConfirmDiscard(false); avatar.clear(); onCancel(); }}
              className="inline-flex min-h-[44px] w-full items-center justify-center rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 sm:w-auto dark:bg-red-700 dark:hover:bg-red-800"
            >
              Descartar
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
