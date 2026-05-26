import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Image } from 'expo-image';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import type { Sticker, StickerStatus } from '@/src/lib/types';
import { flagUrl } from '@/src/lib/flags';
import { useTheme } from '@/src/hooks/useTheme';
import { useResolvedTheme } from '@/src/hooks/usePreferences';

const CARD_BG_LIGHT = require('@/assets/images/card-bg-light.png');
const CARD_BG_DARK = require('@/assets/images/card-bg-dark.png');

type Props = {
  sticker: Sticker | null;
  qty: number;
  onClose: () => void;
  onIncrement: () => void;
  onDecrement: () => void;
};

function codeLines(s: Sticker): { line1: string; line2: string | null } {
  if (s.id === 'FWC-00') return { line1: '00', line2: null };
  if (s.team_code === 'EXTRA') return { line1: 'EXTRA', line2: s.number };
  return { line1: s.team_code ?? '', line2: s.number };
}

export function StickerDetail({ sticker, qty, onClose, onIncrement, onDecrement }: Props) {
  const t = useTheme();
  const themeName = useResolvedTheme();
  const [mounted, setMounted] = useState<Sticker | null>(sticker);
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.7);

  useEffect(() => {
    if (sticker) {
      setMounted(sticker);
      opacity.value = withTiming(1, { duration: 90 });
      scale.value = withSpring(1, { damping: 20, stiffness: 280, mass: 0.6 });
    } else if (mounted) {
      opacity.value = withTiming(0, { duration: 80 });
      scale.value = withTiming(0.7, { duration: 90 }, (done) => {
        if (done) runOnJS(setMounted)(null);
      });
    }
  }, [sticker, mounted, opacity, scale]);

  const backdropStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  const cardStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  if (!mounted) return null;

  const status: StickerStatus = qty <= 0 ? 'missing' : qty === 1 ? 'have' : 'duplicate';
  const isShiny = mounted.is_shiny;
  const isSpecialSection = ['FWC', 'EXTRA'].includes(mounted.team_code ?? '');
  const flag = isSpecialSection ? null : flagUrl(mounted.team_code ?? '', 320);
  const SECTION_LABEL: Record<string, string> = {
    FWC: 'Especiais',
    EXTRA: 'Esmaltadas',
  };
  const sectionLabel = SECTION_LABEL[mounted.team_code ?? ''] ?? mounted.team;

  const cardBorder = isShiny
    ? t.shinyBorder
    : status === 'have'
    ? t.haveBorder
    : status === 'duplicate'
    ? t.dupBorder
    : t.border;

  const textColor = themeName === 'dark' ? '#e2e8f0' : '#0f172a';
  const cardBgSource = themeName === 'dark' ? CARD_BG_DARK : CARD_BG_LIGHT;
  const { line1, line2 } = codeLines(mounted);
  const playerName = mounted.player_name ?? `${mounted.team_code ?? ''}${mounted.number}`;

  return (
    <Modal transparent visible animationType="none" onRequestClose={onClose}>
      <Animated.View
        style={[StyleSheet.absoluteFill, { backgroundColor: t.backdrop }, backdropStyle]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>

      <View style={styles.center} pointerEvents="box-none">
        <Animated.View style={[styles.cardWrap, cardStyle]}>
          <View
            style={[
              styles.card,
              {
                backgroundColor: t.surface,
                borderColor: cardBorder,
                borderWidth: isShiny ? 3 : 1,
              },
            ]}>
            <Pressable
              onPress={onClose}
              hitSlop={12}
              style={[styles.closeBtn, { backgroundColor: t.surfaceAlt }]}>
              <Ionicons name="close" size={20} color={t.textMuted} />
            </Pressable>

            {/* Hero figurinha — com imagem de fundo */}
            <View style={styles.hero}>
              <Image
                source={cardBgSource}
                style={[
                  StyleSheet.absoluteFillObject,
                  status === 'missing' && { opacity: 0.45 },
                ]}
                contentFit="cover"
              />

              <View style={styles.heroCodeSlot} pointerEvents="none">
                <Text
                  style={[styles.heroCodeText, { color: textColor }]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.6}>
                  {line1}
                </Text>
                {line2 ? (
                  <Text
                    style={[styles.heroCodeNumber, { color: textColor }]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.6}>
                    {line2}
                  </Text>
                ) : null}
              </View>

              <View style={styles.heroNameSlot} pointerEvents="none">
                <Text
                  style={[styles.heroName, { color: textColor }]}
                  numberOfLines={2}
                  adjustsFontSizeToFit
                  minimumFontScale={0.55}>
                  {playerName}
                </Text>
              </View>

              {isShiny && (
                <View style={styles.starWrap}>
                  <Ionicons name="star" size={20} color="#facc15" />
                </View>
              )}
            </View>

            {/* Linha do time / bandeira */}
            <View style={styles.teamRow}>
              <View style={[styles.crest, { backgroundColor: t.surfaceAlt, borderColor: t.border }]}>
                {isSpecialSection ? (
                  <MaterialCommunityIcons
                    name={mounted.team_code === 'EXTRA' ? 'medal' : 'trophy'}
                    size={20}
                    color="#facc15"
                  />
                ) : flag ? (
                  <Image
                    source={{ uri: flag }}
                    style={{ width: 36, height: 24, borderRadius: 3 }}
                    contentFit="cover"
                  />
                ) : (
                  <Text style={[styles.code, { color: t.text }]}>{mounted.team_code}</Text>
                )}
              </View>
              <View style={styles.teamInfo}>
                <Text style={[styles.team, { color: t.text }]} numberOfLines={1}>
                  {sectionLabel}
                </Text>
                <Text style={[styles.codeLabel, { color: t.textMuted }]} numberOfLines={1}>
                  {mounted.team_code}-{mounted.number}
                </Text>
              </View>
            </View>

            <View style={styles.controls}>
              <Pressable
                onPress={onDecrement}
                disabled={qty === 0}
                hitSlop={8}
                style={({ pressed }) => [
                  styles.bigBtn,
                  {
                    backgroundColor: qty === 0 ? t.surfaceAlt : '#475569',
                  },
                  pressed && qty > 0 && { transform: [{ scale: 0.92 }], opacity: 0.85 },
                ]}>
                <Ionicons
                  name="remove"
                  size={28}
                  color={qty === 0 ? t.textFaint : '#fff'}
                />
              </Pressable>

              <View style={styles.qtyBox}>
                <Text
                  style={[
                    styles.qtyValue,
                    { color: status === 'have' ? t.haveText : status === 'duplicate' ? t.dupText : t.textMuted },
                  ]}>
                  {qty}
                </Text>
                <Text style={[styles.qtyLabel, { color: t.textFaint }]}>
                  {status === 'missing' ? 'não tenho' : status === 'have' ? 'tenho' : 'repetidas'}
                </Text>
              </View>

              <Pressable
                onPress={onIncrement}
                hitSlop={8}
                style={({ pressed }) => [
                  styles.bigBtn,
                  { backgroundColor: t.primary },
                  pressed && { transform: [{ scale: 0.92 }], opacity: 0.85 },
                ]}>
                <Ionicons name="add" size={28} color={t.primaryText} />
              </Pressable>
            </View>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  cardWrap: { width: '100%', maxWidth: 320 },
  card: {
    borderRadius: 24,
    padding: 16,
    paddingTop: 14,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 12 },
    elevation: 12,
  },
  closeBtn: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 5,
  },
  hero: {
    width: '100%',
    alignSelf: 'stretch',
    aspectRatio: 0.7,
    borderRadius: 14,
    overflow: 'hidden',
    marginTop: 28,
    marginBottom: 16,
    position: 'relative',
  },
  heroCodeSlot: {
    position: 'absolute',
    top: '14%',
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  heroCodeText: {
    fontSize: 28,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: 1,
  },
  heroCodeNumber: {
    fontSize: 32,
    fontWeight: '900',
    textAlign: 'center',
    marginTop: 2,
  },
  heroNameSlot: {
    position: 'absolute',
    bottom: '14%',
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  heroName: {
    fontSize: 18,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  starWrap: { position: 'absolute', top: 10, left: 10 },
  teamRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  crest: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    overflow: 'hidden',
  },
  teamInfo: { flex: 1 },
  code: { fontWeight: '800', fontSize: 13 },
  codeLabel: { fontSize: 12, fontWeight: '700', marginTop: 2 },
  team: { fontSize: 16, fontWeight: '800' },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  bigBtn: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyBox: { alignItems: 'center' },
  qtyValue: { fontSize: 40, fontWeight: '900' },
  qtyLabel: { fontSize: 11, marginTop: -4, fontWeight: '600' },
});
