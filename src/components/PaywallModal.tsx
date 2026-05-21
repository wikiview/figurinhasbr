import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import { useAuth } from '@/src/providers/AuthProvider';
import { useTheme } from '@/src/hooks/useTheme';
import {
  getPremiumOffering,
  purchasePremium,
  purchasesAvailable,
  restorePurchases,
  type PremiumOffering,
} from '@/src/lib/purchases';

const PAYWALL_HERO = require('@/assets/images/paywall-hero.png');

const { height: SCREEN_H } = Dimensions.get('window');
// Hero ocupa ~58% da altura. Em telas curtas (< 700) cai pra 50% pro CTA caber sem scroll.
const HERO_HEIGHT = SCREEN_H * (SCREEN_H > 700 ? 0.58 : 0.5);

type Props = {
  visible: boolean;
  onClose: () => void;
  onPurchased?: () => void;
};

const TERMS_URL = 'https://wikiview.github.io/figurinhasbr/privacy-policy';
const FALLBACK_PRICE = 'R$ 14,90';

export function PaywallModal({ visible, onClose, onPurchased }: Props) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { refreshPremiumStatus } = useAuth();

  const [offering, setOffering] = useState<PremiumOffering | null>(null);
  const [loading, setLoading] = useState(false);
  const [restoring, setRestoring] = useState(false);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    getPremiumOffering()
      .then((o) => {
        if (!cancelled) setOffering(o);
      })
      .catch(() => {
        if (!cancelled) setOffering(null);
      });
    return () => {
      cancelled = true;
    };
  }, [visible]);

  async function onBuy() {
    if (!purchasesAvailable || loading) return;
    setLoading(true);
    try {
      const result = await purchasePremium();
      if (result.ok) {
        await refreshPremiumStatus();
        onPurchased?.();
        onClose();
        Alert.alert('Premium ativado!', 'Aproveita.');
        return;
      }
      if (result.cancelled) return; // silencioso
      Alert.alert('Não rolou', result.message ?? 'Tenta de novo.');
    } finally {
      setLoading(false);
    }
  }

  async function onRestore() {
    if (restoring) return;
    setRestoring(true);
    try {
      const status = await restorePurchases();
      if (status.isPremium) {
        await refreshPremiumStatus();
        onClose();
        Alert.alert('Premium restaurado!', 'Bem-vindo de volta.');
      } else {
        Alert.alert(
          'Nenhuma compra encontrada',
          'Não achamos uma compra Premium nessa conta. Se você comprou em outra conta, faça login com ela.',
        );
      }
    } catch (e: any) {
      Alert.alert('Erro ao restaurar', e?.message ?? 'Tenta de novo em alguns minutos.');
    } finally {
      setRestoring(false);
    }
  }

  async function openTerms() {
    try {
      await WebBrowser.openBrowserAsync(TERMS_URL);
    } catch {
      // ignore
    }
  }

  const priceString = offering?.priceString ?? FALLBACK_PRICE;
  const canBuy = purchasesAvailable && !loading;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.container, { backgroundColor: t.bg }]}>
        {/* Close button — sempre por cima, com fundo escuro pra contraste contra a hero image */}
        <Pressable
          onPress={onClose}
          hitSlop={12}
          style={[
            styles.closeBtn,
            {
              top: insets.top + 8,
              backgroundColor: 'rgba(0,0,0,0.45)',
            },
          ]}>
          <Ionicons name="close" size={20} color="#fff" />
        </Pressable>

        <ScrollView
          contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          {/* HERO — imagem ocupa o topo, textos sobrepostos, gradient fade pro fundo sólido */}
          <View style={[styles.heroBox, { height: HERO_HEIGHT }]}>
            <Image
              source={PAYWALL_HERO}
              style={StyleSheet.absoluteFillObject}
              contentFit="cover"
              transition={200}
            />
            {/* Fade do transparente (topo da imagem) pro t.bg (final da imagem) */}
            <LinearGradient
              colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.35)', t.bg]}
              locations={[0.35, 0.75, 1]}
              style={StyleSheet.absoluteFillObject}
            />
            {/* Hero text — ficam na metade de baixo da imagem, sobre o gradient */}
            <View style={styles.heroTextWrap}>
              <Text style={styles.heroTitle}>Desbloqueie tudo</Text>
              <Text style={styles.heroSubtitle}>Um único pagamento. Pra sempre.</Text>
            </View>
          </View>

          {/* Conteúdo no fundo sólido */}
          <View style={styles.body}>
            <View
              style={[styles.benefitsBox, { backgroundColor: t.surface, borderColor: t.border }]}>
              <Benefit
                icon="ban-outline"
                text="Sem anúncios"
                color={t.primary}
                textColor={t.text}
              />
              <Benefit
                icon="infinite"
                text="Scan ilimitado de figurinhas"
                color={t.primary}
                textColor={t.text}
              />
              <Benefit
                icon="sparkles"
                text="Capas com IA pra qualquer seleção"
                color={t.primary}
                textColor={t.text}
              />
            </View>

            <View style={[styles.priceBox, { backgroundColor: t.surface, borderColor: t.border }]}>
              <Text style={[styles.priceLabel, { color: t.textMuted }]}>Preço único</Text>
              <Text style={[styles.priceValue, { color: t.text }]}>{priceString}</Text>
              <Text style={[styles.priceSub, { color: t.textMuted }]}>
                Pagamento único, vale pra sempre
              </Text>
            </View>

            {!purchasesAvailable && (
              <View
                style={[
                  styles.warnBox,
                  { backgroundColor: t.dupBg, borderColor: t.dupBorder },
                ]}>
                <Ionicons name="information-circle-outline" size={16} color={t.dupText} />
                <Text style={[styles.warnText, { color: t.dupText }]}>
                  Pagamentos disponíveis apenas no app instalado (não no Expo Go).
                </Text>
              </View>
            )}

            <Pressable
              onPress={onBuy}
              disabled={!canBuy}
              style={[
                styles.primaryBtn,
                { backgroundColor: t.primary },
                !canBuy && { opacity: 0.5 },
              ]}>
              {loading ? (
                <ActivityIndicator color={t.primaryText} />
              ) : (
                <>
                  <Ionicons name="star" size={18} color={t.primaryText} />
                  <Text style={[styles.primaryBtnText, { color: t.primaryText }]}>
                    Comprar agora
                  </Text>
                </>
              )}
            </Pressable>

            <Pressable
              onPress={onRestore}
              disabled={restoring || !purchasesAvailable}
              style={styles.restoreBtn}>
              {restoring ? (
                <ActivityIndicator color={t.textMuted} />
              ) : (
                <Text style={[styles.restoreText, { color: t.textMuted }]}>
                  Já comprou? Restaurar compras
                </Text>
              )}
            </Pressable>

            <View style={styles.footer}>
              <Text style={[styles.footerText, { color: t.textFaint }]}>
                Pagamento processado pela{' '}
                <Text style={{ fontWeight: '700' }}>App Store / Google Play</Text>. Sem
                renovação automática.
              </Text>
              <Pressable onPress={openTerms} hitSlop={8}>
                <Text style={[styles.footerLink, { color: t.primary }]}>
                  Termos e Privacidade
                </Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

function Benefit({
  icon,
  text,
  color,
  textColor,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  text: string;
  color: string;
  textColor: string;
}) {
  return (
    <View style={styles.benefitRow}>
      <Ionicons name={icon} size={20} color={color} />
      <Text style={[styles.benefitText, { color: textColor }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  closeBtn: {
    position: 'absolute',
    left: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },

  heroBox: {
    width: '100%',
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  heroTextWrap: {
    paddingHorizontal: 24,
    paddingBottom: 8,
    alignItems: 'center',
  },
  heroTitle: {
    fontSize: 34,
    fontWeight: '900',
    color: '#fff',
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowRadius: 8,
    textShadowOffset: { width: 0, height: 2 },
    letterSpacing: 0.5,
  },
  heroSubtitle: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.92)',
    textAlign: 'center',
    marginTop: 8,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowRadius: 6,
    textShadowOffset: { width: 0, height: 1 },
  },

  body: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },

  benefitsBox: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    gap: 14,
    marginBottom: 16,
  },
  benefitRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  benefitText: { fontSize: 14, fontWeight: '600', flex: 1 },

  priceBox: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 18,
    alignItems: 'center',
    marginBottom: 16,
  },
  priceLabel: { fontSize: 12, fontWeight: '700', marginBottom: 4 },
  priceValue: { fontSize: 32, fontWeight: '900', marginBottom: 4 },
  priceSub: { fontSize: 12 },

  warnBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 14,
  },
  warnText: { fontSize: 12, fontWeight: '600', flex: 1 },

  primaryBtn: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: { fontSize: 15, fontWeight: '800' },

  restoreBtn: {
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  restoreText: { fontSize: 13, fontWeight: '600', textDecorationLine: 'underline' },

  footer: { alignItems: 'center', marginTop: 16, gap: 6 },
  footerText: { fontSize: 11, textAlign: 'center', lineHeight: 15, paddingHorizontal: 8 },
  footerLink: { fontSize: 12, fontWeight: '700', marginTop: 2 },
});
