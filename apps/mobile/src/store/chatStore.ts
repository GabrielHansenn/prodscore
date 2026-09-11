import { create } from 'zustand';
import { getUnreadCounts } from '../services/message.service';

interface ChatStore {
  /** Não lidas por remetente — alimenta os badges da lista de amigos */
  unread: Record<string, number>;
  fetchUnread: () => Promise<void>;
  bump:  (senderId: string) => void;
  clear: (senderId: string) => void;
}

export const useChatStore = create<ChatStore>((set) => ({
  unread: {},

  fetchUnread: async () => {
    try {
      set({ unread: await getUnreadCounts() });
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
