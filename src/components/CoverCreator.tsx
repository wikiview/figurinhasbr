import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import { useAuth } from '@/src/providers/AuthProvider';
import { useTheme } from '@/src/hooks/useTheme';
import { flagUrl } from '@/src/lib/flags';
import { PaywallModal } from '@/src/components/PaywallModal';
import { ACHIEVEMENTS, loadAchievements } from '@/src/lib/achievements';
import { showRewarded } from '@/src/lib/ads';

type CoverVariant = 'standard' | 'elite';

type Props = {
  visible: boolean;
  onClose: () => void;
  onCreated?: (coverUrl: string) => void;
  /** Pré-seleciona a variante. Default: 'standard'. Elite só é aceito se o user tem o achievement. */
  initialVariant?: CoverVariant;
};

type Step = 'team' | 'photo' | 'result';

// Lista das 48 seleções (sincronizada com src/data/stickers-seed.ts)
const TEAMS: { code: string; name: string }[] = [
  { code: 'MEX', name: 'México' }, { code: 'RSA', name: 'África do Sul' },
  { code: 'KOR', name: 'Coreia do Sul' }, { code: 'CZE', name: 'República Tcheca' },
  { code: 'CAN', name: 'Canadá' }, { code: 'BIH', name: 'Bósnia e Herzegovina' },
  { code: 'QAT', name: 'Catar' }, { code: 'SUI', name: 'Suíça' },
  { code: 'BRA', name: 'Brasil' }, { code: 'MAR', name: 'Marrocos' },
  { code: 'HAI', name: 'Haiti' }, { code: 'SCO', name: 'Escócia' },
  { code: 'USA', name: 'Estados Unidos' }, { code: 'PAR', name: 'Paraguai' },
  { code: 'AUS', name: 'Austrália' }, { code: 'TUR', name: 'Turquia' },
  { code: 'GER', name: 'Alemanha' }, { code: 'CUW', name: 'Curaçao' },
  { code: 'CIV', name: 'Costa do Marfim' }, { code: 'ECU', name: 'Equador' },
  { code: 'NED', name: 'Holanda' }, { code: 'JPN', name: 'Japão' },
  { code: 'SWE', name: 'Suécia' }, { code: 'TUN', name: 'Tunísia' },
  { code: 'BEL', name: 'Bélgica' }, { code: 'EGY', name: 'Egito' },
  { code: 'IRN', name: 'Irã' }, { code: 'NZL', name: 'Nova Zelândia' },
  { code: 'ESP', name: 'Espanha' }, { code: 'CPV', name: 'Cabo Verde' },
  { code: 'KSA', name: 'Arábia Saudita' }, { code: 'URU', name: 'Uruguai' },
  { code: 'FRA', name: 'França' }, { code: 'SEN', name: 'Senegal' },
  { code: 'IRQ', name: 'Iraque' }, { code: 'NOR', name: 'Noruega' },
  { code: 'ARG', name: 'Argentina' }, { code: 'ALG', name: 'Argélia' },
  { code: 'AUT', name: 'Áustria' }, { code: 'JOR', name: 'Jordânia' },
  { code: 'POR', name: 'Portugal' }, { code: 'COD', name: 'Rep. Dem. do Congo' },
  { code: 'UZB', name: 'Uzbequistão' }, { code: 'COL', name: 'Colômbia' },
  { code: 'ENG', name: 'Inglaterra' }, { code: 'CRO', name: 'Croácia' },
  { code: 'GHA', name: 'Gana' }, { code: 'PAN', name: 'Panamá' },
];

export function CoverCreator({
  visible,
  onClose,
  onCreated,
  initialVariant = 'standard',
}: Props) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { session, profile, refreshProfile } = useAuth();

  const [step, setStep] = useState<Step>('team');
  const [teamCode, setTeamCode] = useState<string | null>(null);
  const [selfieB64, setSelfieB64] = useState<string | null>(null);
  const [selfieMimeType, setSelfieMimeType] = useState<string | null>(null);
  const [selfieUri, setSelfieUri] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [paywallOpen, setPaywallOpen] = useState(false);
  const [variant, setVariant] = useState<CoverVariant>(initialVariant);
  const [hasElite, setHasElite] = useState(false);
  // Dados extras pro estilo Panini
  const [dob, setDob] = useState('');
  const [heightM, setHeightM] = useState('');
  const [weightKg, setWeightKg] = useState('');

  // Sincroniza a variante inicial quando o modal abre
  useEffect(() => {
    if (visible) {
      setVariant(initialVariant);
    }
  }, [visible, initialVariant]);

  // Verifica se user tem o achievement elite_collector pra mostrar a opção
  useEffect(() => {
    if (!visible || !session?.user.id) return;
    let cancelled = false;
    loadAchievements(session.user.id)
      .then((set) => {
        if (!cancelled) setHasElite(set.has(ACHIEVEMENTS.ELITE_COLLECTOR));
      })
      .catch(() => {
        if (!cancelled) setHasElite(false);
      });
    return () => {
      cancelled = true;
    };
  }, [visible, session?.user.id]);

  useEffect(() => {
    if (!visible) {
      setTimeout(() => {
        setStep('team');
        setTeamCode(null);
        setSelfieB64(null);
        setSelfieMimeType(null);
        setSelfieUri(null);
        setResultUrl(null);
        setGenerating(false);
        setDob('');
        setHeightM('');
        setWeightKg('');
      }, 200);
    }
  }, [visible]);

  // Derivados pra UX da capa Elite:
  //  - Premium: ilimitado, sem ad.
  //  - Free com achievement e cota não usada: 1 grátis após rewarded ad.
  //  - Free com cota já usada: paywall.
  const isPremium = !!profile?.is_premium;
  const eliteUsed = (profile?.elite_covers_generated ?? 0) >= 1;
  const eliteNeedsAd = variant === 'elite' && !isPremium && !eliteUsed;
  const eliteBlockedFree = variant === 'elite' && !isPremium && eliteUsed;

  async function pickFromCamera() {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permissão negada', 'Precisamos da câmera pra tirar a selfie.');
      return;
    }
    const r = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
      base64: true,
      cameraType: ImagePicker.CameraType.front,
    });
    if (!r.canceled && r.assets[0]) {
      setSelfieB64(r.assets[0].base64 ?? null);
      setSelfieMimeType(r.assets[0].mimeType ?? null);
      setSelfieUri(r.assets[0].uri);
    }
  }

  async function pickFromGallery() {
    const r = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
      base64: true,
    });
    if (!r.canceled && r.assets[0]) {
      setSelfieB64(r.assets[0].base64 ?? null);
      setSelfieMimeType(r.assets[0].mimeType ?? null);
      setSelfieUri(r.assets[0].uri);
    }
  }

  async function generate() {
    if (!selfieB64 || !teamCode || !session?.access_token) return;
    const isPremium = !!profile?.is_premium;

    // Gate Premium SÓ pra variante standard.
    if (variant === 'standard' && !isPremium) {
      setPaywallOpen(true);
      return;
    }

    // Gate Elite pra free user: tem direito a 1 geração, atrás de rewarded ad.
    // Premium é ilimitado e não vê ad. O server tem o mesmo guard com SERVICE_ROLE
    // (anti-tampering) — esse check aqui é só pra UX.
    if (variant === 'elite' && !isPremium) {
      const used = profile?.elite_covers_generated ?? 0;
      if (used >= 1) {
        setPaywallOpen(true);
        return;
      }
      const earned = await showRewarded(false);
      if (!earned) {
        Alert.alert(
          'Anúncio cancelado',
          'Pra liberar sua capa dourada grátis, vê o anúncio até o fim.',
        );
        return;
      }
    }

    setGenerating(true);
    setStep('result');
    try {
      const team = TEAMS.find((tt) => tt.code === teamCode)!;
      const supabaseUrl =
        process.env.EXPO_PUBLIC_SUPABASE_URL ??
        (Constants.expoConfig?.extra as any)?.supabaseUrl ?? '';
      const res = await fetch(`${supabaseUrl}/functions/v1/generate-cover`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          selfie_base64: selfieB64,
          selfie_mime_type: selfieMimeType,
          team_code: team.code,
          team_name: team.name,
          variant,
          player_name: profile?.display_name ?? null,
          dob: dob.trim() || null,
          height_m: heightM.trim() || null,
          weight_kg: weightKg.trim() || null,
        }),
      });
      // Resposta é JSON em qualquer caso (sucesso ou erro estruturado).
      // Se não conseguiu parsear (ex: 5xx do edge runtime), cai no fallback amigável.
      let data: any = null;
      try {
        data = await res.json();
      } catch {
        data = null;
      }
      if (!res.ok || !data?.cover_url) {
        // user_message é texto curto e amigável vindo do backend.
        // NUNCA expõe `detail` (pode conter payload bruto do Gemini).
        const friendly =
          data?.user_message ??
          'A IA não conseguiu gerar agora. Tenta de novo em alguns segundos.';
        // Quota Elite estourada (server confirma): leva direto pro paywall.
        if (data?.error === 'elite_quota_exhausted') {
          setStep('photo');
          await refreshProfile();
          setPaywallOpen(true);
          return;
        }
        Alert.alert('Não rolou', friendly);
        setStep('photo');
        return;
      }
      setResultUrl(data.cover_url);
      await refreshProfile();
      onCreated?.(data.cover_url);
    } catch {
      // Erros de rede / fetch — não temos payload do backend.
      Alert.alert(
        'Sem conexão',
        'Não consegui falar com o servidor. Verifica a internet e tenta de novo.',
      );
      setStep('photo');
    } finally {
      setGenerating(false);
    }
  }

  function regenerate() {
    setResultUrl(null);
    generate();
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.container, { backgroundColor: t.bg, paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Pressable onPress={onClose} hitSlop={12} style={[styles.closeBtn, { backgroundColor: t.surfaceAlt }]}>
            <Ionicons name="close" size={20} color={t.textMuted} />
          </Pressable>
          <Text style={[styles.title, { color: t.text }]}>
            {step === 'team' ? 'Escolha sua seleção' : step === 'photo' ? 'Sua selfie' : 'Sua capa'}
          </Text>
          <View style={{ width: 32 }} />
        </View>

        {step === 'team' && (
          <View style={{ flex: 1 }}>
            <FlatList
              data={TEAMS}
              keyExtractor={(item) => item.code}
              numColumns={3}
              contentContainerStyle={{ padding: 12, paddingBottom: 100 }}
              columnWrapperStyle={{ gap: 8, marginBottom: 8 }}
              ListHeaderComponent={
                hasElite ? (
                  <View style={styles.variantChooser}>
                    <Text style={[styles.variantChooserLabel, { color: t.textMuted }]}>
                      Tipo de capa
                    </Text>
                    <View style={styles.variantRow}>
                      <VariantCard
                        active={variant === 'standard'}
                        onPress={() => setVariant('standard')}
                        title="Capa Normal"
                        subtitle="Premium"
                        accent="#0a7ea4"
                        icon="sparkles-outline"
                        theme={t}
                      />
                      <VariantCard
                        active={variant === 'elite'}
                        onPress={() => setVariant('elite')}
                        title="Capa Elite"
                        subtitle={
                          isPremium
                            ? 'Dourada · Ilimitado'
                            : eliteUsed
                            ? 'Premium pra gerar de novo'
                            : '1 grátis · com anúncio'
                        }
                        accent="#facc15"
                        icon="medal"
                        theme={t}
                        gold
                      />
                    </View>
                  </View>
                ) : null
              }
              renderItem={({ item }) => {
                const active = teamCode === item.code;
                const flag = flagUrl(item.code, 160);
                return (
                  <Pressable
                    onPress={() => setTeamCode(item.code)}
                    style={[
                      styles.teamCard,
                      {
                        backgroundColor: active ? t.primary : t.surface,
                        borderColor: active ? t.primary : t.border,
                      },
                    ]}>
                    {flag && <Image source={{ uri: flag }} style={styles.teamFlag} contentFit="cover" />}
                    <Text
                      style={[styles.teamName, { color: active ? t.primaryText : t.text }]}
                      numberOfLines={2}>
                      {item.name}
                    </Text>
                  </Pressable>
                );
              }}
            />
            <View
              style={[
                styles.fixedFooter,
                {
                  backgroundColor: t.bg,
                  borderTopColor: t.border,
                  paddingBottom: insets.bottom + 12,
                },
              ]}>
              <Pressable
                onPress={() => teamCode && setStep('photo')}
                disabled={!teamCode}
                style={[
                  styles.primaryBtn,
                  { backgroundColor: t.primary },
                  !teamCode && { opacity: 0.4 },
                ]}>
                <Text style={[styles.primaryBtnText, { color: t.primaryText }]}>
                  {teamCode
                    ? `Próximo: ${TEAMS.find((tt) => tt.code === teamCode)?.name}`
                    : 'Escolha uma seleção'}
                </Text>
                {teamCode && <Ionicons name="arrow-forward" size={18} color={t.primaryText} />}
              </Pressable>
            </View>
          </View>
        )}

        {step === 'photo' && (
          <ScrollView
            contentContainerStyle={styles.photoWrap}
            keyboardShouldPersistTaps="handled">
            <Text style={[styles.intro, { color: t.textMuted }]}>
              A IA mantém seu rosto e expressão e troca pela camisa de{' '}
              <Text style={{ color: t.text, fontWeight: '700' }}>
                {TEAMS.find((tt) => tt.code === teamCode)?.name}
              </Text>
              .
            </Text>

            <View style={[styles.tipsBox, { backgroundColor: t.surface, borderColor: t.border }]}>
              <Text style={[styles.tipsTitle, { color: t.text }]}>Pra IA acertar a sua cara:</Text>
              <View style={styles.tipRow}>
                <Ionicons name="sunny-outline" size={16} color={t.primary} />
                <Text style={[styles.tipText, { color: t.textMuted }]}>
                  Boa iluminação, evite contraluz e sombra no rosto
                </Text>
              </View>
              <View style={styles.tipRow}>
                <Ionicons name="eye-outline" size={16} color={t.primary} />
                <Text style={[styles.tipText, { color: t.textMuted }]}>
                  Olhe direto pra câmera, rosto de frente e centralizado
                </Text>
              </View>
              <View style={styles.tipRow}>
                <Ionicons name="happy-outline" size={16} color={t.primary} />
                <Text style={[styles.tipText, { color: t.textMuted }]}>
                  Sua expressão natural — sem óculos escuros, máscara ou chapéu
                </Text>
              </View>
            </View>

            {selfieUri ? (
              <Image source={{ uri: selfieUri }} style={styles.preview} contentFit="cover" />
            ) : (
              <View style={[styles.previewPlaceholder, { backgroundColor: t.surfaceAlt, borderColor: t.border }]}>
                <Ionicons name="person" size={64} color={t.textFaint} />
              </View>
            )}
            <View style={styles.actionsRow}>
              <Pressable
                onPress={pickFromCamera}
                style={[styles.action, { backgroundColor: t.surface, borderColor: t.border }]}>
                <Ionicons name="camera" size={22} color={t.primary} />
                <Text style={[styles.actionText, { color: t.text }]}>Tirar selfie</Text>
              </Pressable>
              <Pressable
                onPress={pickFromGallery}
                style={[styles.action, { backgroundColor: t.surface, borderColor: t.border }]}>
                <Ionicons name="images" size={22} color={t.primary} />
                <Text style={[styles.actionText, { color: t.text }]}>Galeria</Text>
              </Pressable>
            </View>

            {/* Dados extras estilo Panini (todos opcionais) */}
            <View style={[styles.statsBox, { backgroundColor: t.surface, borderColor: t.border }]}>
              <Text style={[styles.statsHint, { color: t.textMuted }]}>
                Aparecem na figurinha. Tudo opcional — o que deixar em branco a IA preenche aleatório.
              </Text>
              <Text style={[styles.fieldLabel, { color: t.text }]}>Data de nascimento</Text>
              <TextInput
                style={[styles.field, { backgroundColor: t.surfaceAlt, color: t.text, borderColor: t.border }]}
                placeholder="ex: 12-7-2000"
                placeholderTextColor={t.textFaint}
                value={dob}
                onChangeText={setDob}
              />
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.fieldLabel, { color: t.text }]}>Altura (m)</Text>
                  <TextInput
                    style={[styles.field, { backgroundColor: t.surfaceAlt, color: t.text, borderColor: t.border }]}
                    placeholder="1,76"
                    placeholderTextColor={t.textFaint}
                    keyboardType="decimal-pad"
                    value={heightM}
                    onChangeText={setHeightM}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.fieldLabel, { color: t.text }]}>Peso (kg)</Text>
                  <TextInput
                    style={[styles.field, { backgroundColor: t.surfaceAlt, color: t.text, borderColor: t.border }]}
                    placeholder="73"
                    placeholderTextColor={t.textFaint}
                    keyboardType="number-pad"
                    value={weightKg}
                    onChangeText={setWeightKg}
                  />
                </View>
              </View>
            </View>

            {selfieB64 && (
              <>
                {eliteNeedsAd && (
                  <Text style={[styles.adNotice, { color: t.textMuted }]}>
                    Sua capa dourada grátis libera após um anúncio rápido.
                  </Text>
                )}
                <Pressable
                  onPress={generate}
                  style={[styles.primaryBtn, { backgroundColor: t.primary, marginTop: eliteNeedsAd ? 8 : 16 }]}>
                  <Ionicons
                    name={eliteNeedsAd ? 'play-circle' : 'sparkles'}
                    size={18}
                    color={t.primaryText}
                  />
                  <Text style={[styles.primaryBtnText, { color: t.primaryText }]}>
                    {eliteNeedsAd
                      ? 'Ver anúncio e gerar'
                      : eliteBlockedFree
                      ? 'Ativar Premium pra gerar'
                      : 'Gerar com IA'}
                  </Text>
                </Pressable>
              </>
            )}
          </ScrollView>
        )}

        {step === 'result' && (
          <View style={{ flex: 1 }}>
            {generating ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator size="large" color={t.primary} />
                <Text style={[styles.loadingText, { color: t.textMuted }]}>
                  Gerando sua capa, aguarde.
                </Text>
              </View>
            ) : resultUrl ? (
              <>
                <View style={styles.bigImageWrap}>
                  <Image
                    source={{ uri: resultUrl }}
                    style={styles.bigImage}
                    contentFit="contain"
                  />
                </View>
                <View
                  style={[
                    styles.fixedFooter,
                    {
                      backgroundColor: t.bg,
                      borderTopColor: t.border,
                      paddingBottom: insets.bottom + 12,
                    },
                  ]}>
                  <Text style={[styles.resultTitle, { color: t.textMuted }]}>
                    Salva no seu perfil ✓
                  </Text>
                  <View style={styles.actionsRow}>
                    <Pressable
                      onPress={regenerate}
                      style={[styles.action, { backgroundColor: t.surface, borderColor: t.border }]}>
                      <Ionicons name="refresh" size={22} color={t.primary} />
                      <Text style={[styles.actionText, { color: t.text }]}>Gerar outra</Text>
                    </Pressable>
                    <Pressable
                      onPress={onClose}
                      style={[styles.action, { backgroundColor: t.primary, borderColor: t.primary }]}>
                      <Ionicons name="checkmark" size={22} color={t.primaryText} />
                      <Text style={[styles.actionText, { color: t.primaryText }]}>Tô feliz</Text>
                    </Pressable>
                  </View>
                </View>
              </>
            ) : null}
          </View>
        )}

        <PaywallModal
          visible={paywallOpen}
          onClose={() => setPaywallOpen(false)}
          onPurchased={() => {
            /* usuário pode reapertar 'Gerar com IA' manualmente após a compra */
          }}
        />
      </View>
    </Modal>
  );
}

function VariantCard({
  active,
  onPress,
  title,
  subtitle,
  accent,
  icon,
  theme,
  gold,
}: {
  active: boolean;
  onPress: () => void;
  title: string;
  subtitle: string;
  accent: string;
  icon: keyof typeof Ionicons.glyphMap;
  theme: ReturnType<typeof useTheme>;
  gold?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.variantCard,
        {
          backgroundColor: active ? (gold ? '#fffbeb' : theme.surface) : theme.surface,
          borderColor: active ? accent : theme.border,
          borderWidth: active ? 2 : 1,
        },
      ]}>
      <View
        style={[
          styles.variantIcon,
          { backgroundColor: gold ? 'rgba(250,204,21,0.18)' : theme.surfaceAlt },
        ]}>
        <Ionicons name={icon} size={20} color={accent} />
      </View>
      <Text
        style={[
          styles.variantTitle,
          { color: gold && active ? '#92400e' : theme.text },
        ]}>
        {title}
      </Text>
      <Text style={[styles.variantSubtitle, { color: theme.textMuted }]}>
        {subtitle}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  closeBtn: {
    width: 32, height: 32, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
  },
  title: { fontSize: 18, fontWeight: '800' },

  teamCard: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: 14,
    borderWidth: 1,
    padding: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },

  variantChooser: {
    paddingHorizontal: 4,
    paddingTop: 4,
    paddingBottom: 12,
  },
  variantChooserLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 8,
    marginLeft: 4,
  },
  variantRow: {
    flexDirection: 'row',
    gap: 10,
  },
  variantCard: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 12,
    alignItems: 'center',
    gap: 6,
  },
  variantIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  variantTitle: { fontSize: 13, fontWeight: '800' },
  variantSubtitle: { fontSize: 11, fontWeight: '600' },

  teamFlag: {
    width: 36, height: 24, borderRadius: 4, marginBottom: 6,
  },
  teamName: { fontSize: 11, fontWeight: '700', textAlign: 'center' },

  photoWrap: { padding: 20, paddingBottom: 40, alignItems: 'center' },
  intro: { fontSize: 13, textAlign: 'center', marginBottom: 12, lineHeight: 18 },
  tipsBox: {
    width: '100%',
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    marginBottom: 4,
  },
  tipsTitle: { fontSize: 12, fontWeight: '700', marginBottom: 10 },
  tipRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 8 },
  tipText: { fontSize: 12, lineHeight: 16, flex: 1 },
  preview: { width: 180, height: 180, borderRadius: 16, marginVertical: 12 },
  previewPlaceholder: {
    width: 180, height: 180, borderRadius: 16, marginVertical: 12,
    borderWidth: 2, borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center',
  },
  statsBox: {
    width: '100%',
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    marginTop: 16,
  },
  statsHint: { fontSize: 11, marginBottom: 12, lineHeight: 15 },
  fieldLabel: { fontSize: 12, fontWeight: '700', marginBottom: 4, marginTop: 4 },
  field: {
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    fontSize: 14,
    marginBottom: 6,
  },
  actionsRow: { flexDirection: 'row', gap: 12, marginVertical: 12, width: '100%' },
  action: {
    flex: 1, borderWidth: 1, borderRadius: 12, padding: 14,
    alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8,
  },
  actionText: { fontWeight: '700', fontSize: 13 },

  primaryBtn: {
    flexDirection: 'row', gap: 8,
    paddingVertical: 14, paddingHorizontal: 24, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center', marginTop: 8,
  },
  primaryBtnText: { fontSize: 15, fontWeight: '800' },
  adNotice: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 14,
    paddingHorizontal: 12,
    lineHeight: 16,
  },

  fixedFooter: {
    position: 'absolute',
    left: 0, right: 0, bottom: 0,
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
  },

  loadingBox: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 20 },
  loadingText: { fontSize: 13, textAlign: 'center', lineHeight: 18 },
  bigImageWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
  },
  bigImage: {
    width: '100%',
    height: '100%',
    borderRadius: 20,
  },
  resultTitle: { fontSize: 13, fontWeight: '700', textAlign: 'center', marginBottom: 8 },
});
