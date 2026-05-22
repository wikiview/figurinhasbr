import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '@/src/providers/AuthProvider';
import { useTheme } from '@/src/hooks/useTheme';
import { flagUrl } from '@/src/lib/flags';
import { useCovers } from '@/src/lib/covers';
import { useParallaxTilt } from '@/src/hooks/useParallaxTilt';
import { CoverGallery, type OriginRect } from '@/src/components/CoverGallery';

type Props = {
  size?: number;
  hasEliteBadge?: boolean;
};

export function UserCover({ size = 92, hasEliteBadge = false }: Props) {
  const { profile } = useAuth();
  const { active } = useCovers();
  const t = useTheme();
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [origin, setOrigin] = useState<OriginRect | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const cardRef = useRef<View>(null);

  // A capa ativa vem do store local (src/lib/covers.ts), não mais do
  // profiles.cover_url. O parallax tilt só liga quando a capa é Elite.
  const photoUrl = active?.uri ?? null;
  const coverVariant = active?.variant ?? null;
  const teamCode = profile?.favorite_team_code ?? null;
  const teamFlag = teamCode ? flagUrl(teamCode, 160) : null;
  const name = profile?.display_name ?? '';

  // Reset do estado de load quando troca a capa.
  useEffect(() => {
    setImageLoaded(false);
  }, [photoUrl]);

  // Tilt parallax via DeviceMotion — só ativo se a capa atual for Elite.
  // scale: 1.15 cobre o bound em tilt extremo (sem borda preta nas bordas).
  const tilt = useParallaxTilt(coverVariant === 'elite');
  const tiltStyle = useAnimatedStyle(() => ({
    transform: [
      { perspective: 700 },
      { scale: 1.15 },
      { rotateX: `${tilt.rotateX.value}deg` },
      { rotateY: `${tilt.rotateY.value}deg` },
    ],
  }));
  // Sheen holographic — banda fina que viaja mais com o tilt. Cor só onde
  // o sheen está visível; resto da figurinha fica original.
  const shineStyle = useAnimatedStyle(() => {
    const dx = interpolate(tilt.rotateY.value, [-18, 18], [-55, 55]);
    const dy = interpolate(tilt.rotateX.value, [-18, 18], [-55, 55]);
    return {
      opacity: 0.95,
      transform: [{ translateX: dx }, { translateY: dy }],
    };
  });

  function handlePress() {
    // Mede a posição do card na tela pra o shared-element transition.
    // measureInWindow é assíncrono — espera o callback antes de abrir.
    if (cardRef.current) {
      cardRef.current.measureInWindow((x, y, width, height) => {
        setOrigin({ x, y, width, height, borderRadius: 14 });
        setGalleryOpen(true);
      });
    } else {
      setOrigin(null);
      setGalleryOpen(true);
    }
  }

  const cardHeight = size * 1.3;

  // Halo pulsante do badge dourado
  const haloScale = useSharedValue(1);
  const haloOpacity = useSharedValue(0);

  useEffect(() => {
    if (hasEliteBadge) {
      haloScale.value = withRepeat(
        withSequence(
          withTiming(1.5, { duration: 1100, easing: Easing.inOut(Easing.quad) }),
          withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.quad) }),
        ),
        -1,
        true,
      );
      haloOpacity.value = withRepeat(
        withSequence(
          withTiming(0.55, { duration: 1100 }),
          withTiming(0.05, { duration: 1100 }),
        ),
        -1,
        true,
      );
    } else {
      haloScale.value = 1;
      haloOpacity.value = 0;
    }
  }, [hasEliteBadge, haloScale, haloOpacity]);

  const haloStyle = useAnimatedStyle(() => ({
    opacity: haloOpacity.value,
    transform: [{ scale: haloScale.value }],
  }));

  return (
    <>
      <Animated.View
        style={[
          styles.wrapper,
          { width: size, height: cardHeight },
          tiltStyle,
        ]}>
        <Pressable
          ref={cardRef}
          onPress={handlePress}
          style={({ pressed }) => [
            styles.card,
            {
              width: size,
              height: cardHeight,
              backgroundColor: t.surface,
              borderColor: t.border,
            },
            pressed && { opacity: 0.85 },
          ]}>
          {photoUrl ? (
            <Image
              source={{ uri: photoUrl }}
              style={styles.photo}
              contentFit="cover"
              transition={120}
              onLoad={() => setImageLoaded(true)}
              cachePolicy="memory-disk"
            />
          ) : (
            <View style={[styles.placeholder, { backgroundColor: t.surfaceAlt }]}>
              <Ionicons name="person" size={size * 0.4} color={t.textMuted} />
            </View>
          )}

          {photoUrl && coverVariant === 'elite' && imageLoaded && (
            <View
              pointerEvents="none"
              style={[styles.holoSheenMask, styles.holoBlendOverlay]}>
              <Animated.View style={[styles.holoSheenInner, shineStyle]}>
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

          {name && (
            <View style={styles.nameStrip}>
              <Text style={styles.nameText} numberOfLines={1}>
                {name}
              </Text>
            </View>
          )}

          {teamFlag && (
            <View style={[styles.flagBadge, { borderColor: t.surface }]}>
              <Image source={{ uri: teamFlag }} style={styles.flag} contentFit="cover" />
            </View>
          )}

          {!photoUrl && (
            <View
              style={[
                styles.addBadge,
                { backgroundColor: t.primary, borderColor: t.surface },
              ]}>
              <Ionicons name="add" size={14} color={t.primaryText} />
            </View>
          )}
        </Pressable>

        {/* Badge dourado FORA do Pressable pra não ser cortado pelo overflow:hidden */}
        {hasEliteBadge && (
          <View style={styles.eliteBadgeAnchor} pointerEvents="none">
            <Animated.View style={[styles.eliteHalo, haloStyle]} />
            <View style={styles.eliteBadge}>
              <LinearGradient
                colors={['#fef9c3', '#facc15', '#a16207']}
                start={{ x: 0.2, y: 0 }}
                end={{ x: 0.8, y: 1 }}
                style={styles.eliteBadgeFill}>
                <MaterialCommunityIcons name="medal" size={16} color="#0b1d3a" />
              </LinearGradient>
              <View style={styles.eliteHighlight} />
            </View>
          </View>
        )}
      </Animated.View>

      <CoverGallery
        visible={galleryOpen}
        originRect={origin}
        onClose={() => setGalleryOpen(false)}
      />
    </>
  );
}

const BADGE_SIZE = 30;

const styles = StyleSheet.create({
  wrapper: {
    transform: [{ rotate: '-4deg' }],
  },
  card: {
    borderRadius: 14,
    borderWidth: 2,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 8,
  },
  photo: { width: '100%', height: '100%' },
  // Mask fixo no bound exato da photo. Usa top/left/right/bottom: -2 pra COBRIR
  // a borderWidth: 2 do card — sem isso, o sheen aparecia 2px "atrás" da borda
  // visível e o efeito não casava com a Image. O overflow:hidden + borderRadius
  // do parent (styles.card) corta o excesso uniformemente.
  holoSheenMask: {
    position: 'absolute',
    top: -2,
    left: -2,
    right: -2,
    bottom: -2,
    overflow: 'hidden',
  },
  // Inner precisa ser grande o bastante pra que, no tilt extremo, ele ainda
  // cubra TODA a área do mask. shineStyle translada por ±55px, então a margem
  // em cada eixo deve ser ≥ 55px. Pra size=92 (mask~96×124): -60% × 96 = -57.6
  // e -50% × 124 = -62, ambos cobrindo ±55. width/height dão 220%/200% pra
  // sobrar gradient nas pontas mesmo após translate máximo.
  holoSheenInner: {
    position: 'absolute',
    top: '-50%',
    left: '-60%',
    width: '220%',
    height: '200%',
  },
  holoBlendOverlay: { mixBlendMode: 'overlay' },
  placeholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nameStrip: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingVertical: 4,
    paddingHorizontal: 6,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  nameText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
    textAlign: 'center',
  },
  flagBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    width: 24,
    height: 18,
    borderRadius: 4,
    borderWidth: 2,
    overflow: 'hidden',
  },
  flag: { width: '100%', height: '100%' },
  addBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },

  // Anchor pra centralizar o badge no canto superior esquerdo do card.
  // Fica FORA do Pressable (que tem overflow: 'hidden').
  eliteBadgeAnchor: {
    position: 'absolute',
    top: -BADGE_SIZE / 2 + 4,
    left: -BADGE_SIZE / 2 + 4,
    width: BADGE_SIZE,
    height: BADGE_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eliteHalo: {
    position: 'absolute',
    width: BADGE_SIZE,
    height: BADGE_SIZE,
    borderRadius: BADGE_SIZE / 2,
    backgroundColor: '#facc15',
    shadowColor: '#facc15',
    shadowOpacity: 1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
    elevation: 0,
  },
  eliteBadge: {
    width: BADGE_SIZE,
    height: BADGE_SIZE,
    borderRadius: BADGE_SIZE / 2,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: '#fef9c3',
    shadowColor: '#facc15',
    shadowOpacity: 0.85,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },
  eliteBadgeFill: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eliteHighlight: {
    position: 'absolute',
    top: 2,
    left: 4,
    width: 10,
    height: 5,
    borderRadius: 5,
    backgroundColor: 'rgba(255,255,255,0.65)',
  },
});
