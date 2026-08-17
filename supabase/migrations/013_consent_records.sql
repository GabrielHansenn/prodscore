-- Migration: 013_consent_records
-- Descrição: Registro de consentimento de cookies (LGPD — Lei nº 13.709/2018).
--             Guarda um snapshot imutável de cada escolha de consentimento
--             para fins de prestação de contas (accountability). Não é
--             atualizado — cada nova escolha gera um novo registro.

-- Tabela de registros de consentimento
CREATE TABLE public.consent_records (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Nullable: consentimento pode ser dado por visitante ainda não autenticado.
  -- ON DELETE SET NULL (não CASCADE) para preservar o histórico de auditoria
  -- mesmo que a conta do usuário seja excluída depois.
  user_id    UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  consent    JSONB       NOT NULL,
  version    TEXT        NOT NULL CHECK (char_length(version) BETWEEN 1 AND 20),
  ip_address INET,
  user_agent TEXT        CHECK (char_length(user_agent) <= 500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índice para consultar o histórico de um usuário específico
CREATE INDEX idx_consent_records_user_id    ON public.consent_records(user_id);
-- Índice para relatórios/auditoria por versão da política
CREATE INDEX idx_consent_records_version    ON public.consent_records(version);
-- Índice para consultas ordenadas por data (relatórios de accountability)
CREATE INDEX idx_consent_records_created_at ON public.consent_records(created_at DESC);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
ALTER TABLE public.consent_records ENABLE ROW LEVEL SECURITY;

-- Usuário autenticado pode consultar o próprio histórico de consentimento
CREATE POLICY "consent_records_select_own"
  ON public.consent_records FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Inserção feita exclusivamente pelo backend (service_role, que bypassa RLS).
-- Nenhuma política de INSERT é declarada para anon/authenticated — por padrão
-- do Postgres, RLS sem política correspondente nega a operação (deny-by-default).
