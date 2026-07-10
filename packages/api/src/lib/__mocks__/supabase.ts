/**
 * Mock manual do cliente Supabase para testes unitários.
 * Jest carrega este arquivo automaticamente quando jest.mock('../lib/supabase') é chamado.
 */
export const supabase = {
  from: jest.fn(),
  rpc:  jest.fn(),
  auth: {
    admin:               { signOut: jest.fn() },
    signInWithPassword:  jest.fn(),
    signUp:              jest.fn(),
  },
};
