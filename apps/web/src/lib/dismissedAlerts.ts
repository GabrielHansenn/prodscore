import { localDateKey, type ProcrastinationAlertType } from '@prodscore/shared';

/**
 * Alertas de procrastinação que o usuário fechou HOJE (por tipo). Ficam no
 * localStorage com a data na chave, então voltam no dia seguinte — antes,
 * fechar só valia até recarregar a página.
 */
const storageKey = () => `prodscore:alertas-dispensados:${localDateKey()}`;

export function getDismissedAlertTypes(): Set<ProcrastinationAlertType> {
  try {
    const raw = localStorage.getItem(storageKey());
    return new Set(raw ? (JSON.parse(raw) as ProcrastinationAlertType[]) : []);
  } catch {
    return new Set();
  }
}

export function dismissAlertType(type: ProcrastinationAlertType): Set<ProcrastinationAlertType> {
  const next = getDismissedAlertTypes();
  next.add(type);
  try {
    localStorage.setItem(storageKey(), JSON.stringify([...next]));
  } catch {
    // Sem armazenamento (aba anônima etc.): vale só até recarregar
  }
  return next;
}
