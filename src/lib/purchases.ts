/**
 * Wrapper resiliente do RevenueCat.
 *
 * - Funciona em build nativo (EAS Build) com `react-native-purchases`.
 * - No Expo Go, vira no-op (sem crash).
 * - Source of truth do status premium = customerInfo.entitlements.active['premium']
 *   do próprio RevenueCat. O `profile.is_premium` no Supabase é um espelho/cache.
 *
 * Setup (ver docs/payments-setup.md):
 *   1. Criar conta RevenueCat
 *   2. Configurar produtos no App Store Connect e Google Play
 *   3. Conectar essas stores no RC
 *   4. Criar Entitlement "premium" e Offering "default" com pacote "lifetime"
 *   5. Setar EXPO_PUBLIC_RC_API_KEY_IOS e EXPO_PUBLIC_RC_API_KEY_ANDROID no eas.json
 */

import { Platform } from 'react-native';
import Constants from 'expo-constants';

const isExpoGo =
  Constants.appOwnership === 'expo' ||
  Constants.executionEnvironment === 'storeClient';

let Purchases: any = null;
let LOG_LEVEL: any = null;
let PURCHASES_ERROR_CODE: any = null;

if (!isExpoGo) {
  try {
    const rc = require('react-native-purchases');
    Purchases = rc.default ?? rc.Purchases ?? rc;
    LOG_LEVEL = rc.LOG_LEVEL;
    PURCHASES_ERROR_CODE = rc.PURCHASES_ERROR_CODE;
  } catch (e) {
    console.warn('[purchases] require failed', e);
  }
}

export const purchasesAvailable = !!Purchases;

const API_KEY_IOS = process.env.EXPO_PUBLIC_RC_API_KEY_IOS ?? '';
const API_KEY_ANDROID = process.env.EXPO_PUBLIC_RC_API_KEY_ANDROID ?? '';

/** ID do entitlement no painel do RevenueCat. */
const PREMIUM_ENTITLEMENT_ID = 'premium';

// ===== Configure (idempotente) =====

let configured = false;
let configurePromise: Promise<boolean> | null = null;

/**
 * Inicializa o SDK. Chame uma vez no boot do app (depois do AuthProvider saber se há sessão).
 * Pode ser chamada sem userId (anônimo) e depois ligada via setPurchasesUserId.
 */
export async function configurePurchases(userId: string | null): Promise<boolean> {
  if (!purchasesAvailable) return false;
  if (configurePromise) return configurePromise;

  configurePromise = (async () => {
    try {
      const apiKey = Platform.OS === 'ios' ? API_KEY_IOS : API_KEY_ANDROID;
      if (!apiKey) {
        console.warn('[purchases] missing API key for', Platform.OS);
        return false;
      }
      if (__DEV__ && LOG_LEVEL) {
        try {
          Purchases.setLogLevel(LOG_LEVEL.DEBUG);
        } catch {}
      }
      Purchases.configure({ apiKey, appUserID: userId ?? undefined });
      configured = true;
      return true;
    } catch (e) {
      console.warn('[purchases] configure failed', e);
      return false;
    }
  })();
  return configurePromise;
}

/** Liga a sessão do Supabase com o appUserID do RC pra preservar premium entre devices. */
export async function setPurchasesUserId(userId: string | null): Promise<void> {
  if (!configured) return;
  try {
    if (userId) {
      await Purchases.logIn(userId);
    } else {
      await Purchases.logOut();
    }
  } catch (e) {
    console.warn('[purchases] setUser failed', e);
  }
}

// ===== Status =====

export type PremiumStatus = {
  isPremium: boolean;
  expiresAt: string | null;
  willRenew: boolean;
  productId: string | null;
};

const EMPTY_STATUS: PremiumStatus = {
  isPremium: false,
  expiresAt: null,
  willRenew: false,
  productId: null,
};

function entitlementToStatus(ent: any): PremiumStatus {
  if (!ent) return EMPTY_STATUS;
  return {
    isPremium: true,
    expiresAt: ent.expirationDate ?? null,
    willRenew: !!ent.willRenew,
    productId: ent.productIdentifier ?? null,
  };
}

export async function getPremiumStatus(): Promise<PremiumStatus> {
  if (!configured) return EMPTY_STATUS;
  try {
    const info = await Purchases.getCustomerInfo();
    return entitlementToStatus(info?.entitlements?.active?.[PREMIUM_ENTITLEMENT_ID]);
  } catch (e) {
    console.warn('[purchases] getCustomerInfo failed', e);
    return EMPTY_STATUS;
  }
}

// ===== Offerings (preço dinâmico, pra paywall) =====

export type PremiumOffering = {
  priceString: string; // ex: "R$ 14,90"
  identifier: string;
  productId: string;
};

export async function getPremiumOffering(): Promise<PremiumOffering | null> {
  if (!configured) return null;
  try {
    const offerings = await Purchases.getOfferings();
    const current = offerings?.current;
    if (!current) return null;
    // Tenta achar o pacote lifetime (one-time). Fallback: primeiro disponível.
    const pkg =
      current.lifetime ??
      current.availablePackages?.find((p: any) => p.packageType === 'LIFETIME') ??
      current.availablePackages?.[0];
    if (!pkg) return null;
    return {
      priceString: pkg.product.priceString,
      identifier: pkg.identifier,
      productId: pkg.product.identifier,
    };
  } catch (e) {
    console.warn('[purchases] getOfferings failed', e);
    return null;
  }
}

// ===== Compra =====

export type PurchaseResult =
  | { ok: true; status: PremiumStatus }
  | { ok: false; cancelled: boolean; message?: string };

export async function purchasePremium(): Promise<PurchaseResult> {
  if (!configured) {
    return {
      ok: false,
      cancelled: false,
      message: 'Pagamentos indisponíveis neste ambiente.',
    };
  }
  try {
    const offerings = await Purchases.getOfferings();
    const current = offerings?.current;
    const pkg =
      current?.lifetime ??
      current?.availablePackages?.find((p: any) => p.packageType === 'LIFETIME') ??
      current?.availablePackages?.[0];
    if (!pkg) {
      return {
        ok: false,
        cancelled: false,
        message: 'Produto Premium indisponível no momento. Tente novamente em alguns minutos.',
      };
    }
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    const status = entitlementToStatus(
      customerInfo?.entitlements?.active?.[PREMIUM_ENTITLEMENT_ID],
    );
    if (status.isPremium) return { ok: true, status };
    return {
      ok: false,
      cancelled: false,
      message: 'A compra foi feita mas o Premium ainda não foi ativado. Tente "Restaurar compras" em alguns minutos.',
    };
  } catch (e: any) {
    const userCancelled =
      e?.userCancelled === true ||
      (PURCHASES_ERROR_CODE &&
        e?.code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR);
    if (userCancelled) return { ok: false, cancelled: true };
    console.warn('[purchases] purchasePremium failed', e);
    return {
      ok: false,
      cancelled: false,
      message: e?.message ?? 'Erro inesperado durante a compra.',
    };
  }
}

// ===== Restore (obrigatório pela App Store) =====

export async function restorePurchases(): Promise<PremiumStatus> {
  if (!configured) return EMPTY_STATUS;
  try {
    const info = await Purchases.restorePurchases();
    return entitlementToStatus(info?.entitlements?.active?.[PREMIUM_ENTITLEMENT_ID]);
  } catch (e) {
    console.warn('[purchases] restorePurchases failed', e);
    return EMPTY_STATUS;
  }
}
