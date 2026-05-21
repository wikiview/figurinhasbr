import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Dimensions,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
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
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { ACHIEVEMENT_META } from '@/src/lib/achievements';
import { useAuth } from '@/src/providers/AuthProvider';

const ELITE_REF = require('@/assets/images/elite-cover-ref.png');

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const CONFETTI_COUNT = 36;
const CONFETTI_COLORS = ['#facc15', '#fde68a', '#a16207', '#fff', '#fbbf24', '#fef9c3'];

type Props = {
  visible: boolean;
  onClose: () => void;
  onGenerateElite: () => void;
};

export function EliteUnlockedModal({ visible, onClose, onGenerateElite }: Props) {
  const { profile } = useAuth();
  const isPremium = !!profile?.is_premium;

  // Mantém montado enquanto a animação de saída roda
  const [mounted, setMounted] = useState(visible);

  const backdropOpacity = useSharedValue(0);
  const cardScale = useSharedValue(0.6);
  const cardOpacity = useSharedValue(0);
  const contentOpacity = useSharedValue(0);
  const contentTranslate = useSharedValue(40);

  // Confetti
  const pieces = useMemo(
    () =>
      Array.from({ length: CONFETTI_COUNT }, (_, i) => ({
        id: i,
        angle: (Math.random() * 2 - 1) * Math.PI,
        speed: 260 + Math.random() * 360,
        size: 7 + Math.random() * 9,
        color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
        rotateEnd: (Math.random() * 6 - 3) * 360,
        delay: Math.random() * 200,
      })),
    [mounted],
  );

  // Versão pra forçar remount/re-key dos confetti a cada abertura
  const cycleRef = useRef(0);

  useEffect(() => {
    if (visible) {
      cycleRef.current += 1;
      setMounted(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});

      backdropOpacity.value = 0;
      cardScale.value = 0.6;
      cardOpacity.value = 0;
      contentOpacity.value = 0;
      contentTranslate.value = 40;

      backdropOpacity.value = withTiming(1, { duration: 260 });
      cardOpacity.value = withTiming(1, { duration: 200 });
      cardScale.value = withSequence(
        withSpring(1.04, { damping: 14, stiffness: 200, mass: 0.7 }),
        withSpring(1, { damping: 18, stiffness: 220 }),
      );
      contentOpacity.value = withDelay(280, withTiming(1, { duration: 360 }));
      contentTranslate.value = withDelay(
        280,
        withSpring(0, { damping: 18, stiffness: 160, mass: 0.9 }),
      );
    } else if (mounted) {
      backdropOpacity.value = withTiming(0, { duration: 220 });
      cardOpacity.value = withTiming(0, { duration: 200 });
      cardScale.value = withTiming(0.7, { duration: 220 }, (done) => {
        if (done) runOnJS(setMounted)(false);
      });
    }
  }, [visible, mounted, backdropOpacity, cardOpacity, cardScale, contentOpacity, contentTranslate]);

  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdropOpacity.value }));
  const cardStyle = useAnimatedStyle(() => ({
    opacity: cardOpacity.value,
    transform: [{ scale: cardScale.value }],
  }));
  const contentStyle = useAnimatedStyle(() => ({
    opacity: contentOpacity.value,
    transform: [{ translateY: contentTranslate.value }],
  }));

  if (!mounted) return null;

  return (
    <Modal transparent visible animationType="none" onRequestClose={onClose}>
      <Animated.View style={[StyleSheet.absoluteFill, backdropStyle]}>
        <LinearGradient
          colors={['#0b1d3a', '#020617', '#000']}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>

      {/* Confetti layer */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {pieces.map((p) => (
          <ConfettiPiece key={`${cycleRef.current}-${p.id}`} {...p} />
        ))}
      </View>

      <View style={styles.center} pointerEvents="box-none">
        {/* Card dourado central */}
        <Animated.View style={[styles.cardImageWrap, cardStyle]} pointerEvents="none">
          <Image source={ELITE_REF} style={styles.cardImage} contentFit="contain" />
        </Animated.View>

        <Animated.View style={[styles.content, contentStyle]}>
          <Text style={styles.eyebrow}>CONQUISTA ÉPICA</Text>
          <Text style={styles.title}>{ACHIEVEMENT_META.elite_collector.title}</Text>
          <Text style={styles.subtitle}>
            Você reuniu os 43 craques do álbum
          </Text>
          <Text style={styles.reward}>
            Sua recompensa: uma capa dourada exclusiva pra você.
          </Text>
          {!isPremium && (
            <Text style={styles.adHint}>
              Vê um anúncio rápido pra liberar sua geração grátis.
            </Text>
          )}

          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
              onGenerateElite();
              onClose();
            }}
            style={({ pressed }) => [
              styles.primaryBtnWrap,
              pressed && { opacity: 0.92, transform: [{ scale: 0.98 }] },
            ]}>
            <LinearGradient
              colors={['#fef9c3', '#facc15', '#a16207']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.primaryBtn}>
              <Text style={styles.primaryBtnText}>Gerar minha capa dourada</Text>
            </LinearGradient>
          </Pressable>

          <Pressable onPress={onClose} hitSlop={10} style={styles.ghostBtn}>
            <Text style={styles.ghostBtnText}>Mais tarde</Text>
          </Pressable>
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
    opacity.value = withDelay(delay, withTiming(1, { duration: 100 }));
    tx.value = withDelay(
      delay,
      withTiming(Math.cos(angle) * speed, {
        duration: 2600,
        easing: Easing.out(Easing.quad),
      }),
    );
    ty.value = withDelay(
      delay,
      withTiming(Math.sin(angle) * speed * 0.6 + 320, {
        duration: 2600,
        easing: Easing.bezier(0.2, 0.8, 0.6, 1),
      }),
    );
    rot.value = withDelay(delay, withTiming(rotateEnd, { duration: 2600 }));
    opacity.value = withDelay(delay + 1900, withTiming(0, { duration: 700 }));
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

const CARD_W = Math.min(SCREEN_W * 0.7, 320);

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  cardImageWrap: {
    width: CARD_W,
    height: CARD_W * 1.35,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#facc15',
    shadowOpacity: 0.55,
    shadowRadius: 32,
    shadowOffset: { width: 0, height: 0 },
    elevation: 14,
  },
  cardImage: {
    width: '100%',
    height: '100%',
  },
  content: {
    marginTop: 18,
    alignItems: 'center',
    width: '100%',
    maxWidth: 360,
  },
  eyebrow: {
    color: '#fde68a',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.6,
  },
  title: {
    color: '#D4AF37',
    fontSize: 32,
    fontWeight: '900',
    marginTop: 8,
    textAlign: 'center',
    textShadowColor: 'rgba(250,204,21,0.45)',
    textShadowRadius: 16,
    textShadowOffset: { width: 0, height: 0 },
  },
  subtitle: {
    color: '#e2e8f0',
    fontSize: 14,
    marginTop: 6,
    textAlign: 'center',
  },
  reward: {
    color: '#fef9c3',
    fontSize: 14,
    marginTop: 14,
    textAlign: 'center',
    fontWeight: '600',
    lineHeight: 20,
    paddingHorizontal: 8,
  },
  adHint: {
    color: '#94a3b8',
    fontSize: 12,
    marginTop: 10,
    textAlign: 'center',
    fontWeight: '500',
    paddingHorizontal: 12,
  },
  primaryBtnWrap: {
    marginTop: 22,
    width: '100%',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#facc15',
    shadowOpacity: 0.6,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  primaryBtn: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: {
    color: '#0b1d3a',
    fontWeight: '900',
    fontSize: 16,
    letterSpacing: 0.2,
  },
  ghostBtn: {
    marginTop: 14,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignItems: 'center',
  },
  ghostBtnText: {
    color: '#94a3b8',
    fontWeight: '700',
    fontSize: 13,
  },
});
