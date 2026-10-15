/**
 * Datas "de calendário" (dia escolhido pelo usuário) no fuso do aparelho.
 *
 * Por que existe: montar o prazo como `${dia}T23:59:00.000Z` grava 23h59 em
 * UTC — no Brasil (UTC-3) isso é 20h59, e a tarefa "para hoje" virava
 * atrasada às 21h. Do mesmo jeito, `new Date().toISOString().split('T')[0]`
 * devolve o dia em UTC, que depois das 21h já é amanhã.
 */

const DATE_KEY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Dia local no formato AAAA-MM-DD (o valor de um `<input type="date">`). */
export function localDateKey(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Último minuto (23h59) do dia AAAA-MM-DD no fuso do aparelho, em ISO (UTC)
 * para a API. Usado como prazo de tarefa e expiração de missão.
 *
 * @returns o ISO, ou `null` se a data não existe (ex: 2026-02-31)
 */
export function endOfLocalDayISO(dateKey: string): string | null {
  const match = DATE_KEY.exec(dateKey);
  if (!match) return null;
  const year = Number(match[1]), month = Number(match[2]), day = Number(match[3]);

  const date = new Date(year, month - 1, day, 23, 59, 0, 0);
  // new Date "rola" datas inválidas (31/02 vira 03/03) — se não bater, não existe
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return date.toISOString();
}

/** A data/hora ISO cai no dia de hoje, no fuso do aparelho? */
export function isLocalToday(iso: string, now: Date = new Date()): boolean {
  return localDateKey(new Date(iso)) === localDateKey(now);
}
