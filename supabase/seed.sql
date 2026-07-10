-- =============================================================================
-- Seed de desenvolvimento — ProdScore
-- =============================================================================
-- ATENÇÃO: Execute APENAS em ambiente de desenvolvimento/staging local.
--          Nunca rode em produção.
--
-- Pré-requisito: extensão pgcrypto ativada (feita em 001_users.sql).
--
-- Todos os usuários de teste têm a senha: Password123!
--
-- Como rodar (Supabase CLI local):
--   supabase db reset   (aplica migrations + seed automaticamente)
--   ou
--   psql -h localhost -p 54322 -U postgres -d postgres -f supabase/seed.sql
-- =============================================================================

-- UUIDs fixos para referência previsível em testes e desenvolvimento
-- Usuários:      a100...0001 ~ 0005
-- Grupos:        b100...0001 ~ 0002
-- Conquistas:    c100...0001 ~ 000a
-- Tarefas:       d100...0001 ~ 000f
-- Missões:       e100...0001 ~ 0002

-- =============================================================================
-- 1. USUÁRIOS DE TESTE (auth.users + auto-trigger cria profiles)
-- =============================================================================

-- Nota: em desenvolvimento local (supabase start) não há envio real de e-mails,
--       portanto inserimos diretamente sem desabilitar triggers.
--       O trigger handle_new_user criará automaticamente os perfis em public.profiles.
INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, last_sign_in_at,
  raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
) VALUES
  -- Ana Silva: usuária avançada, nível 5, streak 14 dias
  (
    '00000000-0000-0000-0000-000000000000',
    'a1000000-0000-0000-0000-000000000001',
    'authenticated', 'authenticated',
    'ana@prodscore.dev',
    crypt('Password123!', gen_salt('bf')),
    NOW() - INTERVAL '60 days',
    NOW() - INTERVAL '1 hour',
    '{"provider":"email","providers":["email"]}',
    '{"username":"ana_silva"}',
    NOW() - INTERVAL '60 days', NOW(),
    '', '', '', ''
  ),
  -- Bruno Costa: usuário intermediário, nível 4, streak 7 dias
  (
    '00000000-0000-0000-0000-000000000000',
    'a1000000-0000-0000-0000-000000000002',
    'authenticated', 'authenticated',
    'bruno@prodscore.dev',
    crypt('Password123!', gen_salt('bf')),
    NOW() - INTERVAL '45 days',
    NOW() - INTERVAL '3 hours',
    '{"provider":"email","providers":["email"]}',
    '{"username":"bruno_costa"}',
    NOW() - INTERVAL '45 days', NOW(),
    '', '', '', ''
  ),
  -- Carla Nunes: usuária iniciante-intermediária, nível 3, streak 3 dias
  (
    '00000000-0000-0000-0000-000000000000',
    'a1000000-0000-0000-0000-000000000003',
    'authenticated', 'authenticated',
    'carla@prodscore.dev',
    crypt('Password123!', gen_salt('bf')),
    NOW() - INTERVAL '30 days',
    NOW() - INTERVAL '5 hours',
    '{"provider":"email","providers":["email"]}',
    '{"username":"carla_nunes"}',
    NOW() - INTERVAL '30 days', NOW(),
    '', '', '', ''
  ),
  -- Diego Alves: usuário iniciante, nível 2, streak 1 dia
  (
    '00000000-0000-0000-0000-000000000000',
    'a1000000-0000-0000-0000-000000000004',
    'authenticated', 'authenticated',
    'diego@prodscore.dev',
    crypt('Password123!', gen_salt('bf')),
    NOW() - INTERVAL '15 days',
    NOW() - INTERVAL '8 hours',
    '{"provider":"email","providers":["email"]}',
    '{"username":"diego_alves"}',
    NOW() - INTERVAL '15 days', NOW(),
    '', '', '', ''
  ),
  -- Eva Lima: usuária novata, nível 1, sem streak ativo
  (
    '00000000-0000-0000-0000-000000000000',
    'a1000000-0000-0000-0000-000000000005',
    'authenticated', 'authenticated',
    'eva@prodscore.dev',
    crypt('Password123!', gen_salt('bf')),
    NOW() - INTERVAL '5 days',
    NOW() - INTERVAL '2 days',
    '{"provider":"email","providers":["email"]}',
    '{"username":"eva_lima"}',
    NOW() - INTERVAL '5 days', NOW(),
    '', '', '', ''
  )
ON CONFLICT (id) DO NOTHING;

-- Identidades para login por e-mail
INSERT INTO auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
VALUES
  ('ana@prodscore.dev',   'a1000000-0000-0000-0000-000000000001',
    '{"sub":"a1000000-0000-0000-0000-000000000001","email":"ana@prodscore.dev","email_verified":true,"provider_id":"ana@prodscore.dev"}',
    'email', NOW() - INTERVAL '1 hour',  NOW() - INTERVAL '60 days', NOW()),
  ('bruno@prodscore.dev', 'a1000000-0000-0000-0000-000000000002',
    '{"sub":"a1000000-0000-0000-0000-000000000002","email":"bruno@prodscore.dev","email_verified":true,"provider_id":"bruno@prodscore.dev"}',
    'email', NOW() - INTERVAL '3 hours', NOW() - INTERVAL '45 days', NOW()),
  ('carla@prodscore.dev', 'a1000000-0000-0000-0000-000000000003',
    '{"sub":"a1000000-0000-0000-0000-000000000003","email":"carla@prodscore.dev","email_verified":true,"provider_id":"carla@prodscore.dev"}',
    'email', NOW() - INTERVAL '5 hours', NOW() - INTERVAL '30 days', NOW()),
  ('diego@prodscore.dev', 'a1000000-0000-0000-0000-000000000004',
    '{"sub":"a1000000-0000-0000-0000-000000000004","email":"diego@prodscore.dev","email_verified":true,"provider_id":"diego@prodscore.dev"}',
    'email', NOW() - INTERVAL '8 hours', NOW() - INTERVAL '15 days', NOW()),
  ('eva@prodscore.dev',   'a1000000-0000-0000-0000-000000000005',
    '{"sub":"a1000000-0000-0000-0000-000000000005","email":"eva@prodscore.dev","email_verified":true,"provider_id":"eva@prodscore.dev"}',
    'email', NOW() - INTERVAL '2 days',  NOW() - INTERVAL  '5 days', NOW())
ON CONFLICT DO NOTHING;

-- =============================================================================
-- 2. PERFIS — sobrescreve os dados criados pelo trigger com valores realistas
--    Nível calculado pela fórmula: levelThreshold(N) = N² × 100
--    Nível 2=400, 3=900, 4=1600, 5=2500, 6=3600
-- =============================================================================
UPDATE public.profiles SET
  avatar_url       = 'https://api.dicebear.com/8.x/bottts/svg?seed=ana',
  bio              = 'Desenvolvedora apaixonada por produtividade e sistemas distribuídos.',
  level            = 5,
  total_points     = 2980,   -- entre 2500 (nível 5) e 3600 (nível 6)
  current_streak   = 14,
  longest_streak   = 21,
  last_active_date = CURRENT_DATE,
  updated_at       = NOW()
WHERE id = 'a1000000-0000-0000-0000-000000000001';

UPDATE public.profiles SET
  avatar_url       = 'https://api.dicebear.com/8.x/bottts/svg?seed=bruno',
  bio              = 'Estudante de Engenharia de Software. Gosta de desafios épicos.',
  level            = 4,
  total_points     = 1820,   -- entre 1600 (nível 4) e 2500 (nível 5)
  current_streak   = 7,
  longest_streak   = 14,
  last_active_date = CURRENT_DATE,
  updated_at       = NOW()
WHERE id = 'a1000000-0000-0000-0000-000000000002';

UPDATE public.profiles SET
  avatar_url       = 'https://api.dicebear.com/8.x/bottts/svg?seed=carla',
  bio              = 'Designer UX tentando se tornar mais produtiva.',
  level            = 3,
  total_points     = 1050,   -- entre 900 (nível 3) e 1600 (nível 4)
  current_streak   = 3,
  longest_streak   = 7,
  last_active_date = CURRENT_DATE,
  updated_at       = NOW()
WHERE id = 'a1000000-0000-0000-0000-000000000003';

UPDATE public.profiles SET
  avatar_url       = 'https://api.dicebear.com/8.x/bottts/svg?seed=diego',
  bio              = 'Analista de dados. Novo por aqui!',
  level            = 2,
  total_points     = 430,    -- entre 400 (nível 2) e 900 (nível 3)
  current_streak   = 1,
  longest_streak   = 5,
  last_active_date = CURRENT_DATE,
  updated_at       = NOW()
WHERE id = 'a1000000-0000-0000-0000-000000000004';

UPDATE public.profiles SET
  avatar_url       = 'https://api.dicebear.com/8.x/bottts/svg?seed=eva',
  bio              = NULL,
  level            = 1,
  total_points     = 85,     -- abaixo de 100 (ainda no nível 1)
  current_streak   = 0,
  longest_streak   = 2,
  last_active_date = CURRENT_DATE - INTERVAL '2 days',
  updated_at       = NOW()
WHERE id = 'a1000000-0000-0000-0000-000000000005';

-- =============================================================================
-- 3. CONQUISTAS — catálogo completo da plataforma (IDs fixos para referência)
-- =============================================================================
INSERT INTO public.achievements (id, name, description, icon, reward_points, criteria) VALUES
  ('c1000000-0000-0000-0000-000000000001',
    'Primeira Tarefa',
    'Conclua sua primeira tarefa e dê o primeiro passo rumo à produtividade.',
    '✅', 10,
    '{"type":"tasks_completed","threshold":1}'),

  ('c1000000-0000-0000-0000-000000000002',
    'Sequência de 3 Dias',
    'Mantenha um streak de 3 dias consecutivos completando ao menos uma tarefa por dia.',
    '🔥', 50,
    '{"type":"streak","threshold":3}'),

  ('c1000000-0000-0000-0000-000000000003',
    'Sequência de 7 Dias',
    'Sete dias seguidos de produtividade. Você está construindo um hábito!',
    '⚡', 50,
    '{"type":"streak","threshold":7}'),

  ('c1000000-0000-0000-0000-000000000004',
    'Sequência de 30 Dias',
    'Um mês inteiro de consistência. Conquista impressionante!',
    '💎', 100,
    '{"type":"streak","threshold":30}'),

  ('c1000000-0000-0000-0000-000000000005',
    'Produtivo',
    'Conclua 10 tarefas no total. A produtividade virou rotina.',
    '📋', 25,
    '{"type":"tasks_completed","threshold":10}'),

  ('c1000000-0000-0000-0000-000000000006',
    'Super Produtivo',
    'Conclua 50 tarefas no total. Você é imparável!',
    '🚀', 100,
    '{"type":"tasks_completed","threshold":50}'),

  ('c1000000-0000-0000-0000-000000000007',
    'Desafiador',
    'Conclua uma tarefa de dificuldade Epic. Nada é impossível.',
    '⚔️', 75,
    '{"type":"epic_task_completed","threshold":1}'),

  ('c1000000-0000-0000-0000-000000000008',
    'Pontual',
    'Conclua 5 tarefas dentro do prazo consecutivamente. Respeito pelo tempo!',
    '⏰', 50,
    '{"type":"on_time_streak","threshold":5}'),

  ('c1000000-0000-0000-0000-000000000009',
    'Líder de Grupo',
    'Crie um grupo e tenha pelo menos 3 membros participando.',
    '🏅', 100,
    '{"type":"group_members","threshold":3}'),

  ('c1000000-0000-0000-0000-00000000000a',
    'Lendário',
    'Conclua 200 tarefas no total. Sua dedicação é lendária.',
    '👑', 500,
    '{"type":"tasks_completed","threshold":200}')
ON CONFLICT (id) DO UPDATE SET
  name          = EXCLUDED.name,
  description   = EXCLUDED.description,
  icon          = EXCLUDED.icon,
  reward_points = EXCLUDED.reward_points,
  criteria      = EXCLUDED.criteria;

-- =============================================================================
-- 4. GRUPOS
-- =============================================================================
INSERT INTO public.groups (id, name, description, owner_id, invite_code, created_at, updated_at) VALUES
  (
    'b1000000-0000-0000-0000-000000000001',
    'Produtores de Elite',
    'Grupo dos desenvolvedores mais produtivos. Apenas tarefas Hard e Epic aqui.',
    'a1000000-0000-0000-0000-000000000001',
    'ELITE01',
    NOW() - INTERVAL '30 days', NOW()
  ),
  (
    'b1000000-0000-0000-0000-000000000002',
    'Dev Squad',
    'Grupo de estudos de desenvolvimento de software. Todos são bem-vindos!',
    'a1000000-0000-0000-0000-000000000002',
    'DEVSQD2',
    NOW() - INTERVAL '20 days', NOW()
  )
ON CONFLICT (id) DO NOTHING;

-- Membros dos grupos
INSERT INTO public.group_members (group_id, user_id, role, joined_at) VALUES
  -- Produtores de Elite: Ana (owner), Bruno (admin), Carla (member)
  ('b1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 'owner',  NOW() - INTERVAL '30 days'),
  ('b1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000002', 'admin',  NOW() - INTERVAL '28 days'),
  ('b1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000003', 'member', NOW() - INTERVAL '25 days'),
  -- Dev Squad: Bruno (owner), Diego (member), Eva (member)
  ('b1000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000002', 'owner',  NOW() - INTERVAL '20 days'),
  ('b1000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000004', 'member', NOW() - INTERVAL '12 days'),
  ('b1000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000005', 'member', NOW() - INTERVAL  '3 days')
ON CONFLICT (group_id, user_id) DO NOTHING;

-- =============================================================================
-- 5. TAREFAS — 15 tarefas com mix de dificuldades, status e donos
-- =============================================================================
INSERT INTO public.tasks (id, user_id, group_id, title, description, difficulty, status, due_date, completed_at, points_earned, created_at, updated_at) VALUES

  -- Ana — tarefas individuais
  ('d1000000-0000-0000-0000-000000000001',
    'a1000000-0000-0000-0000-000000000001', NULL,
    'Implementar sistema de autenticação JWT',
    'Criar middleware de auth com refresh token e blacklist de tokens revogados.',
    'epic', 'completed',
    NOW() - INTERVAL '10 days',
    NOW() - INTERVAL '11 days',  -- entregue 1 dia antes do prazo (bônus +20%)
    120,                          -- 100 * 1.20
    NOW() - INTERVAL '12 days', NOW() - INTERVAL '11 days'),

  ('d1000000-0000-0000-0000-000000000002',
    'a1000000-0000-0000-0000-000000000001', NULL,
    'Configurar CI/CD com GitHub Actions',
    'Pipeline com lint, testes e deploy automático para staging.',
    'hard', 'completed',
    NOW() - INTERVAL '5 days',
    NOW() - INTERVAL '6 days',   -- entregue antes do prazo (bônus +20%)
    60,                           -- 50 * 1.20
    NOW() - INTERVAL '7 days', NOW() - INTERVAL '6 days'),

  ('d1000000-0000-0000-0000-000000000003',
    'a1000000-0000-0000-0000-000000000001', NULL,
    'Revisar documentação da API REST',
    'Atualizar Swagger/OpenAPI com novos endpoints e exemplos de request/response.',
    'medium', 'in_progress',
    NOW() + INTERVAL '3 days',
    NULL, NULL,
    NOW() - INTERVAL '2 days', NOW() - INTERVAL '1 day'),

  -- Ana — tarefa de grupo (Produtores de Elite)
  ('d1000000-0000-0000-0000-000000000004',
    'a1000000-0000-0000-0000-000000000001',
    'b1000000-0000-0000-0000-000000000001',
    'Refatorar módulo de gamificação',
    'Extrair lógica de pontuação para um serviço isolado e adicionar testes unitários.',
    'hard', 'completed',
    NOW() - INTERVAL '3 days',
    NOW() - INTERVAL '3 days',   -- entregue no dia do prazo (sem bônus nem penalidade)
    50,
    NOW() - INTERVAL '5 days', NOW() - INTERVAL '3 days'),

  -- Bruno — tarefas individuais
  ('d1000000-0000-0000-0000-000000000005',
    'a1000000-0000-0000-0000-000000000002', NULL,
    'Criar testes de integração para a API',
    'Cobrir pelo menos 70% dos endpoints com testes de integração usando Jest/Supertest.',
    'hard', 'completed',
    NOW() - INTERVAL '8 days',
    NOW() - INTERVAL '7 days',   -- entregue antes do prazo
    60,
    NOW() - INTERVAL '10 days', NOW() - INTERVAL '7 days'),

  ('d1000000-0000-0000-0000-000000000006',
    'a1000000-0000-0000-0000-000000000002', NULL,
    'Implementar ranking semanal',
    'Consultar point_transactions dos últimos 7 dias e calcular posições.',
    'medium', 'completed',
    NOW() - INTERVAL '4 days',
    NOW() - INTERVAL '2 days',   -- entregue 2 dias depois do prazo (penalidade -30%)
    17,                           -- floor(25 * 0.70)
    NOW() - INTERVAL '6 days', NOW() - INTERVAL '2 days'),

  ('d1000000-0000-0000-0000-000000000007',
    'a1000000-0000-0000-0000-000000000002', NULL,
    'Configurar Tailwind CSS no projeto web',
    'Definir design tokens, cores primárias e componentes utilitários.',
    'easy', 'pending',
    NOW() + INTERVAL '2 days',
    NULL, NULL,
    NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day'),

  -- Bruno — tarefa de grupo (Produtores de Elite)
  ('d1000000-0000-0000-0000-000000000008',
    'a1000000-0000-0000-0000-000000000002',
    'b1000000-0000-0000-0000-000000000001',
    'Escrever proposta do TCC',
    'Redigir introdução, justificativa, objetivos e metodologia (aprox. 15 páginas).',
    'epic', 'completed',
    NOW() - INTERVAL '15 days',
    NOW() - INTERVAL '16 days',  -- entregue 1 dia antes
    120,
    NOW() - INTERVAL '20 days', NOW() - INTERVAL '16 days'),

  -- Carla — tarefas individuais
  ('d1000000-0000-0000-0000-000000000009',
    'a1000000-0000-0000-0000-000000000003', NULL,
    'Criar wireframes das telas principais',
    'Fluxo de onboarding, dashboard, tela de tarefas e ranking.',
    'medium', 'completed',
    NOW() - INTERVAL '7 days',
    NOW() - INTERVAL '8 days',   -- entregue antes do prazo
    30,
    NOW() - INTERVAL '10 days', NOW() - INTERVAL '8 days'),

  ('d1000000-0000-0000-0000-00000000000a',
    'a1000000-0000-0000-0000-000000000003', NULL,
    'Pesquisar bibliotecas de animação React',
    'Avaliar Framer Motion, React Spring e CSS transitions para microinterações.',
    'easy', 'completed',
    NOW() - INTERVAL '5 days',
    NOW() - INTERVAL '5 days',
    10,
    NOW() - INTERVAL '6 days', NOW() - INTERVAL '5 days'),

  ('d1000000-0000-0000-0000-00000000000b',
    'a1000000-0000-0000-0000-000000000003', NULL,
    'Prototipar componente de streak badge',
    'Componente visual animado que exibe o streak atual com ícone de fogo.',
    'medium', 'in_progress',
    NOW() + INTERVAL '4 days',
    NULL, NULL,
    NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day'),

  -- Diego — tarefas individuais
  ('d1000000-0000-0000-0000-00000000000c',
    'a1000000-0000-0000-0000-000000000004', NULL,
    'Estudar documentação do Supabase',
    'Ler sobre Auth, RLS, Realtime e Storage.',
    'easy', 'completed',
    NOW() - INTERVAL '3 days',
    NOW() - INTERVAL '1 day',   -- entregue 2 dias atrasado (penalidade -30%)
    7,                           -- floor(10 * 0.70)
    NOW() - INTERVAL '5 days', NOW() - INTERVAL '1 day'),

  ('d1000000-0000-0000-0000-00000000000d',
    'a1000000-0000-0000-0000-000000000004', NULL,
    'Configurar ambiente de desenvolvimento local',
    'Instalar Node.js 20, Docker, Supabase CLI e configurar variáveis de ambiente.',
    'easy', 'pending',
    NOW() + INTERVAL '1 day',
    NULL, NULL,
    NOW(), NOW()),

  -- Eva — tarefas individuais
  ('d1000000-0000-0000-0000-00000000000e',
    'a1000000-0000-0000-0000-000000000005', NULL,
    'Criar conta no Supabase',
    'Acessar supabase.com, criar projeto e copiar as chaves de API.',
    'easy', 'completed',
    NOW() - INTERVAL '4 days',
    NOW() - INTERVAL '4 days',
    12,                          -- 10 * 1.20 (entregue no prazo com bônus)
    NOW() - INTERVAL '5 days', NOW() - INTERVAL '4 days'),

  ('d1000000-0000-0000-0000-00000000000f',
    'a1000000-0000-0000-0000-000000000005', NULL,
    'Ler tutorial de React Router v6',
    'Entender nested routes, loaders e a nova API de navegação.',
    'medium', 'overdue',
    NOW() - INTERVAL '2 days',  -- prazo já passou, não foi concluída
    NULL, NULL,
    NOW() - INTERVAL '4 days', NOW() - INTERVAL '1 day')
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- 6. CONQUISTAS DESBLOQUEADAS POR USUÁRIO
-- =============================================================================
INSERT INTO public.user_achievements (user_id, achievement_id, earned_at) VALUES
  -- Ana: 7 conquistas (usuária veterana)
  ('a1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', NOW() - INTERVAL '59 days'),  -- Primeira Tarefa
  ('a1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000002', NOW() - INTERVAL '57 days'),  -- Streak 3 dias
  ('a1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000003', NOW() - INTERVAL '53 days'),  -- Streak 7 dias
  ('a1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000005', NOW() - INTERVAL '40 days'),  -- Produtivo
  ('a1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000007', NOW() - INTERVAL '11 days'),  -- Desafiador
  ('a1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000008', NOW() - INTERVAL '20 days'),  -- Pontual
  ('a1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000009', NOW() - INTERVAL '27 days'),  -- Líder de Grupo

  -- Bruno: 5 conquistas (intermediário)
  ('a1000000-0000-0000-0000-000000000002', 'c1000000-0000-0000-0000-000000000001', NOW() - INTERVAL '44 days'),  -- Primeira Tarefa
  ('a1000000-0000-0000-0000-000000000002', 'c1000000-0000-0000-0000-000000000002', NOW() - INTERVAL '42 days'),  -- Streak 3 dias
  ('a1000000-0000-0000-0000-000000000002', 'c1000000-0000-0000-0000-000000000003', NOW() - INTERVAL '38 days'),  -- Streak 7 dias
  ('a1000000-0000-0000-0000-000000000002', 'c1000000-0000-0000-0000-000000000005', NOW() - INTERVAL '25 days'),  -- Produtivo
  ('a1000000-0000-0000-0000-000000000002', 'c1000000-0000-0000-0000-000000000007', NOW() - INTERVAL '16 days'),  -- Desafiador

  -- Carla: 2 conquistas (iniciante-intermediária)
  ('a1000000-0000-0000-0000-000000000003', 'c1000000-0000-0000-0000-000000000001', NOW() - INTERVAL '29 days'),  -- Primeira Tarefa
  ('a1000000-0000-0000-0000-000000000003', 'c1000000-0000-0000-0000-000000000002', NOW() - INTERVAL '27 days'),  -- Streak 3 dias

  -- Diego: 1 conquista
  ('a1000000-0000-0000-0000-000000000004', 'c1000000-0000-0000-0000-000000000001', NOW() - INTERVAL '13 days')   -- Primeira Tarefa
ON CONFLICT (user_id, achievement_id) DO NOTHING;

-- =============================================================================
-- 7. MISSÕES — 1 individual + 1 em grupo
-- =============================================================================
INSERT INTO public.missions (id, title, description, type, group_id, target_value, reward_points, expires_at, created_at) VALUES
  -- Missão individual: completar 5 tarefas em 7 dias
  (
    'e1000000-0000-0000-0000-000000000001',
    'Maratona de Tarefas',
    'Complete 5 tarefas em uma única semana e prove que a produtividade é um hábito.',
    'individual', NULL,
    5, 75,
    NOW() + INTERVAL '5 days',
    NOW() - INTERVAL '2 days'
  ),
  -- Missão de grupo: Produtores de Elite completam 10 tarefas coletivamente
  (
    'e1000000-0000-0000-0000-000000000002',
    'Desafio do Grupo de Elite',
    'Como grupo, completem 10 tarefas antes do prazo e mostrem quem manda.',
    'group', 'b1000000-0000-0000-0000-000000000001',
    10, 150,
    NOW() + INTERVAL '7 days',
    NOW() - INTERVAL '3 days'
  )
ON CONFLICT (id) DO NOTHING;

-- Participantes das missões
INSERT INTO public.mission_participants (mission_id, user_id, current_value, is_completed, completed_at, joined_at) VALUES
  -- Ana: completou a Maratona (5/5) — recompensa já concedida
  ('e1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001',
    5, TRUE, NOW() - INTERVAL '1 day', NOW() - INTERVAL '2 days'),
  -- Bruno: em progresso (3/5)
  ('e1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000002',
    3, FALSE, NULL, NOW() - INTERVAL '2 days'),
  -- Carla: em progresso (1/5)
  ('e1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000003',
    1, FALSE, NULL, NOW() - INTERVAL '1 day'),

  -- Missão de grupo — Produtores de Elite (progresso coletivo: 4/10)
  -- Cada membro tem seu progresso individual registrado
  ('e1000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000001',
    2, FALSE, NULL, NOW() - INTERVAL '3 days'),
  ('e1000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000002',
    2, FALSE, NULL, NOW() - INTERVAL '3 days'),
  ('e1000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000003',
    0, FALSE, NULL, NOW() - INTERVAL '2 days')
ON CONFLICT (mission_id, user_id) DO NOTHING;

-- =============================================================================
-- 8. TRANSAÇÕES DE PONTOS — histórico representativo por usuário
--    Nota: os totais aqui são ilustrativos; profiles.total_points foi definido
--          diretamente na seção 2 para refletir o estado acumulado histórico.
-- =============================================================================
INSERT INTO public.point_transactions (user_id, amount, reason, reference_id, created_at) VALUES

  -- Ana (total: 2980 pts)
  ('a1000000-0000-0000-0000-000000000001',  120, 'task_completed',    'd1000000-0000-0000-0000-000000000001', NOW() - INTERVAL '11 days'),
  ('a1000000-0000-0000-0000-000000000001',   60, 'task_completed',    'd1000000-0000-0000-0000-000000000002', NOW() - INTERVAL '6 days'),
  ('a1000000-0000-0000-0000-000000000001',   50, 'task_completed',    'd1000000-0000-0000-0000-000000000004', NOW() - INTERVAL '3 days'),
  ('a1000000-0000-0000-0000-000000000001',   50, 'streak_bonus',      NULL,                                   NOW() - INTERVAL '57 days'),  -- marco 3 dias
  ('a1000000-0000-0000-0000-000000000001',   50, 'streak_bonus',      NULL,                                   NOW() - INTERVAL '53 days'),  -- marco 7 dias
  ('a1000000-0000-0000-0000-000000000001',   50, 'streak_bonus',      NULL,                                   NOW() - INTERVAL '46 days'),  -- marco 14 dias
  ('a1000000-0000-0000-0000-000000000001',   10, 'achievement_bonus', 'c1000000-0000-0000-0000-000000000001', NOW() - INTERVAL '59 days'),  -- Primeira Tarefa
  ('a1000000-0000-0000-0000-000000000001',   50, 'achievement_bonus', 'c1000000-0000-0000-0000-000000000002', NOW() - INTERVAL '57 days'),  -- Streak 3d
  ('a1000000-0000-0000-0000-000000000001',   50, 'achievement_bonus', 'c1000000-0000-0000-0000-000000000003', NOW() - INTERVAL '53 days'),  -- Streak 7d
  ('a1000000-0000-0000-0000-000000000001',   25, 'achievement_bonus', 'c1000000-0000-0000-0000-000000000005', NOW() - INTERVAL '40 days'),  -- Produtivo
  ('a1000000-0000-0000-0000-000000000001',   75, 'achievement_bonus', 'c1000000-0000-0000-0000-000000000007', NOW() - INTERVAL '11 days'),  -- Desafiador
  ('a1000000-0000-0000-0000-000000000001',   50, 'achievement_bonus', 'c1000000-0000-0000-0000-000000000008', NOW() - INTERVAL '20 days'),  -- Pontual
  ('a1000000-0000-0000-0000-000000000001',  100, 'achievement_bonus', 'c1000000-0000-0000-0000-000000000009', NOW() - INTERVAL '27 days'),  -- Líder de Grupo
  ('a1000000-0000-0000-0000-000000000001',   75, 'mission_reward',    'e1000000-0000-0000-0000-000000000001', NOW() - INTERVAL '1 day'),    -- Maratona concluída
  -- Transações históricas agregadas (tarefas concluídas antes do período visível no seed)
  ('a1000000-0000-0000-0000-000000000001', 2165, 'task_completed',    NULL,                                   NOW() - INTERVAL '55 days'),

  -- Bruno (total: 1820 pts)
  ('a1000000-0000-0000-0000-000000000002',   60, 'task_completed',    'd1000000-0000-0000-0000-000000000005', NOW() - INTERVAL '7 days'),
  ('a1000000-0000-0000-0000-000000000002',   17, 'task_completed',    'd1000000-0000-0000-0000-000000000006', NOW() - INTERVAL '2 days'),
  ('a1000000-0000-0000-0000-000000000002',  120, 'task_completed',    'd1000000-0000-0000-0000-000000000008', NOW() - INTERVAL '16 days'),
  ('a1000000-0000-0000-0000-000000000002',   -7, 'late_penalty',      'd1000000-0000-0000-0000-000000000006', NOW() - INTERVAL '2 days'),
  ('a1000000-0000-0000-0000-000000000002',   50, 'streak_bonus',      NULL,                                   NOW() - INTERVAL '42 days'),
  ('a1000000-0000-0000-0000-000000000002',   50, 'streak_bonus',      NULL,                                   NOW() - INTERVAL '38 days'),
  ('a1000000-0000-0000-0000-000000000002',   10, 'achievement_bonus', 'c1000000-0000-0000-0000-000000000001', NOW() - INTERVAL '44 days'),
  ('a1000000-0000-0000-0000-000000000002',   50, 'achievement_bonus', 'c1000000-0000-0000-0000-000000000002', NOW() - INTERVAL '42 days'),
  ('a1000000-0000-0000-0000-000000000002',   50, 'achievement_bonus', 'c1000000-0000-0000-0000-000000000003', NOW() - INTERVAL '38 days'),
  ('a1000000-0000-0000-0000-000000000002',   25, 'achievement_bonus', 'c1000000-0000-0000-0000-000000000005', NOW() - INTERVAL '25 days'),
  ('a1000000-0000-0000-0000-000000000002',   75, 'achievement_bonus', 'c1000000-0000-0000-0000-000000000007', NOW() - INTERVAL '16 days'),
  -- Histórico agregado
  ('a1000000-0000-0000-0000-000000000002', 1320, 'task_completed',    NULL,                                   NOW() - INTERVAL '40 days'),

  -- Carla (total: 1050 pts)
  ('a1000000-0000-0000-0000-000000000003',   30, 'task_completed',    'd1000000-0000-0000-0000-000000000009', NOW() - INTERVAL '8 days'),
  ('a1000000-0000-0000-0000-000000000003',   10, 'task_completed',    'd1000000-0000-0000-0000-00000000000a', NOW() - INTERVAL '5 days'),
  ('a1000000-0000-0000-0000-000000000003',   50, 'streak_bonus',      NULL,                                   NOW() - INTERVAL '27 days'),
  ('a1000000-0000-0000-0000-000000000003',   10, 'achievement_bonus', 'c1000000-0000-0000-0000-000000000001', NOW() - INTERVAL '29 days'),
  ('a1000000-0000-0000-0000-000000000003',   50, 'achievement_bonus', 'c1000000-0000-0000-0000-000000000002', NOW() - INTERVAL '27 days'),
  -- Histórico agregado
  ('a1000000-0000-0000-0000-000000000003',  900, 'task_completed',    NULL,                                   NOW() - INTERVAL '25 days'),

  -- Diego (total: 430 pts)
  ('a1000000-0000-0000-0000-000000000004',    7, 'task_completed',    'd1000000-0000-0000-0000-00000000000c', NOW() - INTERVAL '1 day'),
  ('a1000000-0000-0000-0000-000000000004',   -3, 'late_penalty',      'd1000000-0000-0000-0000-00000000000c', NOW() - INTERVAL '1 day'),
  ('a1000000-0000-0000-0000-000000000004',   10, 'achievement_bonus', 'c1000000-0000-0000-0000-000000000001', NOW() - INTERVAL '13 days'),
  -- Histórico agregado
  ('a1000000-0000-0000-0000-000000000004',  416, 'task_completed',    NULL,                                   NOW() - INTERVAL '12 days'),

  -- Eva (total: 85 pts)
  ('a1000000-0000-0000-0000-000000000005',   12, 'task_completed',    'd1000000-0000-0000-0000-00000000000e', NOW() - INTERVAL '4 days'),
  ('a1000000-0000-0000-0000-000000000005',   73, 'task_completed',    NULL,                                   NOW() - INTERVAL  '4 days')
;
