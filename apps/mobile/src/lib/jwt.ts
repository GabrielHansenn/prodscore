/**
 * Decodifica (sem verificar assinatura) a claim `aal` de um JWT do Supabase.
 * Seguro pra decidir UI (ex: mostrar tela de verificação, esconder ação
 * sensível) — a garantia de segurança de verdade é o `requireAAL2` do
 * backend, que valida o token de novo em cada ação sensível.
 */
export function decodeJwtAal(token: string): string | null {
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    const parsed = JSON.parse(atob(padded)) as { aal?: string };
    return parsed.aal ?? null;
  } catch {
    return null;
  }
}
