/**
 * Environment.js — per-app configuration.
 *
 * ⚠️  RELEASE BLOCKERS — every value below still belongs to another app.
 *     They are left working on purpose so ads and purchases keep functioning
 *     in development, but NONE of them may ship:
 *
 *       ✅ AdMob is DONE on both platforms: the unit IDs and app IDs are this
 *         app's own (fisch_* on Android, ios_* on iOS, same publisher), and
 *         adUnitsConfigured is true for both in Code/config/game.js.
 *       • rev_cat_id / apiKey: the ANDROID RevenueCat key is now this app's
 *         own. The iOS key (appl_…) is still Blox Fruit's.
 *       • supportEmail is the Blox Fruit support address.
 *       ✅ gameInterstitialAndroid / gameInterstitialIOS, likewise — both now
 *         point at this app's own interstitial unit.
 *
 *     Replace all of them before the first release build. Colours are NOT in
 *     this list — they now derive from Code/Design/tokens.js.
 */
import { Platform } from "react-native";
import { LIGHT, DARK, STATUS } from '../Design/tokens';
import { GAME } from '../config/game';

const isNoman = true; // Toggle this to switch configurations

// noman app id = ca-app-pub-5740215782746766~6229019896
//waqas app id = ca-app-pub-3701208411582706~4267174419
// noman pkgName= com.mm2tradesvalues
//waqas pkgName = com.bloxfruitstock
// Android is this app's OWN RevenueCat public SDK key (goog_ keys are meant to
// ship in the client; the secret sk_ keys are not and must never live here).
// iOS is STILL Blox Fruit's — see the release-blocker note above.
const rev_cat_id = Platform.OS === 'ios' ? 'appl_pjMIQFzBcdWtHdGHYbxVLuWcMvA' : 'goog_UCbCmyZVAXxDXrLpaKvpgPVQTfr'

const config = {
  appName: GAME.displayName,
  andriodBanner: 'ca-app-pub-5740215782746766/8372895094',      // fisch_banner
  andriodIntestial: 'ca-app-pub-5740215782746766/3161675875',   // fisch_int
  andriodRewarded: 'ca-app-pub-5740215782746766/9663505046',    // fisch_reward
  andriodOpenApp: 'ca-app-pub-5740215782746766/9535512530',     // fisch_open
  andriodNative: 'ca-app-pub-5740215782746766/1848594209',      // fisch_native
  IOsIntestial: 'ca-app-pub-5740215782746766/2023109166',       // ios_int
  IOsBanner: 'ca-app-pub-5740215782746766/3336190831',          // ios_banner
  IOsRewarded: 'ca-app-pub-5740215782746766/7139704479',        // ios_reward
  IOsOpenApp: 'ca-app-pub-5740215782746766/1424343366',         // ios_open
  IOsNative: 'ca-app-pub-5740215782746766/9765867815',          // ios_native
  // No separate "game" interstitial units exist in this AdMob app, so the
  // IntAd A/B slot B points at the real interstitial unit (valid unit, no
  // no-fill). Create a 2nd interstitial unit per platform later for true A/B.
  gameInterstitialAndroid: 'ca-app-pub-5740215782746766/3161675875', // fisch_int (no 2nd unit yet)

  gameInterstitialIOS: 'ca-app-pub-5740215782746766/2023109166', // ios_int (no 2nd unit yet)
  apiKey: isNoman ? rev_cat_id : 'goog_UCbCmyZVAXxDXrLpaKvpgPVQTfr',

  supportEmail: isNoman ? 'thesolanalabs@gmail.com' : 'mindfusionio.help@gmail.com',
  andriodShareLink: GAME.store.android,

  isNoman: isNoman ? true : false,
  
  IOsShareLink: GAME.store.ios,   // null until the App Store listing exists
  webSite: GAME.privacyPolicyUrl,   // TODO: set once the site exists

  // otherapplink / otherapplink2 removed: sibling-app store links now live in
  // GAME.otherApps, with the matching name and artwork beside them. Keeping
  // them here is what let a link drift away from the label that opened it.
  /**
   * Derived from Code/Design/tokens.js — this object is no longer a source of
   * truth, only a compatibility surface.
   *
   * 778 call sites across 65 files read `config.colors.*`, so deleting it
   * would mean touching every one. Pointing it at the tokens instead means all
   * of them picked up the new palette without being edited, and a colour is
   * now decided in exactly one place.
   *
   * The `isNoman` brand fork that used to live here is gone: this app has one
   * brand. Do not add colours here — add them to tokens.js.
   */
  colors: {
    primary: LIGHT.primary,
    secondary: LIGHT.accent,
    accent: LIGHT.accent,

    // Give/receive blocks. MM2 mapped both to the brand colour, so a "has"
    // block was indistinguishable from a "wants" block — the single most
    // important distinction on the calculator. They differ now.
    hasBlockGreen: LIGHT.success,
    wantBlockRed: LIGHT.accent,

    backgroundLight: LIGHT.bg,              backgroundDark: DARK.bg,
    surfaceLight: LIGHT.card,               surfaceDark: DARK.card,
    surfaceElevatedLight: LIGHT.bgElevated, surfaceElevatedDark: DARK.bgElevated,

    textLight: LIGHT.text,                  textDark: DARK.text,
    textSecondaryLight: LIGHT.textSecondary, textSecondaryDark: DARK.textSecondary,
    textTertiaryLight: LIGHT.textMuted,     textTertiaryDark: DARK.textMuted,

    borderLight: LIGHT.border,              borderDark: DARK.border,
    dividerLight: LIGHT.divider,            dividerDark: DARK.divider,
    placeholderLight: LIGHT.textMuted,      placeholderDark: DARK.textMuted,
    overlayLight: LIGHT.overlay,            overlayDark: DARK.overlay,
    shadowLight: 'rgba(11,42,54,0.08)',     shadowDark: 'rgba(0,0,0,0.40)',
    linkLight: LIGHT.primary,               linkDark: DARK.primary,

    success: STATUS.success, successLight: LIGHT.successTint, successDark: DARK.success,
    error: STATUS.danger,    errorLight: LIGHT.dangerTint,    errorDark: DARK.danger,
    warning: STATUS.warning, warningLight: LIGHT.warningTint, warningDark: DARK.warning,
    info: STATUS.primary,    infoLight: LIGHT.primaryTint,    infoDark: DARK.primary,

    white: '#FFFFFF',
    black: LIGHT.text,   // deep sea ink rather than pure black — softer, on-brand
  },

};

export default config;
