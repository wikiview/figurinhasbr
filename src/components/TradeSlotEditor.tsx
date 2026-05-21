import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Sticker } from '@/src/lib/types';
import type { TradeEntry, TradeSlot } from '@/src/hooks/useTradeSlots';
import { useTheme } from '@/src/hooks/useTheme';

type Props = {
  sticker: Sticker | null;
  entry: TradeEntry | undefined;
  onClose: () => void;
  onChange: (slot: 's1' | 's2', patch: Partial<TradeSlot>) => void;
  onClear: () => void;
};

function codeLabel(s: Sticker): string {
  if (s.id === 'FWC-00') return '00';
  if (s.team_code === 'EXTRA') return s.number;
  return `${s.team_code ?? ''}${s.number}`;
}

export function TradeSlotEditor({
  sticker,
  entry,
  onClose,
  onChange,
  onClear,
}: Props) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const visible = !!sticker;

  // Estado local pra digitação fluida — propaga pro pai a cada change
  const [s1Who, setS1Who] = useState('');
  const [s1What, setS1What] = useState('');
  const [s2Who, setS2Who] = useState('');
  const [s2What, setS2What] = useState('');

  useEffect(() => {
    if (!sticker) return;
    setS1Who(entry?.s1?.who ?? '');
    setS1What(entry?.s1?.what ?? '');
    setS2Who(entry?.s2?.who ?? '');
    setS2What(entry?.s2?.what ?? '');
    // Reseta quando troca de sticker
  }, [sticker?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!sticker) return null;

  return (
    <Modal
      transparent
      animationType="slide"
      visible={visible}
      onRequestClose={onClose}>
      <Pressable style={[styles.backdrop, { backgroundColor: t.backdrop }]} onPress={onClose} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.kav}
        pointerEvents="box-none">
        <View
          style={[
            styles.sheet,
            { backgroundColor: t.bgElevated, paddingBottom: insets.bottom + 16 },
          ]}>
          <View style={styles.handle} />

          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.code, { color: t.textMuted }]}>
                {codeLabel(sticker)} · {sticker.team}
              </Text>
              <Text style={[styles.title, { color: t.text }]} numberOfLines={1}>
                {sticker.player_name ?? codeLabel(sticker)}
              </Text>
            </View>
            <Pressable
              onPress={onClose}
              hitSlop={8}
              style={[styles.closeBtn, { backgroundColor: t.surfaceAlt }]}>
              <Ionicons name="close" size={20} color={t.textMuted} />
            </Pressable>
          </View>

          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: 8 }}>
            <SlotForm
              label="Troca 1"
              who={s1Who}
              what={s1What}
              onWhoChange={(v) => {
                setS1Who(v);
                onChange('s1', { who: v });
              }}
              onWhatChange={(v) => {
                setS1What(v);
                onChange('s1', { what: v });
              }}
            />
            <View style={{ height: 12 }} />
            <SlotForm
              label="Troca 2"
              who={s2Who}
              what={s2What}
              onWhoChange={(v) => {
                setS2Who(v);
                onChange('s2', { who: v });
              }}
              onWhatChange={(v) => {
                setS2What(v);
                onChange('s2', { what: v });
              }}
            />

            <Pressable
              onPress={() => {
                setS1Who('');
                setS1What('');
                setS2Who('');
                setS2What('');
                onClear();
              }}
              style={({ pressed }) => [
                styles.clearBtn,
                { borderColor: t.border },
                pressed && { opacity: 0.6 },
              ]}>
              <Ionicons name="trash-outline" size={16} color={t.textMuted} />
              <Text style={[styles.clearText, { color: t.textMuted }]}>
                Limpar trocas
              </Text>
            </Pressable>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function SlotForm({
  label,
  who,
  what,
  onWhoChange,
  onWhatChange,
}: {
  label: string;
  who: string;
  what: string;
  onWhoChange: (v: string) => void;
  onWhatChange: (v: string) => void;
}) {
  const t = useTheme();
  return (
    <View
      style={[
        styles.slotCard,
        { backgroundColor: t.surface, borderColor: t.border },
      ]}>
      <Text style={[styles.slotLabel, { color: t.textMuted }]}>{label}</Text>
      <View style={styles.fieldRow}>
        <Text style={[styles.fieldLabel, { color: t.textFaint }]}>Quem</Text>
        <TextInput
          value={who}
          onChangeText={onWhoChange}
          placeholder="Nome do parceiro"
          placeholderTextColor={t.textFaint}
          style={[
            styles.input,
            {
              color: t.text,
              backgroundColor: t.surfaceAlt,
              borderColor: t.border,
            },
          ]}
        />
      </View>
      <View style={styles.fieldRow}>
        <Text style={[styles.fieldLabel, { color: t.textFaint }]}>Qual</Text>
        <TextInput
          value={what}
          onChangeText={onWhatChange}
          placeholder="Ex: BRA10, KOR5..."
          placeholderTextColor={t.textFaint}
          autoCapitalize="characters"
          style={[
            styles.input,
            {
              color: t.text,
              backgroundColor: t.surfaceAlt,
              borderColor: t.border,
            },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject },
  kav: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 8,
    maxHeight: '85%',
  },
  handle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#cbd5e1',
    alignSelf: 'center',
    marginBottom: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 12,
  },
  code: { fontSize: 11, fontWeight: '700', letterSpacing: 0.4 },
  title: { fontSize: 17, fontWeight: '800', marginTop: 2 },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },

  slotCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  slotLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  fieldRow: { gap: 4 },
  fieldLabel: { fontSize: 11, fontWeight: '600' },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: Platform.OS === 'ios' ? 10 : 6,
    fontSize: 14,
  },

  clearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 14,
  },
  clearText: { fontSize: 13, fontWeight: '600' },
});
