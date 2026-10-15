import { showToast } from '../store/toastStore.js';

/**
 * Copia um texto para a área de transferência.
 *
 * `navigator.clipboard` só funciona em contexto seguro (HTTPS/localhost) e
 * com permissão; quando falha, tenta o método antigo (textarea + execCommand).
 * Se nada funcionar, avisa e mostra o texto para copiar à mão — antes a falha
 * era silenciosa e o usuário achava que tinha copiado.
 *
 * @returns true se copiou
 */
export async function copyText(text: string, label = 'o texto'): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // segue para o método antigo
  }

  try {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand('copy');
    area.remove();
    if (ok) return true;
  } catch {
    // segue para o aviso
  }

  showToast(`Não foi possível copiar ${label}. Copie à mão: ${text}`, 'error');
  return false;
}
