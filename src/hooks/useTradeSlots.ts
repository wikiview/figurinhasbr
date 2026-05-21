import { useCallback, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type TradeSlot = {
  who?: string;
  what?: string;
};

export type TradeEntry = {
  s1?: TradeSlot;
  s2?: TradeSlot;
};

export type TradeMap = Record<string, TradeEntry>;

const KEY_PREFIX = 'caderneta:trades:';

function storageKey(userId: string | undefined) {
  return `${KEY_PREFIX}${userId ?? 'anon'}`;
}

function isFilledSlot(slot?: TradeSlot): boolean {
  if (!slot) return false;
  return Boolean((slot.who && slot.who.trim()) || (slot.what && slot.what.trim()));
}

export function entryHasTrade(entry?: TradeEntry): boolean {
  if (!entry) return false;
  return isFilledSlot(entry.s1) || isFilledSlot(entry.s2);
}

export function useTradeSlots(userId: string | undefined) {
  const [trades, setTrades] = useState<TradeMap>({});
  const [loaded, setLoaded] = useState(false);
  const writeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let alive = true;
    setLoaded(false);
    AsyncStorage.getItem(storageKey(userId))
      .then((raw) => {
        if (!alive) return;
        if (raw) {
          try {
            setTrades(JSON.parse(raw) as TradeMap);
          } catch {
            setTrades({});
          }
        } else {
          setTrades({});
        }
        setLoaded(true);
      })
      .catch(() => {
        if (alive) {
          setTrades({});
          setLoaded(true);
        }
      });
    return () => {
      alive = false;
    };
  }, [userId]);

  // Debounce writes pra não bater no AsyncStorage a cada keystroke
  const persist = useCallback(
    (next: TradeMap) => {
      if (writeTimer.current) clearTimeout(writeTimer.current);
      writeTimer.current = setTimeout(() => {
        AsyncStorage.setItem(storageKey(userId), JSON.stringify(next)).catch(() => {});
      }, 200);
    },
    [userId],
  );

  const setSlot = useCallback(
    (stickerId: string, slot: 's1' | 's2', patch: Partial<TradeSlot>) => {
      setTrades((prev) => {
        const cur = prev[stickerId] ?? {};
        const curSlot = cur[slot] ?? {};
        const mergedSlot: TradeSlot = { ...curSlot, ...patch };
        const cleaned: TradeSlot = {
          who: mergedSlot.who?.trim() || undefined,
          what: mergedSlot.what?.trim() || undefined,
        };
        const slotIsEmpty = !cleaned.who && !cleaned.what;
        const nextEntry: TradeEntry = { ...cur };
        if (slotIsEmpty) delete nextEntry[slot];
        else nextEntry[slot] = cleaned;
        const next = { ...prev };
        if (!nextEntry.s1 && !nextEntry.s2) delete next[stickerId];
        else next[stickerId] = nextEntry;
        persist(next);
        return next;
      });
    },
    [persist],
  );

  const clearSticker = useCallback(
    (stickerId: string) => {
      setTrades((prev) => {
        if (!prev[stickerId]) return prev;
        const next = { ...prev };
        delete next[stickerId];
        persist(next);
        return next;
      });
    },
    [persist],
  );

  return { trades, setSlot, clearSticker, loaded };
}
