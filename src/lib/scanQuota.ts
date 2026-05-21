/**
 * Quota diária de scans (free tier).
 *
 * Regra: usuário free tem 10 scans por dia (calendário local). Reseta às 00:00.
 * Premium é ilimitado — passa direto.
 *
 * Estado armazenado local em AsyncStorage. Pode ser burlado (reinstalar, limpar dados)
 * mas pra MVP é suficiente. Se virar problema, migra pra Supabase profile.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'scan_quota:v1';
export const SCAN_DAILY_LIMIT = 10;

type State = {
  date: string; // YYYY-MM-DD em fuso local
  count: number;
};

function todayLocal(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

async function readState(): Promise<State> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return { date: todayLocal(), count: 0 };
    const parsed = JSON.parse(raw) as State;
    // Mudou de dia? Reseta.
    if (parsed.date !== todayLocal()) return { date: todayLocal(), count: 0 };
    return parsed;
  } catch {
    return { date: todayLocal(), count: 0 };
  }
}

async function writeState(state: State): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
}

/** Quantos scans o usuário ainda pode fazer hoje. Premium = Infinity. */
export async function getScansRemaining(isPremium: boolean): Promise<number> {
  if (isPremium) return Infinity;
  const state = await readState();
  return Math.max(0, SCAN_DAILY_LIMIT - state.count);
}

/** Pode escanear agora? */
export async function canScanNow(isPremium: boolean): Promise<boolean> {
  if (isPremium) return true;
  const state = await readState();
  return state.count < SCAN_DAILY_LIMIT;
}

/** Registra um scan consumido. Retorna quanto sobrou. */
export async function consumeScan(isPremium: boolean): Promise<number> {
  if (isPremium) return Infinity;
  const state = await readState();
  const next: State = { date: todayLocal(), count: state.count + 1 };
  await writeState(next);
  return Math.max(0, SCAN_DAILY_LIMIT - next.count);
}
