// Edge Function: refresh-ranking
// Atualiza a view materializada ranking_global_mv via cron ou chamada manual.
// Configurar no Supabase Dashboard: Cron → a cada hora ou diariamente.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase    = createClient(supabaseUrl, supabaseKey);

Deno.serve(async () => {
  const startedAt = new Date().toISOString();

  const { error } = await supabase.rpc('refresh_ranking_global');

  if (error) {
    return new Response(
      JSON.stringify({ ok: false, error: error.message, startedAt }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }

  return new Response(
    JSON.stringify({ ok: true, startedAt }),
    { headers: { 'Content-Type': 'application/json' } },
  );
});
