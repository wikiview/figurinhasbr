/**
 * Wrapper resiliente do AdMob.
 *
 * - Funciona em build nativo (EAS Build) com `react-native-google-mobile-ads`.
 * - No Expo Go, vira no-op (sem crash, sem ads).
 * - Free user vê ads. Premium (profile.is_premium) é gratuito.
 *
 * Init é AWAIT-ado antes de qualquer .createForAdRequest pra evitar
 * crash nativo no Android quando o SDK ainda não terminou de subir.
 */

import { Platform } from 'react-native';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';

const isExpoGo =
  Constants.appOwnership === 'expo' ||
  Constants.executionEnvironment === 'storeClient';

let mobileAds: any = null;
let _BannerAd: any = null;
let _BannerAdSize: any = null;
let _InterstitialAd: any = null;
let _RewardedAd: any = null;
let _AdEventType: any = null;
let _RewardedAdEventType: any = null;
let _TestIds: any = null;

if (!isExpoGo) {
  try {
    const ads = require('react-native-google-mobile-ads');
    mobileAds = ads.default;
    _BannerAd = ads.BannerAd;
    _BannerAdSize = ads.BannerAdSize;
    _InterstitialAd = ads.InterstitialAd;
    _RewardedAd = ads.RewardedAd;
    _AdEventType = ads.AdEventType;
    _RewardedAdEventType = ads.RewardedAdEventType;
    _TestIds = ads.TestIds;
  } catch (e) {
    console.warn('[ads] require failed', e);
  }
}

export const adsAvailable = !!mobileAds;

const PROD = {
  banner: {
    android: 'ca-app-pub-5256697293336823/7004768952',
    ios: 'ca-app-pub-5256697293336823/1526271054',
  },
  interstitial: {
    android: 'ca-app-pub-5256697293336823/7844267399',
    ios: 'ca-app-pub-5256697293336823/7612333100',
  },
  rewarded: {
    android: 'ca-app-pub-5256697293336823/6357901691',
    ios: 'ca-app-pub-5256697293336823/9348920757',
  },
};

// Em dev local sempre usa test IDs. Em build (preview/production), respeita EXPO_PUBLIC_USE_REAL_ADS.
// Pra ligar ads reais num build: setar EXPO_PUBLIC_USE_REAL_ADS=true no eas.json do profile.
const USE_TEST_IDS = __DEV__ || process.env.EXPO_PUBLIC_USE_REAL_ADS !== 'true';
const TEST_DEVICE_IDS: string[] = [];

function pickId(prod: { android: string; ios: string }, testId: string | undefined) {
  if (USE_TEST_IDS && testId) return testId;
  return Platform.OS === 'ios' ? prod.ios : prod.android;
}

export const AdUnits = {
  banner: pickId(PROD.banner, _TestIds?.BANNER),
  interstitial: pickId(PROD.interstitial, _TestIds?.INTERSTITIAL),
  rewarded: pickId(PROD.rewarded, _TestIds?.REWARDED),
};

export const BannerAd = _BannerAd;
export const BannerAdSize = _BannerAdSize;

// ===== Init (async, idempotente) =====

let initPromise: Promise<boolean> | null = null;

async function ensureInit(): Promise<boolean> {
  if (!mobileAds) return false;
  if (initPromise) return initPromise;
  initPromise = (async () => {
    try {
      // iOS: pedir ATT antes de inicializar o SDK do AdMob (exigência da App Store).
      // No Android é no-op. Em Expo Go o módulo nem existe — try/catch silencia.
      if (Platform.OS === 'ios') {
        try {
          const tt = require('expo-tracking-transparency');
          const current = await tt.getTrackingPermissionsAsync();
          if (current.status === 'undetermined') {
            await tt.requestTrackingPermissionsAsync();
          }
        } catch (e) {
          console.warn('[ads] ATT request failed', e);
        }
      }
      if (TEST_DEVICE_IDS.length > 0) {
        try {
          await mobileAds().setRequestConfiguration({
            testDeviceIdentifiers: TEST_DEVICE_IDS,
          });
        } catch (e) {
          console.warn('[ads] setRequestConfiguration failed', e);
        }
      }
      await mobileAds().initialize();
      return true;
    } catch (e) {
      console.warn('[ads] initialize failed', e);
      return false;
    }
  })();
  return initPromise;
}

/** Aguarda o SDK estar pronto pra criar ad units. */
export async function waitForAdsReady(): Promise<boolean> {
  if (!adsAvailable) return false;
  return ensureInit();
}

// ===== Intersticial =====

let interstitialInstance: any = null;
let interstitialLoaded = false;
let interstitialLoading = false;

async function loadInterstitial() {
  if (!_InterstitialAd || !AdUnits.interstitial) return;
  if (interstitialLoading || interstitialLoaded) return;
  const ok = await ensureInit();
  if (!ok) return;
  interstitialLoading = true;
  try {
    interstitialInstance = _InterstitialAd.createForAdRequest(AdUnits.interstitial);
    interstitialInstance.addAdEventListener(_AdEventType.LOADED, () => {
      interstitialLoaded = true;
      interstitialLoading = false;
    });
    interstitialInstance.addAdEventListener(_AdEventType.ERROR, () => {
      interstitialLoaded = false;
      interstitialLoading = false;
    });
    interstitialInstance.addAdEventListener(_AdEventType.CLOSED, () => {
      interstitialLoaded = false;
      setTimeout(loadInterstitial, 500);
    });
    interstitialInstance.load();
  } catch (e) {
    console.warn('[ads] interstitial load failed', e);
    interstitialLoading = false;
  }
}

export function tryShowInterstitial(isPremium = false): boolean {
  if (isPremium || !adsAvailable) return false;
  loadInterstitial(); // garante carregamento futuro
  if (!interstitialInstance || !interstitialLoaded) return false;
  try {
    interstitialInstance.show();
    return true;
  } catch (e) {
    console.warn('[ads] interstitial show failed', e);
    return false;
  }
}

// ===== Rewarded =====

let rewardedInstance: any = null;
let rewardedLoaded = false;
let rewardedLoading = false;
let rewardedReadyPromise: Promise<boolean> | null = null;

async function loadRewarded() {
  if (!_RewardedAd || !AdUnits.rewarded) return;
  if (rewardedLoading || rewardedLoaded) return;
  const ok = await ensureInit();
  if (!ok) return;
  rewardedLoading = true;
  rewardedReadyPromise = new Promise<boolean>((resolve) => {
    try {
      rewardedInstance = _RewardedAd.createForAdRequest(AdUnits.rewarded);
      rewardedInstance.addAdEventListener(_AdEventType.LOADED, () => {
        rewardedLoaded = true;
        rewardedLoading = false;
        resolve(true);
      });
      rewardedInstance.addAdEventListener(_AdEventType.ERROR, (err: any) => {
        console.warn('[ads] rewarded error', err);
        rewardedLoaded = false;
        rewardedLoading = false;
        resolve(false);
      });
      rewardedInstance.addAdEventListener(_AdEventType.CLOSED, () => {
        rewardedLoaded = false;
        setTimeout(loadRewarded, 500);
      });
      rewardedInstance.load();
    } catch (e) {
      console.warn('[ads] rewarded load failed', e);
      rewardedLoading = false;
      resolve(false);
    }
  });
}

export function showRewarded(isPremium = false): Promise<boolean> {
  return new Promise(async (resolve) => {
    if (isPremium || !adsAvailable) {
      resolve(true);
      return;
    }
    loadRewarded(); // garante load se ainda não disparou

    // Se ainda não está pronto, dá até 5s pro load completar antes de desistir.
    if (!rewardedLoaded && rewardedReadyPromise) {
      const timeout = new Promise<boolean>((res) => setTimeout(() => res(false), 5000));
      await Promise.race([rewardedReadyPromise, timeout]);
    }

    if (!rewardedInstance || !rewardedLoaded) {
      // Fail-open: ad não carregou em tempo, libera a ação pra não travar UX.
      resolve(true);
      return;
    }

    let earned = false;
    let unsubReward: any;
    let unsubClosed: any;
    try {
      unsubReward = rewardedInstance.addAdEventListener(
        _RewardedAdEventType.EARNED_REWARD,
        () => {
          earned = true;
        },
      );
      unsubClosed = rewardedInstance.addAdEventListener(
        _AdEventType.CLOSED,
        () => {
          unsubReward?.();
          unsubClosed?.();
          resolve(earned);
        },
      );
      rewardedInstance.show();
    } catch (e) {
      unsubReward?.();
      unsubClosed?.();
      console.warn('[ads] rewarded show failed', e);
      resolve(true);
    }
  });
}

/** Aquece os ads em background depois do mount (não bloqueia boot). */
export function warmupAds() {
  if (!adsAvailable) return;
  setTimeout(() => {
    loadInterstitial();
    loadRewarded();
  }, 200);
}

// ===== Contadores =====

const COUNTER_KEYS = {
  scans: 'ads:counter:scans',
  stickers: 'ads:counter:stickers',
};

export type CounterKey = keyof typeof COUNTER_KEYS;

export async function bumpCounter(
  key: CounterKey,
  threshold: number,
  isPremium = false,
  delta = 1,
): Promise<boolean> {
  if (isPremium || !adsAvailable) return false;
  const k = COUNTER_KEYS[key];
  const current = parseInt((await AsyncStorage.getItem(k)) ?? '0', 10);
  const next = current + delta;
  if (next >= threshold) {
    await AsyncStorage.setItem(k, '0');
    return tryShowInterstitial(isPremium);
  }
  await AsyncStorage.setItem(k, String(next));
  return false;
}
