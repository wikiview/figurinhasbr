import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/src/providers/AuthProvider';
import { supabase } from '@/src/lib/supabase';
import { useTheme } from '@/src/hooks/useTheme';
import { useTradeSlots, entryHasTrade } from '@/src/hooks/useTradeSlots';
import { CadernetaRow } from '@/src/components/CadernetaRow';
import { TradeSlotEditor } from '@/src/components/TradeSlotEditor';
import { TeamHeader } from '@/src/components/TeamHeader';
import { EliteUnlockedModal } from '@/src/components/EliteUnlockedModal';
import { CoverCreator } from '@/src/components/CoverCreator';
import {
  buildRows,
  exportCsv,
  exportPdf,
  exportXls,
} from '@/src/lib/caderneta-export';
import {
  ACHIEVEMENTS,
  isEliteCollectorComplete,
  loadAchievements,
  unlockAchievement,
} from '@/src/lib/achievements';
import type { Sticker } from '@/src/lib/types';

type Filter = 'all' | 'tradeOrMissing' | 'missing' | 'duplicate' | 'have';

const FILTERS: { key: Filter; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'all', label: 'Todas', icon: 'apps' },
  { key: 'tradeOrMissing', label: 'Troca+Falta', icon: 'swap-horizontal' },
  { key: 'missing', label: 'Faltantes', icon: 'square-outline' },
  { key: 'duplicate', label: 'Repetidas', icon: 'copy' },
  { key: 'have', label: 'Tenho', icon: 'checkmark-circle' },
];

type Row =
  | {
      kind: 'team';
      team: string;
      teamCode: string;
      total: number;
      owned: number;
      collapsed: boolean;
    }
  | { kind: 'sticker'; sticker: Sticker };

export default function CadernetaScreen() {
  const { session, profile, loading: authLoading } = useAuth();
  const userId = session?.user.id;
  const t = useTheme();
  const insets = useSafeAreaInsets();

  const [stickers, setStickers] = useState<Sticker[]>([]);
  const [qtyMap, setQtyMap] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<Filter>('tradeOrMissing');
  const [grouped, setGrouped] = useState(true);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<Sticker | null>(null);
  const [exporting, setExporting] = useState<null | 'pdf' | 'xls' | 'csv'>(null);
  const [eliteUnlockedOpen, setEliteUnlockedOpen] = useState(false);
  const [eliteCreatorOpen, setEliteCreatorOpen] = useState(false);
  const [hasEliteAchievement, setHasEliteAchievement] = useState(false);

  const { trades, setSlot, clearSticker } = useTradeSlots(userId);

  useEffect(() => {
    if (!userId) return;
    loadAchievements(userId)
      .then((set) => setHasEliteAchievement(set.has(ACHIEVEMENTS.ELITE_COLLECTOR)))
      .catch(() => {});
  }, [userId]);

  const load = useCallback(async () => {
    if (!userId) {
      // Auth ainda resolvendo — isto NÃO é erro. Mantém o spinner; quando o
      // userId chegar, o efeito re-roda o load.
      setRefreshing(false);
      return;
    }

    // Retry com backoff: cobre o cold-start onde a 1ª request HTTP falha em
    // silêncio e volta vazia. `stickers` nunca deve estar vazia em prod, então
    // tratamos resposta vazia como falha transitória e tentamos de novo.
    const RETRY_DELAYS_MS = [0, 800, 2000];
    let loadedStickers: Sticker[] | null = null;
    let loadedUserStickers: any[] = [];

    for (let attempt = 0; attempt < RETRY_DELAYS_MS.length; attempt++) {
      if (RETRY_DELAYS_MS[attempt] > 0) {
        await new Promise((r) => setTimeout(r, RETRY_DELAYS_MS[attempt]));
      }
      try {
        const result = await Promise.race([
          Promise.all([
            supabase.from('stickers').select('*').order('display_order'),
            supabase.from('user_stickers').select('sticker_id,qty').eq('user_id', userId),
          ]),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('load timeout')), 10000),
          ),
        ]);
        const [{ data: sList, error: e1 }, { data: usList, error: e2 }] = result;
        if (e1) console.warn('[caderneta:load] stickers attempt %d:', attempt + 1, e1.message);
        if (e2) console.warn('[caderneta:load] user_stickers attempt %d:', attempt + 1, e2.message);
        if (sList && sList.length > 0) {
          loadedStickers = sList as Sticker[];
          loadedUserStickers = usList ?? [];
          break;
        }
        console.warn('[caderneta:load] empty stickers on attempt %d — retrying', attempt + 1);
      } catch (e) {
        console.warn('[caderneta:load] attempt %d failed:', attempt + 1, e);
      }
    }

    if (loadedStickers) {
      setStickers(loadedStickers);
      const map: Record<string, number> = {};
      loadedUserStickers.forEach((r: any) => {
        map[r.sticker_id] = r.qty;
      });
      setQtyMap(map);
    }
    setLoading(false);
    setRefreshing(false);
  }, [userId]);

  useEffect(() => {
    const safety = setTimeout(() => setLoading(false), 12000);
    load().finally(() => clearTimeout(safety));
    return () => clearTimeout(safety);
  }, [load]);

  async function persistQty(sticker: Sticker, next: number) {
    if (!userId) return;
    const prev = qtyMap[sticker.id] ?? 0;
    if (next === prev) return;
    setQtyMap((m) => ({ ...m, [sticker.id]: next }));
    const { error } = await supabase.from('user_stickers').upsert({
      user_id: userId,
      sticker_id: sticker.id,
      qty: next,
      updated_at: new Date().toISOString(),
    });
    if (error) {
      Alert.alert('Erro', error.message);
      setQtyMap((m) => ({ ...m, [sticker.id]: prev }));
      return;
    }
    // Achievement Elite: só dispara em incremento de 0 → 1.
    if (prev === 0 && next > 0 && !hasEliteAchievement) {
      const nextMap = { ...qtyMap, [sticker.id]: next };
      if (isEliteCollectorComplete(stickers, nextMap, sticker.id)) {
        const ok = await unlockAchievement(userId, ACHIEVEMENTS.ELITE_COLLECTOR);
        if (ok) {
          setHasEliteAchievement(true);
          setEliteUnlockedOpen(true);
        }
      }
    }
  }

  function bumpQty(sticker: Sticker, delta: number) {
    const cur = qtyMap[sticker.id] ?? 0;
    const next = Math.max(0, cur + delta);
    persistQty(sticker, next);
  }

  function toggleHave(sticker: Sticker) {
    const cur = qtyMap[sticker.id] ?? 0;
    persistQty(sticker, cur >= 1 ? 0 : 1);
  }

  function toggleCollapse(code: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  }

  const teamStats = useMemo(() => {
    const map: Record<string, { total: number; owned: number; teamName: string }> = {};
    for (const s of stickers) {
      const key = s.team_code ?? '';
      if (!map[key]) map[key] = { total: 0, owned: 0, teamName: s.team };
      map[key].total++;
      if ((qtyMap[s.id] ?? 0) >= 1) map[key].owned++;
    }
    return map;
  }, [stickers, qtyMap]);

  const filtered = useMemo(() => {
    return stickers.filter((s) => {
      const q = qtyMap[s.id] ?? 0;
      const hasTrade = entryHasTrade(trades[s.id]);
      switch (filter) {
        case 'missing':
          return q === 0;
        case 'have':
          return q >= 1;
        case 'duplicate':
          return q >= 2;
        case 'tradeOrMissing':
          return q === 0 || hasTrade;
        case 'all':
        default:
          return true;
      }
    });
  }, [stickers, qtyMap, trades, filter]);

  const rows = useMemo<Row[]>(() => {
    if (!grouped) {
      return filtered.map((s) => ({ kind: 'sticker' as const, sticker: s }));
    }
    const out: Row[] = [];
    let currentCode: string | null = null;
    for (const s of filtered) {
      const code = s.team_code ?? '';
      if (code !== currentCode) {
        currentCode = code;
        const stat = teamStats[code];
        out.push({
          kind: 'team',
          team: s.team,
          teamCode: code,
          total: stat?.total ?? 0,
          owned: stat?.owned ?? 0,
          collapsed: collapsed.has(code),
        });
      }
      if (!collapsed.has(code)) out.push({ kind: 'sticker', sticker: s });
    }
    return out;
  }, [filtered, grouped, teamStats, collapsed]);

  const stats = useMemo(() => {
    let have = 0;
    let dup = 0;
    let missing = 0;
    let tradeCount = 0;
    for (const s of stickers) {
      const q = qtyMap[s.id] ?? 0;
      if (q === 0) missing++;
      else have++;
      if (q >= 2) dup += q - 1;
      if (entryHasTrade(trades[s.id])) tradeCount++;
    }
    const pct = stickers.length ? Math.round((have / stickers.length) * 100) : 0;
    return { have, dup, missing, tradeCount, total: stickers.length, pct };
  }, [stickers, qtyMap, trades]);

  async function handleExport(kind: 'pdf' | 'xls' | 'csv') {
    if (exporting) return;
    setExporting(kind);
    try {
      // Todos os exports respeitam o filtro ativo — o user escolhe "Todas"
      // pra caderneta inteira, ou um filtro pra subset (ex: só faltantes).
      const exportRows = buildRows(filtered, qtyMap, trades);
      if (exportRows.length === 0) {
        Alert.alert('Sem itens', 'Nenhuma figurinha no filtro atual pra exportar.');
        return;
      }
      const filterLabel =
        FILTERS.find((f) => f.key === filter)?.label ?? 'Todas';
      const title = `Caderneta — Copa 2026`;
      const subtitle = `${exportRows.length} figurinhas · filtro: ${filterLabel} · ${stats.have}/${stats.total} no álbum (${stats.pct}%)`;
      const ownerName = profile?.display_name
        ? `${profile.display_name}${profile.city ? ` · ${profile.city}/${profile.state}` : ''}`
        : undefined;
      if (kind === 'pdf') {
        await exportPdf(exportRows, {
          title,
          subtitle,
          ownerName,
          filterLabel,
          stats: {
            have: stats.have,
            total: stats.total,
            pct: stats.pct,
            dup: stats.dup,
            missing: stats.missing,
          },
        });
      } else if (kind === 'xls') {
        await exportXls(exportRows, title);
      } else {
        await exportCsv(exportRows);
      }
    } catch (err: any) {
      Alert.alert('Erro ao exportar', err?.message ?? 'Tente novamente.');
    } finally {
      setExporting(null);
    }
  }

  if ((loading || authLoading) && !stickers.length) {
    return (
      <View style={[styles.center, { backgroundColor: t.bg }]}>
        <ActivityIndicator />
        <Text style={{ marginTop: 12, color: t.textMuted }}>Carregando caderneta…</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      {/* Header com stats + filtros */}
      <View
        style={[
          styles.headerBlock,
          { backgroundColor: t.bgElevated, borderBottomColor: t.border },
        ]}>
        <View style={styles.statsRow}>
          <StatChip
            color="#16a34a"
            label="Tenho"
            value={`${stats.have}/${stats.total}`}
            theme={t}
          />
          <StatChip
            color="#f59e0b"
            label="Repetidas"
            value={String(stats.dup)}
            theme={t}
          />
          <StatChip
            color="#ef4444"
            label="Faltam"
            value={String(stats.missing)}
            theme={t}
          />
          <StatChip
            color="#0a7ea4"
            label="Trocas"
            value={String(stats.tradeCount)}
            theme={t}
          />
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}>
          {FILTERS.map((f) => {
            const active = filter === f.key;
            return (
              <Pressable
                key={f.key}
                onPress={() => setFilter(f.key)}
                style={[
                  styles.chip,
                  { backgroundColor: t.surface, borderColor: t.border },
                  active && { backgroundColor: t.accent, borderColor: t.accent },
                ]}>
                <Ionicons
                  name={f.icon}
                  size={13}
                  color={active ? '#fff' : t.textMuted}
                  style={{ marginRight: 5 }}
                />
                <Text
                  style={[
                    styles.chipText,
                    { color: active ? '#fff' : t.textMuted },
                  ]}>
                  {f.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={styles.toggleRow}>
          <Text style={[styles.toggleLabel, { color: t.textMuted }]}>
            {grouped ? 'Agrupado por seleção' : 'Sem agrupamento'}
          </Text>
          <Pressable
            onPress={() => setGrouped((v) => !v)}
            style={[
              styles.toggleBtn,
              {
                backgroundColor: grouped ? t.primary : t.surfaceAlt,
                borderColor: grouped ? t.primary : t.border,
              },
            ]}>
            <Ionicons
              name={grouped ? 'albums' : 'list'}
              size={14}
              color={grouped ? t.primaryText : t.textMuted}
            />
            <Text
              style={[
                styles.toggleBtnText,
                { color: grouped ? t.primaryText : t.textMuted },
              ]}>
              {grouped ? 'Agrupar' : 'Lista'}
            </Text>
          </Pressable>
        </View>
      </View>

      <FlatList
        data={rows}
        keyExtractor={(r, i) =>
          r.kind === 'team' ? `t-${r.teamCode}` : `s-${r.sticker.id}-${i}`
        }
        contentContainerStyle={{ paddingBottom: 100 }}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyBlock}>
            <MaterialCommunityIcons
              name="notebook-outline"
              size={42}
              color={t.textFaint}
            />
            <Text style={[styles.emptyText, { color: t.textMuted }]}>
              Nenhuma figurinha nesse filtro.
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          if (item.kind === 'team') {
            return (
              <TeamHeader
                team={item.team}
                teamCode={item.teamCode}
                total={item.total}
                owned={item.owned}
                collapsed={item.collapsed}
                onToggle={() => toggleCollapse(item.teamCode)}
                compact
              />
            );
          }
          const s = item.sticker;
          return (
            <CadernetaRow
              sticker={s}
              qty={qtyMap[s.id] ?? 0}
              trade={trades[s.id]}
              onIncrement={() => bumpQty(s, 1)}
              onDecrement={() => bumpQty(s, -1)}
              onToggleHave={() => toggleHave(s)}
              onOpenTrade={() => setEditing(s)}
            />
          );
        }}
      />

      {/* Bottom bar com export buttons */}
      <View
        style={[
          styles.exportBar,
          {
            backgroundColor: t.bgElevated,
            borderTopColor: t.border,
            paddingBottom: insets.bottom + 8,
          },
        ]}>
        <ExportButton
          label="PDF"
          icon="document-text"
          color="#dc2626"
          loading={exporting === 'pdf'}
          disabled={!!exporting}
          onPress={() => handleExport('pdf')}
        />
        <ExportButton
          label="Excel"
          icon="grid"
          color="#16a34a"
          loading={exporting === 'xls'}
          disabled={!!exporting}
          onPress={() => handleExport('xls')}
        />
        <ExportButton
          label="CSV"
          icon="document"
          color="#2563eb"
          loading={exporting === 'csv'}
          disabled={!!exporting}
          onPress={() => handleExport('csv')}
        />
      </View>

      <TradeSlotEditor
        sticker={editing}
        entry={editing ? trades[editing.id] : undefined}
        onClose={() => setEditing(null)}
        onChange={(slot, patch) => {
          if (editing) setSlot(editing.id, slot, patch);
        }}
        onClear={() => {
          if (editing) clearSticker(editing.id);
        }}
      />

      <EliteUnlockedModal
        visible={eliteUnlockedOpen}
        onClose={() => setEliteUnlockedOpen(false)}
        onGenerateElite={() => {
          setEliteUnlockedOpen(false);
          setTimeout(() => setEliteCreatorOpen(true), 300);
        }}
      />

      <CoverCreator
        visible={eliteCreatorOpen}
        initialVariant="elite"
        onClose={() => setEliteCreatorOpen(false)}
      />
    </View>
  );
}

function StatChip({
  color,
  label,
  value,
  theme,
}: {
  color: string;
  label: string;
  value: string;
  theme: ReturnType<typeof useTheme>;
}) {
  return (
    <View style={[styles.statChip, { backgroundColor: theme.surface }]}>
      <View style={[styles.statDot, { backgroundColor: color }]} />
      <View>
        <Text style={[styles.statValue, { color: theme.text }]}>{value}</Text>
        <Text style={[styles.statLabel, { color: theme.textMuted }]}>{label}</Text>
      </View>
    </View>
  );
}

function ExportButton({
  label,
  icon,
  color,
  loading,
  disabled,
  onPress,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  loading: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.exportBtn,
        { backgroundColor: color },
        (pressed || disabled) && { opacity: 0.6 },
      ]}>
      {loading ? (
        <ActivityIndicator color="#fff" size="small" />
      ) : (
        <>
          <Ionicons name={icon} size={16} color="#fff" />
          <Text style={styles.exportBtnText}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },

  headerBlock: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 6,
    borderBottomWidth: 1,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 10,
  },
  statChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 10,
    gap: 6,
  },
  statDot: { width: 8, height: 8, borderRadius: 4 },
  statValue: { fontSize: 13, fontWeight: '800' },
  statLabel: { fontSize: 10, fontWeight: '600' },

  filterRow: {
    gap: 6,
    paddingRight: 12,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
  },
  chipText: { fontWeight: '600', fontSize: 11 },

  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingHorizontal: 4,
  },
  toggleLabel: { fontSize: 12, fontWeight: '600' },
  toggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  toggleBtnText: { fontSize: 12, fontWeight: '700' },

  emptyBlock: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 8,
  },
  emptyText: { fontSize: 14, fontWeight: '600' },

  exportBar: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingTop: 10,
    gap: 8,
    borderTopWidth: 1,
  },
  exportBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    gap: 6,
  },
  exportBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
});
