import type { ComponentProps } from 'react';
import type { Ionicons } from '@expo/vector-icons';

/**
 * Mapa de chave semântica (campo `icon` do catálogo em supabase/seed.sql)
 * para o nome do ícone correspondente no Ionicons. Usado por AchievementBadge
 * e AchievementsScreen — mantém os dois em sincronia com um só ponto de verdade.
 */
export const ACHIEVEMENT_ICONS: Record<string, ComponentProps<typeof Ionicons>['name']> = {
  check:          'checkmark-circle',
  flame:          'flame',
  sparkle:        'sparkles',
  gem:            'diamond',
  list:           'clipboard',
  rocket:         'rocket',
  bolt:           'flash',
  clock:          'time',
  users:          'people',
  crown:          'trophy',
  medal:          'ribbon',
  star:           'star',
  'trending-up':  'trending-up',
  shield:         'shield-checkmark',
  coins:          'cash',
  flag:           'flag',
};

/** Ícone de fallback para chaves desconhecidas (ex: catálogo mais novo que o app instalado) */
export const ACHIEVEMENT_ICON_FALLBACK: ComponentProps<typeof Ionicons>['name'] = 'trophy';
