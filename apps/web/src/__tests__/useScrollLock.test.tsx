/**
 * Trava de rolagem dos popups: enquanto um modal está aberto, o <main>
 * (onde a página rola) não pode rolar junto quando o usuário arrasta o dedo.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { useScrollLock } from '../lib/useScrollLock';

function Popup({ active = true }: { active?: boolean }) {
  useScrollLock(active);
  return null;
}

let main: HTMLElement;

beforeEach(() => {
  document.body.innerHTML = '';
  document.body.style.overflow = '';
  main = document.createElement('main');
  main.id = 'main-content';
  main.style.overflow = 'auto';
  document.body.appendChild(main);
});

describe('useScrollLock', () => {
  it('trava o <main> e o body enquanto aberto e devolve o valor original ao fechar', () => {
    const { unmount } = render(<Popup />);
    expect(main.style.overflow).toBe('hidden');
    expect(document.body.style.overflow).toBe('hidden');

    unmount();
    expect(main.style.overflow).toBe('auto');
    expect(document.body.style.overflow).toBe('');
  });

  it('com dois popups abertos, só destrava quando o último fecha', () => {
    const first = render(<Popup />);
    const second = render(<Popup />);

    first.unmount();
    expect(main.style.overflow).toBe('hidden');

    second.unmount();
    expect(main.style.overflow).toBe('auto');
  });

  it('não trava quando inativo (popup fechado)', () => {
    render(<Popup active={false} />);
    expect(main.style.overflow).toBe('auto');
  });
});
