import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import type { Sticker, StickerStatus } from '@/src/lib/types';
import type { CardMode } from '@/src/hooks/usePreferences';
import { useTheme } from '@/src/hooks/useTheme';
import { useResolvedTheme } from '@/src/hooks/usePreferences';

const CARD_BG_LIGHT = require('@/assets/images/card-bg-light.png');
const CARD_BG_DARK = require('@/assets/images/card-bg-dark.png');

type Props = {
  sticker: Sticker;
  qty: number;
  mode: CardMode;
  onPress?: () => void;
  onIncrement?: () => void;
  onDecrement?: () => void;
};

function codeLines(s: Sticker): { line1: string; line2: string | null } {
  if (s.id === 'FWC-00') return { line1: '00', line2: null };
  if (s.team_code === 'EXTRA') return { line1: 'EXTRA', line2: s.number };
  return { line1: s.team_code ?? '', line2: s.number };
}

export function StickerCard({
  sticker,
  qty,
  mode,
  onPress,
  onIncrement,
  onDecrement,
}: Props) {
  const t = useTheme();
  const themeName = useResolvedTheme();
  const status: StickerStatus = qty <= 0 ? 'missing' : qty === 1 ? 'have' : 'duplicate';
  const isShiny = sticker.is_shiny;

  const cardBorder = isShiny
    ? t.shinyBorder
    : status === 'have'
    ? t.haveBorder
    : status === 'duplicate'
    ? t.dupBorder
    : t.border;

  const textColor = themeName === 'dark' ? '#e2e8f0' : '#0f172a';
  const nameColor =
    status === 'missing'
      ? themeName === 'dark'
        ? '#64748b'
        : '#94a3b8'
      : status === 'duplicate'
      ? themeName === 'dark'
        ? '#fcd34d'
        : '#92400e'
      : status === 'have'
      ? themeName === 'dark'
        ? '#86efac'
        : '#15803d'
      : textColor;

  const { line1, line2 } = codeLines(sticker);
  const name = sticker.player_name ?? `${sticker.team_code ?? ''}${sticker.number}`;
  const cardBgSource = themeName === 'dark' ? CARD_BG_DARK : CARD_BG_LIGHT;

  const cardClasses = [
    styles.card,
    mode === 'inline' && styles.cardInline,
    {
      borderColor: cardBorder,
      borderWidth: isShiny ? 2 : 1,
    },
  ];

  const visual = (
    <View style={styles.body}>
      <Image
        source={cardBgSource}
        style={[
          StyleSheet.absoluteFillObject,
          status === 'missing' && { opacity: 0.45 },
        ]}
        contentFit="cover"
      />

      {/* Código no centro do "2" (parte de cima) */}
      <View style={styles.codeSlot} pointerEvents="none">
        <Text
          style={[styles.codeText, { color: textColor }]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.6}>
          {line1}
        </Text>
        {line2 ? (
          <Text
            style={[styles.codeNumber, { color: textColor }]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.6}>
            {line2}
          </Text>
        ) : null}
      </View>

      {/* Nome do jogador no centro do "6" (parte de baixo) */}
      <View style={styles.nameSlot} pointerEvents="none">
        <Text
          style={[styles.name, { color: nameColor }]}
          numberOfLines={2}
          adjustsFontSizeToFit
          minimumFontScale={0.55}>
          {name}
        </Text>
      </View>

      {/* Estrela shiny / lock missing — canto sup esquerdo */}
      {isShiny ? (
        <Ionicons name="star" size={12} color="#facc15" style={styles.topLeft} />
      ) : status === 'missing' ? (
        <Ionicons
          name="lock-closed"
          size={11}
          color={themeName === 'dark' ? '#94a3b8' : '#64748b'}
          style={styles.topLeft}
        />
      ) : null}

      {/* Badge de qty (canto inferior direito) */}
      {mode === 'modal' && qty > 0 && (
        <View
          style={[
            styles.qtyBadge,
            { backgroundColor: status === 'duplicate' ? '#f59e0b' : '#22c55e' },
          ]}>
          <Text style={styles.qtyBadgeText}>{qty > 1 ? `×${qty}` : '✓'}</Text>
        </View>
      )}
    </View>
  );

  if (mode === 'inline') {
    return (
      <View style={cardClasses}>
        {visual}
        <View style={[styles.footer, { borderTopColor: t.border, backgroundColor: t.surface }]}>
          <Pressable
            onPress={onDecrement}
            disabled={qty === 0}
            hitSlop={6}
            style={[
              styles.btn,
              { backgroundColor: t.surfaceAlt },
              qty === 0 && { opacity: 0.4 },
            ]}>
            <Ionicons
              name="remove"
              size={14}
              color={qty === 0 ? t.textFaint : t.textMuted}
            />
          </Pressable>
          <Text
            style={[
              styles.qtyText,
              {
                color:
                  status === 'have'
                    ? t.haveText
                    : status === 'duplicate'
                    ? t.dupText
                    : t.textMuted,
              },
            ]}>
            {qty}
          </Text>
          <Pressable
            onPress={onIncrement}
            hitSlop={6}
            style={[styles.btn, { backgroundColor: t.primary }]}>
            <Ionicons name="add" size={14} color={t.primaryText} />
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        ...cardClasses,
        pressed && { opacity: 0.7, transform: [{ scale: 0.96 }] },
      ]}>
      {visual}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    aspectRatio: 0.7,
    borderRadius: 14,
    margin: 5,
    overflow: 'hidden',
  },
  cardInline: {
    aspectRatio: 0.58,
  },
  body: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
  },
  codeSlot: {
    position: 'absolute',
    top: '14%',
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  codeText: {
    fontSize: 12,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  codeNumber: {
    fontSize: 14,
    fontWeight: '900',
    textAlign: 'center',
    marginTop: 1,
  },
  nameSlot: {
    position: 'absolute',
    bottom: '14%',
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  name: {
    fontSize: 10,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  topLeft: {
    position: 'absolute',
    top: 5,
    left: 5,
  },
  qtyBadge: {
    position: 'absolute',
    bottom: 5,
    right: 5,
    minWidth: 22,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  qtyBadgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },

  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    paddingVertical: 4,
    borderTopWidth: 1,
  },
  btn: {
    width: 24,
    height: 24,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyText: {
    fontSize: 14,
    fontWeight: '800',
    minWidth: 16,
    textAlign: 'center',
  },
});
