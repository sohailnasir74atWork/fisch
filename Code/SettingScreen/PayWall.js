// PayWall.js
// All paywall *display* now goes through OfferWall.jsx (custom), matching
// adoptme-jan7. This file previously held handleOpenPaywall(), which called
// RevenueCatUI.presentPaywall() and handed the whole screen to RevenueCat's
// hosted template — the one that rendered as "RevenueCat Paywalls" with no
// branding. Nothing imports that path any more.
//
// What is left is the offerings cache. Note that Code/LocalGlobelStats.js
// already calls its own fetchOfferings() on init and that is what populates
// `packages` for the paywall — so unlike adoptme, preloadOfferings() is NOT
// wired into initRevenueCat here. Calling it there would issue a second
// getOfferings() for a cache nothing reads yet. It is kept because it is the
// documented place to put a preload if a screen ever needs `offerings.all`
// (a second offering, an A/B wall) without waiting on a fetch.
import Purchases from 'react-native-purchases';

let cachedOfferings = null;

export const preloadOfferings = async () => {
  try {
    const offerings = await Purchases.getOfferings();
    if (offerings?.all) {
      cachedOfferings = offerings.all;
    }
  } catch (e) {
    // Silent fail — callers fall back to a fetch on demand
  }
};

export const getCachedOfferings = () => cachedOfferings;
