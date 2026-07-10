import type { Response } from 'express';
import { ZodError } from 'zod';

/**
 * Erro de aplicação com código HTTP e código de negócio opcionais.
 * Lançado pelos services e convertido em resposta JSON pelas rotas.
 */
export class AppError extends Error {
  constructor(
    /** Mensagem em português para o usuário final */
    public override readonly message: string,
    /** Código HTTP da resposta (padrão: 500) */
    public readonly statusCode: number = 500,
    /** Código de negócio legível por máquina (ex: 'TAREFA_NAO_ENCONTRADA') */
    public readonly code?: string,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

/** Verifica se um valor é uma instância de AppError */
export function isAppError(err: unknown): err is AppError {
  return err instanceof AppError;
}

/**
 * Converte um erro capturado em resposta HTTP JSON padronizada.
 * Formato de erro: { erro: string, codigo?: string }
 *
 * @param res      - Objeto de resposta Express
 * @param err      - Erro capturado no catch
 * @param contexto - Nome do módulo para o log (ex: '[auth]', '[tarefas]')
 */
export function sendError(res: Response, err: unknown, contexto: string): Response {
  if (isAppError(err)) {
    return res.status(err.statusCode).json({
      erro: err.message,
      ...(err.code !== undefined && { codigo: err.code }),
    });
  }

  if (err instanceof ZodError) {
    const mensagem = err.errors.map((e) => e.message).join('; ');
    return res.status(400).json({ erro: mensagem, codigo: 'VALIDACAO_INVALIDA' });
  }

  console.error(`${contexto} Erro inesperado:`, err);
  return res.status(500).json({ erro: 'Erro interno do servidor.' });
}
