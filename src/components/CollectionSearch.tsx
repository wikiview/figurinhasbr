import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Sticker } from '@/src/lib/types';
import { normalizeSearch } from '@/src/lib/search';
import { useTheme } from '@/src/hooks/useTheme';

type Props = {
  searchText: string;
  setSearchText: (s: string) => void;
  tags: Set<string>;
  addTag: (code: string) => void;
  removeTag: (code: string) => void;
  stickers: Sticker[];
};

export function CollectionSearch({
  searchText,
  setSearchText,
  tags,
  addTag,
  removeTag,
  stickers,
}: Props) {
  const t = useTheme();

  const codeToName = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of stickers) {
      if (s.team_code) m.set(s.team_code, s.team);
    }
    return m;
  }, [stickers]);

  const suggestions = useMemo(() => {
    const q = normalizeSearch(searchText.trim());
    if (!q) return [] as { code: string; name: string }[];
    const found = new Map<string, string>();
    for (const s of stickers) {
      const code = s.team_code ?? '';
      if (!code || code === 'FWC' || tags.has(code)) continue;
      if (
        normalizeSearch(s.team).includes(q) ||
        normalizeSearch(code).startsWith(q)
      ) {
        found.set(code, s.team);
      }
    }
    return Array.from(found.entries())
      .map(([code, name]) => ({ code, name }))
      .slice(0, 5);
  }, [searchText, stickers, tags]);

  return (
    <View style={styles.wrap}>
      <View
        style={[
          styles.inputRow,
          { backgroundColor: t.surface, borderColor: t.border },
        ]}>
        <Ionicons name="search" size={16} color={t.textFaint} />
        <TextInput
          value={searchText}
          onChangeText={setSearchText}
          placeholder="Buscar jogador ou país"
          placeholderTextColor={t.textFaint}
          style={[styles.input, { color: t.text }]}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          onSubmitEditing={() => {
            if (suggestions[0]) addTag(suggestions[0].code);
          }}
        />
        {searchText.length > 0 && (
          <Pressable onPress={() => setSearchText('')} hitSlop={8}>
            <Ionicons name="close-circle" size={18} color={t.textFaint} />
          </Pressable>
        )}
      </View>

      {(tags.size > 0 || suggestions.length > 0) && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsRow}
          keyboardShouldPersistTaps="handled">
          {Array.from(tags).map((code) => (
            <Pressable
              key={`tag-${code}`}
              style={[styles.tagChip, { backgroundColor: t.accent }]}
              onPress={() => removeTag(code)}>
              <Text style={styles.tagText}>{codeToName.get(code) ?? code}</Text>
              <Ionicons name="close" size={12} color="#fff" />
            </Pressable>
          ))}
          {suggestions.map((s) => (
            <Pressable
              key={`sug-${s.code}`}
              style={[
                styles.suggestChip,
                { backgroundColor: t.surface, borderColor: t.primary },
              ]}
              onPress={() => addTag(s.code)}>
              <Ionicons name="add" size={12} color={t.primary} />
              <Text style={[styles.suggestText, { color: t.primary }]}>{s.name}</Text>
            </Pressable>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
  },
  input: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    fontSize: 14,
  },
  chipsRow: {
    paddingTop: 8,
    paddingBottom: 4,
    gap: 6,
    flexDirection: 'row',
    paddingRight: 12,
  },
  tagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    gap: 6,
  },
  tagText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  suggestChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    gap: 4,
    borderWidth: 1,
  },
  suggestText: { fontWeight: '700', fontSize: 12 },
});
