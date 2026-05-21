import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/src/hooks/useTheme';

type PickerOption = { value: string; label: string };

type Props = {
  label?: string;
  value: string;
  placeholder?: string;
  options: PickerOption[];
  onChange: (value: string) => void;
  searchPlaceholder?: string;
  emptyText?: string;
  disabled?: boolean;
  loading?: boolean;
  modalTitle?: string;
};

function normalize(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

export function OptionPicker({
  value,
  placeholder = 'Selecionar',
  options,
  onChange,
  searchPlaceholder = 'Buscar…',
  emptyText = 'Nada encontrado.',
  disabled,
  loading,
  modalTitle,
}: Props) {
  const t = useTheme();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const selectedLabel = useMemo(
    () => options.find((o) => o.value === value)?.label ?? '',
    [options, value],
  );

  const filtered = useMemo(() => {
    const q = normalize(query.trim());
    if (!q) return options;
    return options.filter((o) => normalize(o.label).includes(q) || normalize(o.value).includes(q));
  }, [options, query]);

  return (
    <>
      <Pressable
        disabled={disabled}
        onPress={() => {
          setQuery('');
          setOpen(true);
        }}
        style={[
          styles.field,
          { backgroundColor: t.surfaceAlt, borderColor: t.border },
          disabled && { opacity: 0.5 },
        ]}>
        {loading ? (
          <ActivityIndicator color={t.primary} />
        ) : (
          <Text
            style={[
              styles.fieldText,
              { color: selectedLabel ? t.text : t.textFaint },
            ]}
            numberOfLines={1}>
            {selectedLabel || placeholder}
          </Text>
        )}
        <Ionicons name="chevron-down" size={18} color={t.textMuted} />
      </Pressable>

      <Modal
        visible={open}
        animationType="slide"
        transparent
        onRequestClose={() => setOpen(false)}>
        <View style={styles.backdrop}>
          <View style={[styles.sheet, { backgroundColor: t.bg, borderColor: t.border }]}>
            <View style={styles.header}>
              <Text style={[styles.title, { color: t.text }]} numberOfLines={1}>
                {modalTitle ?? placeholder}
              </Text>
              <Pressable onPress={() => setOpen(false)} hitSlop={12}>
                <Ionicons name="close" size={24} color={t.textMuted} />
              </Pressable>
            </View>

            <View
              style={[
                styles.search,
                { backgroundColor: t.surfaceAlt, borderColor: t.border },
              ]}>
              <Ionicons name="search" size={16} color={t.textMuted} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder={searchPlaceholder}
                placeholderTextColor={t.textFaint}
                style={[styles.searchInput, { color: t.text }]}
                autoFocus
                autoCorrect={false}
              />
              {query.length > 0 && (
                <Pressable onPress={() => setQuery('')} hitSlop={8}>
                  <Ionicons name="close-circle" size={18} color={t.textMuted} />
                </Pressable>
              )}
            </View>

            {options.length === 0 ? (
              <View style={styles.empty}>
                {loading ? (
                  <ActivityIndicator color={t.primary} />
                ) : (
                  <Text style={{ color: t.textMuted }}>{emptyText}</Text>
                )}
              </View>
            ) : filtered.length === 0 ? (
              <View style={styles.empty}>
                <Text style={{ color: t.textMuted }}>{emptyText}</Text>
              </View>
            ) : (
              <FlatList
                data={filtered}
                keyExtractor={(o) => o.value}
                keyboardShouldPersistTaps="handled"
                ItemSeparatorComponent={() => (
                  <View style={[styles.sep, { backgroundColor: t.border }]} />
                )}
                renderItem={({ item }) => {
                  const active = item.value === value;
                  return (
                    <Pressable
                      onPress={() => {
                        onChange(item.value);
                        setOpen(false);
                      }}
                      style={({ pressed }) => [
                        styles.row,
                        pressed && { backgroundColor: t.surfaceAlt },
                      ]}>
                      <Text
                        style={[
                          styles.rowText,
                          { color: active ? t.primary : t.text },
                          active && { fontWeight: '700' },
                        ]}>
                        {item.label}
                      </Text>
                      {active && (
                        <Ionicons name="checkmark" size={18} color={t.primary} />
                      )}
                    </Pressable>
                  );
                }}
              />
            )}
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    minHeight: 50,
  },
  fieldText: { flex: 1, fontSize: 16, marginRight: 8 },

  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: {
    height: '85%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  title: { fontSize: 18, fontWeight: '800', flex: 1, marginRight: 12 },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
    gap: 8,
    marginBottom: 8,
  },
  searchInput: { flex: 1, fontSize: 15 },

  empty: { padding: 24, alignItems: 'center' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 4,
  },
  rowText: { fontSize: 16, flex: 1 },
  sep: { height: StyleSheet.hairlineWidth },
});
