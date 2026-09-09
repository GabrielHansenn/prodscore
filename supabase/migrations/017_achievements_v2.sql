-- Migration: 017_achievements_v2
-- Descrição: Substitui os emojis do catálogo de conquistas por chaves de
--             ícone semânticas (renderizadas como ícones de verdade no
--             frontend), corrige o critério morto "on_time_streak" (nunca
--             tinha avaliador implementado) e amplia o catálogo com marcos
--             de nível, pontuação acumulada e missões de grupo.

-- ---------------------------------------------------------------------------
-- 1. Ícones do catálogo existente: emoji -> chave semântica
-- ---------------------------------------------------------------------------
UPDATE public.achievements SET icon = 'check' WHERE id = 'c1000000-0000-0000-0000-000000000001'; -- Primeira Tarefa
UPDATE public.achievements SET icon = 'flame' WHERE id = 'c1000000-0000-0000-0000-000000000002'; -- Sequência 3 Dias
UPDATE public.achievements SET icon = 'sparkle' WHERE id = 'c1000000-0000-0000-0000-000000000003'; -- Sequência 7 Dias
UPDATE public.achievements SET icon = 'gem' WHERE id = 'c1000000-0000-0000-0000-000000000004'; -- Sequência 30 Dias
UPDATE public.achievements SET icon = 'list' WHERE id = 'c1000000-0000-0000-0000-000000000005'; -- Produtivo
UPDATE public.achievements SET icon = 'rocket' WHERE id = 'c1000000-0000-0000-0000-000000000006'; -- Super Produtivo
UPDATE public.achievements SET icon = 'bolt' WHERE id = 'c1000000-0000-0000-0000-000000000007'; -- Desafiador
UPDATE public.achievements SET icon = 'users' WHERE id = 'c1000000-0000-0000-0000-000000000009'; -- Líder de Grupo
UPDATE public.achievements SET icon = 'crown' WHERE id = 'c1000000-0000-0000-0000-00000000000a'; -- Lendário

-- ---------------------------------------------------------------------------
-- 2. Corrige "Pontual" — criteria "on_time_streak" nunca teve avaliador
--    implementado no backend (tipo desconhecido = sempre ignorado, silenciosamente
--    inalcançável). Troca para "on_time_completed": contagem simples de tarefas
--    concluídas dentro do prazo (não precisa ser consecutiva), que É computável
--    diretamente da tabela tasks.
-- ---------------------------------------------------------------------------
UPDATE public.achievements SET
  icon        = 'clock',
  description = 'Conclua 5 tarefas dentro do prazo. Respeito pelo tempo!',
  criteria    = '{"type":"on_time_completed","threshold":5}'
WHERE id = 'c1000000-0000-0000-0000-000000000008';

-- ---------------------------------------------------------------------------
-- 3. Novas conquistas
-- ---------------------------------------------------------------------------
INSERT INTO public.achievements (id, name, description, icon, reward_points, criteria) VALUES
  ('c1000000-0000-0000-0000-00000000000b',
    'Centena',
    'Conclua 100 tarefas no total. Um marco de dedicação.',
    'medal', 200,
    '{"type":"tasks_completed","threshold":100}'),

  ('c1000000-0000-0000-0000-00000000000c',
    'Sequência de 60 Dias',
    'Dois meses inteiros de consistência. Isso já é estilo de vida.',
    'star', 150,
    '{"type":"streak","threshold":60}'),

  ('c1000000-0000-0000-0000-00000000000d',
    'Subindo de Nível',
    'Alcance o nível 5. Sua evolução está só começando.',
    'trending-up', 50,
    '{"type":"level_reached","threshold":5}'),

  ('c1000000-0000-0000-0000-00000000000e',
    'Veterano',
    'Alcance o nível 10. Experiência não falta mais.',
    'shield', 150,
    '{"type":"level_reached","threshold":10}'),

  ('c1000000-0000-0000-0000-00000000000f',
    'Mestre',
    'Alcance o nível 20. Referência de produtividade.',
    'crown', 400,
    '{"type":"level_reached","threshold":20}'),

  ('c1000000-0000-0000-0000-000000000010',
    'Primeiros Pontos',
    'Acumule 500 pontos de experiência.',
    'coins', 0,
    '{"type":"points_earned","threshold":500}'),

  ('c1000000-0000-0000-0000-000000000011',
    'Acumulador',
    'Acumule 2.000 pontos de experiência.',
    'coins', 100,
    '{"type":"points_earned","threshold":2000}'),

  ('c1000000-0000-0000-0000-000000000012',
    'Milionário de XP',
    'Acumule 10.000 pontos de experiência. Números de outro nível.',
    'coins', 300,
    '{"type":"points_earned","threshold":10000}'),

  ('c1000000-0000-0000-0000-000000000013',
    'Trabalho em Equipe',
    'Conclua sua primeira missão coletiva de grupo.',
    'flag', 50,
    '{"type":"group_missions_completed","threshold":1}'),

  ('c1000000-0000-0000-0000-000000000014',
    'Coletivo Consistente',
    'Conclua 5 missões coletivas de grupo.',
    'flag', 200,
    '{"type":"group_missions_completed","threshold":5}')
ON CONFLICT (id) DO UPDATE SET
  name          = EXCLUDED.name,
  description   = EXCLUDED.description,
  icon          = EXCLUDED.icon,
  reward_points = EXCLUDED.reward_points,
  criteria      = EXCLUDED.criteria;
