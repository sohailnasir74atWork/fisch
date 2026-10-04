// adsGate.js — "may we request ads yet?"
//
// App.js resolves this once the consent chain has run (iOS ATT → UMP consent
// → setRequestConfiguration + MobileAds.initialize), and resolves it whether
// that chain succeeded or threw, so a consent failure never leaves the app
// without ads. Every ad surface waits on it, so no ad is requested before
// consent, and the SDK's heavy first work (creating the ad WebView on the UI
// thread) happens after the first screen instead of during it — a known
// low-end-Android ANR source. (Ported from mm2values.)
import { useSyncExternalStore } from 'react';

let ready = false;
let resolveReady;
const readyPromise = new Promise((r) => { resolveReady = r; });
const listeners = new Set();

export const markAdsReady = () => {
  if (ready) return;
  ready = true;
  resolveReady();
  listeners.forEach((l) => l());
};

export const whenAdsReady = () => readyPromise;

const subscribe = (l) => { listeners.add(l); return () => listeners.delete(l); };
export const useAdsReady = () => useSyncExternalStore(subscribe, () => ready);
