import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View } from 'react-native';
import 'react-native-reanimated';

import { AuthProvider, useAuth } from '@/src/providers/AuthProvider';
import { PreferencesProvider } from '@/src/providers/PreferencesProvider';
import { useResolvedTheme } from '@/src/hooks/usePreferences';
import { useTheme } from '@/src/hooks/useTheme';
import { warmupAds } from '@/src/lib/ads';

function AuthGate() {
  const { session, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const t = useTheme();

  useEffect(() => {
    warmupAds();
  }, []);

  useEffect(() => {
    if (loading) return;
    const inAuth = segments[0] === '(auth)';
    if (!session && !inAuth) {
      router.replace('/(auth)/login');
    } else if (session && inAuth) {
      router.replace('/(tabs)');
    }
  }, [session, loading, segments, router]);

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: t.bg,
        }}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
    </Stack>
  );
}

function ThemedStatusBar() {
  const resolved = useResolvedTheme();
  return <StatusBar style={resolved === 'dark' ? 'light' : 'dark'} />;
}

export default function RootLayout() {
  return (
    <PreferencesProvider>
      <AuthProvider>
        <AuthGate />
        <ThemedStatusBar />
      </AuthProvider>
    </PreferencesProvider>
  );
}
