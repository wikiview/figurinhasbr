import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Sticker, StickerStatus } from '@/src/lib/types';
import { useTheme } from '@/src/hooks/useTheme';

type Props = {
  sticker: Sticker;
  qty: number;
  onIncrement: () => void;
  onDecrement: () => void;
};

function codeLabel(s: Sticker): string {
  if (s.id === 'FWC-00') return '00';
  if (s.team_code === 'EXTRA') return s.number;
  return `${s.team_code}${s.number}`;
}

export function StickerListItem({ sticker, qty, onIncrement, onDecrement }: Props) {
  const t = useTheme();
  const status: StickerStatus = qty <= 0 ? 'missing' : qty === 1 ? 'have' : 'duplicate';
  const isShiny = sticker.is_shiny;

  const stripeColor =
    status === 'duplicate'
      ? '#f59e0b'
      : status === 'have'
      ? '#22c55e'
      : isShiny
      ? '#facc15'
      : 'transparent';

  const qtyColor =
    status === 'duplicate'
      ? t.dupText
      : status === 'have'
      ? t.haveText
      : t.textFaint;

  const code = codeLabel(sticker);
  const name = sticker.player_name ?? code;

  return (
    <View
      style={[
        styles.row,
        {
          backgroundColor: t.surface,
          borderBottomColor: t.borderSubtle,
        },
      ]}>
      <View style={[styles.stripe, { backgroundColor: stripeColor }]} />
      <View style={styles.codeBox}>
        <Text
          style={[styles.codeText, { color: t.textMuted }]}
          numberOfLines={1}>
          {code}
        </Text>
      </View>
      <View style={styles.nameBox}>
        <Text
          style={[styles.nameText, { color: t.text }]}
          numberOfLines={1}>
          {name}
          {isShiny && (
            <Text>
              {' '}
              <Ionicons name="star" size={11} color="#facc15" />
            </Text>
          )}
        </Text>
      </View>
      <View style={styles.actions}>
        <Pressable
          onPress={onDecrement}
          disabled={qty === 0}
          hitSlop={8}
          style={[
            styles.btn,
            { backgroundColor: t.surfaceAlt },
            qty === 0 && { opacity: 0.4 },
          ]}>
          <Ionicons
            name="remove"
            size={18}
            color={qty === 0 ? t.textFaint : t.textMuted}
          />
        </Pressable>
        <Text style={[styles.qtyText, { color: qtyColor }]}>{qty}</Text>
        <Pressable
          onPress={onIncrement}
          hitSlop={8}
          style={[styles.btn, { backgroundColor: t.primary }]}>
          <Ionicons name="add" size={18} color={t.primaryText} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 0,
    paddingRight: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  stripe: {
    width: 4,
    alignSelf: 'stretch',
    marginRight: 10,
  },
  codeBox: {
    minWidth: 52,
    paddingRight: 8,
  },
  codeText: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  nameBox: {
    flex: 1,
    paddingRight: 8,
  },
  nameText: {
    fontSize: 14,
    fontWeight: '600',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  btn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyText: {
    fontSize: 16,
    fontWeight: '800',
    minWidth: 22,
    textAlign: 'center',
  },
});
