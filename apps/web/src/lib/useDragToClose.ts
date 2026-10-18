import { useEffect, useRef, type RefObject } from 'react';

/** Arrastou mais que isso (px) para baixo: fecha */
const CLOSE_DISTANCE = 100;
/** Ou soltou rápido para baixo (px/ms), mesmo arrastando pouco: fecha */
const CLOSE_VELOCITY = 0.5;

/**
 * Folha que sobe do rodapé (menu do celular): arrastar para baixo fecha.
 *
 * - O gesto começa no puxador ([data-drag-handle]) ou em qualquer ponto da
 *   folha quando o conteúdo já está no topo — se ele estiver rolado, o dedo
 *   para baixo primeiro rola o conteúdo de volta, como nos apps nativos.
 * - A folha acompanha o dedo; ao soltar, fecha se passou de CLOSE_DISTANCE ou
 *   se o movimento foi rápido, senão volta para o lugar.
 * - Os listeners são nativos e não passivos: só assim dá para cancelar a
 *   rolagem da página enquanto a folha é arrastada (os do React são passivos).
 *
 * @param sheetRef  elemento que se move (sem animação de entrada própria)
 * @param scrollRef área com rolagem dentro da folha
 */
export function useDragToClose(
  sheetRef: RefObject<HTMLElement | null>,
  scrollRef: RefObject<HTMLElement | null>,
  onClose: () => void,
) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const sheet = sheetRef.current;
    if (!sheet) return;

    let startY = 0;
    let startTime = 0;
    let offset = 0;
    /** null: ainda não decidiu; true: arrastando a folha; false: deixa rolar */
    let dragging: boolean | null = null;
    let fromHandle = false;

    const move = (y: number, animate: boolean) => {
      sheet.style.transition = animate ? 'transform 200ms ease-out' : 'none';
      sheet.style.transform = y > 0 ? `translateY(${y}px)` : '';
    };

    const onStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      startY = e.touches[0]!.clientY;
      startTime = performance.now();
      offset = 0;
      dragging = null;
      fromHandle = (e.target as Element).closest('[data-drag-handle]') !== null;
    };

    const onMove = (e: TouchEvent) => {
      if (dragging === false) return;
      const dy = e.touches[0]!.clientY - startY;
      if (dragging === null) {
        if (Math.abs(dy) < 6) return;
        // Só vira arraste se for para baixo e o conteúdo estiver no topo
        const atTop = (scrollRef.current?.scrollTop ?? 0) <= 0;
        dragging = dy > 0 && (fromHandle || atTop);
        if (!dragging) return;
      }
      e.preventDefault();
      offset = Math.max(0, dy);
      move(offset, false);
    };

    const onEnd = () => {
      if (!dragging) return;
      dragging = null;
      const velocity = offset / Math.max(1, performance.now() - startTime);
      if (offset > CLOSE_DISTANCE || (offset > 20 && velocity > CLOSE_VELOCITY)) {
        // Termina de descer e só então fecha
        move(sheet.offsetHeight, true);
        window.setTimeout(() => onCloseRef.current(), 180);
      } else {
        move(0, true);
      }
    };

    sheet.addEventListener('touchstart', onStart, { passive: true });
    sheet.addEventListener('touchmove', onMove, { passive: false });
    sheet.addEventListener('touchend', onEnd);
    sheet.addEventListener('touchcancel', onEnd);
    return () => {
      sheet.removeEventListener('touchstart', onStart);
      sheet.removeEventListener('touchmove', onMove);
      sheet.removeEventListener('touchend', onEnd);
      sheet.removeEventListener('touchcancel', onEnd);
    };
  }, [sheetRef, scrollRef]);
}
