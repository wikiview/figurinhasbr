import { StyleSheet, Text, View } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';

const HERO = require('@/assets/images/wc-hero.png');

// Header vai até o topo absoluto da tela (passa por debaixo da status bar)
// e termina com fade pro fundo do app.
const HEADER_VISIBLE_HEIGHT = 160;

export function CollectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  const insets = useSafeAreaInsets();
  const totalHeight = HEADER_VISIBLE_HEIGHT + insets.top;

  return (
    <View style={[styles.wrap, { height: totalHeight }]}>
      {HERO ? (
        <>
          {/* contentPosition "top right" deixa a taça visível no canto superior-direito
              e a maior parte da metade esquerda livre pros textos respirarem. */}
          <ExpoImage
            source={HERO}
            contentFit="cover"
            contentPosition="top right"
            style={StyleSheet.absoluteFill}
          />
          <LinearGradient
            colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.35)', '#0b1d3a']}
            locations={[0.4, 0.78, 1]}
            style={StyleSheet.absoluteFill}
          />
          <Overlay title={title} subtitle={subtitle} topInset={insets.top} />
        </>
      ) : (
        <LinearGradient
          colors={['#0b1d3a', '#0f3a6e', '#0b1d3a']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}>
          <View style={[styles.fallbackTrophy, { top: insets.top + 10 }]}>
            <MaterialCommunityIcons name="trophy" size={140} color="#facc15" />
          </View>
          <Overlay title={title} subtitle={subtitle} topInset={insets.top} />
        </LinearGradient>
      )}
    </View>
  );
}

function Overlay({
  title,
  subtitle,
  topInset,
}: {
  title: string;
  subtitle?: string;
  topInset: number;
}) {
  return (
    <View
      style={[
        styles.textBox,
        {
          paddingTop: topInset + 12,
          paddingHorizontal: 24,
        },
      ]}>
      {/* Textos centralizados verticalmente — saem de cima da figurinha do user
          e respiram com a status bar. Limitados a 60% da largura pra não invadir a taça. */}
      <View style={{ flex: 1, justifyContent: 'center', maxWidth: '60%' }}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: '#0b1d3a',
    overflow: 'hidden',
  },
  fallbackTrophy: {
    position: 'absolute',
    right: -10,
    opacity: 0.85,
  },
  textBox: {
    flex: 1,
    paddingBottom: 18,
  },
  title: {
    color: '#fff',
    fontSize: 32,
    fontWeight: '800',
    textShadowColor: 'rgba(0,0,0,0.55)',
    textShadowRadius: 8,
    textShadowOffset: { width: 0, height: 2 },
  },
  subtitle: {
    color: 'rgba(255,255,255,0.88)',
    fontSize: 13,
    marginTop: 4,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowRadius: 6,
  },
});
