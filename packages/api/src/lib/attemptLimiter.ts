import type { Request } from 'express';

/**
 * Limite de tentativas POR PESSOA (janela deslizante, em memória).
 *
 * Por que existe: os limites do Supabase Auth não distinguem as pessoas. Quem
 * chama o signUp é o nosso servidor (Vercel), então todo cadastro chega ao
 * Supabase com o mesmo IP — e o limite de envio de e-mails vale para o
 * projeto inteiro. Quando ele estourava, TODO mundo via "muitas tentativas",
 * mesmo quem tentava pela primeira vez. Este limite fica antes do Supabase e
 * conta as tentativas pelo IP de quem está se cadastrando.
 *
 * Limitação conhecida: na Vercel cada instância da função tem a própria
 * memória, então o limite é aproximado (vale por instância). Serve para
 * barrar alguém repetindo o cadastro em sequência, que é o objetivo.
 */
export class AttemptLimiter {
  private readonly attempts = new Map<string, number[]>();

  constructor(
    /** Tentativas permitidas dentro da janela */
    readonly maxAttempts: number,
    /** Tamanho da janela, em milissegundos */
    readonly windowMs: number,
  ) {}

  /**
   * Registra uma tentativa de `key` e diz se ela está dentro do limite.
   * Tentativas recusadas não contam (não prolongam o bloqueio).
   */
  tryAttempt(key: string, now: number = Date.now()): boolean {
    const recent = (this.attempts.get(key) ?? []).filter((t) => now - t < this.windowMs);
    if (recent.length >= this.maxAttempts) {
      this.attempts.set(key, recent);
      return false;
    }
    recent.push(now);
    this.attempts.set(key, recent);
    this.prune(now);
    return true;
  }

  /**
   * Já estourou o limite? Só consulta, não conta tentativa — para limites que
   * contam apenas as falhas (ex: senha errada no login), registradas depois
   * com tryAttempt.
   */
  isBlocked(key: string, now: number = Date.now()): boolean {
    const recent = (this.attempts.get(key) ?? []).filter((t) => now - t < this.windowMs);
    return recent.length >= this.maxAttempts;
  }

  /** Zera todas as contagens (usado pelos testes) */
  reset(): void {
    this.attempts.clear();
  }

  /** Esquece chaves sem tentativas recentes (a memória não cresce para sempre) */
  private prune(now: number): void {
    if (this.attempts.size < 1000) return;
    for (const [key, times] of this.attempts) {
      if (times.every((t) => now - t >= this.windowMs)) this.attempts.delete(key);
    }
  }
}

/**
 * IP de quem fez a requisição. Na Vercel, o IP real do visitante vem em
 * x-real-ip / x-forwarded-for (preenchidos pela própria Vercel); req.ip seria
 * o IP interno do proxy, igual para todo mundo.
 */
export function clientIp(req: Request): string {
  const realIp = req.headers['x-real-ip'];
  if (typeof realIp === 'string' && realIp.trim()) return realIp.trim();
  const forwarded = req.headers['x-forwarded-for'];
  const first = (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(',')[0]?.trim();
  return first || req.ip || 'desconhecido';
}
