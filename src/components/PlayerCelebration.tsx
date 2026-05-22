import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import type { Sticker } from '@/src/lib/types';
import { getPlayerGif } from '@/src/data/player-gifs';
import { useTheme } from '@/src/hooks/useTheme';

const GIF_SIZE = 280;

type Props = {
  sticker: Sticker | null;
  onClose: () => void;
};

export function PlayerCelebration({ sticker, onClose }: Props) {
  const t = useTheme();
  const [mounted, setMounted] = useState<Sticker | null>(sticker);
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.6);

  useEffect(() => {
    if (sticker) {
      setMounted(sticker);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      opacity.value = withTiming(1, { duration: 140 });
      scale.value = withSpring(1, { damping: 14, stiffness: 220, mass: 0.7 });
    } else if (mounted) {
      opacity.value = withTiming(0, { duration: 160 });
      scale.value = withTiming(0.6, { duration: 180 }, (done) => {
        if (done) runOnJS(setMounted)(null);
      });
    }
  }, [sticker, mounted, opacity, scale]);

  const backdropStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  const cardStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  if (!mounted) return null;

  const gif = getPlayerGif(mounted.team_code, mounted.number);
  if (!gif) return null;

  return (
    <Modal transparent visible animationType="none" onRequestClose={onClose}>
      <Animated.View
        style={[StyleSheet.absoluteFill, styles.backdrop, backdropStyle]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>

      <View style={styles.center} pointerEvents="box-none">
        <Animated.View style={[styles.cardWrap, cardStyle]} pointerEvents="box-none">
          <View style={styles.badge}>
            <Ionicons name="sparkles" size={14} color="#facc15" />
            <Text style={styles.badgeText}>Primeira figurinha!</Text>
            <Ionicons name="sparkles" size={14} color="#facc15" />
          </View>

          <View style={[styles.gifFrame, { borderColor: t.shinyBorder }]}>
            <Image
              source={gif}
              style={styles.gif}
              contentFit="cover"
              transition={120}
            />
          </View>

          <Text style={styles.player} numberOfLines={2}>
            {mounted.player_name ?? `${mounted.team_code}-${mounted.number}`}
          </Text>
          <Text style={styles.team} numberOfLines={1}>
            {mounted.team}
          </Text>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    backgroundColor: 'rgba(8,12,24,0.78)',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  cardWrap: {
    alignItems: 'center',
    width: '100%',
    maxWidth: 360,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(250,204,21,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(250,204,21,0.55)',
    marginBottom: 18,
  },
  badgeText: {
    color: '#fde68a',
    fontWeight: '800',
    fontSize: 13,
    letterSpacing: 0.3,
  },
  gifFrame: {
    width: GIF_SIZE,
    height: GIF_SIZE,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 3,
    backgroundColor: '#0b1d3a',
    shadowColor: '#facc15',
    shadowOpacity: 0.45,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 0 },
    elevation: 14,
  },
  gif: {
    width: '100%',
    height: '100%',
  },
  gifOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 16,
  },
  gifOverlayText: {
    color: '#cbd5e1',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  player: {
    marginTop: 18,
    color: '#fff',
    fontSize: 22,
    fontWeight: '900',
    textAlign: 'center',
  },
  team: {
    marginTop: 4,
    color: '#cbd5e1',
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
});
