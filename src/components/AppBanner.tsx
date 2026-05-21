import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useAuth } from '@/src/providers/AuthProvider';
import {
  adsAvailable,
  AdUnits,
  BannerAd,
  BannerAdSize,
  waitForAdsReady,
} from '@/src/lib/ads';

export function AppBanner() {
  const { profile } = useAuth();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!adsAvailable) return;
    waitForAdsReady()
      .then((ok) => setReady(ok))
      .catch(() => setReady(false));
  }, []);

  if (!ready || !adsAvailable || !BannerAd) return null;
  if (profile?.is_premium) return null;

  return (
    <View style={styles.wrap}>
      <BannerAd
        unitId={AdUnits.banner}
        size={BannerAdSize?.ANCHORED_ADAPTIVE_BANNER ?? 'BANNER'}
        requestOptions={{ requestNonPersonalizedAdsOnly: true }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
});
