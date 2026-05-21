import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';

const extra = (Constants.expoConfig?.extra ?? {}) as {
  supabaseUrl?: string;
  supabaseAnonKey?: string;
};

const supabaseUrl =
  process.env.EXPO_PUBLIC_SUPABASE_URL ?? extra.supabaseUrl ?? '';
const supabaseAnonKey =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? extra.supabaseAnonKey ?? '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    '[supabase] Variáveis EXPO_PUBLIC_SUPABASE_URL/ANON_KEY não setadas. Crie um .env na raiz.'
  );
}

// Durante `expo export` em Node, `window` não existe e o AsyncStorage quebra.
// Em RN (e browser), `window` está definido. Usamos isso pra detectar o build SSR.
const isRuntime = typeof window !== 'undefined';
const noopStorage = {
  getItem: async (_: string) => null,
  setItem: async (_: string, __: string) => {},
  removeItem: async (_: string) => {},
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: isRuntime ? AsyncStorage : (noopStorage as any),
    autoRefreshToken: isRuntime,
    persistSession: isRuntime,
    detectSessionInUrl: false,
  },
});
