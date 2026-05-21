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
import { getPlayerGifUrl } from '@/src/data/player-gifs';
import { useTheme } from '@/src/hooks/useTheme';

const GIF_SIZE = 280;

type Props = {
  sticker: Sticker | null;
  onClose: () => void;
};

export function PlayerCelebration({ sticker, onClose }: Props) {
  const t = useTheme();
  const [mounted, setMounted] = useState<Sticker | null>(sticker);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.6);

  useEffect(() => {
    if (sticker) {
      setMounted(sticker);
      setLoadError(null);
      setLoaded(false);
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

  const gifUrl = getPlayerGifUrl(mounted.team_code, mounted.number);
  if (!gifUrl) return null;

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
              source={{ uri: gifUrl }}
              style={styles.gif}
              contentFit="cover"
              transition={120}
              cachePolicy="memory-disk"
              priority="high"
              onLoad={() => setLoaded(true)}
              onError={(e: any) => {
                const msg = e?.error ?? e?.nativeEvent?.error ?? 'erro ao carregar';
                console.warn('[PlayerCelebration] gif fail', gifUrl, msg);
                setLoadError(String(msg));
              }}
            />
            {!loaded && !loadError && (
              <View style={styles.gifOverlay} pointerEvents="none">
                <Ionicons name="cloud-download-outline" size={40} color="#94a3b8" />
                <Text style={styles.gifOverlayText}>Carregando…</Text>
              </View>
            )}
            {loadError && (
              <View style={styles.gifOverlay} pointerEvents="none">
                <Ionicons name="alert-circle" size={40} color="#f87171" />
                <Text style={styles.gifOverlayText} numberOfLines={3}>
                  {loadError}
                </Text>
              </View>
            )}
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
