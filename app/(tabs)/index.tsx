import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/src/providers/AuthProvider';
import { supabase } from '@/src/lib/supabase';
import { StickerCard } from '@/src/components/StickerCard';
import { StickerListItem } from '@/src/components/StickerListItem';
import { StickerDetail } from '@/src/components/StickerDetail';
import { PlayerCelebration } from '@/src/components/PlayerCelebration';
import { AchievementCelebration } from '@/src/components/AchievementCelebration';
import { EliteUnlockedModal } from '@/src/components/EliteUnlockedModal';
import { CoverCreator } from '@/src/components/CoverCreator';
import { hasPlayerGif, getPlayerGifUrl } from '@/src/data/player-gifs';
import {
  ACHIEVEMENTS,
  type AchievementCode,
  isEliteCollectorComplete,
  loadAchievements,
  unlockAchievement,
} from '@/src/lib/achievements';
import { Image as ExpoImage } from 'expo-image';
import { CollectionHeader } from '@/src/components/CollectionHeader';
import { TeamHeader } from '@/src/components/TeamHeader';
import { CollectionSearch } from '@/src/components/CollectionSearch';
import { UserCover } from '@/src/components/UserCover';
import { OverviewModal } from '@/src/components/OverviewModal';
import { StickerScanner } from '@/src/components/StickerScanner';
import { AppBanner } from '@/src/components/AppBanner';
import { bumpCounter } from '@/src/lib/ads';
import { useCardMode, useViewMode } from '@/src/hooks/usePreferences';
import { useTheme } from '@/src/hooks/useTheme';
import { normalizeSearch } from '@/src/lib/search';
import type { Sticker } from '@/src/lib/types';

type Filter = 'all' | 'missing' | 'have' | 'duplicate';

const FILTERS: { key: Filter; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'all', label: 'Todas', icon: 'apps' },
  { key: 'missing', label: 'Faltam', icon: 'square-outline' },
  { key: 'have', label: 'Tenho', icon: 'checkmark-circle' },
  { key: 'duplicate', label: 'Repetidas', icon: 'copy' },
];

const CARD_COLS = 4;

type Row =
  | { kind: 'hero' }
  | { kind: 'stats' }
  | { kind: 'controls' }
  | {
      kind: 'team';
      team: string;
      teamCode: string;
      total: number;
      owned: number;
      collapsed: boolean;
    }
  | { kind: 'stickers'; key: string; items: Sticker[] };

export default function CollectionScreen() {
  const { session, profile } = useAuth();
  const userId = session?.user.id;
  const t = useTheme();
  const insets = useSafeAreaInsets();

  const [stickers, setStickers] = useState<Sticker[]>([]);
  const [qtyMap, setQtyMap] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');

  // Busca + tags + colapsadas
  const [searchText, setSearchText] = useState('');
  const [tags, setTags] = useState<Set<string>>(new Set());
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Sticker | null>(null);
  const [celebration, setCelebration] = useState<Sticker | null>(null);
  const [achievementCelebration, setAchievementCelebration] =
    useState<Sticker | null>(null);
  const [eliteUnlockedOpen, setEliteUnlockedOpen] = useState(false);
  const [eliteCreatorOpen, setEliteCreatorOpen] = useState(false);
  const [unlockedAchievements, setUnlockedAchievements] = useState<
    Set<AchievementCode>
  >(new Set());
  const [overviewOpen, setOverviewOpen] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const { mode: cardMode } = useCardMode();
  const { mode: viewMode, setMode: setViewMode } = useViewMode();
  const flatListRef = useRef<FlatList>(null);

  // Tracking de scroll pra fade do header overlay quando o user scrolla
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler({
    onScroll: (e) => {
      scrollY.value = e.contentOffset.y;
    },
  });
  // Threshold aproximado: hero (~140) + statsCard (~120) - margem
  // Overlay fade-in: começa em ~80, completo em ~200
  const headerOverlayStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      scrollY.value,
      [80, 200],
      [0, 1],
      Extrapolation.CLAMP,
    ),
  }));

  // Spacer interno do controlsBlock: cresce com scroll pra criar paddingTop
  // dinâmico. No início é 0 (search colada no card), e quando vira sticky já
  // tem altura insets.top + 4 (search bar visível abaixo do status bar).
  const stickySpacerStyle = useAnimatedStyle(() => ({
    height: interpolate(
      scrollY.value,
      [80, 200],
      [0, insets.top + 4],
      Extrapolation.CLAMP,
    ),
  }));

  function jumpToFirstTeam(filterKey: Filter) {
    // Toggle: se já tá ativo, desseleciona (volta pra 'all')
    const next = filter === filterKey ? 'all' : filterKey;
    setFilter(next);
    // Só rola pra baixo se está ativando um filtro
    if (next !== 'all') {
      requestAnimationFrame(() => {
        setTimeout(() => {
          flatListRef.current?.scrollToOffset({ offset: 380, animated: true });
        }, 80);
      });
    }
  }

  function addTag(code: string) {
    setTags((prev) => {
      const next = new Set(prev);
      next.add(code);
      return next;
    });
    setSearchText('');
  }
  function removeTag(code: string) {
    setTags((prev) => {
      const next = new Set(prev);
      next.delete(code);
      return next;
    });
  }
  function toggleCollapse(code: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  }

  // Códigos únicos pra collapse-all
  const allTeamCodes = useMemo(() => {
    const set = new Set<string>();
    for (const s of stickers) if (s.team_code) set.add(s.team_code);
    return Array.from(set);
  }, [stickers]);

  const allCollapsed =
    allTeamCodes.length > 0 && allTeamCodes.every((c) => collapsed.has(c));

  function toggleCollapseAll() {
    if (allCollapsed) setCollapsed(new Set());
    else setCollapsed(new Set(allTeamCodes));
  }

  const load = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      setRefreshing(false);
      return;
    }

    // Retry com backoff: cobre o cold-start (TestFlight 1ª abertura) onde a
    // primeira request HTTP frequentemente falha em silêncio (TLS/DNS frio) e
    // volta `data=null` ou `data=[]`. `stickers` nunca deve estar vazia em
    // prod, então uma resposta vazia é tratada como falha transitória.
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
        if (e1) console.warn('[load] stickers attempt %d:', attempt + 1, e1.message);
        if (e2) console.warn('[load] user_stickers attempt %d:', attempt + 1, e2.message);
        if (sList && sList.length > 0) {
          loadedStickers = sList as Sticker[];
          loadedUserStickers = usList ?? [];
          break;
        }
        console.warn('[load] empty stickers on attempt %d — retrying', attempt + 1);
      } catch (e) {
        console.warn('[load] attempt %d failed:', attempt + 1, e);
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
    // Cinto de segurança: nunca deixa o spinner preso por mais de 12s,
    // independente do que aconteça com a query ou com o userId.
    const safety = setTimeout(() => setLoading(false), 12000);
    load().finally(() => clearTimeout(safety));
    return () => clearTimeout(safety);
  }, [load]);

  useEffect(() => {
    if (!userId) return;
    loadAchievements(userId).then(setUnlockedAchievements).catch(() => {});
  }, [userId]);

  // Pré-fetcha em background os GIFs dos top players que o user ainda não tem.
  // Roda uma vez por sessão, depois da primeira load. expo-image cuida do
  // cache disco — URLs já baixadas não fazem request de novo.
  const prefetchedRef = useRef(false);
  useEffect(() => {
    if (loading || prefetchedRef.current || stickers.length === 0) return;
    prefetchedRef.current = true;
    const urls: string[] = [];
    for (const s of stickers) {
      if ((qtyMap[s.id] ?? 0) > 0) continue;
      const url = getPlayerGifUrl(s.team_code, s.number);
      if (url) urls.push(url);
    }
    if (urls.length > 0) {
      ExpoImage.prefetch(urls, 'memory-disk').catch(() => {});
    }
  }, [loading, stickers, qtyMap]);

  async function bumpQty(sticker: Sticker, delta: number) {
    if (!userId) return;
    const current = qtyMap[sticker.id] ?? 0;
    const next = Math.max(0, current + delta);
    if (next === current) return;
    setQtyMap((m) => ({ ...m, [sticker.id]: next }));
    const { error } = await supabase.from('user_stickers').upsert({
      user_id: userId,
      sticker_id: sticker.id,
      qty: next,
      updated_at: new Date().toISOString(),
    });
    if (error) {
      Alert.alert('Erro', error.message);
      setQtyMap((m) => ({ ...m, [sticker.id]: current }));
      return;
    }
    // Celebração da primeira figurinha de top player (só no modo modal).
    // RN não renderiza Modal sobre Modal, então fechamos o detalhe antes
    // e abrimos a celebração depois da animação de fechamento (~250ms).
    if (
      delta > 0 &&
      current === 0 &&
      cardMode === 'modal' &&
      hasPlayerGif(sticker.team_code, sticker.number)
    ) {
      const gifUrl = getPlayerGifUrl(sticker.team_code, sticker.number);
      if (gifUrl) {
        ExpoImage.prefetch(gifUrl, 'memory-disk').catch(() => {});
      }
      // Se essa figurinha completa a coleção de top players (43 com GIF),
      // dispara a conquista secreta em vez do GIF normal
      const isEliteUnlock =
        !unlockedAchievements.has(ACHIEVEMENTS.ELITE_COLLECTOR) &&
        isEliteCollectorComplete(stickers, qtyMap, sticker.id);
      setSelected(null);
      if (isEliteUnlock) {
        unlockAchievement(userId, ACHIEVEMENTS.ELITE_COLLECTOR).then((ok) => {
          if (ok) {
            setUnlockedAchievements((prev) => {
              const next = new Set(prev);
              next.add(ACHIEVEMENTS.ELITE_COLLECTOR);
              return next;
            });
          }
        });
        setTimeout(() => setAchievementCelebration(sticker), 250);
      } else {
        setTimeout(() => setCelebration(sticker), 250);
      }
    }
    // Conta só incrementos (delta positivo) pro intersticial a cada 15
    if (delta > 0) {
      bumpCounter('stickers', 15, !!profile?.is_premium, delta).catch(() => {});
    }
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

  const rows = useMemo<Row[]>(() => {
    const trimmed = normalizeSearch(searchText.trim());
    const filtered = stickers.filter((s) => {
      // status
      const q = qtyMap[s.id] ?? 0;
      if (filter === 'missing' && q !== 0) return false;
      if (filter === 'have' && q < 1) return false;
      if (filter === 'duplicate' && q < 2) return false;

      // tags país (OR entre códigos)
      if (tags.size > 0 && !tags.has(s.team_code ?? '')) return false;

      // texto livre (player name / team / number / code) — sem acento, lowercase
      if (trimmed) {
        const matches =
          normalizeSearch(s.team).includes(trimmed) ||
          (s.player_name ? normalizeSearch(s.player_name).includes(trimmed) : false) ||
          s.number.includes(trimmed) ||
          (s.team_code ? normalizeSearch(s.team_code).includes(trimmed) : false);
        if (!matches) return false;
      }
      return true;
    });

    const out: Row[] = [
      { kind: 'hero' },
      { kind: 'stats' },
      { kind: 'controls' },
    ];
    let currentCode: string | null = null;
    let buffer: Sticker[] = [];
    const cols = viewMode === 'list' ? 1 : CARD_COLS;

    function flushBuffer() {
      while (buffer.length) {
        const slice = buffer.splice(0, cols);
        out.push({
          kind: 'stickers',
          key: `${currentCode}-${out.length}`,
          items: slice,
        });
      }
    }

    for (const s of filtered) {
      const code = s.team_code ?? '';
      if (code !== currentCode) {
        flushBuffer();
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
      if (!collapsed.has(code)) buffer.push(s);
    }
    flushBuffer();
    return out;
  }, [stickers, qtyMap, filter, teamStats, searchText, tags, collapsed, viewMode]);

  const stats = useMemo(() => {
    let have = 0,
      dup = 0,
      missing = 0;
    for (const s of stickers) {
      const q = qtyMap[s.id] ?? 0;
      if (q === 0) missing++;
      else have++;
      if (q >= 2) dup += q - 1;
    }
    const pct = stickers.length ? Math.round((have / stickers.length) * 100) : 0;
    return { have, dup, missing, total: stickers.length, pct };
  }, [stickers, qtyMap]);

  if (loading && !stickers.length) {
    return (
      <View style={[styles.center, { backgroundColor: t.bg }]}>
        <ActivityIndicator />
        <Text style={{ marginTop: 12, color: t.textMuted }}>Carregando catálogo…</Text>
      </View>
    );
  }

  if (!stickers.length) {
    return (
      <View style={[styles.center, { backgroundColor: t.bg }]}>
        <Text style={[styles.empty, { color: t.text }]}>Não conseguimos carregar o álbum.</Text>
        <Text style={[styles.emptySub, { color: t.textMuted }]}>
          Verifique sua conexão e tente novamente.
        </Text>
        <Pressable
          onPress={() => {
            setLoading(true);
            load();
          }}
          style={({ pressed }) => [
            styles.retryBtn,
            { backgroundColor: t.primary },
            pressed && { opacity: 0.75 },
          ]}>
          <Ionicons name="refresh" size={16} color={t.primaryText} />
          <Text style={[styles.retryBtnText, { color: t.primaryText }]}>Tentar de novo</Text>
        </Pressable>
      </View>
    );
  }

  // Index do item "controls" pra fixar como sticky header
  const controlsIndex = rows.findIndex((r) => r.kind === 'controls');
  const stickyIndices = controlsIndex >= 0 ? [controlsIndex] : undefined;

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <Animated.FlatList
        ref={flatListRef as any}
        data={rows}
        keyExtractor={(r: Row) => {
          if (r.kind === 'hero') return 'k-hero';
          if (r.kind === 'stats') return 'k-stats';
          if (r.kind === 'controls') return 'k-controls';
          if (r.kind === 'team') return `t-${r.teamCode}`;
          return r.key;
        }}
        stickyHeaderIndices={stickyIndices}
        contentContainerStyle={{ paddingBottom: 80 }}
        keyboardShouldPersistTaps="handled"
        onScroll={onScroll}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
          />
        }
        renderItem={({ item }) => {
          if (item.kind === 'hero') {
            return (
              <CollectionHeader title="Coleção" subtitle="Álbum da Copa do Mundo 2026™" />
            );
          }
          if (item.kind === 'stats') {
            return (
              <View style={styles.statsCardWrap}>
                <View style={styles.statsRow}>
                  <UserCover
                    size={92}
                    hasEliteBadge={unlockedAchievements.has(
                      ACHIEVEMENTS.ELITE_COLLECTOR,
                    )}
                  />
                  <View
                    style={[
                      styles.statsCard,
                      { backgroundColor: t.surface, flex: 1, marginLeft: 12 },
                    ]}>
                  <StatPill
                    icon="checkmark-circle"
                    iconBg="#dcfce7"
                    iconColor="#16a34a"
                    value={`${stats.have}`}
                    suffix={`/${stats.total}`}
                    label="Tenho"
                    valueColor="#16a34a"
                    labelColor={t.textMuted}
                    suffixColor={t.textFaint}
                    onPress={() => jumpToFirstTeam('have')}
                  />
                  <View style={[styles.statDivider, { backgroundColor: t.borderSubtle }]} />
                  <StatPill
                    icon="copy"
                    iconBg="#ffedd5"
                    iconColor="#f97316"
                    value={String(stats.dup)}
                    label="Repetidas"
                    valueColor="#f97316"
                    labelColor={t.textMuted}
                    suffixColor={t.textFaint}
                    onPress={() => jumpToFirstTeam('duplicate')}
                  />
                  <View style={[styles.statDivider, { backgroundColor: t.borderSubtle }]} />
                  <StatPill
                    icon="square-outline"
                    iconBg="#fee2e2"
                    iconColor="#ef4444"
                    value={String(stats.missing)}
                    label="Faltam"
                    valueColor="#ef4444"
                    labelColor={t.textMuted}
                    suffixColor={t.textFaint}
                    onPress={() => jumpToFirstTeam('missing')}
                  />
                  </View>
                </View>
              </View>
            );
          }
          if (item.kind === 'controls') {
            return (
              <View style={[styles.controlsBlock, { backgroundColor: t.bg }]}>
                <Animated.View style={[{ backgroundColor: t.bg }, stickySpacerStyle]} />
                <CollectionSearch
                  searchText={searchText}
                  setSearchText={setSearchText}
                  tags={tags}
                  addTag={addTag}
                  removeTag={removeTag}
                  stickers={stickers}
                />
                <View style={styles.filterRow}>
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
                          style={{ marginRight: 4 }}
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
                  <Pressable
                    onPress={() => setViewMode(viewMode === 'cards' ? 'list' : 'cards')}
                    style={[
                      styles.collapseBtn,
                      { backgroundColor: t.surface, borderColor: t.border },
                    ]}>
                    <Ionicons
                      name={viewMode === 'cards' ? 'list' : 'grid'}
                      size={16}
                      color={t.textMuted}
                    />
                  </Pressable>
                  <Pressable
                    onPress={toggleCollapseAll}
                    style={[
                      styles.collapseBtn,
                      { backgroundColor: t.surface, borderColor: t.border },
                    ]}>
                    <Ionicons
                      name={allCollapsed ? 'expand' : 'contract'}
                      size={16}
                      color={t.textMuted}
                    />
                  </Pressable>
                </View>
              </View>
            );
          }
          if (item.kind === 'team') {
            return (
              <TeamHeader
                team={item.team}
                teamCode={item.teamCode}
                total={item.total}
                owned={item.owned}
                collapsed={item.collapsed}
                onToggle={() => toggleCollapse(item.teamCode)}
                compact={viewMode === 'list'}
              />
            );
          }
          if (viewMode === 'list') {
            const s = item.items[0];
            if (!s) return null;
            return (
              <StickerListItem
                key={s.id}
                sticker={s}
                qty={qtyMap[s.id] ?? 0}
                onIncrement={() => bumpQty(s, 1)}
                onDecrement={() => bumpQty(s, -1)}
              />
            );
          }
          return (
            <View style={styles.stickerRow}>
              {item.items.map((s: Sticker) => (
                <StickerCard
                  key={s.id}
                  sticker={s}
                  qty={qtyMap[s.id] ?? 0}
                  mode={cardMode}
                  onPress={cardMode === 'modal' ? () => setSelected(s) : undefined}
                  onIncrement={cardMode === 'inline' ? () => bumpQty(s, 1) : undefined}
                  onDecrement={cardMode === 'inline' ? () => bumpQty(s, -1) : undefined}
                />
              ))}
              {Array.from({ length: CARD_COLS - item.items.length }).map((_, i) => (
                <View key={`f-${i}`} style={styles.fillerCell} />
              ))}
            </View>
          );
        }}
      />

      {/* Overlay sólido no topo, aparece com fade conforme o user scrolla.
          Cobre a área do status bar com sombra inferior — efeito header elevado. */}
      <Animated.View
        pointerEvents="none"
        style={[
          {
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: insets.top + 4,
            backgroundColor: t.bg,
            shadowColor: '#000',
            shadowOpacity: 0.08,
            shadowRadius: 6,
            shadowOffset: { width: 0, height: 3 },
            elevation: 4,
            borderBottomWidth: StyleSheet.hairlineWidth,
            borderBottomColor: t.border,
          },
          headerOverlayStyle,
        ]}
      />

      <StickerDetail
        sticker={selected}
        qty={selected ? qtyMap[selected.id] ?? 0 : 0}
        onClose={() => setSelected(null)}
        onIncrement={() => selected && bumpQty(selected, 1)}
        onDecrement={() => selected && bumpQty(selected, -1)}
      />

      <PlayerCelebration
        sticker={celebration}
        onClose={() => setCelebration(null)}
      />

      <AchievementCelebration
        sticker={achievementCelebration}
        onClose={() => {
          setAchievementCelebration(null);
          // Depois da celebração, abre o modal de unlock com CTA pra gerar a capa.
          setTimeout(() => setEliteUnlockedOpen(true), 300);
        }}
      />

      <EliteUnlockedModal
        visible={eliteUnlockedOpen}
        onClose={() => setEliteUnlockedOpen(false)}
        onGenerateElite={() => {
          setEliteUnlockedOpen(false);
          // Espera o fade-out antes de abrir o CoverCreator (RN não renderiza modal sobre modal)
          setTimeout(() => setEliteCreatorOpen(true), 300);
        }}
      />

      <CoverCreator
        visible={eliteCreatorOpen}
        initialVariant="elite"
        onClose={() => setEliteCreatorOpen(false)}
      />

      <AppBanner />
      <Pressable
        onPress={() => setOverviewOpen(true)}
        style={({ pressed }) => [
          styles.progressFooter,
          { backgroundColor: t.surface, borderTopColor: t.border },
          pressed && { opacity: 0.7 },
        ]}>
        <MaterialCommunityIcons name="cards-outline" size={22} color={t.textMuted} />
        <View style={{ flex: 1, marginLeft: 10 }}>
          <View style={styles.progressLabelRow}>
            <Text style={[styles.progressLabel, { color: t.textMuted }]}>Progresso do álbum</Text>
            <Text style={[styles.progressPct, { color: t.primary }]}>{stats.pct}% completo</Text>
          </View>
          <View style={[styles.progressBar, { backgroundColor: t.surfaceAlt }]}>
            <View style={[styles.progressFill, { width: `${stats.pct}%`, backgroundColor: t.primary }]} />
          </View>
        </View>
        <Ionicons name="chevron-forward" size={18} color={t.textFaint} style={{ marginLeft: 8 }} />
      </Pressable>

      <OverviewModal
        visible={overviewOpen}
        onClose={() => setOverviewOpen(false)}
        stickers={stickers}
        qtyMap={qtyMap}
      />

      {/* FAB pra escanear figurinhas */}
      <Pressable
        onPress={() => setScannerOpen(true)}
        style={({ pressed }) => [
          styles.scanFab,
          { backgroundColor: t.primary, bottom: 80 + insets.bottom },
          pressed && { transform: [{ scale: 0.94 }] },
        ]}>
        <Ionicons name="scan" size={26} color={t.primaryText} />
      </Pressable>

      <StickerScanner
        visible={scannerOpen}
        onClose={() => setScannerOpen(false)}
        stickers={stickers}
        onConfirmed={(n) => {
          load();
          Alert.alert('Pronto!', `${n} figurinha${n === 1 ? '' : 's'} adicionada${n === 1 ? '' : 's'} à sua coleção.`);
        }}
        onEliteUnlocked={() => {
          // Atualiza cache local de achievements
          setUnlockedAchievements((prev) => {
            const next = new Set(prev);
            next.add(ACHIEVEMENTS.ELITE_COLLECTOR);
            return next;
          });
          // Abre o modal de unlock após o scanner fechar (espera animação de close).
          setTimeout(() => setEliteUnlockedOpen(true), 500);
        }}
      />
    </View>
  );
}

function StatPill({
  icon,
  iconBg,
  iconColor,
  value,
  suffix,
  label,
  valueColor,
  labelColor,
  suffixColor,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  iconBg: string;
  iconColor: string;
  value: string;
  suffix?: string;
  label: string;
  valueColor: string;
  labelColor: string;
  suffixColor: string;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.statPill, pressed && { opacity: 0.6 }]}>
      <View style={[styles.statIcon, { backgroundColor: iconBg }]}>
        <Ionicons name={icon} size={18} color={iconColor} />
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: 6 }}>
        <Text style={[styles.statValue, { color: valueColor }]}>{value}</Text>
        {suffix && <Text style={[styles.statSuffix, { color: suffixColor }]}>{suffix}</Text>}
      </View>
      <Text style={[styles.statLabel, { color: labelColor }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#fff',
  },
  empty: { fontSize: 18, fontWeight: '700', textAlign: 'center' },
  emptySub: { marginTop: 8, color: '#667', textAlign: 'center' },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 20,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
  },
  retryBtnText: { fontWeight: '700', fontSize: 14 },

  statsCardWrap: {
    marginTop: -28,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statsCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 20,
    paddingVertical: 14,
    paddingHorizontal: 8,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
    alignItems: 'center',
  },
  statPill: { flex: 1, alignItems: 'center' },
  statIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statValue: { fontSize: 22, fontWeight: '800' },
  statSuffix: { color: '#94a3b8', fontSize: 13, marginLeft: 1, fontWeight: '600' },
  statLabel: { color: '#64748b', fontSize: 12, marginTop: 2 },
  statDivider: { width: 1, height: 36, backgroundColor: '#f1f5f9', alignSelf: 'center' },

  controlsBlock: {
    paddingBottom: 4,
  },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 6,
  },
  chip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  collapseBtn: {
    width: 36,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipActive: { backgroundColor: '#0b1d3a', borderColor: '#0b1d3a' },
  chipText: { color: '#475569', fontWeight: '600', fontSize: 12 },
  chipTextActive: { color: '#fff' },

  stickerRow: {
    flexDirection: 'row',
    paddingHorizontal: 11, // 11 + margem 5 do card = 16 (alinha com stats card)
  },
  fillerCell: { flex: 1, margin: 5 },

  progressFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  progressLabelRow: { flexDirection: 'row', justifyContent: 'space-between' },
  progressLabel: { color: '#475569', fontSize: 12, fontWeight: '600' },
  progressPct: { color: '#0a7ea4', fontSize: 12, fontWeight: '700' },
  progressBar: {
    height: 6,
    backgroundColor: '#e2e8f0',
    borderRadius: 999,
    marginTop: 6,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: '#0a7ea4', borderRadius: 999 },

  scanFab: {
    position: 'absolute',
    right: 18,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 8,
  },
});
