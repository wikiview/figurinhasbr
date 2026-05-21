import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import { useAuth } from '@/src/providers/AuthProvider';
import { supabase } from '@/src/lib/supabase';
import { useTheme } from '@/src/hooks/useTheme';
import { bumpCounter } from '@/src/lib/ads';
import { canScanNow, consumeScan, getScansRemaining, SCAN_DAILY_LIMIT } from '@/src/lib/scanQuota';
import type { Sticker } from '@/src/lib/types';
import { PaywallModal } from '@/src/components/PaywallModal';
import {
  ACHIEVEMENTS,
  isEliteCollectorComplete,
  loadAchievements,
  unlockAchievement,
} from '@/src/lib/achievements';

type Props = {
  visible: boolean;
  onClose: () => void;
  stickers: Sticker[];
  onConfirmed: (added: number) => void;
  /** Disparado quando o user adicionou a 43ª figurinha de craque pela primeira vez. */
  onEliteUnlocked?: () => void;
};

type Step = 'photo' | 'scanning' | 'review';

export function StickerScanner({ visible, onClose, stickers, onConfirmed, onEliteUnlocked }: Props) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { session, profile } = useAuth();
  const [step, setStep] = useState<Step>('photo');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [photoB64, setPhotoB64] = useState<string | null>(null);
  const [foundCodes, setFoundCodes] = useState<string[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [ownedQty, setOwnedQty] = useState<Map<string, number>>(new Map());
  const [saving, setSaving] = useState(false);
  const [paywallOpen, setPaywallOpen] = useState(false);

  const stickerById = new Map(stickers.map((s) => [s.id, s]));

  // Conta quantas vezes cada código apareceu no scan (duplicatas físicas na foto).
  // Ordem preservada pela primeira ocorrência.
  const scanCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of foundCodes) m.set(c, (m.get(c) ?? 0) + 1);
    return m;
  }, [foundCodes]);

  const uniqueCodes = useMemo(() => Array.from(scanCounts.keys()), [scanCounts]);

  const totalSelected = useMemo(() => {
    let n = 0;
    for (const c of selected) n += scanCounts.get(c) ?? 0;
    return n;
  }, [selected, scanCounts]);

  useEffect(() => {
    if (!visible) {
      setTimeout(() => {
        setStep('photo');
        setPhotoUri(null);
        setPhotoB64(null);
        setFoundCodes([]);
        setSelected(new Set());
        setOwnedQty(new Map());
        setSaving(false);
      }, 200);
    }
  }, [visible]);

  async function pickFromCamera() {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permissão negada', 'Precisamos da câmera pra escanear.');
      return;
    }
    const r = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      base64: true,
    });
    if (!r.canceled && r.assets[0]) {
      setPhotoB64(r.assets[0].base64 ?? null);
      setPhotoUri(r.assets[0].uri);
    }
  }

  async function pickFromGallery() {
    const r = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      base64: true,
    });
    if (!r.canceled && r.assets[0]) {
      setPhotoB64(r.assets[0].base64 ?? null);
      setPhotoUri(r.assets[0].uri);
    }
  }

  async function scan() {
    if (!photoB64 || !session?.access_token) return;
    // Gate de quota: free tem 10 scans/dia, reseta às 00:00. Premium é ilimitado.
    const isPremium = !!profile?.is_premium;
    const allowed = await canScanNow(isPremium);
    if (!allowed) {
      Alert.alert(
        'Limite diário atingido',
        `Você usou os ${SCAN_DAILY_LIMIT} scans grátis de hoje. O contador reseta à meia-noite. Pra escanear sem limite, ative o Premium (R$ 14,90, vitalício).`,
        [
          { text: 'Ok', style: 'cancel' },
          { text: 'Ativar Premium', onPress: () => setPaywallOpen(true) },
        ],
      );
      return;
    }
    setStep('scanning');
    try {
      const supabaseUrl =
        process.env.EXPO_PUBLIC_SUPABASE_URL ??
        (Constants.expoConfig?.extra as any)?.supabaseUrl ??
        '';
      const res = await fetch(`${supabaseUrl}/functions/v1/scan-stickers`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ photo_base64: photoB64 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail ?? data.error ?? `HTTP ${res.status}`);
      const codes: string[] = data.codes ?? [];
      // Filtra só os que existem no catálogo (preservando duplicatas físicas).
      const knownCodes = codes.filter((c) => stickerById.has(c));
      setFoundCodes(knownCodes);
      // Set deduplica naturalmente — a seleção é por código único.
      setSelected(new Set(knownCodes));
      // Busca quantidade atual de cada figurinha pra mostrar se já tem.
      const uniqueKnown = Array.from(new Set(knownCodes));
      if (uniqueKnown.length > 0 && session?.user.id) {
        const { data: existing } = await supabase
          .from('user_stickers')
          .select('sticker_id,qty')
          .eq('user_id', session.user.id)
          .in('sticker_id', uniqueKnown);
        setOwnedQty(
          new Map(
            (existing ?? []).map((r: { sticker_id: string; qty: number }) => [r.sticker_id, r.qty]),
          ),
        );
      } else {
        setOwnedQty(new Map());
      }
      // Consome a quota só depois do scan dar certo (não gasta se falhou).
      const remaining = await consumeScan(isPremium);
      if (!isPremium && remaining <= 3 && remaining >= 0) {
        // Aviso amigável quando tá perto do limite
        setTimeout(() => {
          Alert.alert(
            'Scans restantes hoje',
            remaining === 0
              ? `Esse foi seu último scan grátis hoje. Volta amanhã ou ative o Premium.`
              : `Você tem mais ${remaining} scan${remaining === 1 ? '' : 's'} grátis hoje.`,
          );
        }, 400);
      }
      setStep('review');
    } catch (e: any) {
      Alert.alert('Não rolou o scan', e?.message ?? 'Tenta de novo.');
      setStep('photo');
    }
  }

  function toggle(code: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  }

  async function confirm() {
    if (!session?.user.id || selected.size === 0) return;
    setSaving(true);
    try {
      // Pra cada código selecionado, incrementa pela quantidade que apareceu
      // na foto (suporta duplicatas físicas no mesmo scan).
      const codes = Array.from(selected);
      const { data: existing } = await supabase
        .from('user_stickers')
        .select('sticker_id,qty')
        .eq('user_id', session.user.id)
        .in('sticker_id', codes);
      const existingMap = new Map(
        (existing ?? []).map((r: { sticker_id: string; qty: number }) => [r.sticker_id, r.qty]),
      );
      let addedTotal = 0;
      const upserts = codes.map((c) => {
        const delta = scanCounts.get(c) ?? 1;
        addedTotal += delta;
        return {
          user_id: session.user.id,
          sticker_id: c,
          qty: (existingMap.get(c) ?? 0) + delta,
          updated_at: new Date().toISOString(),
        };
      });
      const { error } = await supabase.from('user_stickers').upsert(upserts);
      if (error) throw error;
      // Intersticial a cada 3 scans completos (não 3 figurinhas)
      bumpCounter('scans', 3, !!profile?.is_premium).catch(() => {});

      // Detecta unlock do achievement Elite — varre os códigos adicionados.
      // qtyMap final = existingMap + delta de cada upsert.
      try {
        const finalQty: Record<string, number> = {};
        for (const c of codes) {
          finalQty[c] = (existingMap.get(c) ?? 0) + (scanCounts.get(c) ?? 1);
        }
        // Inclui o resto da coleção (qty já existentes pros stickers não tocados neste scan).
        // Busca o map completo do user pra ser preciso na verificação.
        const { data: allOwned } = await supabase
          .from('user_stickers')
          .select('sticker_id,qty')
          .eq('user_id', session.user.id);
        const fullMap: Record<string, number> = {};
        (allOwned ?? []).forEach((r: { sticker_id: string; qty: number }) => {
          fullMap[r.sticker_id] = r.qty;
        });
        // Garante que os recém-adicionados estão no map (já devem estar pelo upsert).
        for (const c of codes) {
          if ((fullMap[c] ?? 0) === 0) fullMap[c] = finalQty[c];
        }
        const eliteCompleted = codes.some((c) =>
          isEliteCollectorComplete(stickers, fullMap, c),
        );
        if (eliteCompleted) {
          const set = await loadAchievements(session.user.id);
          if (!set.has(ACHIEVEMENTS.ELITE_COLLECTOR)) {
            const ok = await unlockAchievement(
              session.user.id,
              ACHIEVEMENTS.ELITE_COLLECTOR,
            );
            if (ok) onEliteUnlocked?.();
          }
        }
      } catch (e) {
        console.warn('[StickerScanner] elite check fail', e);
      }

      onConfirmed(addedTotal);
      onClose();
    } catch (e: any) {
      Alert.alert('Erro ao salvar', e?.message ?? 'Tenta de novo.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.container, { backgroundColor: t.bg, paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Pressable
            onPress={onClose}
            hitSlop={12}
            style={[styles.closeBtn, { backgroundColor: t.surfaceAlt }]}>
            <Ionicons name="close" size={20} color={t.textMuted} />
          </Pressable>
          <Text style={[styles.title, { color: t.text }]}>
            {step === 'photo' ? 'Scan de figurinhas' : step === 'scanning' ? 'Lendo…' : 'Confirme'}
          </Text>
          <View style={{ width: 32 }} />
        </View>

        {step === 'photo' && (
          <ScrollView contentContainerStyle={styles.photoWrap}>
            <Text style={[styles.intro, { color: t.textMuted }]}>
              Tira uma foto de várias figurinhas com o <Text style={{ color: t.text, fontWeight: '700' }}>VERSO virado pra cima</Text> (onde tá escrito BRA 5, FWC 14, etc). A IA lê todas de uma vez.
            </Text>
            {photoUri ? (
              <Image source={{ uri: photoUri }} style={styles.preview} contentFit="contain" />
            ) : (
              <View
                style={[
                  styles.previewPlaceholder,
                  { backgroundColor: t.surfaceAlt, borderColor: t.border },
                ]}>
                <Ionicons name="scan" size={64} color={t.textFaint} />
              </View>
            )}
            <View style={styles.actionsRow}>
              <Pressable
                onPress={pickFromCamera}
                style={[styles.action, { backgroundColor: t.surface, borderColor: t.border }]}>
                <Ionicons name="camera" size={22} color={t.primary} />
                <Text style={[styles.actionText, { color: t.text }]}>Câmera</Text>
              </Pressable>
              <Pressable
                onPress={pickFromGallery}
                style={[styles.action, { backgroundColor: t.surface, borderColor: t.border }]}>
                <Ionicons name="images" size={22} color={t.primary} />
                <Text style={[styles.actionText, { color: t.text }]}>Galeria</Text>
              </Pressable>
            </View>
            {photoB64 && (
              <Pressable
                onPress={scan}
                style={[styles.primaryBtn, { backgroundColor: t.primary, marginTop: 16 }]}>
                <Ionicons name="sparkles" size={18} color={t.primaryText} />
                <Text style={[styles.primaryBtnText, { color: t.primaryText }]}>Escanear</Text>
              </Pressable>
            )}
          </ScrollView>
        )}

        {step === 'scanning' && (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={t.primary} />
            <Text style={[styles.scanLoad, { color: t.textMuted }]}>
              Identificando figurinhas…
            </Text>
          </View>
        )}

        {step === 'review' && (
          <View style={{ flex: 1 }}>
            <Text style={[styles.summary, { color: t.text }]}>
              Achei <Text style={{ color: t.primary, fontWeight: '800' }}>{foundCodes.length}</Text> figurinha
              {foundCodes.length === 1 ? '' : 's'}
              {uniqueCodes.length !== foundCodes.length && (
                <Text style={{ color: t.textMuted }}>
                  {' '}
                  ({uniqueCodes.length} código{uniqueCodes.length === 1 ? '' : 's'} diferente
                  {uniqueCodes.length === 1 ? '' : 's'})
                </Text>
              )}
              .{'\n'}
              <Text style={[styles.summarySub, { color: t.textMuted }]}>
                Toque pra desselecionar as que estiverem erradas. <Text style={{ color: t.scanDupText, fontWeight: '700' }}>Laranja</Text> = apareceu mais de uma vez na foto.
              </Text>
            </Text>
            <ScrollView contentContainerStyle={{ padding: 12, paddingBottom: 100, gap: 8 }}>
              {uniqueCodes.length === 0 && (
                <Text style={{ color: t.textMuted, padding: 16 }}>
                  Nenhum código identificado. Volta e tira foto melhor (verso pra cima, sem reflexo).
                </Text>
              )}
              {uniqueCodes.map((code) => {
                const sticker = stickerById.get(code);
                const active = selected.has(code);
                const scanCount = scanCounts.get(code) ?? 1;
                const qty = ownedQty.get(code) ?? 0;
                const hasIt = qty > 0;
                const isDup = qty >= 2;
                const scanDup = scanCount >= 2;
                // Badge da coleção atual (independente do scan)
                const badgeBg = !hasIt ? t.surfaceAlt : isDup ? t.dupBg : t.haveBg;
                const badgeBorder = !hasIt ? t.border : isDup ? t.dupBorder : t.haveBorder;
                const badgeText = !hasIt ? t.textMuted : isDup ? t.dupText : t.haveText;
                // Cor da linha quando selecionada:
                //  - 2+ na foto → laranja (scanDup) — algumas viram repetida na hora
                //  - já tem na coleção → amarelo (dup) — a nova vira repetida
                //  - nova → verde (have)
                let activeBg = t.haveBg;
                let activeBorder = t.haveBorder;
                let activeText = t.haveText;
                let activeIcon = '#22c55e';
                if (scanDup) {
                  activeBg = t.scanDupBg;
                  activeBorder = t.scanDupBorder;
                  activeText = t.scanDupText;
                  activeIcon = '#fb923c';
                } else if (hasIt) {
                  activeBg = t.dupBg;
                  activeBorder = t.dupBorder;
                  activeText = t.dupText;
                  activeIcon = '#f59e0b';
                }
                return (
                  <Pressable
                    key={code}
                    onPress={() => toggle(code)}
                    style={[
                      styles.row,
                      {
                        backgroundColor: active ? activeBg : t.surface,
                        borderColor: active ? activeBorder : t.border,
                      },
                    ]}>
                    <Ionicons
                      name={active ? 'checkmark-circle' : 'ellipse-outline'}
                      size={20}
                      color={active ? activeIcon : t.textFaint}
                    />
                    <View style={{ marginLeft: 10, flex: 1 }}>
                      <View style={styles.codeHeader}>
                        <Text style={[styles.codeText, { color: active ? activeText : t.text }]}>
                          {code}
                        </Text>
                        {scanDup && (
                          <View
                            style={[
                              styles.scanCountPill,
                              { backgroundColor: t.scanDupBg, borderColor: t.scanDupBorder },
                            ]}>
                            <Text style={[styles.scanCountText, { color: t.scanDupText }]}>
                              ×{scanCount} na foto
                            </Text>
                          </View>
                        )}
                      </View>
                      {sticker?.player_name && (
                        <Text style={[styles.codeSub, { color: t.textMuted }]} numberOfLines={1}>
                          {sticker.player_name}
                        </Text>
                      )}
                    </View>
                    <View
                      style={[
                        styles.ownedBadge,
                        { backgroundColor: badgeBg, borderColor: badgeBorder },
                      ]}>
                      <Text style={[styles.ownedText, { color: badgeText }]}>
                        {hasIt ? `Tem ${qty}` : 'Não tem'}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
            <View
              style={[
                styles.fixedFooter,
                {
                  backgroundColor: t.bg,
                  borderTopColor: t.border,
                  paddingBottom: insets.bottom + 12,
                },
              ]}>
              <Pressable
                onPress={confirm}
                disabled={saving || selected.size === 0}
                style={[
                  styles.primaryBtn,
                  { backgroundColor: t.primary },
                  (saving || selected.size === 0) && { opacity: 0.5 },
                ]}>
                {saving ? (
                  <ActivityIndicator color={t.primaryText} />
                ) : (
                  <>
                    <Ionicons name="add-circle" size={18} color={t.primaryText} />
                    <Text style={[styles.primaryBtnText, { color: t.primaryText }]}>
                      Adicionar {totalSelected} figurinha{totalSelected === 1 ? '' : 's'}
                    </Text>
                  </>
                )}
              </Pressable>
            </View>
          </View>
        )}

        <PaywallModal
          visible={paywallOpen}
          onClose={() => setPaywallOpen(false)}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 18, fontWeight: '800' },

  photoWrap: { padding: 20, alignItems: 'center' },
  intro: { fontSize: 13, textAlign: 'center', marginBottom: 12, lineHeight: 18 },
  preview: { width: '100%', aspectRatio: 1, borderRadius: 16, marginVertical: 12 },
  previewPlaceholder: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 16,
    marginVertical: 12,
    borderWidth: 2,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionsRow: { flexDirection: 'row', gap: 12, width: '100%' },
  action: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  actionText: { fontWeight: '700', fontSize: 13 },

  primaryBtn: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: { fontSize: 15, fontWeight: '800' },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  scanLoad: { fontSize: 13 },

  summary: { fontSize: 14, padding: 16, lineHeight: 20 },
  summarySub: { fontSize: 12, fontWeight: '500' },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  codeHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  codeText: { fontSize: 14, fontWeight: '800' },
  codeSub: { fontSize: 12, marginTop: 2 },
  scanCountPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    borderWidth: 1,
  },
  scanCountText: { fontSize: 10, fontWeight: '800' },
  ownedBadge: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
    marginLeft: 8,
  },
  ownedText: { fontSize: 11, fontWeight: '700' },

  fixedFooter: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
  },
});
