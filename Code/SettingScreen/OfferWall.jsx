// OfferWall.jsx — Fisch Values Pro
//
// Ported from adoptme-jan7's custom paywall. It replaces RevenueCatUI's hosted
// paywall, which rendered the stock "RevenueCat Paywalls" template: a pink
// placeholder with no branding, no feature copy, and no savings maths. Nothing
// in this repo could change a pixel of it — it was all dashboard-side.
//
// The screen has three jobs, in this order —
//   1. say what Pro unlocks, in one screenful,
//   2. show every plan side by side so nothing is hidden,
//   3. make the best plan's saving impossible to miss.
//
// Every discount here is arithmetic on LIVE store prices — never hardcoded — so
// it stays true in every currency and survives a price change. The store
// currently serves monthly / 3-month / yearly; the maths is written against
// packageType, so adding or dropping a plan needs no edit here.
//
// The surface FOLLOWS THE APP THEME. adoptme pins one dark look on the argument
// that a paywall is a storefront, not a settings page — but this app ships a
// theme switch that users actually set, and a black screen slammed in front of
// a light app reads as a different app, not as a storefront. Both palettes are
// built from the same SEA vocabulary in Design/tokens, so the gold-on-sea
// identity survives in either mode.
//
// Colours stay LOCAL to this file rather than coming from useThemeColors():
// this screen needs storefront-only values (two backdrop glows, a gold gradient,
// tile-selected states) that have no equivalent in the app-wide palette.
import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import {
  View, Text, Modal, TouchableOpacity, Image,
  StyleSheet, StatusBar, Platform, ActivityIndicator,
  Dimensions, Linking, Animated, Easing, ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, {
  Defs, LinearGradient as SvgLinear, RadialGradient as SvgRadial, Stop, Rect, Circle,
} from 'react-native-svg';
import Icon from 'react-native-vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import { useLocalState } from '../LocalGlobelStats';
import { useGlobalState } from '../GlobelStats';
import { useHaptic } from '../Helper/HepticFeedBack';
import { mixpanel } from '../AppHelper/MixPenel';
import { GAME } from '../config/game';
import SystemNavigationBar from 'react-native-system-navigation-bar';

const { width, height } = Dimensions.get('window');
const SMALL = height < 700;

// ── Palette ──
// Two storefronts built from the same SEA scale in Design/tokens.
//
// The logo follows the surface, and the filenames read backwards: the asset
// named "-dark" is the one drawn FOR a dark background (white/blue ink), so it
// belongs to dark mode. Both are transparent PNGs; assets/logo.png is Blox
// Fruits' BFVC mark (fork residue) and assets/logo.webp is this app's mark but
// baked onto an opaque tile — neither belongs on this screen.
const LOGO_ON_DARK = require('../../assets/brand/bootsplash-logo-dark.png');
const LOGO_ON_LIGHT = require('../../assets/brand/bootsplash-logo.png');

// GOLD_TEXT exists because gold-as-a-surface and gold-as-text need different
// values: #F5B13D on near-black is bright and legible, but the same gold as
// TEXT on a white tile is ~1.9:1 and unreadable. Light mode reads amber instead.
const makePalette = (isDark) => (isDark
  ? {
    BG: '#06212B',                            // deep sea floor, near-black teal
    DOCK_BG: 'rgba(4,20,27,0.92)',
    DOCK_LINE: 'rgba(255,255,255,0.08)',
    NAV: '#06212B',
    NAV_STYLE: 'light',
    STATUS_STYLE: 'light-content',

    GLOW_A: '#3AAFC4', GLOW_A_OP: '0.50',     // tokens DARK.primary, the lit shallows
    GLOW_B: '#0E7C94', GLOW_B_OP: '0.34',     // tokens SEA.lagoon

    ACCENT_A: '#3AAFC4',
    ACCENT_B: '#0E7C94',
    GOLD: '#F5B13D',
    GOLD_DEEP: '#E2841F',                     // tokens SEA.amber
    GOLD_TEXT: '#F5B13D',
    ON_GOLD: '#06212B',

    TEXT: '#FFFFFF',
    TEXT_SUB: 'rgba(255,255,255,0.72)',
    TEXT_MUTE: 'rgba(255,255,255,0.46)',

    CARD: 'rgba(255,255,255,0.06)',
    CARD_LINE: 'rgba(255,255,255,0.10)',
    DIVIDER: 'rgba(255,255,255,0.07)',
    RING_BG: 'rgba(255,255,255,0.07)',
    RING_LINE: 'rgba(255,255,255,0.12)',

    CLOSE_BG: 'rgba(255,255,255,0.10)',
    CLOSE_LINE: 'rgba(255,255,255,0.14)',
    CLOSE_ICON: 'rgba(255,255,255,0.85)',
    TIMER: 'rgba(255,255,255,0.7)',

    TILE_BG: 'rgba(255,255,255,0.05)',
    TILE_LINE: 'rgba(255,255,255,0.13)',
    TILE_ON_BG: 'rgba(245,177,61,0.13)',
    SAVINGS_BG: 'rgba(245,177,61,0.14)',
    SAVINGS_LINE: 'rgba(245,177,61,0.30)',

    FOOTER: 'rgba(255,255,255,0.4)',
    FOOTER_DOT: 'rgba(255,255,255,0.22)',
    LOGO: LOGO_ON_DARK,
  }
  : {
    BG: '#F4F9FB',                            // tokens SEA.foam
    DOCK_BG: 'rgba(255,255,255,0.94)',
    DOCK_LINE: '#DCE8EE',                     // tokens SEA.line
    NAV: '#F4F9FB',
    NAV_STYLE: 'dark',
    STATUS_STYLE: 'dark-content',

    GLOW_A: '#0E7C94', GLOW_A_OP: '0.16',     // far softer: a glow that reads on
    GLOW_B: '#E2841F', GLOW_B_OP: '0.10',     // near-black would be a stain here

    ACCENT_A: '#0E7C94',                      // tokens SEA.lagoon
    ACCENT_B: '#0A5E70',                      // tokens SEA.lagoonDeep
    GOLD: '#E2841F',                          // tokens SEA.amber
    GOLD_DEEP: '#C96F12',
    GOLD_TEXT: '#9A6100',                     // tokens LIGHT.warning — readable on foam
    ON_GOLD: '#0B2A36',                       // ink on amber ≈ 6:1, not white ≈ 2.5:1

    TEXT: '#0B2A36',                          // tokens SEA.ink
    TEXT_SUB: '#52707E',                      // tokens SEA.inkSoft
    TEXT_MUTE: '#8AA3AE',                     // tokens SEA.inkMuted

    CARD: '#FFFFFF',
    CARD_LINE: '#DCE8EE',
    DIVIDER: '#E8F1F5',                       // tokens SEA.shallow
    RING_BG: '#FFFFFF',
    RING_LINE: '#DCE8EE',

    CLOSE_BG: 'rgba(11,42,54,0.06)',
    CLOSE_LINE: '#DCE8EE',
    CLOSE_ICON: '#52707E',
    TIMER: '#52707E',

    TILE_BG: '#FFFFFF',
    TILE_LINE: '#DCE8EE',
    TILE_ON_BG: '#FDF0DE',                    // tokens SEA.amberTint
    SAVINGS_BG: '#FDF0DE',
    SAVINGS_LINE: '#F0C489',

    FOOTER: '#8AA3AE',
    FOOTER_DOT: '#B9CBD4',
    LOGO: LOGO_ON_LIGHT,
  });

// Seconds before the × appears. Short on purpose — long enough to read the
// headline, not long enough to feel like a trap. Set to 0 to show it at once.
const CLOSE_TIMER_SECONDS = 2;

// ── What Pro actually unlocks ──
// Every line is a real gate in this codebase, not a marketing claim:
//   noads   → bannerAds.js / openApp.js / NativeAdManager skip Pro accounts,
//             and Trades.jsx stops injecting an ad row every 8 trades
//   feature → Trades.jsx handleMakeFeatureTrade is Pro-only; free users get
//             the "feature_pro_only" alert
//   badge   → assets/pro.png renders beside the name in trades and chat
const PRO_BADGE = require('../../assets/pro.png');
const benefitsFor = (P) => [
  { key: 'noads', icon: 'close-circle', tint: P.ACCENT_A },
  { key: 'feature', icon: 'arrow-up-circle', tint: P.ACCENT_B },
  { key: 'badge', image: PRO_BADGE, tint: P.GOLD },
];

// Longest plan first — the best deal should sit under the thumb, on the left,
// where the eye lands first.
const PLAN_ORDER = { LIFETIME: 0, ANNUAL: 1, SIX_MONTH: 2, THREE_MONTH: 3, TWO_MONTH: 4, MONTHLY: 5, WEEKLY: 6 };
// Months per billing period — the scale every price is compared on.
const MONTHS_IN_PERIOD = { WEEKLY: 0.2301, MONTHLY: 1, TWO_MONTH: 2, THREE_MONTH: 3, SIX_MONTH: 6, ANNUAL: 12 };
const PLAN_KEY = {
  WEEKLY: 'plan_weekly', MONTHLY: 'plan_monthly', TWO_MONTH: 'plan_two_month',
  THREE_MONTH: 'plan_three_month', SIX_MONTH: 'plan_six_month', ANNUAL: 'plan_annual',
  LIFETIME: 'plan_lifetime',
};
const BILLED_KEY = {
  WEEKLY: 'billed_weekly', MONTHLY: 'billed_monthly', TWO_MONTH: 'billed_2months',
  THREE_MONTH: 'billed_3months', SIX_MONTH: 'billed_6months', ANNUAL: 'billed_yearly',
};

// Rebuild a price string at a different amount, keeping the store's currency
// symbol and its position (prefix "$4.99" vs suffix "4,99 €").
//
// The STORE's own symbol wins, and Intl is only the fallback. adoptme has this
// the other way round and gets away with it because Intl renders USD as "$",
// exactly what Play returns. This account bills in PKR, where Play says
// "Rs 550.00" and Intl says "PKR 550.00" — so the Intl-first order printed two
// different currencies on one screen: "Rs 1,650.00" on the tile and
// "PKR 137.50 a month" directly beneath it. One screen, one symbol.
const formatMoney = (pkg, amount) => {
  const priceString = pkg?.product?.priceString || '';
  const symbol = priceString.replace(/[\d\s.,]/g, '').trim();
  // Group the thousands. toFixed(2) alone renders 1590.00, which sat directly
  // under the store's own "Rs 1,650.00" and read as a different style of number.
  // Whole amounts drop the decimals entirely ("Rs 1,590", not "Rs 1,590.00");
  // anything with real pence keeps both places ("Rs 137.50", never "Rs 137.5").
  const whole = Math.abs(amount - Math.round(amount)) < 0.005;
  let value;
  try {
    value = new Intl.NumberFormat(undefined, {
      minimumFractionDigits: whole ? 0 : 2,
      maximumFractionDigits: whole ? 0 : 2,
    }).format(amount);
  } catch (e) {
    value = whole ? String(Math.round(amount)) : amount.toFixed(2);
  }

  if (symbol) {
    const firstDigit = priceString.search(/\d/);
    const symbolIndex = priceString.indexOf(symbol[0]);
    // Suffix currencies ("4,99 €") keep the space; prefix ones ("Rs 550.00")
    // keep whatever spacing the store used between symbol and digits.
    if (firstDigit !== -1 && symbolIndex > firstDigit) return `${value} ${symbol}`;
    const gap = firstDigit > symbolIndex + symbol.length - 1 &&
      /\s/.test(priceString.slice(symbolIndex + symbol.length, firstDigit)) ? ' ' : '';
    return `${symbol}${gap}${value}`;
  }

  const currency = pkg?.product?.currencyCode;
  if (currency) {
    try {
      return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount);
    } catch (e) {
      // Fall through to the bare number below
    }
  }
  return value;
};

// The store's own priceString is authoritative, but Play returns a trailing
// ".00" on every whole price — "Rs 550.00" where the shop itself says "Rs 550".
// Strip a decimal separator followed by exactly two zeros, and only when no
// digit follows, so a grouped "Rs 1,006.00" loses its ".00" and keeps its
// "1,006", and a comma-decimal locale ("1.650,00 €") is trimmed correctly too.
const trimZeroDecimals = (s) => (typeof s === 'string' ? s.replace(/([.,])00(?!\d)/, '') : s);

// ── Background: two soft colour glows over near-black ──
// Drawn once in SVG rather than stacked translucent Views, so it costs a single
// layer on Android instead of a pile of overdrawn rectangles.
const Backdrop = ({ P }) => (
  <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
    <Defs>
      <SvgRadial id="glowTop" cx="50%" cy="50%" r="50%">
        <Stop offset="0" stopColor={P.GLOW_A} stopOpacity={P.GLOW_A_OP} />
        <Stop offset="1" stopColor={P.GLOW_A} stopOpacity="0" />
      </SvgRadial>
      <SvgRadial id="glowBottom" cx="50%" cy="50%" r="50%">
        <Stop offset="0" stopColor={P.GLOW_B} stopOpacity={P.GLOW_B_OP} />
        <Stop offset="1" stopColor={P.GLOW_B} stopOpacity="0" />
      </SvgRadial>
    </Defs>
    <Rect x="0" y="0" width="100%" height="100%" fill={P.BG} />
    <Circle cx={width * 0.5} cy={height * 0.05} r={width * 0.85} fill="url(#glowTop)" />
    <Circle cx={width * 0.1} cy={height * 0.62} r={width * 0.7} fill="url(#glowBottom)" />
  </Svg>
);

const SubscriptionScreen = ({ visible, onClose, track, showoffer, oneWallOnly, inline }) => {
  const insets = useSafeAreaInsets();
  const { packages, purchaseProduct, restorePurchases, localState } = useLocalState();
  const { theme } = useGlobalState();
  const { triggerHapticFeedback } = useHaptic();
  const { t } = useTranslation();

  // Same signal every other screen uses (Setting.jsx, OnBoardingScreen): the
  // global `theme` is already resolved from 'system' against the OS scheme in
  // GlobelStats, so there is nothing to resolve again here.
  const isDark = theme === 'dark';
  const P = useMemo(() => makePalette(isDark), [isDark]);
  const s = useMemo(() => makeStyles(P), [P]);
  const BENEFITS = useMemo(() => benefitsFor(P), [P]);

  const [selectedPkg, setSelectedPkg] = useState(null);
  const [loading, setLoading] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [closeTimer, setCloseTimer] = useState(CLOSE_TIMER_SECONDS);
  const canClose = closeTimer <= 0;

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const riseAnim = useRef(new Animated.Value(28)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const closeFade = useRef(new Animated.Value(0)).current;

  // Subscriptions off for this app → behave as if the wall does not exist, but
  // STILL call onClose or callers that show this wall stay stuck waiting. The
  // gate lives here rather than at the five call sites so re-enabling is one
  // flag in Code/config/game.js.
  const disabled = !GAME.subscriptionsEnabled;

  // ── Pricing: every plan measured against the priciest per-month rate ──
  //
  // The anchor is what the same stretch of time would cost on the most
  // expensive plan (in practice, monthly). Comparing to it produces both the
  // savings percentage and the amount saved.
  const plans = useMemo(() => {
    const list = (packages || []).slice().sort(
      (a, b) => (PLAN_ORDER[a.packageType] ?? 9) - (PLAN_ORDER[b.packageType] ?? 9)
    );
    const monthlyRate = (p) => {
      const months = MONTHS_IN_PERIOD[p.packageType];
      const price = p.product?.price;
      return months && price > 0 ? price / months : null;
    };
    const rates = list.map(monthlyRate).filter(r => r != null);
    const anchorRate = rates.length ? Math.max(...rates) : null;

    return list.map(pkg => {
      const months = MONTHS_IN_PERIOD[pkg.packageType];
      const price = pkg.product?.price;
      const rate = monthlyRate(pkg);
      const anchorTotal = (anchorRate && months) ? anchorRate * months : null;

      // Only claim a saving when it is real and worth saying — anything under
      // 5% reads as a rounding artefact and cheapens the yearly plan's real cut.
      const pct = (anchorTotal && price > 0 && anchorTotal > price)
        ? Math.round((1 - price / anchorTotal) * 100)
        : 0;
      const savings = pct >= 5 ? pct : 0;
      const saved = savings ? anchorTotal - price : 0;

      // "Like 6 months free" — the money saved, in months of the anchor plan.
      // Floored on purpose: better to undersell than to round a claim up in an
      // app store reviewers read closely.
      const freeMonths = (savings && anchorRate) ? Math.floor(saved / anchorRate) : 0;

      return { pkg, rate, savings, saved, freeMonths, anchorTotal };
    });
  }, [packages]);

  // Best value = biggest real saving; ties go to the longest plan (list is sorted).
  const recommended = useMemo(() => {
    if (!plans.length) return null;
    return plans.reduce((best, p) => (p.savings > best.savings ? p : best), plans[0]).pkg;
  }, [plans]);

  const selectedPlan = useMemo(
    () => plans.find(p => p.pkg.identifier === selectedPkg?.identifier) || null,
    [plans, selectedPkg]
  );

  // ── Free trial, if the store ever offers one (none configured today) ──
  const getTrial = (pkg) => {
    const product = pkg?.product;
    const intro = product?.introPrice;
    if (intro && intro.price === 0 && intro.periodNumberOfUnits > 0) {
      return { count: intro.periodNumberOfUnits, unit: String(intro.periodUnit || '').toUpperCase() };
    }
    const freePhase = product?.defaultOption?.freePhase?.billingPeriod;
    if (freePhase && freePhase.value > 0) {
      return { count: freePhase.value, unit: String(freePhase.unit || '').toUpperCase() };
    }
    return null;
  };

  const trialLabel = (trial) => {
    if (!trial) return null;
    const key = { DAY: 'trial_days', WEEK: 'trial_weeks', MONTH: 'trial_months' }[trial.unit];
    return key ? t(`paywall.${key}`, { count: trial.count }) : null;
  };

  const trial = trialLabel(getTrial(selectedPkg));

  // Subscriptions disabled → close immediately and render nothing.
  useEffect(() => {
    if (disabled && visible && typeof onClose === 'function') onClose();
  }, [disabled, visible, onClose]);

  // ── Close button countdown ──
  useEffect(() => {
    if (!visible || disabled) return;
    if (CLOSE_TIMER_SECONDS <= 0) {
      setCloseTimer(0);
      closeFade.setValue(1);
      return;
    }
    setCloseTimer(CLOSE_TIMER_SECONDS);
    closeFade.setValue(0);
    const interval = setInterval(() => {
      setCloseTimer(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          Animated.timing(closeFade, { toValue: 1, duration: 250, useNativeDriver: true }).start();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [visible, disabled, closeFade]);

  // ── Android system nav bar: match the storefront, restore the app on exit ──
  // targetSdk 36 draws edge-to-edge, so the bar sits over our dock; leaving it
  // the app's colour would put a slate strip under a deep-sea screen.
  useEffect(() => {
    if (Platform.OS !== 'android' || disabled || !visible) return;
    SystemNavigationBar.setNavigationColor(P.NAV, P.NAV_STYLE, 'navigation');
    return () => {
      SystemNavigationBar.setNavigationColor(isDark ? '#000000' : '#F4F9FB', isDark ? 'light' : 'dark', 'navigation');
    };
  }, [visible, disabled, isDark, P.NAV, P.NAV_STYLE]);

  // ── Entrance ──
  useEffect(() => {
    if (!visible || disabled) return;
    fadeAnim.setValue(0);
    riseAnim.setValue(28);
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 420, useNativeDriver: true }),
      Animated.timing(riseAnim, { toValue: 0, duration: 520, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, [visible, disabled, fadeAnim, riseAnim]);

  // ── CTA breathing ──
  useEffect(() => {
    if (disabled) return;
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.025, duration: 1100, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1100, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [pulseAnim, disabled]);

  // Preselect the best-value plan
  useEffect(() => {
    if (visible && recommended && !selectedPkg) setSelectedPkg(recommended);
  }, [visible, recommended, selectedPkg]);

  // Reset on close
  useEffect(() => {
    if (!visible) {
      setSelectedPkg(null);
      setLoading(false);
    }
  }, [visible]);

  useEffect(() => {
    if (visible && !disabled) mixpanel.track('custom_paywall_presented', { source: track || 'unknown' });
  }, [visible, track, disabled]);

  const handleSelect = useCallback((pkg) => {
    triggerHapticFeedback('impactLight');
    setSelectedPkg(pkg);
    mixpanel.track('custom_paywall_plan_select', {
      source: track || 'unknown',
      package: pkg.identifier,
    });
  }, [triggerHapticFeedback, track]);

  const handlePurchase = useCallback(async () => {
    if (!selectedPkg || loading) return;
    triggerHapticFeedback('impactMedium');
    mixpanel.track('custom_paywall_purchase_tap', {
      source: track || 'unknown',
      package: selectedPkg.identifier,
      price: selectedPkg.product?.price,
    });
    await purchaseProduct(selectedPkg, setLoading, track);
    setTimeout(() => {
      if (localState?.isPro) {
        mixpanel.track('custom_paywall_purchase_success', {
          source: track || 'unknown',
          package: selectedPkg.identifier,
        });
        onClose?.();
      }
    }, 500);
  }, [selectedPkg, loading, purchaseProduct, track, localState?.isPro, onClose, triggerHapticFeedback]);

  const handleRestore = useCallback(async () => {
    if (restoring) return;
    await restorePurchases(setRestoring);
    setTimeout(() => {
      if (localState?.isPro) onClose?.();
    }, 500);
  }, [restoring, restorePurchases, localState?.isPro, onClose]);

  // ── The button never repeats the price. ──
  // The selected tile already shows it in gold, and the line under the button
  // states exactly what gets charged — a third copy on the button itself only
  // gives the eye one more number to stop and re-check before tapping.
  const ctaLabel = trial ? t('paywall.cta_trial') : t('paywall.cta');

  // ── And the line under it says exactly what is charged, and when. ──
  const ctaSubtitle = (() => {
    if (!selectedPkg) return null;
    const price = trimZeroDecimals(selectedPkg.product?.priceString);
    if (!price) return null;
    if (selectedPkg.packageType === 'LIFETIME') return t('paywall.cta_sub_lifetime', { price });
    const billedKey = BILLED_KEY[selectedPkg.packageType];
    const billed = billedKey ? t(`paywall.${billedKey}`) : '';
    if (trial) return t('paywall.cta_sub_trial', { trial, price, billed });
    return t('paywall.cta_sub', { price, billed });
  })();

  // Both are null until the site exists (Code/config/game.js). Linking.openURL
  // on a null throws, and a dead "Terms" link is worse than no link — so each
  // renders only when there is somewhere to go.
  const legalLinks = [
    GAME.termsUrl ? { key: 'terms', url: GAME.termsUrl } : null,
    GAME.privacyPolicyUrl ? { key: 'privacy', url: GAME.privacyPolicyUrl } : null,
  ].filter(Boolean);

  if (disabled) return null;

  const content = (
    <View style={s.container}>
      <StatusBar barStyle={P.STATUS_STYLE} backgroundColor={P.BG} translucent={false} />
      <Backdrop P={P} />

      {/* ══ TOP: what you get ══ */}
      <ScrollView
        style={s.scroll}
        contentContainerStyle={[s.scrollContent, { paddingTop: insets.top + 14 }]}
        showsVerticalScrollIndicator={false}
        bounces
      >
        <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: riseAnim }] }}>
          {/* ── Hero ── */}
          <View style={s.hero}>
            {/* assets/logo.png is Blox Fruits' BFVC mark — fork residue, not this
                app's. The bootsplash DARK variant is the right asset here: it is
                the only logo drawn for a dark surface (white/blue ink) and the
                only one with a transparent background, so it sits in the glass
                ring instead of pasting a square tile into a circle. */}
            <View style={s.logoRing}>
              <Image
                source={P.LOGO}
                style={s.logo}
                resizeMode="contain"
              />
            </View>

            <Text style={s.title}>{t('paywall.title')}</Text>
            <Text style={s.subtitle}>{t('paywall.subtitle')}</Text>
          </View>

          {/* ── One glass card, three promises, no scrolling to find them ── */}
          <View style={s.card}>
            {BENEFITS.map((b, i) => (
              <View key={b.key} style={[s.benefit, i > 0 && s.benefitDivider]}>
                <View style={[s.benefitIcon, { backgroundColor: b.tint + '26' }]}>
                  {b.image
                    ? <Image source={b.image} style={s.benefitBadge} resizeMode="contain" />
                    : <Icon name={b.icon} size={19} color={b.tint} />}
                </View>
                <View style={s.benefitText}>
                  <Text style={s.benefitTitle}>{t(`paywall.${b.key}_title`)}</Text>
                  <Text style={s.benefitDesc}>{t(`paywall.${b.key}_desc`)}</Text>
                </View>
              </View>
            ))}

            <View style={s.extrasRow}>
              <Icon name="add-circle" size={13} color={P.TEXT_MUTE} />
              <Text style={s.extras} numberOfLines={2}>
                {[
                  t('paywall.extra_translate'), t('paywall.extra_noadrows'),
                  t('paywall.extra_support'),
                ].join(' · ')}
              </Text>
            </View>
          </View>
        </Animated.View>
      </ScrollView>

      {/* ── Close / countdown — pinned, never scrolls away ── */}
      <View style={[s.closeWrap, { top: insets.top + 10 }]} pointerEvents="box-none">
        {canClose ? (
          <Animated.View style={{ opacity: closeFade }}>
            <TouchableOpacity
              onPress={onClose}
              style={s.closeBtn}
              hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
            >
              <Icon name="close" size={19} color={P.CLOSE_ICON} />
            </TouchableOpacity>
          </Animated.View>
        ) : (
          <View style={s.closeBtn}>
            <Text style={s.timerText}>{closeTimer}</Text>
          </View>
        )}
      </View>

      {/* ══ BOTTOM: the offers, side by side, then one button ══ */}
      <View style={[s.dock, { paddingBottom: DOCK_PAD + insets.bottom }]}>
        {plans.length > 0 ? (
          <>
            <View style={s.tiles}>
              {plans.map(({ pkg, rate, savings }, i) => {
                const isSelected = selectedPkg?.identifier === pkg.identifier;
                const isBest = recommended?.identifier === pkg.identifier;
                const planKey = PLAN_KEY[pkg.packageType];
                const showPerMonth = rate != null
                  && pkg.packageType !== 'MONTHLY'
                  && pkg.packageType !== 'LIFETIME';
                return (
                  <TouchableOpacity
                    key={pkg.identifier || i}
                    onPress={() => handleSelect(pkg)}
                    activeOpacity={0.9}
                    style={[s.tile, isSelected && s.tileOn]}
                  >
                    {savings > 0 && (
                      <View style={[s.saveTag, isSelected && s.saveTagOn]}>
                        <Text style={[s.saveTagText, isSelected && s.saveTagTextOn]}>
                          {t('paywall.save', { percent: savings })}
                        </Text>
                      </View>
                    )}

                    {isBest && <Text style={s.bestLabel}>{t('paywall.best_deal')}</Text>}

                    <Text style={[s.tilePlan, isSelected && s.tilePlanOn]} numberOfLines={1}>
                      {planKey ? t(`paywall.${planKey}`) : (pkg.identifier || t('paywall.plan_default'))}
                    </Text>

                    <Text
                      style={[s.tilePrice, isSelected && s.tilePriceOn]}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.6}
                    >
                      {trimZeroDecimals(pkg.product?.priceString) || '—'}
                    </Text>

                    {/* Reserved line so all tiles stay the same height */}
                    <Text
                      style={[s.tilePerMonth, isSelected && s.tilePerMonthOn]}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.7}
                    >
                      {showPerMonth ? t('paywall.per_month', { price: formatMoney(pkg, rate) }) : ' '}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* The saving, said the way someone repeats it out loud */}
            {!!selectedPlan && selectedPlan.savings > 0 && (
              <View style={s.savingsBar}>
                <Text style={s.savingsText} numberOfLines={1}>
                  {t('paywall.you_save', {
                    amount: formatMoney(selectedPlan.pkg, selectedPlan.saved),
                  })}
                  {selectedPlan.freeMonths >= 1
                    ? '  ·  ' + t('paywall.free_months', { count: selectedPlan.freeMonths })
                    : ''}
                </Text>
              </View>
            )}
          </>
        ) : (
          <View style={s.loadingWrap}>
            <ActivityIndicator size="small" color={P.GOLD} />
            <Text style={s.loadingText}>{t('paywall.loading')}</Text>
          </View>
        )}

        <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
          <TouchableOpacity
            style={[s.cta, (loading || !selectedPkg) && s.ctaOff]}
            onPress={handlePurchase}
            disabled={loading || !selectedPkg}
            activeOpacity={0.9}
          >
            <Svg style={StyleSheet.absoluteFill}>
              <Defs>
                <SvgLinear id="ctaGrad" x1="0" y1="0" x2="1" y2="1">
                  <Stop offset="0" stopColor={P.GOLD} />
                  <Stop offset="1" stopColor={P.GOLD_DEEP} />
                </SvgLinear>
              </Defs>
              <Rect x="0" y="0" width="100%" height="100%" fill="url(#ctaGrad)" />
            </Svg>
            {loading ? (
              <ActivityIndicator size="small" color={P.ON_GOLD} />
            ) : (
              <View style={s.ctaInner}>
                <Text style={s.ctaText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
                  {ctaLabel}
                </Text>
                <Icon name="arrow-forward" size={19} color={P.ON_GOLD} style={s.ctaArrow} />
              </View>
            )}
          </TouchableOpacity>
        </Animated.View>

        {!!ctaSubtitle && <Text style={s.ctaSub} numberOfLines={2}>{ctaSubtitle}</Text>}

        <View style={s.footer}>
          <TouchableOpacity onPress={handleRestore} disabled={restoring} hitSlop={FOOTER_SLOP}>
            {restoring
              ? <ActivityIndicator size="small" color={P.GOLD} />
              : <Text style={s.footerLink}>{t('paywall.restore')}</Text>}
          </TouchableOpacity>
          {legalLinks.map(({ key, url }) => (
            <React.Fragment key={key}>
              <Text style={s.footerDot}>·</Text>
              <TouchableOpacity onPress={() => Linking.openURL(url)} hitSlop={FOOTER_SLOP}>
                <Text style={s.footerLink}>{t(`paywall.${key}`)}</Text>
              </TouchableOpacity>
            </React.Fragment>
          ))}
        </View>
      </View>
    </View>
  );

  if (inline) return content;

  return (
    <Modal visible={visible} animationType="fade" presentationStyle="fullScreen" onRequestClose={canClose ? onClose : undefined}>
      {content}
    </Modal>
  );
};

// ── Styles ──
// insets.bottom is what actually clears the Android 3-button nav bar (~48dp);
// a fixed constant alone leaves the buy button half-covered there.
const DOCK_PAD = 10;
const FOOTER_SLOP = { top: 10, bottom: 10, left: 8, right: 8 };

// Rebuilt whenever the theme flips; memoised by the component.
const makeStyles = (P) => StyleSheet.create({
  container: { flex: 1, backgroundColor: P.BG },

  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 10 },

  // ── Hero ──
  hero: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingBottom: SMALL ? 10 : 14,
  },
  logoRing: {
    width: SMALL ? 96 : 112,
    height: SMALL ? 96 : 112,
    borderRadius: 999,
    backgroundColor: P.RING_BG,
    borderWidth: 1,
    borderColor: P.RING_LINE,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  logo: {
    // No borderRadius: the asset is transparent, so there is no tile to round
    // off — a corner radius here would only clip the hook's ends.
    width: SMALL ? 74 : 88,
    height: SMALL ? 74 : 88,
  },
  title: {
    color: P.TEXT,
    fontSize: SMALL ? 31 : 36,
    fontWeight: '900',
    letterSpacing: -1.1,
    marginTop: 10,
    textAlign: 'center',
  },
  subtitle: {
    color: P.TEXT_SUB,
    fontSize: 13.5,
    fontWeight: '600',
    lineHeight: 18,
    marginTop: 6,
    textAlign: 'center',
  },

  // ── Benefits card ──
  card: {
    marginHorizontal: 18,
    backgroundColor: P.CARD,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: P.CARD_LINE,
    paddingHorizontal: 14,
    paddingVertical: 4,
  },
  benefit: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  benefitDivider: {
    borderTopWidth: 1,
    borderTopColor: P.DIVIDER,
  },
  benefitIcon: {
    width: 38,
    height: 38,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 13,
  },
  benefitBadge: { width: 23, height: 23 },
  benefitText: { flex: 1 },
  benefitTitle: {
    color: P.TEXT,
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  benefitDesc: {
    color: P.TEXT_SUB,
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16,
    marginTop: 2,
  },
  extrasRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderTopWidth: 1,
    borderTopColor: P.DIVIDER,
    paddingVertical: 9,
  },
  extras: {
    flex: 1,
    color: P.TEXT_MUTE,
    fontSize: 11.5,
    fontWeight: '600',
    lineHeight: 16,
  },

  // ── Close ──
  closeWrap: {
    position: 'absolute',
    right: 16,
    zIndex: 10,
    elevation: 10, // Android: keep the tap target above the ScrollView
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: P.CLOSE_BG,
    borderWidth: 1,
    borderColor: P.CLOSE_LINE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timerText: {
    color: P.TIMER,
    fontSize: 13,
    fontWeight: '800',
  },

  // ══ Dock ══
  dock: {
    paddingHorizontal: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: P.DOCK_LINE,
    backgroundColor: P.DOCK_BG,
  },

  // ── Offers, side by side ──
  tiles: {
    flexDirection: 'row',
    gap: 9,
    marginTop: 7, // headroom for the SAVE tag sitting on the border
  },
  tile: {
    flex: 1,
    minWidth: 0,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: P.TILE_LINE,
    backgroundColor: P.TILE_BG,
    paddingTop: 13,
    paddingBottom: 11,
    paddingHorizontal: 6,
    alignItems: 'center',
  },
  tileOn: {
    borderColor: P.GOLD,
    backgroundColor: P.TILE_ON_BG,
    shadowColor: P.GOLD,
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  saveTag: {
    position: 'absolute',
    top: -9,
    alignSelf: 'center',
    backgroundColor: P.ACCENT_B,
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: 999,
  },
  saveTagOn: {
    backgroundColor: P.GOLD,
  },
  saveTagText: {
    color: '#fff',
    fontSize: 9.5,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  saveTagTextOn: {
    color: P.ON_GOLD,
  },
  bestLabel: {
    color: P.GOLD_TEXT,
    fontSize: 8.5,
    fontWeight: '900',
    letterSpacing: 0.7,
    marginBottom: 2,
  },
  tilePlan: {
    color: P.TEXT_SUB,
    fontSize: 11.5,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  tilePlanOn: { color: P.TEXT },
  tilePrice: {
    color: P.TEXT,
    fontSize: 21,
    fontWeight: '900',
    letterSpacing: -0.7,
    marginTop: 3,
  },
  tilePriceOn: { color: P.GOLD_TEXT },
  tilePerMonth: {
    color: P.TEXT_MUTE,
    fontSize: 10.5,
    fontWeight: '700',
    marginTop: 2,
  },
  tilePerMonthOn: { color: P.TEXT_SUB },

  // ── Savings line ──
  savingsBar: {
    marginTop: 9,
    alignSelf: 'center',
    backgroundColor: P.SAVINGS_BG,
    borderWidth: 1,
    borderColor: P.SAVINGS_LINE,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 5,
    maxWidth: '100%',
  },
  savingsText: {
    color: P.GOLD_TEXT,
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'center',
  },

  // ── Loading ──
  loadingWrap: { alignItems: 'center', paddingVertical: 26 },
  loadingText: { color: P.TEXT_MUTE, fontSize: 12, fontWeight: '600', marginTop: 8 },

  // ── CTA ──
  cta: {
    height: 58,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginTop: 11,
    shadowColor: P.GOLD_DEEP,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 14,
    elevation: 9,
  },
  ctaOff: { opacity: 0.55 },
  ctaInner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
  },
  ctaText: {
    color: P.ON_GOLD,
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: -0.2,
    flexShrink: 1,
  },
  ctaArrow: { marginLeft: 8 },
  ctaSub: {
    color: P.TEXT_MUTE,
    fontSize: 11.5,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 9,
  },

  // ── Footer ──
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 9,
    gap: 8,
    flexWrap: 'wrap',
  },
  footerLink: {
    color: P.FOOTER,
    fontSize: 11,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  footerDot: { color: P.FOOTER_DOT, fontSize: 11 },
});

export default SubscriptionScreen;
