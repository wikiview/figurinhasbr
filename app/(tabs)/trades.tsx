import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Linking,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/src/providers/AuthProvider';
import { supabase } from '@/src/lib/supabase';
import { useTheme } from '@/src/hooks/useTheme';
import type { TradeMatch } from '@/src/lib/types';

type Scope = 'city' | 'state' | 'all';

export default function TradesScreen() {
  const { session, profile } = useAuth();
  const t = useTheme();
  const [matches, setMatches] = useState<TradeMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [scope, setScope] = useState<Scope>('city');

  const load = useCallback(async () => {
    if (!session?.user.id) return;
    const { data, error } = await supabase.rpc('find_trade_matches', {
      my_id: session.user.id,
      scope,
    });
    if (error) {
      console.warn(error);
      Alert.alert('Erro', error.message);
    }
    setMatches((data ?? []) as TradeMatch[]);
    setLoading(false);
    setRefreshing(false);
  }, [session?.user.id, scope]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  function openWhatsApp(m: TradeMatch) {
    if (!m.whatsapp) {
      Alert.alert(
        'Sem WhatsApp',
        `${m.display_name} não cadastrou WhatsApp. Aguarde o chat in-app (em breve).`,
      );
      return;
    }
    const offerList = m.they_offer.slice(0, 8).join(', ');
    const needList = m.they_need.slice(0, 8).join(', ');
    const msg = encodeURIComponent(
      `Oi ${m.display_name}! Te achei no app Figurinha 📒⚽\n\n` +
        `Você tem ${m.they_offer.length} que eu preciso (ex: ${offerList})\n` +
        `Eu tenho ${m.they_need.length} que você precisa (ex: ${needList})\n\n` +
        `Topa trocar?`,
    );
    const phone = m.whatsapp.replace(/\D/g, '');
    const url = `https://wa.me/${phone}?text=${msg}`;
    Linking.openURL(url).catch(() =>
      Alert.alert('Erro', 'Não consegui abrir o WhatsApp.'),
    );
  }

  if (!profile?.city) {
    return (
      <View style={[styles.center, { backgroundColor: t.bg }]}>
        <Text style={[styles.title, { color: t.text }]}>Defina sua cidade</Text>
        <Text style={[styles.sub, { color: t.textMuted }]}>
          Vai pra aba Perfil e adiciona cidade/UF — sem isso não consigo achar trocas perto de você.
        </Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <View style={styles.scopeRow}>
        <ScopeBtn
          active={scope === 'city'}
          icon="business"
          label={profile.city}
          sub={`em ${profile.city}/${profile.state}`}
          onPress={() => setScope('city')}
          theme={t}
        />
        <ScopeBtn
          active={scope === 'state'}
          icon="map"
          label={profile.state}
          sub={`todo ${profile.state}`}
          onPress={() => setScope('state')}
          theme={t}
        />
        <ScopeBtn
          active={scope === 'all'}
          icon="globe"
          label="Brasil"
          sub="qualquer lugar"
          onPress={() => setScope('all')}
          theme={t}
        />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator />
        </View>
      ) : !matches.length ? (
        <View style={styles.center}>
          <Text style={[styles.title, { color: t.text }]}>Nenhuma troca por enquanto 😔</Text>
          <Text style={[styles.sub, { color: t.textMuted }]}>
            {scope === 'city'
              ? `Em ${profile.city}/${profile.state} ainda não achei. Tenta expandir pro estado ou pro país inteiro.`
              : scope === 'state'
              ? `Em todo ${profile.state} não achei. Tenta no Brasil inteiro.`
              : 'Marque mais figurinhas (incluindo as repetidas) e chame os amigos pra entrar no app — quanto mais gente, mais matches!'}
          </Text>
          <Pressable
            style={[styles.refreshBtn, { backgroundColor: t.primary }]}
            onPress={() => {
              setLoading(true);
              load();
            }}>
            <Text style={[styles.refreshText, { color: t.primaryText }]}>Tentar de novo</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={matches}
          keyExtractor={(m) => m.partner_id}
          contentContainerStyle={{ padding: 16, paddingTop: 8, gap: 12 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                load();
              }}
            />
          }
          renderItem={({ item }) => (
            <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.border }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={[styles.avatar, { backgroundColor: t.primary }]}>
                  <Text style={[styles.avatarText, { color: t.primaryText }]}>
                    {item.display_name.slice(0, 1).toUpperCase()}
                  </Text>
                </View>
                <View style={{ marginLeft: 12, flex: 1 }}>
                  <Text style={[styles.name, { color: t.text }]}>{item.display_name}</Text>
                  <Text style={[styles.city, { color: t.textMuted }]}>
                    {item.city}/{item.state}
                  </Text>
                </View>
                <View style={[styles.scoreBadge, { backgroundColor: t.dupBg, borderColor: t.dupBorder, borderWidth: 1 }]}>
                  <Text style={[styles.scoreText, { color: t.dupText }]}>{item.match_score}</Text>
                </View>
              </View>

              <View style={[styles.divider, { backgroundColor: t.border }]} />

              <Row
                label="Tem que você precisa"
                count={item.they_offer.length}
                color="#22c55e"
                sample={item.they_offer.slice(0, 6)}
                muted={t.textMuted}
              />
              <Row
                label="Precisa que você tem"
                count={item.they_need.length}
                color="#f59e0b"
                sample={item.they_need.slice(0, 6)}
                muted={t.textMuted}
              />

              <Pressable style={styles.waBtn} onPress={() => openWhatsApp(item)}>
                <Text style={styles.waBtnText}>💬 Combinar troca</Text>
              </Pressable>
            </View>
          )}
        />
      )}
    </View>
  );
}

function ScopeBtn({
  active,
  icon,
  label,
  sub,
  onPress,
  theme,
}: {
  active: boolean;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  sub: string;
  onPress: () => void;
  theme: ReturnType<typeof useTheme>;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.scopeBtn,
        { backgroundColor: theme.surface, borderColor: theme.border },
        active && { backgroundColor: theme.primary, borderColor: theme.primary },
      ]}>
      <Ionicons name={icon} size={18} color={active ? theme.primaryText : theme.primary} />
      <Text
        style={[
          styles.scopeLabel,
          { color: active ? theme.primaryText : theme.text },
        ]}
        numberOfLines={1}>
        {label}
      </Text>
      <Text
        style={[
          styles.scopeSub,
          { color: active ? theme.primaryText : theme.textMuted, opacity: active ? 0.85 : 1 },
        ]}
        numberOfLines={1}>
        {sub}
      </Text>
    </Pressable>
  );
}

function Row({
  label,
  count,
  color,
  sample,
  muted,
}: {
  label: string;
  count: number;
  color: string;
  sample: string[];
  muted: string;
}) {
  return (
    <View style={{ marginTop: 8 }}>
      <Text style={[styles.rowLabel, { color }]}>
        {label}: <Text style={{ fontWeight: '800' }}>{count}</Text>
      </Text>
      {sample.length > 0 && (
        <Text style={[styles.sample, { color: muted }]}>
          {sample.join(' · ')}
          {count > sample.length ? ' …' : ''}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  title: { fontSize: 20, fontWeight: '800', marginBottom: 8 },
  sub: { textAlign: 'center', lineHeight: 22 },
  refreshBtn: {
    marginTop: 24,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  refreshText: { fontWeight: '700' },

  scopeRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
    gap: 8,
  },
  scopeBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    alignItems: 'flex-start',
  },
  scopeLabel: { fontWeight: '800', fontSize: 14, marginTop: 6 },
  scopeSub: { fontSize: 11, marginTop: 2 },

  card: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 18, fontWeight: '800' },
  name: { fontSize: 16, fontWeight: '700' },
  city: { fontSize: 13 },
  scoreBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  scoreText: { fontWeight: '800' },
  divider: { height: 1, marginTop: 12 },
  rowLabel: { fontSize: 13, fontWeight: '600' },
  sample: { fontSize: 12, marginTop: 2 },
  waBtn: {
    marginTop: 12,
    backgroundColor: '#22c55e',
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  waBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
