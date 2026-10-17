/**
 * Datas no formato brasileiro (DD/MM/AAAA) para campos de texto — o app não
 * usa seletor de data nativo. Usado no prazo da tarefa e no filtro de período
 * dos relatórios.
 */

/** Aplica a máscara DD/MM/AAAA conforme o usuário digita (só dígitos, insere as barras) */
export function maskDateBR(text: string): string {
  const digits = text.replace(/\D/g, '').slice(0, 8);
  if (digits.length > 4) return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
  if (digits.length > 2) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return digits;
}

/** Converte DD/MM/AAAA (completo e válido) em AAAA-MM-DD para a API — null se incompleta/inválida */
export function parseDateBR(masked: string): string | null {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(masked);
  if (!match) return null;
  const [, dd, mm, yyyy] = match as unknown as [string, string, string, string];
  const day = Number(dd), month = Number(mm), year = Number(yyyy);
  const date = new Date(year, month - 1, day);
  // new Date() "rola" datas inválidas (ex: 31/02 vira 03/03) — se não bater, não existe
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return `${yyyy}-${mm}-${dd}`;
}

/** AAAA-MM-DD (como vem da API) → DD/MM/AAAA (como o usuário vê) */
export function isoToBR(iso: string): string {
  const [yyyy, mm, dd] = iso.split('-');
  return `${dd}/${mm}/${yyyy}`;
}
