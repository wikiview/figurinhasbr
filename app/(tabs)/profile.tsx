import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/src/providers/AuthProvider';
import { supabase } from '@/src/lib/supabase';
import { useTheme } from '@/src/hooks/useTheme';
import { useCardMode, useThemePref } from '@/src/hooks/usePreferences';
import { buildExportText, type ExportMode } from '@/src/lib/export';
import type { Sticker } from '@/src/lib/types';
import { OptionPicker } from '@/src/components/OptionPicker';
import { BRAZIL_STATES } from '@/src/data/brazil-states';
import { getCitiesByUF } from '@/src/lib/cities';
import { validateDisplayName } from '@/src/lib/profanity';
import {
  ACHIEVEMENTS,
  ACHIEVEMENT_META,
  type AchievementCode,
  loadAchievements,
} from '@/src/lib/achievements';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { PaywallModal } from '@/src/components/PaywallModal';
import { getPremiumOffering, type PremiumOffering } from '@/src/lib/purchases';

export default function ProfileScreen() {
  const { session, profile, refreshProfile, signOut } = useAuth();
  const t = useTheme();
  const { mode: cardMode, setMode: setCardMode } = useCardMode();
  const { pref: themePref, setPref: setThemePref } = useThemePref();

  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [stateUF, setStateUF] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [saving, setSaving] = useState(false);
  const [sharing, setSharing] = useState<ExportMode | null>(null);
  const [cities, setCities] = useState<string[]>([]);
  const [citiesLoading, setCitiesLoading] = useState(false);
  const [achievements, setAchievements] = useState<Set<AchievementCode>>(
    new Set(),
  );
  const [paywallOpen, setPaywallOpen] = useState(false);
  const [premiumOffering, setPremiumOffering] = useState<PremiumOffering | null>(null);

  useEffect(() => {
    let cancelled = false;
    getPremiumOffering()
      .then((o) => {
        if (!cancelled) setPremiumOffering(o);
      })
      .catch(() => {
        if (!cancelled) setPremiumOffering(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!session?.user.id) return;
    loadAchievements(session.user.id).then(setAchievements).catch(() => {});
  }, [session?.user.id]);

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

  async function onShare(mode: ExportMode) {
    if (!session?.user.id) return;
    setSharing(mode);
    try {
      const [{ data: sList }, { data: usList }] = await Promise.all([
        supabase.from('stickers').select('*').order('display_order'),
        supabase.from('user_stickers').select('sticker_id,qty').eq('user_id', session.user.id),
      ]);
      const map: Record<string, number> = {};
      (usList ?? []).forEach((r: { sticker_id: string; qty: number }) => {
        map[r.sticker_id] = r.qty;
      });
      const text = buildExportText(
        (sList ?? []) as Sticker[],
        map,
        mode,
        profile?.display_name,
      );
      await Share.share({ message: text });
    } catch (e: any) {
      Alert.alert('Erro ao compartilhar', e?.message ?? 'Tenta de novo.');
    } finally {
      setSharing(null);
    }
  }

  useEffect(() => {
    if (profile) {
      setName(profile.display_name);
      setCity(profile.city);
      setStateUF((profile.state ?? '').toUpperCase());
      setWhatsapp(profile.whatsapp ?? '');
    }
  }, [profile]);

  async function onSave() {
    if (!session?.user.id) return;
    if (!name || !city || !stateUF) {
      Alert.alert('Faltam dados', 'Nome, cidade e UF são obrigatórios.');
      return;
    }
    const nameCheck = validateDisplayName(name);
    if (!nameCheck.ok) {
      Alert.alert('Nome inválido', nameCheck.reason);
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from('profiles')
      .update({
        display_name: name.trim(),
        city,
        state: stateUF.toUpperCase(),
        whatsapp: whatsapp.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', session.user.id);
    setSaving(false);
    if (error) {
      Alert.alert('Erro', error.message);
      return;
    }
    await refreshProfile();
    Alert.alert('Pronto', 'Perfil atualizado.');
  }

  if (!profile) {
    return (
      <View style={[styles.center, { backgroundColor: t.bg }]}>
        <ActivityIndicator />
      </View>
    );
  }

  const inputStyle = [
    styles.input,
    { backgroundColor: t.surfaceAlt, borderColor: t.border, color: t.text },
  ];

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: t.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.inner} keyboardShouldPersistTaps="handled">
        <Text style={[styles.title, { color: t.text }]}>Seu perfil</Text>
        <Text style={[styles.email, { color: t.textMuted }]}>{session?.user.email}</Text>

        {achievements.has(ACHIEVEMENTS.ELITE_COLLECTOR) && (
          <View style={styles.achievementBadge}>
            <View style={styles.achievementMedal}>
              <MaterialCommunityIcons name="medal" size={26} color="#facc15" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.achievementTitle}>
                {ACHIEVEMENT_META.elite_collector.title}
              </Text>
              <Text style={styles.achievementSubtitle}>
                {ACHIEVEMENT_META.elite_collector.subtitle}
              </Text>
            </View>
          </View>
        )}

        <Text style={[styles.label, { color: t.text }]}>Nome</Text>
        <TextInput
          style={inputStyle}
          value={name}
          onChangeText={setName}
          maxLength={30}
          placeholderTextColor={t.textFaint}
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

        <Text style={[styles.label, { color: t.text }]}>WhatsApp (DDD + número)</Text>
        <TextInput
          style={inputStyle}
          value={whatsapp}
          onChangeText={setWhatsapp}
          keyboardType="phone-pad"
          placeholder="11999998888"
          placeholderTextColor={t.textFaint}
        />
        <Text style={[styles.hint, { color: t.textFaint }]}>
          Opcional. Se preencher, outros usuários conseguem te chamar pra trocar.
        </Text>

        <Pressable
          style={[styles.btn, { backgroundColor: t.primary }, saving && { opacity: 0.6 }]}
          disabled={saving}
          onPress={onSave}>
          {saving ? (
            <ActivityIndicator color={t.primaryText} />
          ) : (
            <Text style={[styles.btnText, { color: t.primaryText }]}>Salvar</Text>
          )}
        </Pressable>

        {/* === PREFERÊNCIAS === */}
        <Text style={[styles.sectionTitle, { color: t.text }]}>Preferências</Text>

        <Text style={[styles.label, { color: t.text }]}>Modo de marcar figurinha</Text>
        <Segmented
          options={[
            { key: 'modal', label: 'Modo animado', icon: 'expand' },
            { key: 'inline', label: 'Botões no card', icon: 'add-circle' },
          ]}
          value={cardMode}
          onChange={(v) => setCardMode(v as 'modal' | 'inline')}
          theme={t}
        />

        <Text style={[styles.label, { color: t.text, marginTop: 16 }]}>Tema</Text>
        <Segmented
          options={[
            { key: 'light', label: 'Claro', icon: 'sunny' },
            { key: 'dark', label: 'Escuro', icon: 'moon' },
            { key: 'system', label: 'Sistema', icon: 'phone-portrait' },
          ]}
          value={themePref}
          onChange={(v) => setThemePref(v as 'light' | 'dark' | 'system')}
          theme={t}
        />

        {/* === COMPARTILHAR === */}
        <Text style={[styles.sectionTitle, { color: t.text }]}>Compartilhar coleção</Text>
        <Text style={[styles.hint, { color: t.textFaint, marginBottom: 12 }]}>
          Gera o texto formatado pra mandar no zap (igual aquela lista que circula).
        </Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <ShareBtn
            label="O que falta"
            icon="paper-plane"
            loading={sharing === 'missing'}
            onPress={() => onShare('missing')}
            theme={t}
          />
          <ShareBtn
            label="Repetidas"
            icon="swap-horizontal"
            loading={sharing === 'duplicates'}
            onPress={() => onShare('duplicates')}
            theme={t}
          />
        </View>

        {/* === PREMIUM === */}
        <Text style={[styles.sectionTitle, { color: t.text }]}>Premium</Text>
        {profile.is_premium ? (
          <View
            style={[
              styles.premiumActiveCard,
              {
                backgroundColor: t.haveBg,
                borderColor: t.haveBorder,
              },
            ]}>
            <View style={styles.premiumActiveHeader}>
              <Ionicons name="checkmark-circle" size={22} color={t.haveText} />
              <Text style={[styles.premiumActiveTitle, { color: t.haveText }]}>
                Premium ativo
              </Text>
            </View>
            <Text style={[styles.premiumActiveSub, { color: t.haveText }]}>
              Sem anúncios, scan ilimitado, capas com IA.
            </Text>
          </View>
        ) : (
          <View
            style={[
              styles.premiumCtaCard,
              { backgroundColor: t.surface, borderColor: t.border },
            ]}>
            <View style={styles.premiumCtaHeader}>
              <View
                style={[
                  styles.premiumCtaIcon,
                  { backgroundColor: t.surfaceAlt, borderColor: t.border },
                ]}>
                <Ionicons name="sparkles" size={20} color={t.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.premiumCtaTitle, { color: t.text }]}>
                  Ativar Premium
                </Text>
                <Text style={[styles.premiumCtaPrice, { color: t.textMuted }]}>
                  {premiumOffering?.priceString ?? 'R$ 14,90'} · vitalício
                </Text>
              </View>
            </View>
            <View style={styles.premiumBullets}>
              <PremiumBullet text="Sem anúncios" color={t.primary} textColor={t.textMuted} />
              <PremiumBullet text="Scan ilimitado" color={t.primary} textColor={t.textMuted} />
              <PremiumBullet text="Capas com IA" color={t.primary} textColor={t.textMuted} />
            </View>
            <Pressable
              onPress={() => setPaywallOpen(true)}
              style={[styles.premiumCtaBtn, { backgroundColor: t.primary }]}>
              <Text style={[styles.premiumCtaBtnText, { color: t.primaryText }]}>
                Saber mais
              </Text>
              <Ionicons name="arrow-forward" size={16} color={t.primaryText} />
            </Pressable>
          </View>
        )}

        <Pressable style={styles.signOut} onPress={signOut}>
          <Text style={styles.signOutText}>Sair</Text>
        </Pressable>

        <Text style={[styles.disclaimer, { color: t.textFaint }]}>
          App não oficial. Sem afiliação, patrocínio ou endosso da FIFA ou da Panini.
        </Text>

        <PaywallModal visible={paywallOpen} onClose={() => setPaywallOpen(false)} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function PremiumBullet({
  text,
  color,
  textColor,
}: {
  text: string;
  color: string;
  textColor: string;
}) {
  return (
    <View style={styles.bulletRow}>
      <Ionicons name="checkmark" size={14} color={color} />
      <Text style={[styles.bulletText, { color: textColor }]}>{text}</Text>
    </View>
  );
}

function ShareBtn({
  label,
  icon,
  loading,
  onPress,
  theme,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  loading: boolean;
  onPress: () => void;
  theme: ReturnType<typeof useTheme>;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={loading}
      style={[
        styles.shareBtn,
        { backgroundColor: theme.surface, borderColor: theme.border },
        loading && { opacity: 0.6 },
      ]}>
      {loading ? (
        <ActivityIndicator color={theme.primary} />
      ) : (
        <>
          <Ionicons name={icon} size={18} color={theme.primary} />
          <Text style={[styles.shareBtnText, { color: theme.text }]}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

function Segmented<T extends string>({
  options,
  value,
  onChange,
  theme,
}: {
  options: { key: T; label: string; icon: keyof typeof Ionicons.glyphMap }[];
  value: T;
  onChange: (v: T) => void;
  theme: ReturnType<typeof useTheme>;
}) {
  return (
    <View style={[styles.segmented, { backgroundColor: theme.surfaceAlt, borderColor: theme.border }]}>
      {options.map((o) => {
        const active = value === o.key;
        return (
          <Pressable
            key={o.key}
            onPress={() => onChange(o.key)}
            style={[styles.segItem, active && { backgroundColor: theme.primary }]}>
            <Ionicons
              name={o.icon}
              size={14}
              color={active ? theme.primaryText : theme.textMuted}
              style={{ marginRight: 6 }}
            />
            <Text
              style={[
                styles.segText,
                { color: active ? theme.primaryText : theme.textMuted },
              ]}
              numberOfLines={1}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  inner: { padding: 20, paddingBottom: 80 },
  title: { fontSize: 24, fontWeight: '800' },
  email: { marginTop: 4, marginBottom: 24 },
  label: { fontWeight: '600', marginTop: 12, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
  },
  hint: { fontSize: 12, marginTop: 4 },
  btn: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 24,
  },
  btnText: { fontWeight: '700', fontSize: 16 },

  sectionTitle: { fontSize: 16, fontWeight: '800', marginTop: 32, marginBottom: 4 },
  segmented: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 4,
    borderWidth: 1,
    gap: 4,
  },
  segItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderRadius: 8,
  },
  segText: { fontWeight: '700', fontSize: 12 },

  shareBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  shareBtnText: { fontWeight: '700', fontSize: 13 },

  premiumActiveCard: {
    marginTop: 8,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
  },
  premiumActiveHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  premiumActiveTitle: { fontSize: 15, fontWeight: '800' },
  premiumActiveSub: { fontSize: 12, fontWeight: '500' },

  premiumCtaCard: {
    marginTop: 8,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    gap: 14,
  },
  premiumCtaHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  premiumCtaIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  premiumCtaTitle: { fontSize: 16, fontWeight: '800' },
  premiumCtaPrice: { fontSize: 12, fontWeight: '600', marginTop: 2 },
  premiumBullets: { gap: 6 },
  bulletRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  bulletText: { fontSize: 13, fontWeight: '600' },
  premiumCtaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
  },
  premiumCtaBtnText: { fontWeight: '800', fontSize: 14 },

  signOut: { marginTop: 32, alignItems: 'center' },
  signOutText: { color: '#ef4444', fontWeight: '700' },
  disclaimer: {
    fontSize: 11,
    textAlign: 'center',
    marginTop: 24,
    lineHeight: 15,
  },

  achievementBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 14,
    borderRadius: 16,
    backgroundColor: 'rgba(11,29,58,0.92)',
    borderWidth: 1.5,
    borderColor: 'rgba(250,204,21,0.6)',
    marginBottom: 8,
    shadowColor: '#facc15',
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
  },
  achievementMedal: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(250,204,21,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(250,204,21,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  achievementTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '900',
  },
  achievementSubtitle: {
    color: '#cbd5e1',
    fontSize: 12,
    marginTop: 2,
  },
});
