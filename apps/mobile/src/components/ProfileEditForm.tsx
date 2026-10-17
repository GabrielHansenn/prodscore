import { useEffect, useState } from 'react';
import {
  View, Text, TextInput, Image, Pressable, TouchableOpacity, ActivityIndicator,
  Alert, AccessibilityInfo, StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import {
  validateUsername, USERNAME_RULES_HINT, MAX_BIO_LENGTH, MAX_IMAGE_SIZE_MB, type User,
} from '@prodscore/shared';
import { api } from '../services/api';
import { uploadAvatar } from '../services/user.service';
import { useImageUpload } from '../lib/useImageUpload';
import { getFriendlyErrorMessage } from '../lib/errors';
import { showToast } from '../store/toastStore';
import InlineFeedback from './InlineFeedback';
import { FONT, RADIUS, SPACING, CARD_SHADOW } from '../constants/theme';
import { useThemeColors } from '../lib/useThemeColors';
import { createThemedStyles } from '../lib/createThemedStyles';

interface ProfileEditFormProps {
  user:     Pick<User, 'username' | 'email' | 'bio' | 'avatarUrl'>;
  /** Sai do modo de edição sem salvar (a confirmação, se havia alterações, já foi feita) */
  onCancel: () => void;
  /** Chamado depois de salvar com sucesso — a tela recarrega a sessão e sai da edição */
  onSaved:  () => Promise<void> | void;
}

const AVATAR_SIZE = 112;

/**
 * Formulário de edição do perfil (mobile) — espelha o ProfileEditForm do web:
 * avatar tocável com trocar/remover, nome de usuário validado enquanto digita,
 * contador da bio, e-mail somente leitura e Salvar/Cancelar no rodapé. Salvar
 * fica desabilitado até algo mudar e todos os campos serem válidos; cancelar
 * com alterações pede confirmação (diálogo nativo, mesmo padrão do "Sair").
 */
export default function ProfileEditForm({ user, onCancel, onSaved }: ProfileEditFormProps) {
  const colors = useThemeColors();
  const styles = useStyles();
  const avatar = useImageUpload();

  const [username,      setUsername]      = useState(user.username);
  const [bio,           setBio]           = useState(user.bio ?? '');
  const [removeAvatar,  setRemoveAvatar]  = useState(false);
  const [usernameTaken, setUsernameTaken] = useState<string | null>(null);
  const [saveError,     setSaveError]     = useState('');
  const [saving,        setSaving]        = useState(false);

  const trimmedUsername = username.trim();
  const trimmedBio      = bio.trim();

  // Valida enquanto digita, só depois que o valor difere do salvo
  const usernameError = usernameTaken
    ?? (username !== user.username ? validateUsername(username) : null);
  const bioTooLong = bio.length > MAX_BIO_LENGTH;

  const avatarChanged = avatar.image !== null || (removeAvatar && user.avatarUrl !== null);
  const isDirty = trimmedUsername !== user.username
    || trimmedBio !== (user.bio ?? '').trim()
    || avatarChanged;
  const canSave = isDirty && !usernameError && !bioTooLong && !saving;

  const shownAvatar = avatar.image?.uri ?? (removeAvatar ? null : user.avatarUrl);

  // O iOS ignora accessibilityLiveRegion — anuncia os erros de validação explicitamente
  useEffect(() => {
    if (usernameError) AccessibilityInfo.announceForAccessibility(usernameError);
  }, [usernameError]);

  // Escolher uma foto nova anula um "remover" pendente
  useEffect(() => {
    if (avatar.image) setRemoveAvatar(false);
  }, [avatar.image]);

  const choosePhoto = () => {
    Alert.alert('Trocar foto', 'De onde vem a nova foto?', [
      { text: 'Câmera',  onPress: () => void avatar.takePhoto() },
      { text: 'Galeria', onPress: () => void avatar.pickFromLibrary() },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  };

  const removePhoto = () => {
    avatar.clear();
    setRemoveAvatar(true);
  };

  const handleCancel = () => {
    if (!isDirty) { onCancel(); return; }
    Alert.alert('Descartar alterações?', 'As alterações que você fez no perfil ainda não foram salvas e serão perdidas.', [
      { text: 'Continuar editando', style: 'cancel' },
      { text: 'Descartar', style: 'destructive', onPress: () => { avatar.clear(); onCancel(); } },
    ]);
  };

  const handleSave = async () => {
    if (!canSave) return;
    setSaveError('');
    setSaving(true);
    try {
      let avatarUrl: string | null | undefined;
      if (avatar.image) avatarUrl = await uploadAvatar(avatar.image);
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
      // 409 = nome de usuário já em uso: mostra no próprio campo
      if (axios.isAxiosError(err) && err.response?.status === 409) {
        setUsernameTaken('Este nome de usuário já está em uso. Escolha outro.');
      } else {
        setSaveError(getFriendlyErrorMessage(err, 'Não foi possível salvar o perfil. Tente novamente.'));
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.card}>
      <Text style={styles.title} accessibilityRole="header">Editar perfil</Text>
      <Text style={styles.subtitle}>Essas informações aparecem para seus amigos e nos grupos.</Text>

      {/* Foto de perfil — tocar abre a escolha entre câmera e galeria */}
      <View style={styles.avatarSection}>
        <Pressable
          onPress={choosePhoto}
          style={({ pressed }) => [styles.avatar, pressed && { opacity: 0.8 }]}
          accessibilityRole="button"
          accessibilityLabel="Trocar foto de perfil"
          accessibilityHint="Abre a escolha entre câmera e galeria"
        >
          {shownAvatar ? (
            <Image source={{ uri: shownAvatar }} style={styles.avatarImage} />
          ) : (
            <Text style={styles.avatarLetter}>{(trimmedUsername || user.username).charAt(0).toUpperCase()}</Text>
          )}
          <View style={styles.cameraBadge}>
            <Ionicons name="camera" size={16} color="#fff" />
          </View>
        </Pressable>

        <Text style={styles.hint}>Toque para trocar · JPG, PNG, WebP ou GIF · máx. {MAX_IMAGE_SIZE_MB} MB</Text>
        {avatar.image && <Text style={styles.newPhoto}>Nova foto — será salva ao tocar em "Salvar alterações"</Text>}
        {shownAvatar && (
          <TouchableOpacity onPress={removePhoto} style={styles.removeBtn} accessibilityRole="button">
            <Text style={styles.removeText}>Remover foto</Text>
          </TouchableOpacity>
        )}
        {avatar.error ? <InlineFeedback variant="error" message={avatar.error} /> : null}
      </View>

      {/* Nome de usuário */}
      <Text style={styles.label} nativeID="profile-username-label">Nome de usuário</Text>
      <TextInput
        style={[styles.input, usernameError ? styles.inputError : null]}
        value={username}
        onChangeText={(t) => { setUsername(t); setUsernameTaken(null); }}
        autoCapitalize="none"
        autoCorrect={false}
        accessibilityLabelledBy="profile-username-label"
        accessibilityLabel="Nome de usuário"
        accessibilityHint={USERNAME_RULES_HINT}
      />
      <Text style={styles.help}>{USERNAME_RULES_HINT}</Text>
      {usernameError ? (
        <Text style={styles.error} accessibilityLiveRegion="polite" accessibilityRole="alert">{usernameError}</Text>
      ) : null}

      {/* Bio */}
      <Text style={[styles.label, styles.labelSpaced]} nativeID="profile-bio-label">Bio (opcional)</Text>
      <TextInput
        style={[styles.input, styles.textarea]}
        value={bio}
        onChangeText={setBio}
        multiline
        maxLength={MAX_BIO_LENGTH}
        placeholder="Conte um pouco sobre você..."
        placeholderTextColor={colors.textMuted}
        accessibilityLabelledBy="profile-bio-label"
        accessibilityLabel="Bio"
        accessibilityHint={`Até ${MAX_BIO_LENGTH} caracteres`}
      />
      <Text style={[styles.counter, bio.length >= MAX_BIO_LENGTH && { color: colors.amberText }]}>
        {bio.length}/{MAX_BIO_LENGTH} caracteres
      </Text>

      {/* E-mail (somente leitura) */}
      <Text style={[styles.label, styles.labelSpaced]} nativeID="profile-email-label">E-mail</Text>
      <View style={styles.readOnly}>
        <Text style={styles.readOnlyText} numberOfLines={1} accessibilityLabelledBy="profile-email-label">{user.email}</Text>
        <Ionicons name="lock-closed" size={14} color={colors.textMuted} />
      </View>
      <Text style={styles.help}>O e-mail não pode ser alterado por aqui.</Text>

      {saveError ? <InlineFeedback variant="error" message={saveError} /> : null}

      {/* Ações — largura total no celular */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.primaryBtn, !canSave && styles.btnDisabled]}
          onPress={() => void handleSave()}
          disabled={!canSave}
          accessibilityRole="button"
          accessibilityState={{ disabled: !canSave, busy: saving }}
        >
          {saving
            ? <><ActivityIndicator color="#fff" size="small" /><Text style={styles.primaryText}>{avatar.image ? 'Enviando foto…' : 'Salvando…'}</Text></>
            : <Text style={styles.primaryText}>Salvar alterações</Text>}
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.secondaryBtn, saving && styles.btnDisabled]}
          onPress={handleCancel}
          disabled={saving}
          accessibilityRole="button"
        >
          <Text style={styles.secondaryText}>Cancelar</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const useStyles = createThemedStyles((colors) => StyleSheet.create({
  card: {
    width: '100%', maxWidth: 720, alignSelf: 'center',
    backgroundColor: colors.card, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: colors.borderSoft,
    padding: SPACING.md + 4, marginBottom: SPACING.md, ...CARD_SHADOW,
  },
  title:    { fontSize: FONT.lg, fontWeight: '700', color: colors.text },
  subtitle: { fontSize: FONT.sm, color: colors.textMuted, marginTop: 2 },

  avatarSection: { alignItems: 'center', marginTop: SPACING.lg, marginBottom: SPACING.md },
  avatar: {
    width: AVATAR_SIZE, height: AVATAR_SIZE, borderRadius: 28,
    backgroundColor: colors.primaryDim, alignItems: 'center', justifyContent: 'center',
  },
  avatarImage:  { width: AVATAR_SIZE, height: AVATAR_SIZE, borderRadius: 28 },
  avatarLetter: { fontSize: 40, fontWeight: '800', color: colors.primary400 },
  cameraBadge: {
    position: 'absolute', right: -4, bottom: -4, width: 34, height: 34, borderRadius: 17,
    backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center',
    borderWidth: 3, borderColor: colors.card,
  },
  hint:       { fontSize: FONT.sm, color: colors.textMuted, marginTop: SPACING.sm, textAlign: 'center' },
  newPhoto:   { fontSize: FONT.sm, color: colors.primary400, marginTop: 2, textAlign: 'center' },
  removeBtn:  { minHeight: 44, justifyContent: 'center', paddingHorizontal: SPACING.md },
  removeText: { fontSize: FONT.base, fontWeight: '600', color: colors.red },

  label:       { fontSize: FONT.sm, fontWeight: '600', color: colors.textSecondary, marginBottom: 6 },
  labelSpaced: { marginTop: SPACING.md },
  input: {
    minHeight: 44, backgroundColor: colors.input, borderRadius: RADIUS.md, borderWidth: 1, borderColor: colors.inputBorder,
    paddingHorizontal: SPACING.md, paddingVertical: 10, fontSize: FONT.base, color: colors.text,
  },
  inputError: { borderColor: colors.red },
  textarea:   { minHeight: 96, textAlignVertical: 'top' },
  help:       { fontSize: FONT.sm, color: colors.textMuted, marginTop: 6 },
  error:      { fontSize: FONT.sm, color: colors.red, marginTop: 4 },
  counter:    { fontSize: FONT.sm, color: colors.textMuted, marginTop: 6, textAlign: 'right' },
  readOnly: {
    minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    backgroundColor: colors.borderSoft, borderRadius: RADIUS.md, borderWidth: 1, borderColor: colors.inputBorder,
    paddingHorizontal: SPACING.md,
  },
  readOnlyText: { flex: 1, fontSize: FONT.base, color: colors.textMuted },

  footer: {
    marginTop: SPACING.lg, paddingTop: SPACING.md, gap: SPACING.sm,
    borderTopWidth: 1, borderTopColor: colors.borderSoft,
  },
  primaryBtn: {
    minHeight: 48, flexDirection: 'row', gap: SPACING.sm, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.primary, borderRadius: RADIUS.md,
  },
  primaryText:   { color: '#fff', fontWeight: '700', fontSize: FONT.base },
  secondaryBtn: {
    minHeight: 48, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: colors.border, borderRadius: RADIUS.md,
  },
  secondaryText: { color: colors.textSecondary, fontWeight: '600', fontSize: FONT.base },
  btnDisabled:   { opacity: 0.5 },
}));
