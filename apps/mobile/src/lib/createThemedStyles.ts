import { useMemo } from 'react';
import type { ColorPalette } from '../constants/theme';
import { useThemeColors } from './useThemeColors';

/**
 * Transforma uma função `(colors) => StyleSheet.create({...})` num hook que
 * recalcula o StyleSheet só quando o tema muda (useMemo por referência da
 * paleta — `lightColors`/`darkColors` são objetos constantes, então a
 * referência só troca quando o tema resolvido troca).
 *
 * Existe pra manter o padrão já usado em toda tela (StyleSheet.create no fim
 * do arquivo) — a única mudança por arquivo é envolver esse `StyleSheet.create`
 * nesta fábrica e trocar `COLORS.x` por `colors.x`, sem precisar mover o bloco
 * de estilos pra dentro do componente.
 */
export function createThemedStyles<T>(factory: (colors: ColorPalette) => T): () => T {
  return function useStyles(): T {
    const colors = useThemeColors();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    return useMemo(() => factory(colors), [colors]);
  };
}
