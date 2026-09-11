import { create } from 'zustand';
import { getUnreadCounts } from '../services/message.service.js';

interface ChatStore {
  /** Não lidas por remetente — alimenta os badges da lista de amigos */
  unread: Record<string, number>;
  fetchUnread: () => Promise<void>;
  /** Incrementa ao receber uma mensagem via Realtime */
  bump: (senderId: string) => void;
  /** Zera ao abrir/ler a conversa */
  clear: (senderId: string) => void;
}

export const useChatStore = create<ChatStore>((set) => ({
  unread: {},

  fetchUnread: async () => {
    try {
      const unread = await getUnreadCounts();
      set({ unread });
    } catch {
      // badge é informativo — não bloqueia a tela
    }
  },

  bump: (senderId) => set((s) => ({ unread: { ...s.unread, [senderId]: (s.unread[senderId] ?? 0) + 1 } })),

  clear: (senderId) => set((s) => {
    if (!s.unread[senderId]) return s;
    const { [senderId]: _removed, ...rest } = s.unread;
    return { unread: rest };
  }),
}));

/** Total de não lidas (para badge agregado) */
export function totalUnread(state: ChatStore): number {
  return Object.values(state.unread).reduce((sum, n) => sum + n, 0);
}
