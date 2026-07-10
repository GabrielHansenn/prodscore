/**
 * Arquivo de setup global para os testes com Vitest + React Testing Library.
 * Executado antes de cada arquivo de teste.
 */

// Importa os matchers do jest-dom (toBeInTheDocument, toHaveTextContent, etc.)
import '@testing-library/jest-dom';

// Suprime logs de console durante os testes para manter output limpo
// (remova se precisar debugar um teste específico)
import { vi } from 'vitest';
vi.spyOn(console, 'error').mockImplementation(() => undefined);
vi.spyOn(console, 'warn').mockImplementation(() => undefined);
