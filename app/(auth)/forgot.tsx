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
import { Link, useRouter } from 'expo-router';
import { supabase } from '@/src/lib/supabase';
import { useTheme } from '@/src/hooks/useTheme';

export default function ForgotPasswordScreen() {
  const t = useTheme();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function onSend() {
    if (!email.trim()) {
      Alert.alert('Faltam dados', 'Coloca o email do seu cadastro.');
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: 'figurinha://reset-password',
    });
    setLoading(false);
    if (error) {
      Alert.alert('Erro', error.message);
      return;
    }
    setSent(true);
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: t.bg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.inner}>
        <Text style={[styles.title, { color: t.text }]}>Recuperar senha</Text>
        <Text style={[styles.subtitle, { color: t.textMuted }]}>
          Coloca o email do seu cadastro — mando um link pra você definir uma senha nova.
        </Text>

        {sent ? (
          <View style={[styles.successBox, { backgroundColor: t.haveBg, borderColor: t.haveBorder }]}>
            <Text style={[styles.successTitle, { color: t.haveText }]}>Email enviado ✓</Text>
            <Text style={[styles.successText, { color: t.haveText }]}>
              Cheque a caixa de entrada (e o spam) em {'\n'}
              <Text style={{ fontWeight: '700' }}>{email.trim()}</Text>
              {'\n\n'}
              Clica no link, define a senha nova e volta aqui pra entrar.
            </Text>
            <Pressable
              style={[styles.btn, { backgroundColor: t.primary, marginTop: 16 }]}
              onPress={() => router.replace('/(auth)/login')}>
              <Text style={[styles.btnText, { color: t.primaryText }]}>Voltar pro login</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <Text style={[styles.label, { color: t.text }]}>Email</Text>
            <TextInput
              style={[
                styles.input,
                { backgroundColor: t.surfaceAlt, borderColor: t.border, color: t.text },
              ]}
              placeholder="seu@email.com"
              placeholderTextColor={t.textFaint}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
            />

            <Pressable
              style={[styles.btn, { backgroundColor: t.primary }, loading && { opacity: 0.6 }]}
              disabled={loading}
              onPress={onSend}>
              {loading ? (
                <ActivityIndicator color={t.primaryText} />
              ) : (
                <Text style={[styles.btnText, { color: t.primaryText }]}>Enviar link</Text>
              )}
            </Pressable>

            <Link href="/(auth)/login" style={styles.link}>
              <Text style={[styles.linkText, { color: t.primary }]}>Voltar pro login</Text>
            </Link>
          </>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  inner: { flex: 1, padding: 24, justifyContent: 'center' },
  title: { fontSize: 28, fontWeight: '800', marginBottom: 8, textAlign: 'center' },
  subtitle: { textAlign: 'center', marginBottom: 32, lineHeight: 20 },
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
  successBox: {
    padding: 20,
    borderRadius: 14,
    borderWidth: 1,
  },
  successTitle: { fontSize: 16, fontWeight: '800', marginBottom: 8 },
  successText: { fontSize: 14, lineHeight: 20 },
});
