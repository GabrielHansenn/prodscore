/**
 * Testes dos validadores de campo compartilhados entre web e mobile.
 *
 * Técnicas aplicadas:
 * - Partição de equivalência: um caso representativo de cada grupo (vazio,
 *   formato inválido, válido).
 * - Análise de valor-limite: testa exatamente na borda da regra (ex: senha
 *   com 7 e com 8 caracteres), onde os bugs costumam aparecer.
 *
 * Os IDs (V1, V2...) correspondem à planilha de casos de teste.
 */

import { describe, it, expect } from 'vitest';
import {
  validateEmail,
  validateUsername,
  validatePassword,
  validatePasswordConfirmation,
} from '../validation';

describe('validateEmail', () => {
  it('V1 — e-mail vazio deve ser recusado', () => {
    expect(validateEmail('')).toBe('E-mail é obrigatório.');
  });

  it('V1b — e-mail só com espaços conta como vazio', () => {
    expect(validateEmail('   ')).toBe('E-mail é obrigatório.');
  });

  it('V2 — e-mail sem domínio deve ser recusado', () => {
    expect(validateEmail('gabriel@')).toBe('Informe um e-mail válido (ex: nome@dominio.com).');
  });

  it('V2b — e-mail sem @ deve ser recusado', () => {
    expect(validateEmail('gabriel.gmail.com')).toBe('Informe um e-mail válido (ex: nome@dominio.com).');
  });

  it('V3 — e-mail válido deve ser aceito', () => {
    expect(validateEmail('gabriel@gmail.com')).toBeNull();
  });
});

describe('validateUsername', () => {
  it('V4 — 2 caracteres (abaixo do limite mínimo) deve ser recusado', () => {
    expect(validateUsername('ab')).toBe('Use 3–30 caracteres: letras, números ou _.');
  });

  it('V5 — 3 caracteres (exatamente no limite mínimo) deve ser aceito', () => {
    expect(validateUsername('abc')).toBeNull();
  });

  it('V5b — 30 caracteres (exatamente no limite máximo) deve ser aceito', () => {
    expect(validateUsername('a'.repeat(30))).toBeNull();
  });

  it('V5c — 31 caracteres (acima do limite máximo) deve ser recusado', () => {
    expect(validateUsername('a'.repeat(31))).toBe('Use 3–30 caracteres: letras, números ou _.');
  });

  it('V6 — nome com espaço deve ser recusado', () => {
    expect(validateUsername('gabriel hansen')).toBe('Use 3–30 caracteres: letras, números ou _.');
  });

  it('V6b — letras, números e underline devem ser aceitos', () => {
    expect(validateUsername('gabriel_2005')).toBeNull();
  });
});

describe('validatePassword', () => {
  it('senha vazia deve ser recusada', () => {
    expect(validatePassword('')).toBe('Senha é obrigatória.');
  });

  it('V7 — 7 caracteres (abaixo do limite) deve ser recusada', () => {
    expect(validatePassword('abc1234')).toBe('A senha precisa ter pelo menos 8 caracteres.');
  });

  it('V8 — senha sem número deve ser recusada', () => {
    expect(validatePassword('abcdefgh')).toBe('A senha precisa conter pelo menos um número.');
  });

  it('V9 — senha sem letra deve ser recusada', () => {
    expect(validatePassword('12345678')).toBe('A senha precisa conter pelo menos uma letra.');
  });

  it('V10 — 8 caracteres com letra e número (exatamente no limite) deve ser aceita', () => {
    expect(validatePassword('abcd1234')).toBeNull();
  });
});

describe('validatePasswordConfirmation', () => {
  it('confirmação vazia deve pedir para confirmar', () => {
    expect(validatePasswordConfirmation('abcd1234', '')).toBe('Confirme sua senha.');
  });

  it('V11 — confirmação diferente da senha deve ser recusada', () => {
    expect(validatePasswordConfirmation('abcd1234', 'abcd12345')).toBe('As senhas não coincidem.');
  });

  it('V11b — confirmação igual à senha deve ser aceita', () => {
    expect(validatePasswordConfirmation('abcd1234', 'abcd1234')).toBeNull();
  });
});
