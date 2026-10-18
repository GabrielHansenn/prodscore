import { useEffect, useState } from 'react';

/** Tipos de <input> que abrem o teclado virtual */
const TEXT_INPUT_TYPES = new Set(['text', 'email', 'password', 'search', 'tel', 'url', 'number', 'date', 'datetime-local', 'time', '']);

function opensKeyboard(el: Element | null): boolean {
  if (!(el instanceof HTMLElement) || !el.isConnected) return false;
  if (el.isContentEditable || el.tagName === 'TEXTAREA') return true;
  return el.tagName === 'INPUT' && TEXT_INPUT_TYPES.has((el as HTMLInputElement).type);
}

/**
 * true enquanto o teclado virtual provavelmente está aberto: um campo de texto
 * (ou o editor de texto rico) está com foco num aparelho de toque. É uma
 * heurística — o navegador não avisa quando o teclado abre — usada para
 * esconder a barra inferior, que senão subiria junto e espremeria o formulário.
 *
 * Cuidado no iPhone (WebKit): quando o campo focado SAI da página — modal
 * fechado com Esc, salvo ou cancelado — o Safari não dispara focusout. Só
 * ouvir focusout deixava a barra escondida para sempre. Por isso, enquanto
 * está "aberto", também vigia a remoção do campo e o redimensionamento da
 * tela (o teclado fechando).
 */
export function useKeyboardOpen(): boolean {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const touch = () => window.matchMedia?.('(pointer: coarse)').matches ?? false;
    const check = () => setOpen(touch() && opensKeyboard(document.activeElement));

    const onFocusIn = (e: FocusEvent) => { if (touch() && opensKeyboard(e.target as Element)) setOpen(true); };
    // O foco pode passar direto de um campo para outro: confere depois do evento
    const onFocusOut = () => { setTimeout(check, 0); };

    document.addEventListener('focusin', onFocusIn);
    document.addEventListener('focusout', onFocusOut);
    window.visualViewport?.addEventListener('resize', check);
    window.addEventListener('resize', check);
    return () => {
      document.removeEventListener('focusin', onFocusIn);
      document.removeEventListener('focusout', onFocusOut);
      window.visualViewport?.removeEventListener('resize', check);
      window.removeEventListener('resize', check);
    };
  }, []);

  // Enquanto "aberto": se o campo focado for removido da página (sem focusout
  // no Safari), reavalia — e a barra volta
  useEffect(() => {
    if (!open) return;
    const observer = new MutationObserver(() => {
      if (!opensKeyboard(document.activeElement)) setOpen(false);
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [open]);

  // Ao fechar o teclado, o iOS às vezes deixa a página deslocada para cima
  // (window.scrollY > 0, mesmo o layout não rolando a janela). Elementos fixos
  // continuam desenhados no lugar, mas a área de toque fica deslocada — a barra
  // parece "intocável". O layout só rola dentro do <main>, então a janela
  // deve estar sempre no topo.
  useEffect(() => {
    if (open) return;
    if (window.scrollY !== 0 || (window.visualViewport?.offsetTop ?? 0) !== 0) window.scrollTo(0, 0);
  }, [open]);

  return open;
}
