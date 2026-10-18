import { useEffect, useState } from 'react';

/** Tipos de <input> que abrem o teclado virtual */
const TEXT_INPUT_TYPES = new Set(['text', 'email', 'password', 'search', 'tel', 'url', 'number', 'date', 'datetime-local', 'time', '']);

function opensKeyboard(el: Element | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  if (el.isContentEditable || el.tagName === 'TEXTAREA') return true;
  return el.tagName === 'INPUT' && TEXT_INPUT_TYPES.has((el as HTMLInputElement).type);
}

/**
 * true enquanto o teclado virtual provavelmente está aberto: um campo de texto
 * (ou o editor de texto rico) está com foco num aparelho de toque. É uma
 * heurística — o navegador não avisa quando o teclado abre — usada para
 * esconder a barra inferior, que senão subiria junto e espremeria o formulário.
 */
export function useKeyboardOpen(): boolean {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const touch = () => window.matchMedia?.('(pointer: coarse)').matches ?? false;
    const onFocusIn = (e: FocusEvent) => { if (touch() && opensKeyboard(e.target as Element)) setOpen(true); };
    // O foco pode passar direto de um campo para outro: confere depois do evento
    const onFocusOut = () => { setTimeout(() => setOpen(touch() && opensKeyboard(document.activeElement)), 0); };

    document.addEventListener('focusin', onFocusIn);
    document.addEventListener('focusout', onFocusOut);
    return () => {
      document.removeEventListener('focusin', onFocusIn);
      document.removeEventListener('focusout', onFocusOut);
    };
  }, []);

  return open;
}
