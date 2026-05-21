/**
 * Tilt 3D parallax baseado em DeviceMotion (sensor de inclinação do iPhone).
 *
 * Retorna shared values pra `rotateX` (pitch) e `rotateY` (roll) em graus,
 * suavizados com spring. Pra usar numa view animada do Reanimated:
 *
 *   const { rotateX, rotateY } = useParallaxTilt(isElite);
 *   const style = useAnimatedStyle(() => ({
 *     transform: [
 *       { perspective: 600 },
 *       { rotateX: `${rotateX.value}deg` },
 *       { rotateY: `${rotateY.value}deg` },
 *     ],
 *   }));
 *
 * Quando `enabled=false`, os valores ficam em 0 (sem tilt) — útil pra desativar
 * em capas standard ou em ambientes sem sensor (Expo Go, etc).
 */

import { useEffect } from 'react';
import {
  type SharedValue,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

// Import opcional do expo-sensors — em Expo Go ou builds sem módulo nativo,
// o require falha e o hook degrada pra no-op (tilt fica em 0).
let DeviceMotion: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const sensors = require('expo-sensors');
  DeviceMotion = sensors.DeviceMotion ?? null;
} catch {
  // ignore — sensor indisponível
}

const MAX_TILT_DEG = 18; // bem visível pra Elite (Pokémon-card style)
const UPDATE_INTERVAL_MS = 33; // ~30 fps
const SPRING_CONFIG = { damping: 18, stiffness: 130, mass: 0.55 };
// Multiplicador de sensibilidade pro delta. Pequenas inclinações geram boa
// rotação visual sem precisar girar o device até o teto.
const SENSITIVITY = 2.5;

export type ParallaxTilt = {
  rotateX: SharedValue<number>;
  rotateY: SharedValue<number>;
};

export function useParallaxTilt(enabled: boolean): ParallaxTilt {
  const rotateX = useSharedValue(0);
  const rotateY = useSharedValue(0);

  useEffect(() => {
    if (!enabled || !DeviceMotion) {
      rotateX.value = withSpring(0, SPRING_CONFIG);
      rotateY.value = withSpring(0, SPRING_CONFIG);
      return;
    }

    let mounted = true;
    let sub: { remove?: () => void } | null = null;
    // Baseline: primeira leitura do sensor vira o "zero". Sem isso, o pitch (beta)
    // fica fixo perto de π/2 quando o device está vertical, e o clamp trava — daí
    // a inclinação relativa não move o rotateX. Com baseline, qualquer pose inicial
    // funciona (vertical, deitado na mesa, etc).
    let baselineBeta: number | null = null;
    let baselineGamma: number | null = null;

    (async () => {
      try {
        const available = await DeviceMotion.isAvailableAsync();
        if (!available || !mounted) return;
        DeviceMotion.setUpdateInterval(UPDATE_INTERVAL_MS);
        sub = DeviceMotion.addListener((data: any) => {
          if (!mounted) return;
          // rotation.beta = pitch (eixo X, frente/trás), em radianos
          // rotation.gamma = roll (eixo Y, lado a lado), em radianos
          const beta = data?.rotation?.beta ?? 0;
          const gamma = data?.rotation?.gamma ?? 0;
          if (baselineBeta === null || baselineGamma === null) {
            baselineBeta = beta;
            baselineGamma = gamma;
            return;
          }
          const deltaBeta = beta - baselineBeta;
          const deltaGamma = gamma - baselineGamma;
          const degX = clamp(
            (deltaBeta * SENSITIVITY * 180) / Math.PI,
            -MAX_TILT_DEG,
            MAX_TILT_DEG,
          );
          const degY = clamp(
            (deltaGamma * SENSITIVITY * 180) / Math.PI,
            -MAX_TILT_DEG,
            MAX_TILT_DEG,
          );
          // Sinais escolhidos pra: inclinar device pra esquerda → card aparenta
          // virar pra esquerda; inclinar pra trás → card cai pra trás.
          // (Pokémon-card parallax: a face do card persegue o "horizonte".)
          rotateX.value = withSpring(-degX, SPRING_CONFIG);
          rotateY.value = withSpring(-degY, SPRING_CONFIG);
        });
      } catch (e) {
        console.warn('[useParallaxTilt] sensor setup fail', e);
      }
    })();

    return () => {
      mounted = false;
      try {
        sub?.remove?.();
      } catch {
        // ignore
      }
      rotateX.value = withSpring(0, SPRING_CONFIG);
      rotateY.value = withSpring(0, SPRING_CONFIG);
    };
  }, [enabled, rotateX, rotateY]);

  return { rotateX, rotateY };
}

function clamp(v: number, min: number, max: number): number {
  if (v < min) return min;
  if (v > max) return max;
  return v;
}
