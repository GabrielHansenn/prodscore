/**
 * Edge Function: process-overdue-tasks
 *
 * Executada periodicamente (cron via Supabase) para marcar como 'overdue'
 * as tarefas pendentes/em andamento cujo prazo já expirou.
 *
 * Delega o UPDATE para a função SQL mark_overdue_tasks() definida na
 * migration 010_streak_freeze.sql — mantém a lógica no banco e evita
 * N+1 queries no runtime Deno.
 *
 * Configuração sugerida (supabase/config.toml):
 *   [functions.process-overdue-tasks]
 *   schedule = "0 * * * *"   # a cada hora cheia
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabaseUrl            = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

Deno.serve(async (_req: Request): Promise<Response> => {
  const startedAt = new Date().toISOString();

  try {
    // Chama a função SQL que aplica o UPDATE em lote (com índice em due_date + status)
    const { data, error } = await supabase.rpc('mark_overdue_tasks');

    if (error) {
      console.error('[process-overdue-tasks] Erro ao executar mark_overdue_tasks:', error.message);
      return new Response(
        JSON.stringify({ ok: false, error: error.message, startedAt }),
        { status: 500, headers: { 'Content-Type': 'application/json' } },
      );
    }

    // mark_overdue_tasks() retorna o número de linhas afetadas
    const rowsUpdated = typeof data === 'number' ? data : 0;

    console.log(`[process-overdue-tasks] ${rowsUpdated} tarefa(s) marcada(s) como overdue em ${startedAt}`);

    return new Response(
      JSON.stringify({ ok: true, rowsUpdated, startedAt }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[process-overdue-tasks] Erro inesperado:', message);

    return new Response(
      JSON.stringify({ ok: false, error: message, startedAt }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
});
