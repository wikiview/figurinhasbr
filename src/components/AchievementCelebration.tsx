import { useEffect, useMemo, useState } from 'react';
import { Dimensions, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import type { Sticker } from '@/src/lib/types';
import { getPlayerGifUrl } from '@/src/data/player-gifs';
import { ACHIEVEMENT_META } from '@/src/lib/achievements';

const PHASE1_MS = 1700; // GIF grande, sozinho
const TRANSITION_MS = 600;
const BIG_SIZE = 240;
const CONFETTI_COUNT = 28;
const CONFETTI_COLORS = ['#facc15', '#fde68a', '#f59e0b', '#fff', '#22c55e', '#0ea5e9'];

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

type Props = {
  sticker: Sticker | null;
  onClose: () => void;
};

export function AchievementCelebration({ sticker, onClose }: Props) {
  const [mounted, setMounted] = useState<Sticker | null>(sticker);

  const backdropOpacity = useSharedValue(0);
  const gifScale = useSharedValue(0.6);
  const gifTranslateY = useSharedValue(0);
  const cardTranslateY = useSharedValue(80);
  const cardOpacity = useSharedValue(0);

  // 3 flashes iniciais (tipo flash de câmera)
  const flash1 = useSharedValue(0);
  const flash2 = useSharedValue(0);
  const flash3 = useSharedValue(0);

  // Flash extra no momento da revelação (PHASE1_MS)
  const revealFlash = useSharedValue(0);

  // Confetti — gerado uma vez por celebração
  const pieces = useMemo(
    () =>
      Array.from({ length: CONFETTI_COUNT }, (_, i) => ({
        id: i,
        angle: (Math.random() * 2 - 1) * Math.PI, // -π a π
        speed: 220 + Math.random() * 320,
        size: 6 + Math.random() * 8,
        color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
        rotateEnd: (Math.random() * 6 - 3) * 360,
        delay: Math.random() * 120,
      })),
    [mounted?.id], // recria a cada nova celebração
  );

  useEffect(() => {
    if (sticker) {
      setMounted(sticker);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});

      // Reset
      backdropOpacity.value = 0;
      gifScale.value = 0.6;
      gifTranslateY.value = 0;
      cardTranslateY.value = 80;
      cardOpacity.value = 0;
      flash1.value = 0;
      flash2.value = 0;
      flash3.value = 0;
      revealFlash.value = 0;

      // Backdrop
      backdropOpacity.value = withTiming(1, { duration: 240 });

      // 3 flashes iniciais
      flash1.value = withSequence(
        withTiming(1, { duration: 80 }),
        withTiming(0, { duration: 240 }),
      );
      flash2.value = withDelay(
        180,
        withSequence(
          withTiming(0.85, { duration: 80 }),
          withTiming(0, { duration: 280 }),
        ),
      );
      flash3.value = withDelay(
        380,
        withSequence(
          withTiming(0.7, { duration: 80 }),
          withTiming(0, { duration: 320 }),
        ),
      );

      // GIF entra
      gifScale.value = withDelay(
        160,
        withSpring(1, { damping: 14, stiffness: 200, mass: 0.7 }),
      );

      // Stage 2 (PHASE1_MS): flash de revelação + GIF encolhe e sobe + card entra
      const triggerStage2 = setTimeout(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
      }, PHASE1_MS);

      revealFlash.value = withDelay(
        PHASE1_MS,
        withSequence(
          withTiming(1, { duration: 120 }),
          withTiming(0, { duration: 360 }),
        ),
      );

      gifScale.value = withDelay(
        PHASE1_MS,
        withTiming(0.5, { duration: TRANSITION_MS, easing: Easing.out(Easing.cubic) }),
      );
      gifTranslateY.value = withDelay(
        PHASE1_MS,
        withTiming(-90, { duration: TRANSITION_MS, easing: Easing.out(Easing.cubic) }),
      );
      cardTranslateY.value = withDelay(
        PHASE1_MS + 80,
        withSpring(0, { damping: 18, stiffness: 140, mass: 0.9 }),
      );
      cardOpacity.value = withDelay(
        PHASE1_MS + 80,
        withTiming(1, { duration: TRANSITION_MS }),
      );

      return () => clearTimeout(triggerStage2);
    } else if (mounted) {
      backdropOpacity.value = withTiming(0, { duration: 240 }, (done) => {
        if (done) runOnJS(setMounted)(null);
      });
      gifScale.value = withTiming(0.6, { duration: 240 });
      cardOpacity.value = withTiming(0, { duration: 200 });
      cardTranslateY.value = withTiming(80, { duration: 240 });
    }
  }, [
    sticker,
    mounted,
    backdropOpacity,
    gifScale,
    gifTranslateY,
    cardOpacity,
    cardTranslateY,
    flash1,
    flash2,
    flash3,
    revealFlash,
  ]);

  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdropOpacity.value }));
  const gifStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: gifTranslateY.value },
      { scale: gifScale.value },
    ],
  }));
  const cardStyle = useAnimatedStyle(() => ({
    opacity: cardOpacity.value,
    transform: [{ translateY: cardTranslateY.value }],
  }));
  const flash1Style = useAnimatedStyle(() => ({ opacity: flash1.value }));
  const flash2Style = useAnimatedStyle(() => ({ opacity: flash2.value }));
  const flash3Style = useAnimatedStyle(() => ({ opacity: flash3.value }));
  const revealFlashStyle = useAnimatedStyle(() => ({ opacity: revealFlash.value }));

  if (!mounted) return null;

  const gifUrl = getPlayerGifUrl(mounted.team_code, mounted.number);
  const meta = ACHIEVEMENT_META.elite_collector;

  return (
    <Modal transparent visible animationType="none" onRequestClose={onClose}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, backdropStyle]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>

      {/* Flashes brancos full screen */}
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, styles.whiteFlash, flash1Style]}
      />
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, styles.whiteFlash, flash2Style]}
      />
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, styles.whiteFlash, flash3Style]}
      />
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, styles.revealFlash, revealFlashStyle]}
      />

      {/* Confetti em camada própria */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {pieces.map((p) => (
          <ConfettiPiece key={`${mounted.id}-${p.id}`} {...p} />
        ))}
      </View>

      <View style={styles.center} pointerEvents="box-none">
        {/* GIF do jogador */}
        <Animated.View style={[styles.gifWrap, gifStyle]} pointerEvents="none">
          <View style={styles.gifFrame}>
            {gifUrl ? (
              <Image
                source={{ uri: gifUrl }}
                style={styles.gif}
                contentFit="cover"
                cachePolicy="memory-disk"
                priority="high"
              />
            ) : (
              <View style={[styles.gif, styles.gifFallback]}>
                <Ionicons name="trophy" size={56} color="#facc15" />
              </View>
            )}
          </View>
        </Animated.View>

        {/* Card da conquista */}
        <Animated.View style={[styles.card, cardStyle]} pointerEvents="none">
          <View style={styles.medal}>
            <MaterialCommunityIcons name="medal" size={32} color="#facc15" />
          </View>
          <Text style={styles.unlockedLabel}>Conquista desbloqueada</Text>
          <Text style={styles.title}>{meta.title}</Text>
          <Text style={styles.subtitle}>{meta.subtitle}</Text>
          <View style={styles.tapHint}>
            <Ionicons name="hand-left-outline" size={14} color="#cbd5e1" />
            <Text style={styles.tapHintText}>toque pra fechar</Text>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

type ConfettiProps = {
  angle: number;
  speed: number;
  size: number;
  color: string;
  rotateEnd: number;
  delay: number;
};

function ConfettiPiece({ angle, speed, size, color, rotateEnd, delay }: ConfettiProps) {
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const rot = useSharedValue(0);
  const opacity = useSharedValue(0);

  useEffect(() => {
    const totalDelay = PHASE1_MS - 200 + delay; // dispara um pouco antes do reveal
    opacity.value = withDelay(totalDelay, withTiming(1, { duration: 80 }));
    tx.value = withDelay(
      totalDelay,
      withTiming(Math.cos(angle) * speed, {
        duration: 2400,
        easing: Easing.out(Easing.quad),
      }),
    );
    ty.value = withDelay(
      totalDelay,
      withTiming(Math.sin(angle) * speed * 0.6 + 280, {
        duration: 2400,
        easing: Easing.bezier(0.2, 0.8, 0.6, 1),
      }),
    );
    rot.value = withDelay(
      totalDelay,
      withTiming(rotateEnd, { duration: 2400 }),
    );
    opacity.value = withDelay(
      totalDelay + 1700,
      withTiming(0, { duration: 700 }),
    );
  }, [angle, speed, rotateEnd, delay, opacity, tx, ty, rot]);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { translateX: tx.value },
      { translateY: ty.value },
      { rotate: `${rot.value}deg` },
    ],
  }));

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          left: SCREEN_W / 2 - size / 2,
          top: SCREEN_H / 2 - size / 2,
          width: size,
          height: size * 0.5,
          backgroundColor: color,
          borderRadius: 1,
        },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  backdrop: {
    backgroundColor: 'rgba(8,12,24,0.92)',
  },
  whiteFlash: {
    backgroundColor: '#fff',
  },
  revealFlash: {
    backgroundColor: 'rgba(250,204,21,0.55)',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingBottom: '20%',
  },
  gifWrap: {
    width: BIG_SIZE,
    height: BIG_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gifFrame: {
    width: '100%',
    height: '100%',
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: '#facc15',
    backgroundColor: '#0b1d3a',
  },
  gif: {
    width: '100%',
    height: '100%',
  },
  gifFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    marginTop: -10,
    paddingVertical: 22,
    paddingHorizontal: 22,
    borderRadius: 24,
    backgroundColor: 'rgba(11,29,58,0.95)',
    borderWidth: 1.5,
    borderColor: 'rgba(250,204,21,0.6)',
    alignItems: 'center',
    width: '100%',
    maxWidth: 360,
    shadowColor: '#facc15',
    shadowOpacity: 0.4,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 0 },
    elevation: 14,
  },
  medal: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(250,204,21,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(250,204,21,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  unlockedLabel: {
    color: '#fde68a',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    marginTop: 4,
  },
  title: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '900',
    marginTop: 4,
    textAlign: 'center',
  },
  subtitle: {
    color: '#cbd5e1',
    fontSize: 13,
    marginTop: 6,
    textAlign: 'center',
    lineHeight: 18,
  },
  tapHint: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    opacity: 0.7,
  },
  tapHintText: {
    color: '#cbd5e1',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.4,
  },
});
