import { create } from 'zustand';
import type { Notification } from '@prodscore/shared';
import {
  getNotifications,
  getUnreadCount,
  markAsRead as markAsReadApi,
  markAllAsRead as markAllAsReadApi,
  clearNotifications as clearApi,
} from '../services/notification.service';

interface NotificationState {
  notifications: Notification[];
  unreadCount:   number;
  hasMore:       boolean;
  isLoading:     boolean;
  /** Carrega a primeira página + contador (ao abrir o painel) */
  fetch:        () => Promise<void>;
  /** Só o contador — barato o suficiente para rodar ao montar o app */
  fetchUnreadCount: () => Promise<void>;
  loadMore:     () => Promise<void>;
  markAsRead:   (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  clearAll:     () => Promise<void>;
  /** Recebida via Realtime (INSERT) — entra no topo */
  receive:      (n: Notification) => void;
  /** Atualizada via Realtime (UPDATE) — ex: agrupamento de mensagens de chat */
  upsert:       (n: Notification) => void;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  unreadCount:   0,
  hasMore:       false,
  isLoading:     false,

  fetch: async () => {
    set({ isLoading: true });
    try {
      const [page, unreadCount] = await Promise.all([getNotifications(), getUnreadCount()]);
      set({ notifications: page.notifications, hasMore: page.hasMore, unreadCount, isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },

  fetchUnreadCount: async () => {
    try {
      set({ unreadCount: await getUnreadCount() });
    } catch {
      // badge é informativo — falha silenciosa não bloqueia a UI
    }
  },

  loadMore: async () => {
    const { notifications, hasMore, isLoading } = get();
    if (!hasMore || isLoading || notifications.length === 0) return;
    set({ isLoading: true });
    try {
      const page = await getNotifications(notifications[notifications.length - 1]!.createdAt);
      set((s) => ({ notifications: [...s.notifications, ...page.notifications], hasMore: page.hasMore, isLoading: false }));
    } catch {
      set({ isLoading: false });
    }
  },

  markAsRead: async (id) => {
    const target = get().notifications.find((n) => n.id === id);
    if (!target || target.readAt) return;
    // Otimista: o painel responde na hora; o servidor confirma em seguida
    const readAt = new Date().toISOString();
    set((s) => ({
      notifications: s.notifications.map((n) => (n.id === id ? { ...n, readAt } : n)),
      unreadCount:   Math.max(0, s.unreadCount - 1),
    }));
    try {
      await markAsReadApi(id);
    } catch {
      await get().fetch();
    }
  },

  markAllAsRead: async () => {
    const readAt = new Date().toISOString();
    set((s) => ({
      notifications: s.notifications.map((n) => (n.readAt ? n : { ...n, readAt })),
      unreadCount:   0,
    }));
    try {
      await markAllAsReadApi();
    } catch {
      await get().fetch();
    }
  },

  clearAll: async () => {
    const backup = get().notifications;
    set({ notifications: [], unreadCount: 0, hasMore: false });
    try {
      await clearApi();
    } catch {
      set({ notifications: backup });
      await get().fetch();
    }
  },

  receive: (n) => set((s) => (
    s.notifications.some((x) => x.id === n.id)
      ? s
      : { notifications: [n, ...s.notifications], unreadCount: s.unreadCount + (n.readAt ? 0 : 1) }
  )),

  upsert: (n) => set((s) => {
    const existing = s.notifications.find((x) => x.id === n.id);
    if (!existing) {
      return { notifications: [n, ...s.notifications], unreadCount: s.unreadCount + (n.readAt ? 0 : 1) };
    }
    // Notificação agrupada de chat: sobe para o topo com o texto atualizado
    const rest = s.notifications.filter((x) => x.id !== n.id);
    const becameRead = !existing.readAt && n.readAt;
    const becameUnread = existing.readAt && !n.readAt;
    return {
      notifications: [n, ...rest],
      unreadCount: Math.max(0, s.unreadCount + (becameUnread ? 1 : 0) - (becameRead ? 1 : 0)),
    };
  }),
}));
