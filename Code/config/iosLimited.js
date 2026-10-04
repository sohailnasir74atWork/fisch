/**
 * iOS limited-release gate.
 *
 * The first iOS release ships a cut-down app: no onboarding walkthrough, a
 * single Home screen with no tab bar, and none of the social surfaces.
 * Android is unchanged. Every hidden surface is gated on this ONE flag rather
 * than deleted, so the full app returns on iOS by flipping this to `false` —
 * nothing has to be restored.
 *
 * Search for IOS_LIMITED to find every gate:
 *   App.js            – onboarding walkthrough skipped; Calculator registered
 *                       as a stack route (it is a tab everywhere else); the
 *                       bottom inset MainTabs normally gets from its tab bar
 *   MainTabs.js       – Calculator / Trade / Designs / Chat tabs and the bar
 *   HomeTabScreen.jsx – the custom header band (App.js gives Home the plain
 *                       native stack header instead, title only), Friends,
 *                       Top Rated, Our Team, the status feed, Win / My
 *                       Cosmetics; adds the Calculator card and a Settings pill
 *   Setting route     – IosSettings.jsx (Remove Ads, Restore, theme, support,
 *                       legal; no language picker) instead of the full Setting.jsx
 *   OfferWall.jsx     – sells Remove Ads only; CTA reads "Continue"
 *
 * RevenueCat IS configured on iOS (appl_ key in Helper/Environment.js); its
 * only product there is Remove Ads, i.e. the Pro entitlement.
 */
import { Platform } from 'react-native';

export const IOS_LIMITED = Platform.OS === 'ios';
