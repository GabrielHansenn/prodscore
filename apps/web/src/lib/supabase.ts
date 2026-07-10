import {
  createClient,
  type AuthChangeEvent,
  type Session,
  type Subscription,
  type User as SupabaseAuthUser,
} from '@supabase/supabase-js';

// ---------------------------------------------------------------------------
// Validação das variáveis de ambiente Vite no carregamento do módulo
// ---------------------------------------------------------------------------
const supabaseUrl     = import.meta.env['VITE_SUPABASE_URL'] as string | undefined;
const supabaseAnonKey = import.meta.env['VITE_SUPABASE_ANON_KEY'] as string | undefined;

if (!supabaseUrl) {
  throw new Error('[supabase] Variável de ambiente VITE_SUPABASE_URL não definida.');
}
if (!supabaseAnonKey) {
  throw new Error('[supabase] Variável de ambiente VITE_SUPABASE_ANON_KEY não definida.');
}

// ---------------------------------------------------------------------------
// Singleton do cliente — usa a anon key pública
// As políticas RLS do banco protegem os dados; a anon key é segura no frontend.
// ---------------------------------------------------------------------------

/**
 * Instância única do cliente Supabase para uso no frontend.
 * Exportada para uso direto quando os helpers abaixo não cobrem o caso de uso.
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Persiste a sessão no localStorage para sobreviver a recarregamentos de página
    persistSession:   true,
    autoRefreshToken: true,
    // Detecta eventos de autenticação em outras abas do navegador
    detectSessionInUrl: true,
  },
});

// ---------------------------------------------------------------------------
// Tipos auxiliares
// ---------------------------------------------------------------------------

/** Resultado padronizado dos helpers de autenticação */
export interface AuthResult<T = null> {
  data: T;
  error: string | null;
}

// ---------------------------------------------------------------------------
// Helpers de autenticação
// ---------------------------------------------------------------------------

/**
 * Registra um novo usuário com e-mail e senha.
 *
 * O Supabase envia um e-mail de confirmação após o registro.
 * O trigger `handle_new_user` cria automaticamente o perfil em `public.profiles`.
 *
 * @param email    - Endereço de e-mail do novo usuário
 * @param password - Senha (mínimo 6 caracteres, recomendado 8+)
 * @param username - Nome de usuário desejado (único na plataforma)
 * @returns Sessão criada ou null se o e-mail precisar de confirmação
 */
export async function signUp(
  email: string,
  password: string,
  username: string,
): Promise<AuthResult<Session | null>> {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      // username é lido pelo trigger handle_new_user para criar o perfil
      data: { username },
    },
  });

  if (error) return { data: null, error: error.message };
  return { data: data.session, error: null };
}

/**
 * Autentica o usuário com e-mail e senha.
 *
 * Ao fazer login com sucesso, o Supabase armazena a sessão no localStorage
 * e dispara o evento `SIGNED_IN` para todos os listeners registrados em
 * `onAuthStateChange`.
 *
 * @param email    - E-mail cadastrado
 * @param password - Senha do usuário
 * @returns Sessão com access_token e refresh_token, ou erro
 */
export async function signIn(
  email: string,
  password: string,
): Promise<AuthResult<Session | null>> {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) return { data: null, error: error.message };
  return { data: data.session, error: null };
}

/**
 * Encerra a sessão atual do usuário.
 *
 * Invalida o refresh_token no Supabase e limpa a sessão do localStorage.
 * O evento `SIGNED_OUT` é disparado para todos os listeners.
 *
 * @returns null em caso de sucesso, mensagem de erro se falhar
 */
export async function signOut(): Promise<AuthResult> {
  const { error } = await supabase.auth.signOut();
  if (error) return { data: null, error: error.message };
  return { data: null, error: null };
}

/**
 * Retorna o usuário autenticado atualmente na sessão ativa.
 *
 * Lê diretamente do token JWT armazenado localmente sem fazer requisição
 * ao servidor. Use `supabase.auth.getSession()` se precisar garantir que
 * o token não expirou.
 *
 * @returns Objeto do usuário do Supabase Auth ou null se não autenticado
 */
export async function getCurrentUser(): Promise<SupabaseAuthUser | null> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return data.user;
}

/**
 * Retorna a sessão ativa com access_token e refresh_token.
 *
 * Diferente de `getCurrentUser`, verifica se o token está expirado e
 * realiza o refresh automaticamente se necessário.
 *
 * @returns Sessão ativa ou null se o usuário não estiver autenticado
 */
export async function getSession(): Promise<Session | null> {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session) return null;
  return data.session;
}

/**
 * Retorna o access token JWT da sessão atual para envio ao backend.
 *
 * Use este token no cabeçalho `Authorization: Bearer <token>` nas
 * chamadas à API Express.
 *
 * @returns Bearer token ou null se não autenticado
 */
export async function getAccessToken(): Promise<string | null> {
  const session = await getSession();
  return session?.access_token ?? null;
}

/**
 * Registra um listener para mudanças no estado de autenticação.
 *
 * Disparado nos eventos:
 * - `SIGNED_IN`:       usuário fez login ou sessão foi restaurada
 * - `SIGNED_OUT`:      usuário fez logout
 * - `TOKEN_REFRESHED`: access_token foi renovado automaticamente
 * - `USER_UPDATED`:    dados do usuário foram alterados
 *
 * @param callback - Função chamada com o evento e a sessão atual
 * @returns Função de cancelamento da inscrição (chame para parar de ouvir)
 *
 * @example
 * const unsubscribe = onAuthStateChange((event, session) => {
 *   if (event === 'SIGNED_IN') authStore.setSession(session);
 *   if (event === 'SIGNED_OUT') authStore.clear();
 * });
 * // Para parar de ouvir:
 * unsubscribe();
 */
export function onAuthStateChange(
  callback: (event: AuthChangeEvent, session: Session | null) => void,
): () => void {
  const { data }: { data: { subscription: Subscription } } =
    supabase.auth.onAuthStateChange(callback);

  // Retorna a função de cancelamento para uso em cleanup de componentes (useEffect)
  return () => data.subscription.unsubscribe();
}

/**
 * Solicita o envio de e-mail para redefinição de senha.
 *
 * @param email       - E-mail cadastrado na plataforma
 * @param redirectTo  - URL para onde o usuário será redirecionado após clicar no link
 * @returns null em sucesso, mensagem de erro se o e-mail não for encontrado
 */
export async function resetPassword(
  email: string,
  redirectTo: string,
): Promise<AuthResult> {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo,
  });
  if (error) return { data: null, error: error.message };
  return { data: null, error: null };
}

/**
 * Atualiza a senha do usuário autenticado.
 * Deve ser chamado na página de redefinição de senha após o usuário clicar no link do e-mail.
 *
 * @param newPassword - Nova senha (mínimo 6 caracteres)
 * @returns null em sucesso, mensagem de erro se a senha não atender aos critérios
 */
export async function updatePassword(newPassword: string): Promise<AuthResult> {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) return { data: null, error: error.message };
  return { data: null, error: null };
}
