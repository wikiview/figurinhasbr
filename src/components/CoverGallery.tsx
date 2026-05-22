import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  LayoutAnimation,
  type LayoutAnimationConfig,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  UIManager,
  View,
} from 'react-native';
import Animated, {
  Easing,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { Image } from 'expo-image';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as MediaLibrary from 'expo-media-library';
import { useTheme } from '@/src/hooks/useTheme';
import { useParallaxTilt } from '@/src/hooks/useParallaxTilt';
import {
  useCovers,
  setActiveCover,
  deleteCover as removeCover,
  type LocalCover,
  type CoverVariant,
} from '@/src/lib/covers';
import { CoverCreator } from '@/src/components/CoverCreator';

/** Posição+tamanho do elemento de origem na tela (medido via measureInWindow). */
export type OriginRect = {
  x: number;
  y: number;
  width: number;
  height: number;
  /** borderRadius inicial do elemento original (pra animar até o destino) */
  borderRadius?: number;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  /** Posição da capa atual no profile, pra animar shared-element. Se null, fallback de fade. */
  originRect: OriginRect | null;
  /** Variante inicial pro CoverCreator quando user clicar em "+ Nova capa". */
  initialCreatorVariant?: CoverVariant;
};

const { width: SCREEN_W } = Dimensions.get('window');

// Layout estilo iPhone Photos: capa ATUAL grande, ocupando quase a tela toda;
// capas antigas viram thumbs bem pequenos embaixo.
const SCREEN_PADDING = 16;

// Hero: 85% da largura, proporção 3:4 (figurinha real). Centralizado.
const HERO_W = SCREEN_W * 0.85;
const HERO_H = HERO_W * 1.33;
const HERO_BORDER_RADIUS = 18;

// Thumbs antigas: 4 colunas, gaps pequenos, bem compactas.
const GRID_COLUMNS = 4;
const GRID_GAP = 6;
const GRID_CARD_W = (SCREEN_W - SCREEN_PADDING * 2 - GRID_GAP * (GRID_COLUMNS - 1)) / GRID_COLUMNS;
const GRID_CARD_H = GRID_CARD_W * 1.33;

// Habilita LayoutAnimation no Android (no iOS já é default). Idempotente.
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const SWAP_LAYOUT_ANIM: LayoutAnimationConfig = {
  duration: 420,
  create: {
    type: LayoutAnimation.Types.easeInEaseOut,
    property: LayoutAnimation.Properties.opacity,
  },
  update: {
    type: LayoutAnimation.Types.easeInEaseOut,
    springDamping: 0.75,
  },
  delete: {
    type: LayoutAnimation.Types.easeInEaseOut,
    property: LayoutAnimation.Properties.opacity,
  },
};

export function CoverGallery({
  visible,
  onClose,
  originRect,
  initialCreatorVariant = 'standard',
}: Props) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { active, items, loading } = useCovers();

  const [mounted, setMounted] = useState(false);
  const [creatorOpen, setCreatorOpen] = useState(false);
  const [creatorVariant, setCreatorVariant] = useState<CoverVariant>(initialCreatorVariant);
  // Controla quando o sheen holographic pode aparecer — só depois que a Image
  // do hero terminou de carregar. Evita ver efeito sobre o fundo preto.
  const [heroImageLoaded, setHeroImageLoaded] = useState(false);

  // Centro de destino do hero (na coluna central, abaixo do header)
  const heroDestX = SCREEN_W / 2 - HERO_W / 2;
  const heroDestY = insets.top + 80;

  // Origem (se houver). Se não, usa o destino — animação degenera pra fade.
  const startX = originRect?.x ?? heroDestX;
  const startY = originRect?.y ?? heroDestY;
  const startW = originRect?.width ?? HERO_W;
  const startH = originRect?.height ?? HERO_H;
  const startRadius = originRect?.borderRadius ?? HERO_BORDER_RADIUS;

  // Animações compartilhadas — começam no estado "origem"
  const heroX = useSharedValue(startX);
  const heroY = useSharedValue(startY);
  const heroW = useSharedValue(startW);
  const heroH = useSharedValue(startH);
  const heroRadius = useSharedValue(startRadius);
  const backdropOpacity = useSharedValue(0);
  const heroOpacity = useSharedValue(originRect ? 1 : 0);
  const gridOpacity = useSharedValue(0);
  const gridTranslate = useSharedValue(24);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      // Reset shared values pro ponto de origem (cada abertura pode ter outro origin)
      heroX.value = startX;
      heroY.value = startY;
      heroW.value = startW;
      heroH.value = startH;
      heroRadius.value = startRadius;
      heroOpacity.value = originRect ? 1 : 0;
      backdropOpacity.value = 0;
      gridOpacity.value = 0;
      gridTranslate.value = 24;

      const easing = Easing.bezier(0.22, 1, 0.36, 1);
      const ENTER = 360;

      backdropOpacity.value = withTiming(1, { duration: ENTER, easing });
      heroOpacity.value = withTiming(1, { duration: 220 });
      heroX.value = withTiming(heroDestX, { duration: ENTER, easing });
      heroY.value = withTiming(heroDestY, { duration: ENTER, easing });
      heroW.value = withTiming(HERO_W, { duration: ENTER, easing });
      heroH.value = withTiming(HERO_H, { duration: ENTER, easing });
      heroRadius.value = withTiming(HERO_BORDER_RADIUS, { duration: ENTER, easing });

      // Grid entra com delay pequeno
      gridOpacity.value = withDelay(180, withTiming(1, { duration: 360, easing }));
      gridTranslate.value = withDelay(180, withTiming(0, { duration: 380, easing }));
    } else if (mounted) {
      // Saída — reverso da animação
      const easing = Easing.bezier(0.22, 1, 0.36, 1);
      const EXIT = 280;
      gridOpacity.value = withTiming(0, { duration: 160 });
      gridTranslate.value = withTiming(24, { duration: 160 });
      backdropOpacity.value = withDelay(40, withTiming(0, { duration: EXIT, easing }));
      heroX.value = withDelay(40, withTiming(startX, { duration: EXIT, easing }));
      heroY.value = withDelay(40, withTiming(startY, { duration: EXIT, easing }));
      heroW.value = withDelay(40, withTiming(startW, { duration: EXIT, easing }));
      heroH.value = withDelay(40, withTiming(startH, { duration: EXIT, easing }));
      heroRadius.value = withDelay(40, withTiming(startRadius, { duration: EXIT, easing }));
      heroOpacity.value = withDelay(
        40 + EXIT - 100,
        withTiming(originRect ? 1 : 0, { duration: 100 }, (done) => {
          if (done) runOnJS(setMounted)(false);
        }),
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // Camada externa: posição/tamanho/clip FIXOS (não rotacionam). Funciona como
  // "janela" 2D pela qual vemos o card tiltado.
  const heroClipStyle = useAnimatedStyle(() => ({
    position: 'absolute',
    left: heroX.value,
    top: heroY.value,
    width: heroW.value,
    height: heroH.value,
    opacity: heroOpacity.value,
    borderRadius: heroRadius.value,
  }));
  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdropOpacity.value }));
  const gridAnimStyle = useAnimatedStyle(() => ({
    opacity: gridOpacity.value,
    transform: [{ translateY: gridTranslate.value }],
  }));

  // Hero = capa ativa do store local; o grid mostra as demais.
  const heroCover = active;
  const otherCovers = heroCover
    ? items.filter((c) => c.id !== heroCover.id)
    : items;

  // Reset estado do load quando trocar de capa hero — força o sheen a esperar
  // a nova Image carregar antes de aparecer.
  useEffect(() => {
    setHeroImageLoaded(false);
  }, [heroCover?.uri]);

  // Tilt parallax — só ativo quando o hero é Elite.
  // scale: 1.15 dá uma "margem visual" pra cobrir o bound mesmo em tilt extremo
  // (evita ver borda preta do heroClip quando o 3D inclina forte).
  const heroTilt = useParallaxTilt(heroCover?.variant === 'elite');
  const heroTiltStyle = useAnimatedStyle(() => ({
    transform: [
      { perspective: 900 },
      { scale: 1.15 },
      { rotateX: `${heroTilt.rotateX.value}deg` },
      { rotateY: `${heroTilt.rotateY.value}deg` },
    ],
  }));
  // Sheen holographic — banda fina que viaja mais com o tilt. Cor só onde
  // o sheen está visível; resto da figurinha fica original.
  const heroShineStyle = useAnimatedStyle(() => {
    const dx = interpolate(heroTilt.rotateY.value, [-18, 18], [-110, 110]);
    const dy = interpolate(heroTilt.rotateX.value, [-18, 18], [-110, 110]);
    return {
      opacity: 0.95,
      transform: [{ translateX: dx }, { translateY: dy }],
    };
  });

  async function setAsCover(id: string) {
    // Anima o swap: a capa selecionada sobe pro slot hero, a antiga desce pro
    // grid. LayoutAnimation aplica no próximo re-render automaticamente.
    LayoutAnimation.configureNext(SWAP_LAYOUT_ANIM);
    await setActiveCover(id);
  }

  async function downloadHero() {
    if (!heroCover) return;
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permissão negada',
          'Precisa permitir acesso à galeria pra salvar a capa.',
        );
        return;
      }
      // A capa já é um arquivo local — salva direto na galeria do iPhone.
      await MediaLibrary.saveToLibraryAsync(heroCover.uri);
      Alert.alert('Salvou', 'Capa salva na galeria do seu iPhone.');
    } catch (e: any) {
      Alert.alert('Erro ao salvar', e?.message ?? 'Tenta de novo em alguns segundos.');
    }
  }

  function deleteHero() {
    if (!heroCover) return;
    confirmDelete(heroCover);
  }

  async function deleteCover(row: LocalCover) {
    // removeCover apaga o arquivo, atualiza o índice e reabre a capa ativa.
    await removeCover(row.id);
  }

  function onPressCover(row: LocalCover) {
    // Toque numa capa do grid = define ela como capa atual direto.
    if (row.id === heroCover?.id) return;
    setAsCover(row.id);
  }

  function confirmDelete(row: LocalCover) {
    Alert.alert('Excluir capa', 'Tem certeza? Essa ação não desfaz.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Excluir', style: 'destructive', onPress: () => deleteCover(row) },
    ]);
  }

  function openCreator(variant: CoverVariant) {
    setCreatorVariant(variant);
    setCreatorOpen(true);
  }

  if (!mounted) return null;

  return (
    <Modal transparent visible animationType="none" onRequestClose={onClose}>
      <Animated.View style={[StyleSheet.absoluteFill, backdropStyle]}>
        <View style={[StyleSheet.absoluteFill, { backgroundColor: t.bg }]} />
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>

      {/* Header: close + title + (download/delete da hero) + nova capa */}
      <Animated.View
        style={[
          styles.header,
          {
            paddingTop: insets.top + 8,
            paddingHorizontal: SCREEN_PADDING,
          },
          backdropStyle,
        ]}>
        <Pressable
          onPress={onClose}
          hitSlop={12}
          style={[styles.closeBtn, { backgroundColor: t.surfaceAlt }]}>
          <Ionicons name="close" size={20} color={t.textMuted} />
        </Pressable>
        <Text style={[styles.title, { color: t.text }]}>Suas capas</Text>
        <View style={styles.headerActions}>
          {heroCover && (
            <>
              <Pressable
                onPress={downloadHero}
                hitSlop={10}
                style={[styles.headerBtnGhost, { backgroundColor: t.surfaceAlt }]}>
                <Ionicons name="download-outline" size={18} color={t.textMuted} />
              </Pressable>
              <Pressable
                onPress={deleteHero}
                hitSlop={10}
                style={[styles.headerBtnGhost, { backgroundColor: t.surfaceAlt }]}>
                <Ionicons name="trash-outline" size={18} color={t.dupText} />
              </Pressable>
            </>
          )}
          <Pressable
            onPress={() => openCreator('standard')}
            hitSlop={12}
            style={[styles.headerBtn, { backgroundColor: t.primary }]}>
            <Ionicons name="add" size={18} color={t.primaryText} />
          </Pressable>
        </View>
      </Animated.View>

      {/* Hero — DUAS camadas:
            1) CLIP layer (heroClipStyle): position/size/opacity/borderRadius + overflow:hidden.
               NÃO rotaciona. É a "janela" 2D fixa.
            2) TILT layer (heroTiltStyle): transform 3D + width/height 100% do parent.
               Rotaciona DENTRO da janela. Parts que saem pela janela são clipadas pela
               primeira camada (sem distorção 3D do clip).
          Resultado: tilt visível + clip preciso, sem o triângulo cortado. */}
      <Animated.View style={[heroClipStyle, styles.heroClip]}>
        <Animated.View style={[styles.heroTilt, heroTiltStyle]}>
          {heroCover ? (
            <Pressable
              onPress={() => onPressCover(heroCover)}
              style={StyleSheet.absoluteFill}
              android_ripple={{ color: 'rgba(255,255,255,0.12)' }}>
              <Image
                source={{ uri: heroCover.uri }}
                style={styles.heroImage}
                contentFit="cover"
                transition={120}
                onLoad={() => setHeroImageLoaded(true)}
                cachePolicy="memory-disk"
              />
            </Pressable>
          ) : (
            <View style={[styles.heroEmpty, { backgroundColor: t.surfaceAlt, borderColor: t.border }]}>
              <Ionicons name="image-outline" size={48} color={t.textFaint} />
            </View>
          )}
          {/* Holographic — mask wrapper FIXO (absoluteFill da Image) + gradient
              wrapper interno que translada. O gradient é clipado pelo mask,
              ficando sempre alinhado ao bound exato da Image. Só renderiza
              depois que a Image carregou (evita efeito sobre fundo preto). */}
          {heroCover?.variant === 'elite' && heroImageLoaded && (
            <View
              pointerEvents="none"
              style={[styles.holoSheenMask, styles.holoBlendOverlay]}>
              <Animated.View style={[styles.holoSheenInner, heroShineStyle]}>
                <LinearGradient
                  colors={[
                    'rgba(0,0,0,0)',
                    'rgba(0,0,0,0)',
                    'rgba(80, 200, 255, 0.85)',
                    'rgba(255, 255, 255, 1)',
                    'rgba(255, 80, 200, 0.85)',
                    'rgba(255, 220, 80, 0.7)',
                    'rgba(0,0,0,0)',
                    'rgba(0,0,0,0)',
                  ]}
                  locations={[0, 0.45, 0.475, 0.5, 0.525, 0.55, 0.575, 1]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={StyleSheet.absoluteFill}
                />
              </Animated.View>
            </View>
          )}
        </Animated.View>
        {/* Badge Elite e pill "Capa atual" ficam FORA do heroTilt (não rotacionam
            com o parallax) mas DENTRO do heroClip pra continuar ancorados ao
            bound da foto. Permanecem com pointerEvents:none, então a Pressable
            de baixo (dentro do tilt) continua respondendo ao tap normalmente. */}
        {heroCover?.variant === 'elite' && (
          <View style={styles.eliteBadgeOnHero} pointerEvents="none">
            <LinearGradient
              colors={['#fef9c3', '#facc15', '#a16207']}
              start={{ x: 0.2, y: 0 }}
              end={{ x: 0.8, y: 1 }}
              style={styles.eliteBadgeFill}>
              <MaterialCommunityIcons name="medal" size={14} color="#0b1d3a" />
            </LinearGradient>
          </View>
        )}
        {heroCover && (
          <View style={[styles.activePill, { backgroundColor: t.primary }]} pointerEvents="none">
            <Ionicons name="checkmark" size={11} color={t.primaryText} />
            <Text style={[styles.activePillText, { color: t.primaryText }]}>Capa atual</Text>
          </View>
        )}
      </Animated.View>

      {/* Conteúdo: grid de outras capas + estado vazio */}
      <Animated.View
        style={[
          styles.scrollArea,
          { paddingTop: insets.top + 80 + HERO_H + 28 },
          gridAnimStyle,
        ]}>
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={t.primary} />
          </View>
        ) : items.length === 0 ? (
          <View style={[styles.emptyBox, { paddingBottom: insets.bottom + 40 }]}>
            <View style={[styles.emptyIcon, { backgroundColor: t.surfaceAlt }]}>
              <Ionicons name="images-outline" size={48} color={t.textFaint} />
            </View>
            <Text style={[styles.emptyTitle, { color: t.text }]}>
              Você ainda não criou nenhuma capa
            </Text>
            <Text style={[styles.emptySub, { color: t.textMuted }]}>
              Crie sua capa personalizada estilo figurinha e mostre pra galera no álbum.
            </Text>
            <Pressable
              onPress={() => openCreator('standard')}
              style={[styles.emptyBtn, { backgroundColor: t.primary }]}>
              <Ionicons name="sparkles" size={16} color={t.primaryText} />
              <Text style={[styles.emptyBtnText, { color: t.primaryText }]}>
                Criar agora
              </Text>
            </Pressable>
          </View>
        ) : (
          <FlatList
            data={[...otherCovers, { kind: 'add' } as const]}
            keyExtractor={(item) =>
              'kind' in item ? 'k-add' : item.id
            }
            numColumns={GRID_COLUMNS}
            columnWrapperStyle={{ gap: GRID_GAP, paddingHorizontal: SCREEN_PADDING }}
            contentContainerStyle={{
              paddingBottom: insets.bottom + 24,
              gap: GRID_GAP,
            }}
            ListHeaderComponent={
              <Text style={[styles.gridLabel, { color: t.textMuted }]}>
                {otherCovers.length > 0
                  ? `${items.length}/10 capas`
                  : 'Crie mais capas. Limite 10.'}
              </Text>
            }
            renderItem={({ item }) => {
              if ('kind' in item) {
                return (
                  <Pressable
                    onPress={() => openCreator('standard')}
                    style={({ pressed }) => [
                      styles.addCard,
                      {
                        width: GRID_CARD_W,
                        height: GRID_CARD_H,
                        backgroundColor: t.surfaceAlt,
                        borderColor: t.border,
                      },
                      pressed && { opacity: 0.7 },
                    ]}>
                    <Ionicons name="add-circle" size={36} color={t.primary} />
                    <Text style={[styles.addCardText, { color: t.text }]}>
                      Nova capa
                    </Text>
                  </Pressable>
                );
              }
              return (
                <Pressable
                  onPress={() => onPressCover(item)}
                  style={({ pressed }) => [
                    styles.gridCard,
                    {
                      width: GRID_CARD_W,
                      height: GRID_CARD_H,
                      borderColor: item.variant === 'elite' ? '#facc15' : t.border,
                      borderWidth: item.variant === 'elite' ? 2 : 1,
                      backgroundColor: t.surface,
                    },
                    pressed && { opacity: 0.85 },
                  ]}>
                  <Image
                    source={{ uri: item.uri }}
                    style={styles.gridImage}
                    contentFit="cover"
                    transition={250}
                  />
                  {item.variant === 'elite' && (
                    <View style={styles.gridEliteBadge} pointerEvents="none">
                      <LinearGradient
                        colors={['#fef9c3', '#facc15', '#a16207']}
                        start={{ x: 0.2, y: 0 }}
                        end={{ x: 0.8, y: 1 }}
                        style={styles.gridEliteBadgeFill}>
                        <Text style={styles.gridEliteBadgeText}>Elite</Text>
                      </LinearGradient>
                    </View>
                  )}
                </Pressable>
              );
            }}
          />
        )}
      </Animated.View>

      <CoverCreator
        visible={creatorOpen}
        initialVariant={creatorVariant}
        onClose={() => setCreatorOpen(false)}
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 0, // grows with paddingTop
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 12,
    zIndex: 30,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerBtnGhost: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 17, fontWeight: '800' },

  // Camada externa: clip 2D FIXO (não rotaciona). É quem clipa, com borderRadius.
  heroClip: {
    overflow: 'hidden',
    backgroundColor: '#000',
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 14,
    zIndex: 20,
  },
  // Camada interna: tilt 3D rotaciona DENTRO do clip layer.
  heroTilt: {
    width: '100%',
    height: '100%',
  },
  // MASK FIXO: tem o bound exato da Image (absoluteFill) e overflow:hidden.
  // Mantém o gradient interno alinhado ao retângulo da Image, sem vazar.
  holoSheenMask: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  // Gradient interno: maior que o mask, translada com tilt pra "deslizar" a luz.
  // shineStyle translada por ±110px aqui (sensibilidade maior que o UserCover).
  // Pra HERO_W ≈ 272 (menor tela razoável): -50% × 272 = -136 cobre ±110 ✓.
  // width/height grandes garantem que mesmo no tilt extremo o gradient cobre
  // toda a foto (antes ficava acabando antes do bound).
  holoSheenInner: {
    position: 'absolute',
    top: '-40%',
    left: '-50%',
    width: '200%',
    height: '180%',
  },
  // mixBlendMode é nativo no RN 0.76+ (Expo SDK 54 = RN 0.81). 'overlay' mistura
  // cores mantendo o brilho da imagem por baixo — perfeito pro feixe colorido.
  holoBlendOverlay: { mixBlendMode: 'overlay' },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  heroEmpty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderStyle: 'dashed',
  },
  eliteBadgeOnHero: {
    position: 'absolute',
    top: 10,
    left: 10,
    width: 26,
    height: 26,
    borderRadius: 13,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: '#fef9c3',
  },
  eliteBadgeFill: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  activePill: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  activePillText: { fontSize: 10, fontWeight: '800' },

  scrollArea: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  gridLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    paddingHorizontal: SCREEN_PADDING,
    marginBottom: 10,
  },
  gridCard: {
    borderRadius: 14,
    overflow: 'hidden',
  },
  gridImage: { width: '100%', height: '100%' },
  gridEliteBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    borderRadius: 999,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#fef9c3',
  },
  gridEliteBadgeFill: {
    paddingVertical: 2,
    paddingHorizontal: 8,
  },
  gridEliteBadgeText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#0b1d3a',
    letterSpacing: 0.5,
  },
  gridActivePill: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addCard: {
    borderRadius: 14,
    borderWidth: 2,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  addCardText: { fontSize: 13, fontWeight: '800' },

  emptyBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 10,
  },
  emptyIcon: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  emptyTitle: { fontSize: 16, fontWeight: '800', textAlign: 'center', marginTop: 4 },
  emptySub: { fontSize: 13, textAlign: 'center', lineHeight: 18, marginBottom: 8 },
  emptyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 999,
    marginTop: 6,
  },
  emptyBtnText: { fontSize: 14, fontWeight: '800' },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
