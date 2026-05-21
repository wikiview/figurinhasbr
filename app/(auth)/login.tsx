import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Link } from 'expo-router';
import { supabase } from '@/src/lib/supabase';
import { useTheme } from '@/src/hooks/useTheme';

export default function LoginScreen() {
  const t = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function onLogin() {
    if (!email || !password) {
      Alert.alert('Faltam dados', 'Preencha email e senha.');
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) Alert.alert('Erro ao entrar', error.message);
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: t.bg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.inner}>
        <Text style={[styles.title, { color: t.text }]}>⚽ Figurinha</Text>
        <Text style={[styles.subtitle, { color: t.textMuted }]}>
          Sua coleção da Copa 2026, sem papelzinho.
        </Text>

        <Text style={[styles.label, { color: t.text }]}>Email</Text>
        <TextInput
          style={[styles.input, { backgroundColor: t.surfaceAlt, borderColor: t.border, color: t.text }]}
          placeholder="seu@email.com"
          placeholderTextColor={t.textFaint}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />

        <Text style={[styles.label, { color: t.text }]}>Senha</Text>
        <TextInput
          style={[styles.input, { backgroundColor: t.surfaceAlt, borderColor: t.border, color: t.text }]}
          placeholder="Sua senha"
          placeholderTextColor={t.textFaint}
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />

        <Pressable
          style={[styles.btn, { backgroundColor: t.primary }, loading && { opacity: 0.6 }]}
          disabled={loading}
          onPress={onLogin}>
          {loading ? (
            <ActivityIndicator color={t.primaryText} />
          ) : (
            <Text style={[styles.btnText, { color: t.primaryText }]}>Entrar</Text>
          )}
        </Pressable>

        <Link href="/(auth)/forgot" style={styles.link}>
          <Text style={[styles.linkText, { color: t.textMuted }]}>Esqueci minha senha</Text>
        </Link>

        <Link href="/(auth)/signup" style={styles.link}>
          <Text style={[styles.linkText, { color: t.primary }]}>Não tem conta? Cadastrar</Text>
        </Link>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  inner: { flex: 1, padding: 24, justifyContent: 'center' },
  title: { fontSize: 36, fontWeight: '800', textAlign: 'center', marginBottom: 4 },
  subtitle: { textAlign: 'center', marginBottom: 32 },
  label: { fontSize: 13, fontWeight: '600', marginBottom: 6, marginTop: 8 },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
  },
  btn: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 24,
  },
  btnText: { fontWeight: '700', fontSize: 16 },
  link: { marginTop: 16, alignSelf: 'center' },
  linkText: { fontWeight: '600' },
});
