// Conquistas do app. Persistidas em public.user_achievements.

import { supabase } from './supabase';
import { hasPlayerGif } from '@/src/data/player-gifs';
import type { Sticker } from './types';

export const ACHIEVEMENTS = {
  ELITE_COLLECTOR: 'elite_collector',
} as const;

export type AchievementCode = (typeof ACHIEVEMENTS)[keyof typeof ACHIEVEMENTS];

export const ACHIEVEMENT_META: Record<
  AchievementCode,
  { title: string; subtitle: string }
> = {
  elite_collector: {
    title: 'Colecionador de Elite',
    subtitle: 'Você reuniu os 43 craques do álbum',
  },
};

export async function loadAchievements(userId: string): Promise<Set<AchievementCode>> {
  const { data, error } = await supabase
    .from('user_achievements')
    .select('code')
    .eq('user_id', userId);
  if (error) {
    console.warn('[achievements] load fail', error.message);
    return new Set();
  }
  return new Set((data ?? []).map((r: { code: string }) => r.code as AchievementCode));
}

export async function unlockAchievement(
  userId: string,
  code: AchievementCode,
): Promise<boolean> {
  const { error } = await supabase.from('user_achievements').upsert(
    { user_id: userId, code, unlocked_at: new Date().toISOString() },
    { onConflict: 'user_id,code' },
  );
  if (error) {
    console.warn('[achievements] unlock fail', error.message);
    return false;
  }
  return true;
}

// Retorna true se a figurinha que acabou de ser adicionada (justAddedId)
// completa a coleção de top players com GIF — i.e., todos os outros stickers
// com GIF já têm qty >= 1 antes desta.
export function isEliteCollectorComplete(
  stickers: Sticker[],
  qtyMap: Record<string, number>,
  justAddedId: string,
): boolean {
  let foundJustAdded = false;
  for (const s of stickers) {
    if (!hasPlayerGif(s.team_code, s.number)) continue;
    if (s.id === justAddedId) {
      foundJustAdded = true;
      continue;
    }
    if ((qtyMap[s.id] ?? 0) === 0) return false;
  }
  return foundJustAdded;
}
