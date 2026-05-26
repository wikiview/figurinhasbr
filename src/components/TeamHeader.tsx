import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { flagUrl } from '@/src/lib/flags';
import { useTheme } from '@/src/hooks/useTheme';

type Props = {
  team: string;
  teamCode: string;
  total: number;
  owned: number;
  collapsed: boolean;
  onToggle: () => void;
  compact?: boolean;
};

const SECTION_NAMES: Record<string, string> = {
  FWC: 'Especiais',
  EXTRA: 'Esmaltadas (Bronze, Prata, Ouro)',
};

const SECTION_ICONS: Record<string, 'trophy' | 'medal'> = {
  FWC: 'trophy',
  EXTRA: 'medal',
};

export function TeamHeader({
  team,
  teamCode,
  total,
  owned,
  collapsed,
  onToggle,
  compact = false,
}: Props) {
  const t = useTheme();
  const pct = total ? Math.round((owned / total) * 100) : 0;
  const isSpecial = teamCode in SECTION_NAMES;
  const displayName = isSpecial ? SECTION_NAMES[teamCode] : team;
  const flag = isSpecial ? null : flagUrl(teamCode, 160);
  const sectionIcon = isSpecial ? SECTION_ICONS[teamCode] : null;
  const crestSize = compact ? 28 : 44;
  const iconSize = compact ? 16 : 24;
  const flagWidth = compact ? 28 : 44;
  const flagHeight = compact ? 20 : 30;

  return (
    <Pressable
      onPress={onToggle}
      style={[
        compact ? styles.wrapCompact : styles.wrap,
        { backgroundColor: t.surface, borderColor: t.border },
      ]}>
      <View
        style={[
          {
            width: crestSize,
            height: crestSize,
            borderRadius: compact ? 8 : 12,
            backgroundColor: t.surfaceAlt,
            borderColor: t.border,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 1,
            overflow: 'hidden',
          },
        ]}>
        {sectionIcon ? (
          <MaterialCommunityIcons
            name={sectionIcon}
            size={iconSize}
            color="#facc15"
          />
        ) : flag ? (
          <Image
            source={{ uri: flag }}
            style={{ width: flagWidth, height: flagHeight }}
            contentFit="cover"
            transition={150}
          />
        ) : (
          <Text style={[styles.code, { color: t.text }]}>{teamCode}</Text>
        )}
      </View>

      <View style={{ flex: 1, marginLeft: compact ? 10 : 12 }}>
        <Text
          style={[compact ? styles.nameCompact : styles.name, { color: t.text }]}
          numberOfLines={1}>
          {displayName}
        </Text>
        <Text
          style={[compact ? styles.subCompact : styles.sub, { color: t.textMuted }]}>
          {owned}/{total}
          {compact ? '' : ' coletadas'} · {pct}%
        </Text>
      </View>

      {pct === 100 && (
        <MaterialCommunityIcons
          name="check-decagram"
          size={compact ? 16 : 20}
          color="#22c55e"
          style={{ marginRight: 8 }}
        />
      )}

      <Ionicons
        name={collapsed ? 'chevron-down' : 'chevron-up'}
        size={compact ? 16 : 20}
        color={t.textFaint}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginTop: 18,
    marginBottom: 4,
    borderTopWidth: 1,
    borderBottomWidth: 1,
  },
  wrapCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 8,
    marginBottom: 2,
    borderTopWidth: 1,
    borderBottomWidth: 1,
  },
  code: { fontWeight: '800', fontSize: 13 },
  name: { fontSize: 16, fontWeight: '800' },
  nameCompact: { fontSize: 13, fontWeight: '800' },
  sub: { fontSize: 12, marginTop: 2 },
  subCompact: { fontSize: 11, marginTop: 1 },
});
