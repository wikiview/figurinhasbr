import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Sticker } from '@/src/lib/types';
import type { TradeEntry } from '@/src/hooks/useTradeSlots';
import { entryHasTrade } from '@/src/hooks/useTradeSlots';
import { useTheme } from '@/src/hooks/useTheme';

type Props = {
  sticker: Sticker;
  qty: number;
  trade?: TradeEntry;
  onIncrement: () => void;
  onDecrement: () => void;
  onToggleHave: () => void;
  onOpenTrade: () => void;
};

function codeLabel(s: Sticker): string {
  if (s.id === 'FWC-00') return '00';
  if (s.team_code === 'EXTRA') return s.number;
  return `${s.team_code ?? ''}${s.number}`;
}

function summarizeTrade(entry: TradeEntry): string {
  const slots = [entry.s1, entry.s2].filter(
    (s) => s && (s.who || s.what),
  ) as { who?: string; what?: string }[];
  if (!slots.length) return '';
  return slots
    .map((s) => {
      const who = s.who?.trim();
      const what = s.what?.trim();
      if (who && what) return `${who} → ${what}`;
      return who || what || '';
    })
    .filter(Boolean)
    .join(' · ');
}

export function CadernetaRow({
  sticker,
  qty,
  trade,
  onIncrement,
  onDecrement,
  onToggleHave,
  onOpenTrade,
}: Props) {
  const t = useTheme();
  const have = qty >= 1;
  const reps = qty > 1 ? qty - 1 : 0;
  const hasTrade = entryHasTrade(trade);
  const summary = trade ? summarizeTrade(trade) : '';
  const code = codeLabel(sticker);
  const name = sticker.player_name ?? code;

  const stripeColor = reps > 0 ? '#f59e0b' : have ? '#22c55e' : 'transparent';

  return (
    <View
      style={[
        styles.row,
        { backgroundColor: t.surface, borderBottomColor: t.borderSubtle },
      ]}>
      <View style={[styles.stripe, { backgroundColor: stripeColor }]} />

      <View style={styles.codeBox}>
        <Text style={[styles.codeText, { color: t.textMuted }]} numberOfLines={1}>
          {code}
        </Text>
      </View>

      <View style={styles.nameBox}>
        <Text style={[styles.nameText, { color: t.text }]} numberOfLines={1}>
          {name}
        </Text>
        {hasTrade ? (
          <Text
            style={[styles.tradeSummary, { color: t.textMuted }]}
            numberOfLines={1}>
            {summary}
          </Text>
        ) : null}
      </View>

      {/* Tenho */}
      <Pressable onPress={onToggleHave} hitSlop={6} style={styles.checkBox}>
        <View
          style={[
            styles.checkbox,
            {
              borderColor: have ? '#16a34a' : t.border,
              backgroundColor: have ? '#16a34a' : 'transparent',
            },
          ]}>
          {have ? <Ionicons name="checkmark" size={14} color="#fff" /> : null}
        </View>
      </Pressable>

      {/* Repetidas (controle inline) */}
      <View style={styles.repBox}>
        <Pressable
          onPress={onDecrement}
          hitSlop={6}
          disabled={qty === 0}
          style={[
            styles.repBtn,
            { backgroundColor: t.surfaceAlt },
            qty === 0 && { opacity: 0.35 },
          ]}>
          <Ionicons
            name="remove"
            size={13}
            color={qty === 0 ? t.textFaint : t.textMuted}
          />
        </Pressable>
        <Text
          style={[
            styles.repText,
            { color: reps > 0 ? '#f59e0b' : t.textFaint },
          ]}>
          {reps}
        </Text>
        <Pressable
          onPress={onIncrement}
          hitSlop={6}
          style={[styles.repBtn, { backgroundColor: t.surfaceAlt }]}>
          <Ionicons name="add" size={13} color={t.textMuted} />
        </Pressable>
      </View>

      {/* Trade chip */}
      <Pressable
        onPress={onOpenTrade}
        style={[
          styles.tradeBtn,
          {
            backgroundColor: hasTrade ? '#fef3c7' : t.surfaceAlt,
            borderColor: hasTrade ? '#f59e0b' : t.border,
          },
        ]}>
        <Ionicons
          name="swap-horizontal"
          size={14}
          color={hasTrade ? '#92400e' : t.textMuted}
        />
      </Pressable>
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
  stripe: { width: 4, alignSelf: 'stretch', marginRight: 10 },
  codeBox: { minWidth: 52, paddingRight: 6 },
  codeText: { fontSize: 12, fontWeight: '800', letterSpacing: 0.3 },
  nameBox: { flex: 1, paddingRight: 6 },
  nameText: { fontSize: 14, fontWeight: '600' },
  tradeSummary: { fontSize: 11, marginTop: 1 },

  checkBox: { paddingHorizontal: 4, paddingVertical: 2 },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },

  repBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
  },
  repBtn: {
    width: 24,
    height: 24,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  repText: {
    fontSize: 14,
    fontWeight: '800',
    minWidth: 14,
    textAlign: 'center',
  },

  tradeBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
  },
});
