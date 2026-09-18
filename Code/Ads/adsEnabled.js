// Single switch for "should this build serve ads at all".
//
// In development the App Open ad covers the whole screen on every cold start
// and foreground return, and interstitials interrupt navigation — so a debug
// build spends more time behind Google's test creatives than in the app.
//
// This is deliberately separate from the Pro check. Pro means "this user paid
// to remove ads"; this means "this build does not show ads". Keeping them
// apart means the Pro paths stay exercised in dev.
//
// Release builds are untouched: __DEV__ is false there, so adsEnabled() is
// true regardless of the flag below.
import { GAME } from '../config/game';

export const adsEnabled = () => !__DEV__ || GAME.showAdsInDev === true;

export default adsEnabled;
