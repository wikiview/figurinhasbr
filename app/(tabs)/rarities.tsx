import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { supabase } from '@/src/lib/supabase';
import { useTheme } from '@/src/hooks/useTheme';

const MIN_USERS = 5;

type Rarity = {
  id: string;
  number: string;
  team: string;
  team_code: string | null;
  player_name: string | null;
  is_shiny: boolean;
  owners: number;
  total_active: number;
  rarity_pct: number;
};

type Mode = 'rare' | 'common';

export default function RaritiesScreen() {
  const t = useTheme();
  const [rows, setRows] = useState<Rarity[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [mode, setMode] = useState<Mode>('rare');

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc('get_sticker_rarities');
    if (error) console.warn(error);
    setRows((data ?? []) as Rarity[]);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const totalActive = rows[0]?.total_active ?? 0;

  const top = useMemo(() => {
    const ranked = rows.filter((r) => r.total_active >= MIN_USERS);
    if (mode === 'rare') {
      return [...ranked].sort((a, b) => Number(a.rarity_pct) - Number(b.rarity_pct)).slice(0, 10);
    }
    return [...ranked]
      .sort((a, b) => Number(b.rarity_pct) - Number(a.rarity_pct))
      .slice(0, 10);
  }, [rows, mode]);

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: t.bg }]}>
        <ActivityIndicator />
      </View>
    );
  }

  if (totalActive < MIN_USERS) {
    return (
      <View style={[styles.center, { backgroundColor: t.bg }]}>
        <MaterialCommunityIcons name="account-group-outline" size={64} color={t.textFaint} />
        <Text style={[styles.title, { color: t.text }]}>Esperando mais colecionadores</Text>
        <Text style={[styles.sub, { color: t.textMuted }]}>
          Pra mostrar quais figurinhas tão saindo mais (e quais menos), precisamos pelo menos de{' '}
          <Text style={{ fontWeight: '700' }}>{MIN_USERS} pessoas</Text> registrando coleção.
          {'\n\n'}Tem{' '}
          <Text style={{ fontWeight: '700', color: t.primary }}>
            {totalActive} colecionador{totalActive === 1 ? '' : 'es'}
          </Text>{' '}
          até agora. Chama a galera!
        </Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <View style={styles.modeRow}>
        <ModeBtn
          label="Mais raras"
          subtitle="Saem menos vezes"
          icon="diamond"
          color="#0ea5e9"
          active={mode === 'rare'}
          onPress={() => setMode('rare')}
          theme={t}
        />
        <ModeBtn
          label="Mais comuns"
          subtitle="Caem em todo pacote"
          icon="cards"
          color="#f59e0b"
          active={mode === 'common'}
          onPress={() => setMode('common')}
          theme={t}
        />
      </View>

      <Text style={[styles.basis, { color: t.textFaint }]}>
        Baseado em {totalActive} colecionadores ativos
      </Text>

      <FlatList
        data={top}
        keyExtractor={(r) => r.id}
        contentContainerStyle={{ padding: 16, paddingTop: 4 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
          />
        }
        renderItem={({ item, index }) => (
          <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.border }]}>
            <View style={[styles.rank, { backgroundColor: t.accent }]}>
              <Text style={styles.rankText}>{index + 1}</Text>
            </View>

            <View style={styles.idCell}>
              <Text style={[styles.code, { color: t.text }]}>
                {item.team_code}-{item.number}
              </Text>
              {item.is_shiny && (
                <Ionicons name="star" size={14} color="#facc15" style={{ marginLeft: 4 }} />
              )}
            </View>

            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={[styles.team, { color: t.text }]} numberOfLines={1}>
                {item.team_code === 'FWC' ? 'Especiais' : item.team}
              </Text>
              <Text style={[styles.player, { color: t.textMuted }]} numberOfLines={1}>
                {item.player_name ?? '—'}
              </Text>
            </View>

            <View style={styles.pctBox}>
              <Text
                style={[
                  styles.pct,
                  { color: mode === 'rare' ? '#0ea5e9' : '#f59e0b' },
                ]}>
                {Number(item.rarity_pct).toFixed(1)}%
              </Text>
              <Text style={[styles.pctLabel, { color: t.textFaint }]}>tem</Text>
            </View>
          </View>
        )}
      />
    </View>
  );
}

function ModeBtn({
  label,
  subtitle,
  icon,
  color,
  active,
  onPress,
  theme,
}: {
  label: string;
  subtitle: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  color: string;
  active: boolean;
  onPress: () => void;
  theme: ReturnType<typeof useTheme>;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.modeBtn,
        { backgroundColor: theme.surface, borderColor: theme.border },
        active && { backgroundColor: color, borderColor: color },
      ]}>
      <MaterialCommunityIcons name={icon} size={22} color={active ? '#fff' : color} />
      <Text
        style={[
          styles.modeLabel,
          { color: active ? '#fff' : theme.text },
        ]}>
        {label}
      </Text>
      <Text
        style={[
          styles.modeSub,
          { color: active ? 'rgba(255,255,255,0.85)' : theme.textMuted },
        ]}>
        {subtitle}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  title: { fontSize: 20, fontWeight: '800', marginTop: 16 },
  sub: { textAlign: 'center', lineHeight: 22, marginTop: 8 },

  modeRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 10,
  },
  modeBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    alignItems: 'flex-start',
  },
  modeLabel: { fontWeight: '800', fontSize: 14, marginTop: 6 },
  modeSub: { fontSize: 11, marginTop: 2 },

  basis: {
    fontSize: 11,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontStyle: 'italic',
  },

  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
  },
  rank: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  idCell: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 10,
  },
  code: { fontWeight: '800', fontSize: 14 },
  team: { fontSize: 13, fontWeight: '700' },
  player: { fontSize: 12, marginTop: 1 },
  pctBox: { alignItems: 'flex-end' },
  pct: { fontSize: 16, fontWeight: '800' },
  pctLabel: { fontSize: 10 },
});
