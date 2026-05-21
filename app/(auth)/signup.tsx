import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Link } from 'expo-router';
import { supabase } from '@/src/lib/supabase';
import { useTheme } from '@/src/hooks/useTheme';
import { OptionPicker } from '@/src/components/OptionPicker';
import { BRAZIL_STATES } from '@/src/data/brazil-states';
import { getCitiesByUF } from '@/src/lib/cities';
import { validateDisplayName } from '@/src/lib/profanity';

export default function SignupScreen() {
  const t = useTheme();
  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [stateUF, setStateUF] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [cities, setCities] = useState<string[]>([]);
  const [citiesLoading, setCitiesLoading] = useState(false);

  const stateOptions = useMemo(
    () => BRAZIL_STATES.map((s) => ({ value: s.uf, label: `${s.name} (${s.uf})` })),
    [],
  );
  const cityOptions = useMemo(
    () => cities.map((c) => ({ value: c, label: c })),
    [cities],
  );

  useEffect(() => {
    if (!stateUF) {
      setCities([]);
      return;
    }
    let cancelled = false;
    setCitiesLoading(true);
    getCitiesByUF(stateUF)
      .then((list) => {
        if (!cancelled) setCities(list);
      })
      .catch(() => {
        if (!cancelled) setCities([]);
      })
      .finally(() => {
        if (!cancelled) setCitiesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [stateUF]);

  async function onSignup() {
    if (!name || !city || !stateUF || !email || !password) {
      Alert.alert(
        'Faltam dados',
        'Preencha tudo — cidade/UF é o que conecta você com outros colecionadores.',
      );
      return;
    }
    const nameCheck = validateDisplayName(name);
    if (!nameCheck.ok) {
      Alert.alert('Nome inválido', nameCheck.reason);
      return;
    }
    if (password.length < 6) {
      Alert.alert('Senha curta', 'Mínimo 6 caracteres.');
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          display_name: name.trim(),
          city,
          state: stateUF.toUpperCase(),
        },
      },
    });
    setLoading(false);
    if (error) {
      Alert.alert('Erro no cadastro', error.message);
      return;
    }
    Alert.alert('Quase lá!', 'Confirme o email se a Supabase pediu, e depois faça login.');
  }

  const inputStyle = [
    styles.input,
    { backgroundColor: t.surfaceAlt, borderColor: t.border, color: t.text },
  ];

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: t.bg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.inner} keyboardShouldPersistTaps="handled">
        <Text style={[styles.title, { color: t.text }]}>Criar conta</Text>
        <Text style={[styles.intro, { color: t.textMuted }]}>
          A cidade/UF é o que liga você com outros colecionadores perto pra trocar figurinha.
        </Text>

        <Text style={[styles.label, { color: t.text }]}>Nome</Text>
        <TextInput
          style={inputStyle}
          placeholder="Como você quer ser chamado"
          placeholderTextColor={t.textFaint}
          value={name}
          onChangeText={setName}
          maxLength={30}
        />

        <Text style={[styles.label, { color: t.text }]}>Estado (UF)</Text>
        <OptionPicker
          value={stateUF}
          placeholder="Selecione o estado"
          modalTitle="Estado"
          searchPlaceholder="Buscar estado…"
          options={stateOptions}
          onChange={(uf) => {
            if (uf !== stateUF) {
              setStateUF(uf);
              setCity('');
            }
          }}
        />

        <Text style={[styles.label, { color: t.text }]}>Cidade</Text>
        <OptionPicker
          value={city}
          placeholder={stateUF ? 'Selecione a cidade' : 'Escolha o estado primeiro'}
          modalTitle="Cidade"
          searchPlaceholder="Buscar cidade…"
          options={cityOptions}
          onChange={setCity}
          disabled={!stateUF || citiesLoading}
          loading={citiesLoading}
          emptyText={
            !stateUF
              ? 'Escolha o estado primeiro.'
              : citiesLoading
              ? 'Carregando cidades…'
              : 'Nenhuma cidade encontrada.'
          }
        />

        <Text style={[styles.label, { color: t.text }]}>Email</Text>
        <TextInput
          style={inputStyle}
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
          style={inputStyle}
          placeholder="Mínimo 6 caracteres"
          placeholderTextColor={t.textFaint}
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />

        <Pressable
          style={[styles.btn, { backgroundColor: t.primary }, loading && { opacity: 0.6 }]}
          disabled={loading}
          onPress={onSignup}>
          {loading ? (
            <ActivityIndicator color={t.primaryText} />
          ) : (
            <Text style={[styles.btnText, { color: t.primaryText }]}>Cadastrar</Text>
          )}
        </Pressable>

        <Link href="/(auth)/login" style={styles.link}>
          <Text style={[styles.linkText, { color: t.primary }]}>Já tenho conta</Text>
        </Link>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  inner: { padding: 24, paddingTop: 64, paddingBottom: 48 },
  title: { fontSize: 28, fontWeight: '800', marginBottom: 8 },
  intro: { fontSize: 14, marginBottom: 24, lineHeight: 20 },
  label: { fontSize: 13, fontWeight: '600', marginBottom: 6, marginTop: 8 },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
  },
  row: { flexDirection: 'row' },
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
