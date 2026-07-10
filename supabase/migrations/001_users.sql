-- Migration: 001_users
-- Descrição: Estende auth.users com dados de perfil e métricas de gamificação.
--             O perfil é criado automaticamente via trigger ao registrar no Auth.

-- Habilita pgcrypto para funções de hash (usada no seed e em utilities)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Tabela de perfis públicos — relação 1:1 com auth.users
CREATE TABLE public.profiles (
  id               UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username         TEXT        NOT NULL UNIQUE
                                CHECK (char_length(username) BETWEEN 3 AND 30)
                                CHECK (username ~ '^[a-zA-Z0-9_]+$'),
  avatar_url       TEXT,
  bio              TEXT        CHECK (char_length(bio) <= 300),

  -- Dados de gamificação
  level            INTEGER     NOT NULL DEFAULT 1  CHECK (level >= 1),
  total_points     INTEGER     NOT NULL DEFAULT 0  CHECK (total_points >= 0),
  current_streak   INTEGER     NOT NULL DEFAULT 0  CHECK (current_streak >= 0),
  longest_streak   INTEGER     NOT NULL DEFAULT 0  CHECK (longest_streak >= 0),
  last_active_date DATE,

  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índice para ranking global por pontos totais
CREATE INDEX idx_profiles_total_points    ON public.profiles(total_points DESC);
-- Índice para ranking por streak atual
CREATE INDEX idx_profiles_current_streak  ON public.profiles(current_streak DESC);
-- Índice para busca de perfil por username (case-sensitive; adicionar LOWER() se precisar case-insensitive)
CREATE INDEX idx_profiles_username        ON public.profiles(username);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Qualquer usuário autenticado pode ler perfis (necessário para ranking e busca)
CREATE POLICY "profiles_select_authenticated"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

-- Cada usuário só pode atualizar o próprio perfil
CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Inserção feita exclusivamente pelo trigger SECURITY DEFINER (service_role bypassa RLS)
-- Política declarada explicitamente para auditoria; não permite inserção direta pelo cliente
CREATE POLICY "profiles_insert_trigger_only"
  ON public.profiles FOR INSERT
  WITH CHECK (false);

-- ---------------------------------------------------------------------------
-- Funções auxiliares reutilizadas por outras migrations
-- ---------------------------------------------------------------------------

-- Atualiza o campo updated_at para o momento atual (disparado nos triggers de UPDATE)
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Cria perfil automaticamente quando um usuário é registrado no Supabase Auth.
-- SECURITY DEFINER garante que a função roda com permissão de superusuário,
-- contornando a RLS da tabela profiles no momento do INSERT inicial.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, username)
  VALUES (
    NEW.id,
    -- Usa o username informado no metadata de registro; fallback: parte local do e-mail
    COALESCE(
      NULLIF(TRIM(NEW.raw_user_meta_data->>'username'), ''),
      split_part(NEW.email, '@', 1)
    )
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
