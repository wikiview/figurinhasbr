import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { Image } from 'expo-image';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/src/hooks/useTheme';
import { flagUrl } from '@/src/lib/flags';
import type { Sticker } from '@/src/lib/types';

type Props = {
  visible: boolean;
  onClose: () => void;
  stickers: Sticker[];
  qtyMap: Record<string, number>;
};

const SPECIAL_KEYS = new Set(['INTRO', 'COPA', 'SEDES', 'MUSEU', 'EXTRA', 'CC']);

function sectionKey(s: Sticker): { key: string; name: string } {
  const code = s.team_code ?? '';
  if (code === 'FWC') {
    if (s.id === 'FWC-00') return { key: 'INTRO', name: 'Introdução' };
    const n = parseInt(s.number, 10);
    if (n <= 4) return { key: 'COPA', name: 'Copa 2026' };
    if (n <= 8) return { key: 'SEDES', name: 'Bola e Sedes' };
    return { key: 'MUSEU', name: 'Museu FIFA' };
  }
  if (code === 'EXTRA') return { key: 'EXTRA', name: 'Esmaltadas' };
  if (code === 'CC') return { key: 'CC', name: 'Coca-Cola' };
  return { key: code, name: s.team };
}

export function OverviewModal({ visible, onClose, stickers, qtyMap }: Props) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const [mounted, setMounted] = useState(visible);
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(40);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      opacity.value = withTiming(1, { duration: 160 });
      translateY.value = withTiming(0, { duration: 220 });
    } else if (mounted) {
      opacity.value = withTiming(0, { duration: 140 });
      translateY.value = withTiming(40, { duration: 180 }, (done) => {
        if (done) runOnJS(setMounted)(false);
      });
    }
  }, [visible, mounted, opacity, translateY]);

  const backdropStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  const sheetStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  const sections = useMemo(() => {
    const map = new Map<string, { key: string; name: string; total: number; owned: number }>();
    for (const s of stickers) {
      const { key, name } = sectionKey(s);
      const ent = map.get(key) ?? { key, name, total: 0, owned: 0 };
      ent.total++;
      if ((qtyMap[s.id] ?? 0) >= 1) ent.owned++;
      map.set(key, ent);
    }
    return Array.from(map.values()).map((s) => ({
      ...s,
      pct: s.total ? Math.round((s.owned / s.total) * 100) : 0,
      complete: s.owned === s.total,
    }));
  }, [stickers, qtyMap]);

  const totalOwned = sections.reduce((acc, s) => acc + s.owned, 0);
  const totalAll = sections.reduce((acc, s) => acc + s.total, 0);
  const totalPct = totalAll ? Math.round((totalOwned / totalAll) * 100) : 0;

  const teams = sections.filter((s) => !SPECIAL_KEYS.has(s.key));
  const specials = sections.filter((s) => SPECIAL_KEYS.has(s.key));
  const teamsComplete = teams.filter((s) => s.complete).length;

  const badges = useMemo(() => {
    const list: { id: string; icon: string; label: string; unlocked: boolean }[] = [];
    // Specials
    specials.forEach((s) =>
      list.push({
        id: `sec-${s.key}`,
        icon: s.key === 'CC' ? 'bottle-soda-classic' : s.key === 'EXTRA' ? 'medal' : 'trophy',
        label: `${s.name} completo`,
        unlocked: s.complete,
      }),
    );
    // Marcos de seleções
    [
      { n: 1, label: '1ª seleção completa' },
      { n: 5, label: '5 seleções completas' },
      { n: 10, label: '10 seleções completas' },
      { n: 24, label: 'Metade das seleções' },
      { n: 48, label: 'Todas as 48 seleções!' },
    ].forEach(({ n, label }) =>
      list.push({
        id: `team-${n}`,
        icon: n === 48 ? 'crown' : 'soccer',
        label,
        unlocked: teamsComplete >= n,
      }),
    );
    // Milestones gerais
    [25, 50, 75, 100].forEach((p) =>
      list.push({
        id: `pct-${p}`,
        icon: p === 100 ? 'trophy-variant' : 'progress-check',
        label: `${p}% do álbum`,
        unlocked: totalPct >= p,
      }),
    );
    return list;
  }, [specials, teamsComplete, totalPct]);

  if (!mounted) return null;

  return (
    <Modal transparent visible animationType="none" onRequestClose={onClose}>
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: t.backdrop },
          backdropStyle,
        ]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>

      <View style={styles.center} pointerEvents="box-none">
        <Animated.View
          style={[
            styles.sheet,
            { backgroundColor: t.bg, paddingBottom: insets.bottom + 12 },
            sheetStyle,
          ]}>
          {/* Header */}
          <View style={[styles.handle, { backgroundColor: t.border }]} />
          <View style={styles.header}>
            <Text style={[styles.title, { color: t.text }]}>Conquistas</Text>
            <Pressable onPress={onClose} hitSlop={12} style={[styles.closeBtn, { backgroundColor: t.surfaceAlt }]}>
              <Ionicons name="close" size={20} color={t.textMuted} />
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={{ padding: 16, paddingTop: 8 }}
            showsVerticalScrollIndicator={false}>
            {/* Total */}
            <View style={[styles.totalCard, { backgroundColor: t.surface, borderColor: t.border }]}>
              <Text style={[styles.totalNum, { color: t.primary }]}>
                {totalOwned}
                <Text style={[styles.totalDen, { color: t.textFaint }]}>/{totalAll}</Text>
              </Text>
              <Text style={[styles.totalLabel, { color: t.textMuted }]}>
                figurinhas coletadas · {totalPct}%
              </Text>
              <View style={[styles.barTrack, { backgroundColor: t.surfaceAlt }]}>
                <View
                  style={[
                    styles.barFill,
                    { width: `${totalPct}%`, backgroundColor: t.primary },
                  ]}
                />
              </View>
            </View>

            {/* Badges */}
            <Text style={[styles.sectionHead, { color: t.text }]}>Badges</Text>
            <View style={styles.badgesGrid}>
              {badges.map((b) => (
                <View
                  key={b.id}
                  style={[
                    styles.badge,
                    {
                      backgroundColor: b.unlocked ? t.dupBg : t.surface,
                      borderColor: b.unlocked ? t.dupBorder : t.border,
                      opacity: b.unlocked ? 1 : 0.55,
                    },
                  ]}>
                  <MaterialCommunityIcons
                    name={b.icon as any}
                    size={26}
                    color={b.unlocked ? '#facc15' : t.textFaint}
                  />
                  <Text
                    style={[
                      styles.badgeLabel,
                      { color: b.unlocked ? t.text : t.textMuted },
                    ]}
                    numberOfLines={2}>
                    {b.label}
                  </Text>
                </View>
              ))}
            </View>

            {/* Especiais */}
            <Text style={[styles.sectionHead, { color: t.text }]}>Especiais</Text>
            {specials.map((s) => (
              <SectionRow key={s.key} section={s} t={t} />
            ))}

            {/* Seleções */}
            <Text style={[styles.sectionHead, { color: t.text }]}>
              Seleções ({teamsComplete}/{teams.length} completas)
            </Text>
            {teams.map((s) => (
              <SectionRow key={s.key} section={s} t={t} flag />
            ))}
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

function SectionRow({
  section,
  t,
  flag,
}: {
  section: { key: string; name: string; total: number; owned: number; pct: number; complete: boolean };
  t: ReturnType<typeof useTheme>;
  flag?: boolean;
}) {
  const flagSrc = flag ? flagUrl(section.key, 80) : null;
  return (
    <View style={[styles.row, { borderColor: t.border }]}>
      <View style={[styles.rowIcon, { backgroundColor: t.surfaceAlt }]}>
        {flagSrc ? (
          <Image source={{ uri: flagSrc }} style={styles.rowFlag} contentFit="cover" />
        ) : (
          <MaterialCommunityIcons
            name={section.key === 'CC' ? 'bottle-soda-classic' : section.key === 'EXTRA' ? 'medal' : 'trophy'}
            size={18}
            color="#facc15"
          />
        )}
      </View>
      <View style={{ flex: 1, marginLeft: 10 }}>
        <Text style={[styles.rowName, { color: t.text }]} numberOfLines={1}>
          {section.name}
        </Text>
        <View style={styles.rowBarTrack}>
          <View style={[styles.rowBarTrackInner, { backgroundColor: t.surfaceAlt }]} />
          <View
            style={[
              styles.rowBarFill,
              {
                width: `${section.pct}%`,
                backgroundColor: section.complete ? '#22c55e' : '#0a7ea4',
              },
            ]}
          />
        </View>
      </View>
      <View style={styles.rowRight}>
        <Text style={[styles.rowCount, { color: t.text }]}>
          {section.owned}/{section.total}
        </Text>
        {section.complete && (
          <MaterialCommunityIcons name="check-decagram" size={16} color="#22c55e" />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '88%',
    paddingTop: 6,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  title: { fontSize: 20, fontWeight: '800' },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },

  totalCard: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    alignItems: 'center',
  },
  totalNum: { fontSize: 40, fontWeight: '900' },
  totalDen: { fontSize: 18, fontWeight: '700' },
  totalLabel: { fontSize: 13, marginTop: 2 },
  barTrack: {
    width: '100%',
    height: 8,
    borderRadius: 999,
    marginTop: 12,
    overflow: 'hidden',
  },
  barFill: { height: '100%', borderRadius: 999 },

  sectionHead: { fontSize: 14, fontWeight: '800', marginTop: 24, marginBottom: 10 },

  badgesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  badge: {
    width: '31%',
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 80,
  },
  badgeLabel: {
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 6,
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  rowIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  rowFlag: { width: '100%', height: '100%' },
  rowName: { fontSize: 13, fontWeight: '700' },
  rowBarTrack: {
    height: 4,
    borderRadius: 999,
    marginTop: 6,
    position: 'relative',
  },
  rowBarTrackInner: { ...StyleSheet.absoluteFillObject, borderRadius: 999 },
  rowBarFill: {
    height: 4,
    borderRadius: 999,
    position: 'absolute',
    left: 0,
    top: 0,
  },
  rowRight: {
    alignItems: 'flex-end',
    marginLeft: 12,
    flexDirection: 'row',
    gap: 4,
  },
  rowCount: { fontSize: 12, fontWeight: '800' },
});
