// AdConfig.js

import { Platform } from 'react-native';
import {  TestIds } from 'react-native-google-mobile-ads';
import config from '../Helper/Environment';
import { GAME } from '../config/game';


// Test units in dev, AND in release for any platform whose real IDs are not in
// place yet — those still belong to a sibling app, and a release build would
// serve live ads against someone else's AdMob account. The check is PER
// PLATFORM: Android has its own fisch_* units now, iOS does not, so the same
// build must serve real units on one and test units on the other.
// See Code/config/game.js.
const platformHasOwnUnits = !!GAME.adUnitsConfigured?.[Platform.OS];
export const developmentMode = __DEV__ || !platformHasOwnUnits;

const adUnits = {
  test: {
    banner: TestIds.BANNER,
    interstitial: TestIds.INTERSTITIAL,
    rewarded:TestIds.REWARDED,
    openapp:TestIds.APP_OPEN,
    native:TestIds.NATIVE,
    feedBanner: TestIds.BANNER,
  },
  android: {
    banner: config.andriodBanner,       
    interstitial: config.andriodIntestial, 
    rewarded:config.andriodRewarded,
    openapp:config.andriodOpenApp,
    native:config.andriodNative,
    // In-feed inline banner (FeedBannerAd.jsx). Falls back to the anchored
    // banner unit until a dedicated unit exists for this platform — any
    // banner-format unit serves inline sizes; only the reporting differs.
    feedBanner: config.andriodFeedBanner || config.andriodBanner,
  },
  ios: {
    banner: config.IOsBanner,      
    interstitial: config.IOsIntestial, 
    rewarded:config.IOsRewarded,
    openapp:config.IOsOpenApp,
    native:config.IOsNative,
    feedBanner: config.IOsFeedBanner || config.IOsBanner,
  },
  
};

const getAdUnitId = (type) => {
  const os = Platform.OS;
  if (developmentMode) 
    return adUnits.test[type];
  return adUnits[os][type]; 
};

export default getAdUnitId;