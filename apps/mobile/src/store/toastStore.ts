import { create } from 'zustand';

export type ToastVariant = 'success' | 'error';

interface ToastItem {
  id:      number;
  message: string;
  variant: ToastVariant;
}

interface ToastState {
  toasts:  ToastItem[];
  show:    (message: string, variant?: ToastVariant) => void;
  dismiss: (id: number) => void;
}

const AUTO_DISMISS_MS = 4000;

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],

  show: (message, variant = 'success') => {
    const id = Date.now() + Math.random();
    set((state) => ({ toasts: [...state.toasts, { id, message, variant }] }));
    setTimeout(() => get().dismiss(id), AUTO_DISMISS_MS);
  },

  dismiss: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}));

/**
 * Mostra uma notificação toast (topo da tela, some sozinha em 4s).
 * Use no lugar de `Alert.alert` para mostrar erro/sucesso de uma ação —
 * `Alert.alert` continua reservado para confirmação de ações destrutivas.
 */
export function showToast(message: string, variant: ToastVariant = 'success'): void {
  useToastStore.getState().show(message, variant);
}
