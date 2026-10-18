import { useEffect } from 'react';

/** Quantos popups estão abertos agora — a trava só sai quando o último fecha */
let openLocks = 0;
const saved = new Map<HTMLElement, string>();

/**
 * Trava a rolagem da página enquanto um popup está aberto.
 *
 * A página rola dentro do <main> (não do body), e os modais são renderizados
 * dentro dele. No celular, ao chegar no fim do conteúdo do modal — ou ao
 * arrastar o dedo no fundo escurecido — o navegador repassa a rolagem para
 * o <main> e o app de trás anda junto. Com o overflow travado não há para
 * onde repassar.
 */
export function useScrollLock(active = true) {
  useEffect(() => {
    if (!active) return;
    const targets = [document.getElementById('main-content'), document.body]
      .filter((el): el is HTMLElement => el !== null);

    if (openLocks === 0) {
      for (const el of targets) {
        saved.set(el, el.style.overflow);
        el.style.overflow = 'hidden';
      }
    }
    openLocks++;

    return () => {
      openLocks--;
      if (openLocks === 0) {
        for (const [el, overflow] of saved) el.style.overflow = overflow;
        saved.clear();
      }
    };
  }, [active]);
}
