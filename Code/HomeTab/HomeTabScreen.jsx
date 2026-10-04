import { formatMarketValue, resolveItem, canTrade, sourceLabel, summarizeItems as summarizeMarketItems } from '../Helper/valueSources';
import { quantityOf } from '../Helper/feedContract';
/**
 * HomeTabScreen — home: cosmetics, status feed, XP + portfolio
 *
 * The mini-games grid was removed with the move to Fisch. The games were
 * themed to other titles (Whack the Murderer, Find the Killer) or generic
 * filler, and served none of the measured demand. Egg hatching stays, because
 * it is the cosmetics unlock, not a game.
 */
import React, { useMemo, useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Platform, Share, StatusBar, Modal, TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import HomeIcon from './HomeIcons';
import FontAwesome from 'react-native-vector-icons/FontAwesome6';
import { useGlobalState } from '../GlobelStats';
import { useLocalState } from '../LocalGlobelStats';
import { doc, getDoc } from '@react-native-firebase/firestore';
import { useTranslation } from 'react-i18next';
import config from '../Helper/Environment';
import { useThemeColors } from '../Helper/themeColors';
import {
  buildItemPool, unwrapFeed, priceOf, isSummable, DEFAULT_VALUE_SOURCE,
} from '../Helper/valueSources';
import { setAppLanguage } from '../../i18n';
import { useLanguage } from '../Translation/LanguageProvider';
import { useNavigation, useFocusEffect, useIsFocused } from '@react-navigation/native';
import BannerAdComponent from '../Ads/bannerAds';


import DailyStarRewards from '../Engagement/DailyStarRewards';
import SignInDrawer from '../Firebase/SigninDrawer';
import CodesDrawer from '../ValuesScreen/Code';

import StatusFeed from '../Design/StatusFeed';
import FramedAvatar from '../ChatScreen/GroupChat/FramedAvatar';
import { getMyCosmetics, syncMyCosmetics } from '../Helper/cosmeticsCache';
import { GAME } from '../config/game';
import { useNextEvent, countdown } from '../Helper/useNextEvent';
import EventBell from '../Timers/EventBell';
import { STATUS, LIGHT } from '../Design/tokens';
import { SIZE } from '../Design/tokens';
import { SPACE } from '../Design/tokens';
import { accentFor } from '../Design/tokens';
import { FONT } from '../Design/tokens';
import { IOS_LIMITED } from '../config/iosLimited';
import AppOpenAdManager from '../Ads/openApp';

const LANGUAGES = [
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'es', name: 'Español', flag: '🇪🇸' },
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
  { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
  { code: 'ar', name: 'العربية', flag: '🇸🇦' },
];


// ── Home header band ───────────────────────────────────────────────────────
// Deep lagoon in BOTH themes rather than following the page: the point of the
// band is to stop being the same colour as the content under it. Both tones are
// dark enough to carry white text, so the header reads identically light or
// dark and the status bar icons never have to change with the theme.
const HEADER_BG = LIGHT.primaryPressed;              // #0E7C94 — the app's primary sea
const HEADER_BG_PRESSED = LIGHT.primaryPressed; // #0A5E70 — deeper, for the band edge
const HEADER_TEXT = '#FFFFFF';
const HEADER_TEXT_DIM = 'rgba(255,255,255,0.78)';
const HEADER_BTN_BG = 'rgba(255,255,255,0.16)';

const fmt = formatMarketValue;


const HomeTabScreen = ({ selectedTheme }) => {
  const { theme, user, appdatabase, firestoreDB, isAdmin, canGrantJmd } = useGlobalState();
  // Same gate MainTabs uses for the moderation trophy. That one lives on the
  // Calculator tab's headerRight, which is the ONLY header in the tab navigator
  // (Home / Trade / Designs / Chat all set headerShown: false), so staff who
  // stay on Home never saw an entry point to the dashboard.
  const canOpenModeration = isAdmin || !!user?.isModerator || !!user?.isBabyMod || !!canGrantJmd;
  const { localState } = useLocalState();
  const { t, i18n } = useTranslation();
  const { changeLanguage: setLang } = useLanguage();
  const nav = useNavigation();
  const dark = theme === 'dark';
  const insets = useSafeAreaInsets();
  // Only while Home is on screen: bottom-tab screens stay mounted, so an
  // unconditional <StatusBar> here would keep forcing light icons on the other
  // tabs too. Unmounting it pops RN's status-bar stack back to App.js's entry.
  const isFocused = useIsFocused();


  const [showDailyStars, setShowDailyStars] = useState(false);
  const [showCodes, setShowCodes] = useState(false);
  const [homeQuery, setHomeQuery] = useState('');

  const [showLangPicker, setShowLangPicker] = useState(false);
  const [showOfferWall, setShowOfferWall] = useState(false);

  const curLang = LANGUAGES.find(l => l.code === i18n.language) || LANGUAGES[0];

  const handleLangSelect = (code) => {
    // All languages are free
    setLang(code); 
    setAppLanguage(code); 
    setShowLangPicker(false);
  };


  const [signinVis, setSigninVis] = useState(false);
  const [signinMsg, setSigninMsg] = useState('');
  const [owned, setOwned] = useState([]);
  // Equipped cosmetics — seeded from MMKV so the frame paints on first render
  const [myCosmetics, setMyCosmetics] = useState(() => getMyCosmetics());

  // Codes for the drawer below. They come from localState, which every screen
  // can read, so the Codes chip no longer has to bounce through the Values tab
  // just to reach a drawer — it opens one right here. Same parse the Values
  // screen uses: the feed stores them as an object (or a JSON string of one).
  const codesData = useMemo(() => {
    if (!localState.codes) return [];
    try {
      const parsed = typeof localState.codes === 'string'
        ? JSON.parse(localState.codes)
        : localState.codes;
      return typeof parsed === 'object' && parsed !== null ? Object.values(parsed) : [];
    } catch (error) {
      console.error('❌ Error parsing codes:', error);
      return [];
    }
  }, [localState.codes]);

  const guard = (fn, msg) => {
    if (!user?.id) { setSigninMsg(msg || 'Sign in first'); setSigninVis(true); return; }
    fn();
  };

  // Status bar icons are handled by the focus-scoped <StatusBar> in the tree
  // below, NOT imperatively: App.js keeps a <StatusBar> mounted for the whole
  // app, and its props win over StatusBar.setBarStyle() every time it
  // re-renders — so an imperative call here was silently reverted to
  // dark-content, leaving near-black icons on the teal band.
  //
  // RN 0.87 removed StatusBar.setBackgroundColor (and setTranslucent) in the
  // edge-to-edge migration. The band's own backgroundColor plus insets.top
  // padding is what colours the status bar area now, which works precisely
  // because edge-to-edge lets the app draw up there (AppTheme sets no
  // android:statusBarColor).



  // Re-read the equipped frame from MMKV whenever this screen regains focus, so
  // something just equipped in My Cosmetics shows without a remount. Sync read,
  // no DB cost. The DB sync below reconciles it when signed in.
  useFocusEffect(useCallback(() => {
    setMyCosmetics(getMyCosmetics());
    if (user?.id && appdatabase) {
      syncMyCosmetics(appdatabase, user.id).then(c => c && setMyCosmetics(c)).catch(() => {});
    }
  }, [user?.id, appdatabase]));

  useFocusEffect(useCallback(() => {
    if (!user?.id || !firestoreDB) return;
    (async () => {
      try {
        const s = await getDoc(doc(firestoreDB, 'reviews', user.id));
        if (s.exists()) setOwned(Array.isArray(s.data()?.ownedPets) ? s.data().ownedPets : []);
      } catch {}
    })();
  }, [user?.id, firestoreDB]));




  const greet = useMemo(() => {
    const h = new Date().getHours();
    return h < 12 ? t('home.good_morning') : h < 17 ? t('home.good_afternoon') : t('home.good_evening');
  }, [t]);

  // Which catalogue prices this screen. See Code/Helper/valueSources.js.
  const valueSource = localState?.valueSource || DEFAULT_VALUE_SOURCE;

  const parsedData = useMemo(() => {
    const parse = (raw) => {
      try {
        if (!raw) return null;
        const p = typeof raw === 'string' ? JSON.parse(raw) : raw;
        return p && typeof p === 'object' ? unwrapFeed(p) : null;
      } catch { return null; }
    };
    // One deduped pool from both catalogues, same as the calculator.
    // See Code/Helper/valueSources.js.
    return buildItemPool(parse(localState?.data), parse(localState?.suprime));
  }, [localState?.data, localState?.suprime]);

  // Priced from the catalogue the user selected, and only from values that can
  // honestly be summed — a bundle-tier rank is not currency, and Supreme does
  // not price leaderboard awards at all. An item the pool does not know falls
  // back to whatever value was stored with it, which is what this always did.
  // See Code/Helper/valueSources.js.
  const lookupVal = useCallback((item) => {
    if (!item?.name) return 0;
    const resolved = resolveItem(parsedData, item);
    if (!resolved) return null;
    const priced = priceOf(resolved, valueSource);
    return priced.missing || priced.stale ? null : priced.value * quantityOf(resolved);
  }, [parsedData, valueSource]);

  const portfolio = useMemo(() => owned.reduce((s, p) => s + lookupVal(p), 0), [owned, lookupVal]);


  const C = useThemeColors();

  // Shared with TimerScreen, so Home and Timers can never disagree about when
  // the Black Market opens. Ticks once a minute here — this strip shows hours
  // and days, so a per-second re-render of the whole Home tree buys nothing.
  const { event: nextEvent, now: eventNow } = useNextEvent(60000);

  return (
    <View style={[$.root, { backgroundColor: C.bg }]}>

      {/* iOS limited build: no custom band, so no language picker either —
          Home gets the plain native stack header (title only, set in App.js)
          and the app stays in English (i18n.js default). See Code/config/iosLimited.js. */}
      {!IOS_LIMITED && (<>
      {/* ── Header band ──
          Its own surface, deliberately NOT the page background. It used to be
          painted in C.bg inside the ScrollView, so it read as the first row of
          content rather than a heading and dissolved into the cards below it.
          Now it is a fixed deep-lagoon band that carries the status bar with
          it: the inset padding lives here, so the colour runs to the very top
          of the screen instead of leaving a strip of page background above. */}
      <View style={[$.headerBand, { backgroundColor: HEADER_BG, paddingTop: insets.top }]}>
        {isFocused && <StatusBar barStyle="light-content" />}
        <View pointerEvents="none" style={$.headerBubble} />
        <View style={$.header}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[$.sub11, { color: HEADER_TEXT_DIM }]}>{greet}</Text>
            <Text style={[$.h1, { color: HEADER_TEXT }]} numberOfLines={1}>
              {user?.displayName || t('home.trader')}
            </Text>
          </View>
          {canOpenModeration && (
            <TouchableOpacity
              onPress={() => nav.navigate('Admin')}
              style={[$.iconBtn, { backgroundColor: HEADER_BTN_BG, marginRight: 0 }]}
              activeOpacity={0.8}
              accessibilityLabel="Open moderation dashboard"
            >
              <FontAwesome name="shield-halved" size={22} color={HEADER_TEXT} />
            </TouchableOpacity>
          )}
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Change language" onPress={() => setShowLangPicker(true)} style={[$.iconBtn, { backgroundColor: HEADER_BTN_BG }]}>
            <Text style={{ fontSize: 26 }}>{curLang.flag}</Text>
          </TouchableOpacity>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Open profile and settings" style={$.profileTouch} onPress={() => nav.navigate('Setting')} activeOpacity={0.8}>
            <FramedAvatar
              avatarUri={user?.avatar || GAME.defaultAvatar}
              frame={myCosmetics?.profileFrame || null}
              isDarkMode={dark}
              avatarSize={46}
              forceDetail
            />
          </TouchableOpacity>

        </View>
      </View>
      </>)}

      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 100 }} bounces>
        <View style={$.introRow}>
          <View style={{ flex: 1 }}>
            <Text style={[$.sectionTitle, { color: C.text }]}>{t("home.explore_title", { defaultValue: "Your Fisch adventure" })}</Text>
            <Text style={[$.introSub, { color: C.textSecondary }]}>{t("home.explore_sub", { defaultValue: "Find favorites. Explore values." })}</Text>
          </View>
          <View style={[$.introIcon, { backgroundColor: accentFor("lagoon", dark).tint }]}><HomeIcon name="fish" size={30} color={C.primary} /></View>
        </View>


        {/* ── Search: the app's primary job, previously absent from Home ──
            A values app exists to answer "what is this worth". Until now the
            first screen offered no way to ask, and you had to know to tap
            Values first. The query rides through as a route param so this
            lands on results, not on an empty list. */}
        <View style={[$.searchBar, { backgroundColor: C.card, borderColor: C.border }]}>
          <FontAwesome name="magnifying-glass" size={18} color={C.primary} />
          <TextInput
            style={[$.searchInput, { color: C.text }]}
            value={homeQuery}
            onChangeText={setHomeQuery}
            /* A distinct key on purpose: `home.search_placeholder` already exists
               across the translation files as a generic "Search...", and a
               defaultValue only applies when the key is MISSING — so reusing it
               silently threw this copy away. */
            placeholder={t('home.search_values', { defaultValue: 'Find a fish, rod or item…' })}
            placeholderTextColor={C.textSecondary}
            returnKeyType="search"
            onSubmitEditing={() => {
              const q = homeQuery.trim();
              if (!q) return;
              // Hand the query to Values rather than just opening it, so the
              // user lands on results instead of an empty list they retype into.
              nav.navigate('Values', { q });
              setHomeQuery('');
            }}
          />
          {homeQuery.length > 0 && (
            <TouchableOpacity onPress={() => setHomeQuery('')} hitSlop={8}>
              <FontAwesome name="circle-xmark" size={14} color={C.textSecondary} solid />
            </TouchableOpacity>
          )}
        </View>

        {/* ── Live / next event strip ──
            The most time-sensitive fact in the game. Black Market being open
            right now is what players actually search for, and the schedule is
            already in the feed — surfacing it here costs one hook. Renders
            nothing at all until the feed has a schedule. */}
        {nextEvent && (
          <TouchableOpacity
            style={[
              $.eventStrip,
              nextEvent.live
                ? { backgroundColor: STATUS.success, borderColor: STATUS.success }
                : { backgroundColor: accentFor('amber', dark).tint, borderColor: accentFor('amber', dark).tint },
            ]}
            onPress={() => nav.navigate('Timers')}
            activeOpacity={0.8}
          >
            <View style={[$.eventDot, { backgroundColor: nextEvent.live ? '#FFFFFF' : accentFor('amber', dark).color }]} />
            <Text
              style={[$.eventLabel, { color: nextEvent.live ? '#FFFFFF' : accentFor('amber', dark).color }]}
              numberOfLines={1}
            >
              {nextEvent.live
                ? `${nextEvent.label} is live`
                : `${nextEvent.label} in ${countdown(nextEvent.start - eventNow)}`}
            </Text>
            <Text style={[$.eventMeta, { color: nextEvent.live ? '#FFFFFF' : accentFor('amber', dark).color }]}>
              {nextEvent.live ? `${countdown(nextEvent.end - eventNow)} left` : t('home.timers', { defaultValue: 'Timers' })}
            </Text>
            <EventBell
              eventKey={nextEvent.key}
              label={nextEvent.label}
              size={16}
              color={nextEvent.live ? '#FFFFFF' : accentFor('amber', dark).color}
            />
            <FontAwesome name="chevron-right" size={11} color={nextEvent.live ? '#FFFFFF' : accentFor('amber', dark).color} />
          </TouchableOpacity>
        )}

        {/* ── Tools: what the app is for ──
            A 2x2 grid, every tile visible at once. These four were previously
            buried in a nine-item horizontal scroller where only three and a
            half tiles fit on screen — so Rods, which is ~32% of all Fisch
            search demand, sat past the fold and was effectively undiscoverable.
            A grid also lets the row carry a subtitle, which a pill cannot. */}
        <Text style={[$.sectionTitle, $.sectionSpacing, { color: C.text }]}>{t("home.explore_tools", { defaultValue: "Explore & discover" })}</Text>
        <View style={$.toolGrid}>
          {[
            // iOS limited build only: the trade calculator is a TAB on Android
            // (MainTabs.js) and needs no card there. With the tab bar hidden it
            // becomes the headline card here — full width, first — and opens
            // the stack route App.js registers under the same gate.
            ...(IOS_LIMITED ? [{
              icon: 'calculator', accent: 'amber', wide: true,
              label: t('tabs.calculator'),
              sub: t('home.calculator_sub', { defaultValue: 'Check a trade: win, fair or loss' }),
              onPress: () => nav.navigate('Calculator'),
            }] : []),
            // One hue per tool. Colour is doing work here, not decoration: the
            // grid becomes scannable by colour before it is read, so a
            // returning user reaches for position + colour instead of
            // re-reading four labels.
            { icon: 'values', accent: 'lagoon', label: t('home.values'), sub: t('home.market_quotes_sub', { defaultValue: 'See trading prices' }), onPress: () => nav.navigate('Values') },
            { icon: 'rod', accent: 'coral', label: t('home.rods', { defaultValue: 'Rods' }), sub: t('home.rod_guide_sub', { defaultValue: 'Find your next rod' }), onPress: () => nav.navigate('Rods') },
            { icon: 'fish', accent: 'kelp', label: t('home.fish_value', { defaultValue: 'Fish Value' }), sub: t('home.npc_sale_sub', { defaultValue: 'Estimate NPC sale · C$' }), onPress: () => nav.navigate('FishValue') },
            { icon: 'timer', accent: 'violet', label: t('home.timers', { defaultValue: 'Timers' }), sub: t('home.timers_sub', { defaultValue: 'See what’s happening' }), onPress: () => nav.navigate('Timers') },
          ].map((tool) => {
            const a = accentFor(tool.accent, dark);
            return (
              <TouchableOpacity
                key={tool.label}
                accessibilityRole="button"
                accessibilityLabel={tool.label + '. ' + tool.sub}
                style={[$.toolCard, tool.wide && $.toolCardWide, { backgroundColor: a.tint, borderColor: a.tint }]}
                onPress={tool.onPress}
                activeOpacity={0.8}
              >
                <View style={$.toolTopRow}>
                <View style={[$.toolIcon, { backgroundColor: dark ? '#FFFFFF0D' : '#FFFFFFB3' }]}>
                  <HomeIcon name={tool.icon} size={32} color={a.color} />
                </View>
                <FontAwesome name="arrow-up-right-from-square" size={12} color={a.color} />
                </View>
                <Text style={[$.toolLabel, { color: C.text }]} numberOfLines={1}>{tool.label}</Text>
                <Text style={[$.toolSub, { color: a.color }]} numberOfLines={1}>{tool.sub}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ── My Stuff Worth ──
            Personal, but secondary to lookup: it reads 0 until you have added
            items, so it must not be the first thing a new user meets.
            Not in the iOS limited build: it is sign-in gated. */}
        {!IOS_LIMITED && (
        <TouchableOpacity
          onPress={() => guard(() => nav.navigate('MyStuff'), 'Sign in')}
          activeOpacity={0.8}
          style={[$.myStuffCard, { backgroundColor: accentFor('kelp', dark).tint, borderColor: accentFor('kelp', dark).tint }]}
        >
          <View style={$.myStuffCardInner}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.md, flexShrink: 1 }}>
              <HomeIcon name="inventory" size={23} color={accentFor('kelp', dark).color} solid />
              <Text style={[$.b14, { color: C.text, flexShrink: 1 }]}>{t('home.my_stuff_worth')}</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.md }}>
              <View style={[$.worthPill, { backgroundColor: accentFor('kelp', dark).color }]}>
                <HomeIcon name="values" size={14} color={dark ? C.bg : '#FFFFFF'} solid />
                <Text style={[$.worthText, { color: dark ? C.bg : '#FFFFFF' }]}>{sourceLabel(valueSource)} {fmt(portfolio)}{owned.some(i => lookupVal(i) == null) ? ' · subtotal' : ''}</Text>
              </View>
              <FontAwesome name="chevron-right" size={12} color={accentFor('kelp', dark).color} />
            </View>
          </View>
        </TouchableOpacity>
        )}

        {/* ── Social & extras ──
            Deliberately smaller than the tool grid. These used to sit in the
            same pill row at identical weight, which told the user that Daily
            Stars and Rods were equally central. They are not. */}
        <Text style={[$.sectionTitle, $.sectionSpacing, { color: C.text }]}>{t("home.more_to_explore", { defaultValue: "More to explore" })}</Text>
        <View style={$.pillRow}>
          {[
            // hideOnIosLimited: pills the iOS limited build leaves out — the
            // social ones, and Daily Stars because it is sign-in gated.
            // iosLimitedOnly: Settings, whose entry point elsewhere is the
            // header avatar — the iOS header has no buttons at all.
            // See Code/config/iosLimited.js.
            { icon: 'friends', accent: 'lagoon', label: t('home.friends') || 'Friends', onPress: () => guard(() => nav.navigate('SocialDashboard'), 'Sign in'), hideOnIosLimited: true },
            { icon: 'star', accent: 'amber', label: t('home.daily_stars'), onPress: () => guard(() => setShowDailyStars(true), 'Sign in'), hideOnIosLimited: true },
            { icon: 'trophy', accent: 'rose', label: t('home.top_rated'), onPress: () => nav.navigate('Leaderboard'), hideOnIosLimited: true },
            { icon: 'gift', accent: 'kelp', label: t('home.codes', { defaultValue: 'Codes' }), onPress: () => setShowCodes(true) },
            { icon: 'shield', accent: 'violet', label: t('home.our_team', { defaultValue: 'Our Team' }), onPress: () => nav.navigate('ModsScreen'), hideOnIosLimited: true },
            { icon: 'settings', accent: 'lagoon', label: t('tabs.settings'), onPress: () => nav.navigate('Setting'), iosLimitedOnly: true },
          ].filter((p) => (IOS_LIMITED ? !p.hideOnIosLimited : !p.iosLimitedOnly)).map((p) => {
            const a = accentFor(p.accent, dark);
            return (
              <TouchableOpacity
                key={p.label}
                accessibilityRole="button" accessibilityLabel={p.label}
                style={[$.navPill, { backgroundColor: a.tint, borderColor: a.tint }]}
                onPress={p.onPress}
                activeOpacity={0.7}
              >
                <HomeIcon name={p.icon} size={24} color={a.color} />
                <Text style={[$.navLabel, { color: a.color }]} numberOfLines={1}>{p.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ── Status Feed ── (not in the iOS limited build) */}
        {!IOS_LIMITED && (
        <StatusFeed
          user={user}
          firestoreDB={firestoreDB}
          appdatabase={appdatabase}
          isDarkMode={dark}
          onRequireSignIn={() => { setSigninMsg('Sign in to post a status'); setSigninVis(true); }}
        />
        )}

        {/* ══════════ Cosmetics ══════════
            Demoted to one compact row. It had a titled section and two large
            saturated cards — more visual weight than any data tool on the
            screen — for an engagement mechanic. The pink/purple were also the
            last un-migrated MM2 literals on this screen. */}
        {/* Not in the iOS limited build. See Code/config/iosLimited.js. */}
        {!IOS_LIMITED && (
        <View style={$.cosmeticsRow}>
          <TouchableOpacity
            style={[$.cosmeticCard, { backgroundColor: accentFor('rose', dark).tint, borderColor: accentFor('rose', dark).tint }]}
            onPress={() => guard(() => nav.navigate('MysteryEggScreen'), 'Sign in to open eggs')}
            activeOpacity={0.85}
          >
            <HomeIcon name="egg" size={22} color={accentFor('rose', dark).color} solid />
            <Text style={[$.cosmeticLabel, { color: accentFor('rose', dark).color }]} numberOfLines={1}>
              {t('home.win_cosmetics', { defaultValue: 'Win Cosmetics' })}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[$.cosmeticCard, { backgroundColor: accentFor('violet', dark).tint, borderColor: accentFor('violet', dark).tint }]}
            onPress={() => guard(() => nav.navigate('MyCosmeticsScreen'), 'Sign in to see cosmetics')}
            activeOpacity={0.85}
          >
            <HomeIcon name="cosmetics" size={22} color={accentFor('violet', dark).color} solid />
            <Text style={[$.cosmeticLabel, { color: accentFor('violet', dark).color }]} numberOfLines={1}>
              {t('home.my_cosmetics', { defaultValue: 'My Cosmetics' })}
            </Text>
          </TouchableOpacity>
        </View>
        )}

        {/* ── Invite: growth, not a peer of the tools ── */}
        <TouchableOpacity
          style={[$.inviteRow, { borderColor: C.border }]}
          activeOpacity={0.7}
          onPress={async () => {
            const link = Platform.OS === 'ios' ? config.IOsShareLink : config.andriodShareLink;
            // The Android share sheet backgrounds the app; don't greet the
            // player with an App Open ad when they come back from it.
            AppOpenAdManager.skipNextForeground();
            try { await Share.share({ message: `${t('home.share_message')} ${link}` }); } catch {}
          }}
        >
          <FontAwesome name="share-nodes" size={12} color={C.primary} />
          <Text style={[$.inviteText, { color: C.primary }]}>{t('home.invite')}</Text>
        </TouchableOpacity>

        {/* ── Footer ── */}
        <Text style={[$.footer, { color: C.textSecondary }]}>{t('home.made_with_love')}</Text>

      </ScrollView>

      {/* ── Banner Ad ── (tab bar is docked, so bottom: 0 sits flush above it) */}
      <View style={{ position: 'absolute', bottom: 0, width: '100%', alignItems: 'center' }}>
        <BannerAdComponent collapsible />
      </View>

      {/* ── Modals ──
          The iOS limited build has no sign-in: every trigger above is hidden,
          and the drawer itself is not mounted so nothing can surface it. */}
      {!IOS_LIMITED && (
      <DailyStarRewards visible={showDailyStars} onClose={() => setShowDailyStars(false)} db={appdatabase} uid={user?.id} isDarkMode={dark} />
      )}

      {!IOS_LIMITED && (
      <SignInDrawer visible={signinVis} onClose={() => setSigninVis(false)} selectedTheme={selectedTheme} screen="Home" message={signinMsg} />
      )}

      {/* Codes open here rather than on the Values tab. CodesDrawer is a
          self-contained Modal, so it needs nothing from that screen. */}
      <CodesDrawer
        isVisible={showCodes}
        toggleModal={() => setShowCodes(v => !v)}
        codes={codesData}
      />

      <Modal visible={showLangPicker} animationType="fade" transparent onRequestClose={() => setShowLangPicker(false)}>
        <TouchableOpacity style={$.langOverlay} activeOpacity={1} onPress={() => setShowLangPicker(false)}>
          <TouchableOpacity activeOpacity={1} style={[$.langBox, { backgroundColor: dark ? config.colors.surfaceDark : '#fff' }]}>
            <Text style={[$.b16, { color: C.text, textAlign: 'center', marginBottom: 14 }]}>🌍 {t('home.language')}</Text>
            {LANGUAGES.map(l => {
              const on = i18n.language === l.code;
              return (
                <TouchableOpacity key={l.code} style={[$.langRow, on && { backgroundColor: '#7C3AED12' }]}
                  onPress={() => handleLangSelect(l.code)}>
                  <Text style={{ fontSize: SIZE.heading }}>{l.flag}</Text>
                  <Text style={[$.b14, { color: C.text, flex: 1, marginLeft: SPACE.lg, fontFamily: on ? FONT.bold : FONT.regular }]}>{l.name}</Text>
                  {on && <FontAwesome name="check" size={12} color="#7C3AED" solid />}
                </TouchableOpacity>
              );
            })}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

const $ = StyleSheet.create({
  root: { flex: 1 },
  // Bottom edge gives the band a defined end instead of letting it bleed into
  // the first card.
  headerBand: { borderBottomLeftRadius: 24, borderBottomRightRadius: 24, overflow: 'hidden', paddingBottom: 6 },
  headerBubble: { position: 'absolute', width: 180, height: 180, borderRadius: 90, backgroundColor: HEADER_BTN_BG, right: -50, top: -65 },
  introRow: { marginHorizontal: SPACE.xxl, marginTop: SPACE.xl, flexDirection: 'row', alignItems: 'center', gap: SPACE.lg },
  introIcon: { width: 48, height: 48, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  introSub: { fontSize: SIZE.caption, fontFamily: FONT.regular, marginTop: 4 },
  sectionTitle: { fontSize: SIZE.subtitle, fontFamily: FONT.bold },
  sectionSpacing: { marginHorizontal: SPACE.xxl, marginTop: SPACE.xl },
  toolTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACE.md },

  // Header
  header: { minHeight: 88, flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACE.xxl, paddingVertical: 18, gap: 10 },
  h1: { fontSize: SIZE.heading, fontFamily: FONT.bold, letterSpacing: -0.5 },
  sub11: { fontSize: SIZE.small, fontFamily: FONT.regular },
  b14: { fontSize: SIZE.body, fontFamily: FONT.bold },
  b16: { fontSize: SIZE.subtitle, fontFamily: FONT.bold },
  profileTouch: { minWidth: 52, minHeight: 52, alignItems: 'center', justifyContent: 'center' },
  iconBtn: { width: 52, height: 52, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  // (removed profileBtn/profileAvatar — the header now uses FramedAvatar, which
  // must not be wrapped in a fixed-size `overflow: 'hidden'` box or the frame
  // decorations get clipped.)
  // My Stuff
  myStuffCard: {
    marginHorizontal: SPACE.xxl,
    marginTop: SPACE.xl,
    paddingHorizontal: SPACE.lg,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  myStuffCardInner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center', gap: SPACE.md, flexWrap: 'wrap',
  },
  worthPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.sm,
    paddingHorizontal: SPACE.lg,
    paddingVertical: 5,
    borderRadius: 10,
  },
  worthText: {
    fontSize: SIZE.caption,
    fontFamily: FONT.bold,
    color: '#B8860B',
  },

  // Search — the screen's primary affordance, so it sits full width.
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: SPACE.lg,
    marginHorizontal: SPACE.xxl, marginTop: SPACE.xl,
    paddingHorizontal: SPACE.xl, minHeight: 52,
    borderRadius: 18, borderWidth: 1,
  },
  searchInput: { fontSize: SIZE.body, fontFamily: FONT.regular, flex: 1, padding: 0 },

  // Live / next event strip
  eventStrip: {
    flexDirection: 'row', alignItems: 'center', gap: SPACE.md,
    marginHorizontal: SPACE.xxl, marginTop: SPACE.lg,
    paddingHorizontal: SPACE.xl, paddingVertical: SPACE.lg,
    borderRadius: 12, borderWidth: 1,
  },
  eventDot: { width: 7, height: 7, borderRadius: 4 },
  eventLabel: { flex: 1, fontSize: SIZE.caption, fontFamily: FONT.bold },
  eventMeta: { fontSize: SIZE.label, fontFamily: FONT.bold },

  // Tool grid — 2x2, every tile on screen at once.
  toolGrid: {
    flexDirection: 'row', flexWrap: 'wrap',
    paddingHorizontal: SPACE.xxl, marginTop: SPACE.md,
    gap: SPACE.lg,
  },
  toolCard: {
    // 48% + gap lands exactly two per row at any phone width, without doing
    // arithmetic against Dimensions that breaks on rotation or split screen.
    flexBasis: '45%', flexGrow: 1, minWidth: 0,
    padding: SPACE.xl, borderRadius: 20, borderWidth: 1,
  },
  // The one card that takes a whole row: the iOS limited build's calculator.
  toolCardWide: { flexBasis: '100%' },
  toolIcon: {
    width: 46, height: 46, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 0,
  },
  toolLabel: { fontSize: SIZE.body, fontFamily: FONT.bold },
  toolSub: { fontSize: SIZE.small, fontFamily: FONT.regular, marginTop: 4 },

  // Secondary pills — smaller than a tool card, on purpose.
  pillRow: {
    flexDirection: 'row', flexWrap: 'wrap',
    paddingHorizontal: SPACE.xxl, marginTop: SPACE.md, gap: SPACE.md,
  },
  navPill: {
    flexDirection: 'row', alignItems: 'center', gap: SPACE.md, flexBasis: '45%', flexGrow: 1, minHeight: 52,
    paddingHorizontal: SPACE.lg, paddingVertical: SPACE.md,
    borderRadius: 16, borderWidth: 1,
  },
  navLabel: { flexShrink: 1, fontSize: SIZE.caption, fontFamily: FONT.bold },

  // Section
  // Cosmetics — one quiet row.
  cosmeticsRow: {
    flexDirection: 'row', paddingHorizontal: SPACE.xxl,
    marginTop: SPACE.xl, gap: SPACE.lg,
  },
  cosmeticCard: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: SPACE.md,
    paddingHorizontal: SPACE.xl, paddingVertical: SPACE.xl, minHeight: 52,
    borderRadius: 16, borderWidth: 1,
  },
  cosmeticLabel: { fontSize: SIZE.caption, fontFamily: FONT.bold, flex: 1 },

  // Invite
  inviteRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: SPACE.md, marginHorizontal: SPACE.xxl, marginTop: SPACE.xxl,
    paddingVertical: SPACE.xl, borderRadius: 12, borderWidth: 1,
  },
  inviteText: { fontSize: SIZE.caption, fontFamily: FONT.bold },

  // Games Grid

  // Footer
  footer: { textAlign: 'center', fontSize: SIZE.small, fontFamily: FONT.regular, marginTop: SPACE.huge, paddingBottom: SPACE.md },

  // Language
  langOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: SPACE.huge },
  langBox: { borderRadius: 20, padding: SPACE.xxxl, width: '100%', maxWidth: 340 },
  langRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: SPACE.lg, paddingHorizontal: SPACE.xl, borderRadius: 12, marginBottom: SPACE.hair },
});

export default HomeTabScreen;
