import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { User } from '@prodscore/shared';

// ---------------------------------------------------------------------------
// Validação de variáveis de ambiente obrigatórias no boot do servidor
// ---------------------------------------------------------------------------
const supabaseUrl            = process.env['SUPABASE_URL'];
const supabaseServiceRoleKey = process.env['SUPABASE_SERVICE_ROLE_KEY'];
const supabaseAnonKey        = process.env['SUPABASE_ANON_KEY'];

if (!supabaseUrl) {
  throw new Error('[supabase] Variável de ambiente SUPABASE_URL não definida.');
}
if (!supabaseServiceRoleKey) {
  throw new Error('[supabase] Variável de ambiente SUPABASE_SERVICE_ROLE_KEY não definida.');
}
if (!supabaseAnonKey) {
  throw new Error('[supabase] Variável de ambiente SUPABASE_ANON_KEY não definida.');
}

// ---------------------------------------------------------------------------
// Cliente admin — service role
// ---------------------------------------------------------------------------

/**
 * Singleton do cliente Supabase com permissões de service role.
 *
 * Utilizado no backend para operações que precisam contornar RLS,
 * como registrar transações de pontos, criar perfis e atualizar dados de gamificação.
 *
 * NUNCA exponha este cliente ou a service role key no frontend.
 */
export const supabase: SupabaseClient = createClient(
  supabaseUrl,
  supabaseServiceRoleKey,
  {
    auth: {
      // O backend não mantém sessão de usuário — cada requisição é stateless
      autoRefreshToken: false,
      persistSession:   false,
    },
    global: {
      headers: {
        // Header customizado para identificar requisições originadas pelo backend nos logs
        'x-application-name': 'prodscore-api',
      },
    },
  },
);

// ---------------------------------------------------------------------------
// Cliente com sessão do usuário — necessário para supabase.auth.mfa.*
// ---------------------------------------------------------------------------

/**
 * Cria um cliente Supabase autenticado como o próprio usuário chamador (não
 * service role), a partir do access/refresh token da sessão dele.
 *
 * Necessário especificamente para `supabase.auth.mfa.*`: esses métodos leem
 * a sessão interna do cliente (populada via `setSession`), não o cabeçalho
 * Authorization da requisição — o cliente `supabase` (service role, stateless)
 * não serve para eles. Um cliente novo é criado a cada chamada porque a
 * sessão do usuário muda a cada requisição (não dá pra reusar um singleton).
 *
 * @param accessToken  - JWT da sessão atual do usuário (do cabeçalho Authorization)
 * @param refreshToken - Refresh token da mesma sessão (enviado pelo cliente no corpo)
 */
export async function createUserScopedClient(
  accessToken: string,
  refreshToken: string,
): Promise<{ client: SupabaseClient; error: string | null }> {
  const client = createClient(supabaseUrl as string, supabaseAnonKey as string, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { error } = await client.auth.setSession({
    access_token:  accessToken,
    refresh_token: refreshToken,
  });

  if (error) return { client, error: error.message };
  return { client, error: null };
}

// ---------------------------------------------------------------------------
// Helpers de autenticação
// ---------------------------------------------------------------------------

/**
 * Resultado da verificação de token JWT do Supabase.
 * Contém o usuário autenticado ou null se o token for inválido/expirado.
 */
export interface TokenVerificationResult {
  /** Dados do usuário autenticado (null se inválido) */
  user: User | null;
  /** Mensagem de erro quando a verificação falha */
  error: string | null;
}

/**
 * Verifica o token JWT do Supabase e retorna o perfil completo do usuário autenticado.
 *
 * Realiza dois passos:
 * 1. Valida o JWT com `supabase.auth.getUser(token)` — confirma assinatura e expiração
 * 2. Busca o perfil em `public.profiles` para obter dados de gamificação
 *
 * @param token - Bearer token JWT extraído do cabeçalho Authorization
 * @returns Objeto com `user` (perfil completo) ou `error` descrevendo a falha
 */
export async function verifySupabaseToken(token: string): Promise<TokenVerificationResult> {
  // Passo 1: validar assinatura e expiração do JWT
  const { data: authData, error: authError } = await supabase.auth.getUser(token);

  if (authError || !authData.user) {
    return {
      user:  null,
      error: authError?.message ?? 'Token inválido ou expirado.',
    };
  }

  const authUser = authData.user;

  // Passo 2: buscar perfil completo com dados de gamificação
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select(
      'id, username, avatar_url, bio, level, total_points, ' +
      'current_streak, longest_streak, last_active_date, streak_freezes, created_at',
    )
    .eq('id', authUser.id)
    .single();

  if (profileError || !profile) {
    return {
      user:  null,
      error: profileError?.message ?? 'Perfil do usuário não encontrado.',
    };
  }

  // Mapeia snake_case do banco para camelCase do tipo compartilhado
  const user: User = {
    id:             profile.id as string,
    username:       profile.username as string,
    email:          authUser.email ?? '',
    avatarUrl:      (profile.avatar_url as string | null) ?? null,
    bio:            (profile.bio as string | null) ?? null,
    level:          profile.level as number,
    totalPoints:    profile.total_points as number,
    currentStreak:  profile.current_streak as number,
    longestStreak:  profile.longest_streak as number,
    lastActiveDate: (profile.last_active_date as string | null) ?? null,
    streakFreezes:  (profile.streak_freezes as number) ?? 0,
    createdAt:      profile.created_at as string,
  };

  return { user, error: null };
}

/**
 * Busca um usuário pelo UUID sem verificar token JWT.
 * Útil para operações administrativas do backend onde o ID já foi validado.
 *
 * @param userId - UUID do usuário
 * @returns Perfil completo ou null se não encontrado
 */
export async function getUserById(userId: string): Promise<User | null> {
  const { data: profile, error } = await supabase
    .from('profiles')
    .select(
      'id, username, avatar_url, bio, level, total_points, ' +
      'current_streak, longest_streak, last_active_date, streak_freezes, created_at',
    )
    .eq('id', userId)
    .single();

  if (error || !profile) return null;

  // Busca o e-mail do auth.users via admin API
  const { data: authData } = await supabase.auth.admin.getUserById(userId);

  return {
    id:             profile.id as string,
    username:       profile.username as string,
    email:          authData.user?.email ?? '',
    avatarUrl:      (profile.avatar_url as string | null) ?? null,
    bio:            (profile.bio as string | null) ?? null,
    level:          profile.level as number,
    totalPoints:    profile.total_points as number,
    currentStreak:  profile.current_streak as number,
    longestStreak:  profile.longest_streak as number,
    lastActiveDate: (profile.last_active_date as string | null) ?? null,
    streakFreezes:  (profile.streak_freezes as number) ?? 0,
    createdAt:      profile.created_at as string,
  };
}
