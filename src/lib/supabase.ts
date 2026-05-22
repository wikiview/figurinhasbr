import 'react-native-url-polyfill/auto';
import { AppState } from 'react-native';
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

// `autoRefreshToken` sozinho não basta no React Native: o iOS suspende os
// timers JS enquanto o app fica em background, então o refresh do token não
// dispara de forma confiável ao voltar — e a sessão acaba caindo. O listener de
// AppState pausa o auto-refresh em background e o retoma no foreground. É o
// padrão recomendado pelo Supabase para apps React Native.
if (isRuntime) {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      supabase.auth.startAutoRefresh();
    } else {
      supabase.auth.stopAutoRefresh();
    }
  });
}
