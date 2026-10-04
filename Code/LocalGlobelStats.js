import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { Appearance, AppState } from 'react-native';
import { createMMKV } from 'react-native-mmkv';
import Purchases from 'react-native-purchases';
import config from './Helper/Environment';
import { GAME, hasProEntitlement } from './config/game';
import { useTranslation } from 'react-i18next';
import { getAuth, onAuthStateChanged } from '@react-native-firebase/auth';
import { fetchPromoProUntil } from './Helper/promoCode';

import { showErrorMessage, showSuccessMessage } from './Helper/MessageHelper';

import { parseStored, normalizeScale } from './Helper/feedContract';
import { readCatalogueCache } from './Helper/catalogueClient';

const storage = createMMKV();
const LocalStateContext = createContext();

export const useLocalState = () => useContext(LocalStateContext);

export const LocalStateProvider = ({ children }) => {
  // Initial local state
  const safeParseJSON = (key, defaultValue) => {
    try {
      const value = storage.getString(key);
      return value ? JSON.parse(value) : defaultValue;
    } catch (error) {
      // console.error(`🚨 JSON Parse Error for key "${key}":`, error);
      return defaultValue; // Return a safe fallback value
    }
  };

  const initialCatalogue = useMemo(() => readCatalogueCache(storage.getString('catalogueSnapshot')), []);
  const [localState, setLocalState] = useState(() => ({
    localKey: storage.getString('localKey') || 'defaultValue',
    reviewCount: Number(storage.getString('reviewCount')) || 0,
    lastVersion: storage.getString('lastVersion') || 'UNKNOWN',
    updateCount: Number(storage.getString('updateCount')) || 0,
    featuredCount: safeParseJSON('featuredCount', { count: 0, time: null }),
    isHaptic: storage.getBoolean('isHaptic') ?? true,
    theme: storage.getString('theme') || 'system',
    consentStatus: storage.getString('consentStatus') || 'UNKNOWN',
    isPro: storage.getBoolean('isPro') ?? false,
    // Promo-code Pro end time (ms), 0 = none. isPro is RevenueCat OR this;
    // see applyRcPro / applyPromoPro below.
    promoProUntil: Number(storage.getString('promoProUntil')) || 0,
    fetchDataTime: storage.getString('fetchDataTime') || null,
    data: initialCatalogue?.data || parseStored(storage.getString('data')) || {},
    // The Supreme catalogue. GlobalStats has written this to MMKV since the
    // dual-feed fetch landed, but it was never rehydrated here — so on every
    // cold start it came back undefined and stayed that way until the next
    // network fetch finished.
    suprime: safeParseJSON('suprime', {}),
    // Which catalogue prices the calculator: 'mm2' | 'supreme'. The two
    // disagree on 70% of the items they share, so this is a real preference,
    // not a display option. See Code/Helper/valueSources.js.
    valueSource: normalizeScale(storage.getString('valueSource')),
    // Seasonal-event config, mirrored from RTDB /events. Empty until the first
    // fetch; the event screen falls back to its built-in estimates until then,
    // so a cold start with no network still shows a sensible countdown.
    events: safeParseJSON('events', {}),
    // The feed envelope's `meta`: catalogue `generatedAt` plus the measured
    // event schedule the Timers screen counts down from. Kept separate from
    // `data` so nothing that reads the collections has to change.
    feedMeta: initialCatalogue?.meta || parseStored(storage.getString('feedMeta')) || {},
    catalogueSnapshot: initialCatalogue,
    valuesError: null,
    ggData: safeParseJSON('ggData', {}),
    codes: initialCatalogue?.data.codes || safeParseJSON('codes', {}),
    normalStock: safeParseJSON('normalStock', []),
    // My Stuff mirror (source of truth = Firestore reviews/{uid}) — read by
    // the calculator INVENTORY tab and the chat item picker so all three
    // surfaces share ONE list.
    ownedPets: safeParseJSON('ownedPets', []),
    wishlistPets: safeParseJSON('wishlistPets', []),
    bannedUsers: safeParseJSON('bannedUsers', []),
    // Per launch, never restored: it gates the boot splash on THIS launch's
    // login. Read back from storage it was true from the 2nd launch on, so the
    // splash hid before login and signed-in players saw a signed-out app.
    // App.js caps the wait at 3 s. (From mm2values.)
    isAppReady: false,
    lastActivity: storage.getString('lastActivity') || null,
    showOnBoardingScreen: storage.getBoolean('showOnBoardingScreen') ?? true,
    user_name: storage.getString('user_name') || 'Anonymous',
    translationUsage: safeParseJSON('translationUsage', { count: 0, date: new Date().toDateString() }),
    favorites: safeParseJSON('favorites', []),
    isGG: storage.getBoolean('isGG') ?? false,
    showAd1: storage.getBoolean('showAd1') ?? true,
    postsCache: safeParseJSON('postsCache', []),
    tradingServerLink: storage.getString('tradingServerLink') || null,
    lastServerFetch: storage.getString('lastServerFetch') || null,
    // When the value catalogues were last pulled. Deliberately NOT lastActivity:
    // that key is stamped on every app launch (and mirrored to RTDB), so using
    // it as the catalogue's TTL clock meant timeElapsed was always ~0 and a
    // cached catalogue was never refreshed. MUST be rehydrated here -- left
    // undefined it reads as epoch 0 and every launch refetches both feeds.
    valuesFetchedAt: initialCatalogue?.checkedAt || storage.getString('valuesFetchedAt') || null,
    showFlag: storage.getBoolean('showFlag') ?? true, // ✅ Default true (show flag), user can hide to save data
    showOnlineStatus: storage.getBoolean('showOnlineStatus') ?? true, // ✅ Default true (show online), user can hide to save Firebase costs

  }));


  // RevenueCat states
  const [customerId, setCustomerId] = useState(null);
  // const [isPro, setIsPro] = useState(true); // Sync with MMKV storage
  const [packages, setPackages] = useState([]);
  const [mySubscriptions, setMySubscriptions] = useState([]);
  const { t } = useTranslation();


  // Listen for system theme changes
  useEffect(() => {
    if (localState.theme === 'system') {
      const listener = Appearance.addChangeListener(({ colorScheme }) => {
        updateLocalState('theme', colorScheme);
      });
      return () => listener.remove(); // Correct cleanup
    }
  }, [localState.theme]);

  const commitCatalogue = useCallback(snapshot => {
    const checked = readCatalogueCache(snapshot);
    if (!checked) throw new Error('Invalid catalogue cache');
    // One durable record keeps catalogue, metadata and ETag from different builds apart.
    storage.set('catalogueSnapshot', JSON.stringify(checked));
    setLocalState(prev => ({ ...prev, catalogueSnapshot: checked, data: checked.data, feedMeta: checked.meta,
      valuesFetchedAt: checked.checkedAt, valuesError: null,
      codes: [...(checked.data.codes || [])].sort((a,b) => Number(b.active === true) - Number(a.active === true)) }));
  }, []);

  // console.log(localState.isPro)
  // ✅ Memoize updateLocalState to prevent recreation on every render
  const updateLocalState = useCallback((key, value) => {
    setLocalState((prevState) => ({
      ...prevState,
      [key]: value,
    }));

    // Save to MMKV storage
    if (typeof value === 'string') {
      storage.set(key, value);
    } else if (typeof value === 'number') {
      storage.set(key, value.toString());
    } else if (typeof value === 'boolean') {
      storage.set(key, value);
    } else if (typeof value === 'object') {
      storage.set(key, JSON.stringify(value)); // ✅ Store objects/arrays as JSON
    } else {
      // console.error('🚨 MMKV supports only string, number, boolean, or JSON stringified objects.');
    }
  }, []); // ✅ Empty deps - function is stable, doesn't depend on any props/state
  // ── Pro = RevenueCat OR an unexpired promo code ─────────────────────────
  // The ad modules read MMKV 'isPro' directly, so the combined answer must
  // land in that key. RevenueCat's own answer is kept in 'rcPro' so a promo
  // expiring can fall back to it rather than to false.
  const promoActive = (until) => until > Date.now();

  const applyRcPro = useCallback((rcPro) => {
    storage.set('rcPro', rcPro === true);
    const promoUntil = Number(storage.getString('promoProUntil')) || 0;
    updateLocalState('isPro', rcPro === true || promoActive(promoUntil));
  }, [updateLocalState]);

  const applyPromoPro = useCallback((until) => {
    const next = Number(until) || 0;
    // Installs from before promo codes never stored 'rcPro'; their isPro is
    // RevenueCat's answer, so take it as the baseline before overwriting it.
    if (storage.getBoolean('rcPro') === undefined) {
      storage.set('rcPro', storage.getBoolean('isPro') === true);
    }
    updateLocalState('promoProUntil', next);
    updateLocalState('isPro', storage.getBoolean('rcPro') === true || promoActive(next));
  }, [updateLocalState]);

  // Expire promo Pro on time: at launch, on every foreground, and by timer
  // while the app stays open.
  useEffect(() => {
    const until = localState.promoProUntil;
    if (!until) return;
    const expire = () => {
      if (!promoActive(until)) applyPromoPro(0);
    };
    expire();
    const sub = AppState.addEventListener('change', s => { if (s === 'active') expire(); });
    const left = until - Date.now();
    const timer = left > 0 && left < 2 ** 31 - 1 ? setTimeout(expire, left + 1000) : null;
    return () => { sub.remove(); if (timer) clearTimeout(timer); };
  }, [localState.promoProUntil, applyPromoPro]);

  // Promo Pro belongs to the account: restore it on sign-in (reinstall, new
  // phone), drop it on sign-out so a shared phone never lends it. Offline
  // reads (null) leave the stored value alone.
  useEffect(() => {
    return onAuthStateChanged(getAuth(), async (user) => {
      if (!user) {
        if (Number(storage.getString('promoProUntil')) > 0) applyPromoPro(0);
        return;
      }
      const until = await fetchPromoProUntil(user.uid);
      if (until === null) return;
      if (until !== (Number(storage.getString('promoProUntil')) || 0)) {
        applyPromoPro(promoActive(until) ? until : 0);
      }
    });
  }, [applyPromoPro]);

  const canTranslate = useCallback(() => {
    const today = new Date().toDateString();
    const { count, date } = localState.translationUsage || { count: 0, date: today };

    if (date !== today) {
      // Reset count for new day
      const newUsage = { count: 0, date: today };
      updateLocalState('translationUsage', newUsage);
      return true;
    }

    return count < 5;
  }, [localState.translationUsage, updateLocalState]);
  
  // ✅ Memoize toggleAd to prevent recreation on every render
  const toggleAd = useCallback(() => {
    const newAdState = !localState.showAd1;
    updateLocalState('showAd1', newAdState);
    return newAdState;
  }, [localState.showAd1, updateLocalState]);

  const incrementTranslationCount = useCallback(() => {
    const today = new Date().toDateString();
    const { count, date } = localState.translationUsage || { count: 0, date: today };

    const updatedUsage = {
      count: date === today ? count + 1 : 1,
      date: today,
    };

    updateLocalState('translationUsage', updatedUsage);
  }, [localState.translationUsage, updateLocalState]);


  // console.log(localState.data)
  // console.log(isPro)
  // Initialize RevenueCat
  const initRevenueCat = async () => {
    // The iOS limited build configures RevenueCat too: its one purchase is
    // Remove Ads (the Pro entitlement), sold from IosSettings and the
    // calculator. See Code/config/iosLimited.js.
    try {
      // Configure once per app process. The provider remounts (Fast Refresh in
      // dev, a provider re-render after a reload), and a second configure
      // logged "Purchases instance already set ... Ignoring duplicate call".
      if (!(await Purchases.isConfigured())) {
        await Purchases.configure({ apiKey: config.apiKey, usesStoreKit2IfAvailable: false });
      }
      const userID = await Purchases.getAppUserID();
      setCustomerId(userID);

      // Run these in parallel for better performance
      await Promise.all([
        fetchOfferings().catch(error => {
          // console.error('❌ Error fetching offerings:', error.message);
          return null; // Return null instead of throwing
        }),
        checkEntitlements().catch(error => {
          // console.error('❌ Error checking entitlements:', error.message);
          return null; // Return null instead of throwing
        })
      ]);
    } catch (error) {
      // console.error('❌ Error initializing RevenueCat:', error.message);
      // Set a default state in case of failure
      setCustomerId(null);
      setPackages([]);
      setMySubscriptions([]);
    }
  };
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      initRevenueCat();
    }, 0);
    return () => clearTimeout(timeoutId);
  }, []);

  // console.log(isPro)
  // Fetch available subscriptions
  const fetchOfferings = async () => {
    try {
      // No RevenueCat products for this app yet — see Code/config/game.js.
      // Without this, every launch logs a NetworkError/offerings failure.
      if (!GAME.subscriptionsEnabled) return;
      // ✅ Guard: skip if billing is unavailable (e.g. emulator)
      const canPay = await Purchases.canMakePayments().catch(() => false);
      if (!canPay) {
        console.warn('⚠️ Billing unavailable — skipping fetchOfferings');
        return;
      }
      const offerings = await Purchases.getOfferings();
      if (offerings.current?.availablePackages?.length > 0) {
        setPackages(offerings.current.availablePackages);
      } else {
        console.warn('⚠️ No offerings found in RevenueCat.');
      }
    } catch (error) {
      console.error('❌ Fetch Offerings Error:', error.message);
    }
  };

// console.log(packages)


  const restorePurchases = async (setLoadingReStore) => {
    setLoadingReStore(true);
    try {
      const customerInfo = await Purchases.restorePurchases();
      const entitlements = customerInfo.entitlements.active;
      const proStatus = hasProEntitlement(entitlements);

      applyRcPro(proStatus);
      setMySubscriptions(
        proStatus
          ? customerInfo.activeSubscriptions.map((plan) => ({
            plan,
            expiry: customerInfo.allExpirationDates[plan] || null,
          }))
          : []
      );
      // Callers that need to tell the user what happened read this; the
      // paywall ignores it and watches localState.isPro instead.
      return proStatus;
    } catch (error) {
      // console.error('❌ Restore Purchases Error:', error);
      return null;
    } finally {
      setLoadingReStore(false); // Ensure loading state resets
    }
  };


  // Check if the user has an active subscription
  const checkEntitlements = async () => {
    try {
      const canPay = await Purchases.canMakePayments().catch(() => false);
      if (!canPay) return;
      const customerInfo = await Purchases.getCustomerInfo();
      const entitlements = customerInfo.entitlements.active;
      // console.log(customerInfo.activeSubscriptions)
      const proStatus = hasProEntitlement(entitlements);
      if (proStatus) {
        applyRcPro(proStatus); // Persist Pro status in MMKV
        const activePlansWithExpiry = customerInfo.activeSubscriptions.map((subscription) => ({
          plan: subscription,
          expiry: customerInfo.allExpirationDates[subscription],
        }));
        setMySubscriptions(activePlansWithExpiry);
      }
    } catch (error) {
      // console.error('❌ Error checking entitlements:', error);
    }
  };
  // Handle in-app purchase
  const purchaseProduct = async (packageToPurchase, setLoading, track) => {
    setLoading(true);
    try {
      // The Play purchase sheet backgrounds the app; coming back from it must
      // not open an App Open ad on someone who was just buying ad-free. Lazy
      // require keeps the ad SDK out of this module's import graph.
      try { require('./Ads/openApp').default.skipNextForeground(); } catch (_) {}
      const { customerInfo } = await Purchases.purchasePackage(packageToPurchase);
      const entitlements = customerInfo.entitlements.active;
      const proStatus = hasProEntitlement(entitlements);

      applyRcPro(proStatus);
      setMySubscriptions(
        proStatus
          ? customerInfo.activeSubscriptions.map((plan) => ({
            plan,
            expiry: customerInfo.allExpirationDates[plan] || null,
          }))
          : []
      );

      if (track) {
      }

      showSuccessMessage("Success", "Purchase completed successfully!");
    } catch (error) {
      if (!error.userCancelled) {
        // console.error('❌ Purchase Error:', error);
        showErrorMessage("Error", "Failed to complete purchase. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

 
  // Clear a specific key
  const clearKey = useCallback((key) => {
    setLocalState((prevState) => {
      const newState = { ...prevState };
      delete newState[key];
      return newState;
    });

    storage.remove(key);
  }, []);

  // Clear all local state and MMKV storage
  const clearAll = useCallback(() => {
    setLocalState({});
    storage.clearAll();
  }, []);

  const getRemainingTranslationTries = useCallback(() => {
    const today = new Date().toDateString();
    const { count = 0, date = today } = localState.translationUsage || {};
    return date === today ? 5 - count : 5;
  }, [localState.translationUsage]);


  const contextValue = useMemo(
    () => ({
      localState,
      updateLocalState,
      commitCatalogue,
      clearKey,
      clearAll,
      customerId,
      packages,
      mySubscriptions,
      purchaseProduct,
      restorePurchases,
      applyPromoPro,
      canTranslate,
      incrementTranslationCount,
      getRemainingTranslationTries, toggleAd
    }),
    [localState, commitCatalogue, applyPromoPro, customerId, packages, mySubscriptions, updateLocalState, canTranslate, incrementTranslationCount, getRemainingTranslationTries, toggleAd, clearKey, clearAll]
  );

  return (
    <LocalStateContext.Provider value={contextValue}>
      {children}
    </LocalStateContext.Provider>
  );
};
