import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, Modal, FlatList, TextInput, Image, Pressable, Platform, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/Ionicons';
import ViewShot from 'react-native-view-shot';
import { useGlobalState } from '../GlobelStats';
import { buildSearchTokens } from '../Trades/tradeSearchIndex';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import config from '../Helper/Environment';
import {
  resolveItemImage, summarizeItems, buildItemPool, unwrapFeed, newestGeneratedAt, matchesFilter,
  priceOf, displayValueText, isSummable, VALUE_SOURCE, DEFAULT_VALUE_SOURCE, sourceLabel,
} from '../Helper/valueSources';
import ConditionalKeyboardWrapper from '../Helper/keyboardAvoidingContainer';
import { useHaptic } from '../Helper/HepticFeedBack';
import { getDatabase, ref } from '@react-native-firebase/database';
import { useLocalState } from '../LocalGlobelStats';
import SignInDrawer from '../Firebase/SigninDrawer';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../Translation/LanguageProvider';
import { showSuccessMessage, showErrorMessage } from '../Helper/MessageHelper';
import { mixpanel } from '../AppHelper/MixPenel';
import InterstitialAdManager from '../Ads/IntAd';
import BannerAdComponent from '../Ads/bannerAds';
import Share from 'react-native-share';
import ShareTradeModal from '../Trades/ShareTradeModal';
import TradeCompletion from '../Engagement/TradeCompletion';
import { addDoc, collection, serverTimestamp, doc, getDoc, setDoc } from '@react-native-firebase/firestore';
import SubscriptionScreen from '../SettingScreen/OfferWall';
import { STATUS } from '../Design/tokens';
import { getThemeColors } from '../Helper/themeColors';
import { SIZE } from '../Design/tokens';
import { SPACE } from '../Design/tokens';
import { CALC_FILTERS, GAME } from '../config/game';
import { FONT } from '../Design/tokens';

// Nine per side is the game's actual trade window (Fisch opens a 9-slot trade
// menu), and it matches the Adopt Me build. The MM2 default of 4 was that
// game's limit, not this one's — it capped the calculator below what a player
// could actually put in a trade.
const GRID_STEPS = [9, 12, 15, 18];

// Notice tones. Environment.js carries no semantic good/caution pair, and the
// MM2 theme maps hasBlockGreen and wantBlockRed both to the brand colour, so
// they are declared here. Each background is a light tint with the deep shade
// of the same hue as its foreground, which keeps contrast in either theme.
const NOTICE_GOOD_BG = '#E7F6EC';
const NOTICE_GOOD_FG = '#1B6B3A';
const NOTICE_CAUTION_BG = '#FDF1DA';
const NOTICE_CAUTION_FG = '#8A5A12';

const createEmptySlots = (count) => Array(count).fill(null);



// ✅ MM2: Removed VALUE_TYPES, MODIFIERS, and hideBadge - MM2 doesn't use these

// ✅ MM2: Removed getItemValue function - MM2 uses simple value field

// Items a total cannot honestly include: `modeled` values are ordinal ranks
// derived from bundle pricing, `none` has no price at all.
// See Code/Helper/valueSources.js.
// ONLY genuinely unpriced items belong in the "Unpriced" row. Two other kinds
// of item used to land here and both were mislabelled:
//   - fish, which carry a real C$ figure (their own row)
//   - anything on the Proto scale, which is an ordinal rank and cannot be
//     summed, but is very much priced (its own row too)
// A Proto-priced rod skin reading "Unpriced" is exactly backwards.
const excludedCount = (summary) => summary?.unpriced || 0;
const notSummableCount = (summary) => summary?.notSummable || 0;
const excludedLabel = (summary) => {
  const n = excludedCount(summary);
  return n ? `${n} item${n === 1 ? '' : 's'}` : '—';
};

// Value and demand are different things, and the community's most-repeated
// lesson is that a high-value, low-demand item will not actually trade. An
// even-on-value deal where you receive the harder-to-move side is a worse deal
// than the number says.
//
// This ADVISES; it deliberately does not change the WIN/FAIR/LOSE verdict.
// That verdict is stored as `status` on every trade document and drives the
// badge on 8,799 existing trades — redefining it would make new trades
// incomparable with old ones.
const DEMAND_GAP_THRESHOLD = 1.5;

// Returns { text, tone } so an advisory line can be coloured by what it
// actually means for the user instead of every notice looking alike.
// gap = (demand of what you GIVE) - (demand of what you RECEIVE):
//
//   gap > 0   you hand over the liquid side and take back the illiquid one.
//             Runs against you -> caution.
//   gap < 0   you offload the illiquid side and take back liquid items.
//             Runs in your favour -> good.
//
// Both strings are the originals; only the tone is new. Still advisory only --
// it deliberately does not touch the WIN/FAIR/LOSE verdict, which is stored as
// `status` on 8,799 existing trades.
const getDemandAdvice = (hasAvg, wantsAvg) => {
  const a = Number(hasAvg);
  const b = Number(wantsAvg);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  const gap = a - b;
  if (Math.abs(gap) < DEMAND_GAP_THRESHOLD) return null;
  return gap > 0
    ? { text: 'Their side is harder to trade on', tone: 'caution' }
    : { text: 'Your side is harder to trade on', tone: 'good' };
};

/**
 * The W/F/L verdict, or `null` when there is nothing to judge.
 *
 * The MM2 version took two totals and opened on WIN, reasoning that 0 vs 0 is
 * the initial state. That is wrong here in a way it never was there: in Fisch
 * a 0 total ALSO means "every item on this side is unpriced" — fish are valued
 * by arithmetic, not consensus, and the Proto scale is ordinal and never
 * summable. So the empty calculator and a real trade of nine unpriced items
 * produced the same confident green WIN.
 *
 * A verdict needs at least one priced, summable item somewhere. Below that,
 * return null and let all three pills sit inactive — an honest "no reading"
 * rather than a flattering guess.
 */
const getTradeStatus = (hasSummary, wantsSummary) => {
  const priced = (hasSummary?.observed || 0) + (wantsSummary?.observed || 0);
  if (priced === 0) return null;

  // A verdict is only as good as its coverage, and the coverage here is
  // genuinely patchy: of 666 quoted cosmetics, 354 carry both figures, 99 are
  // S$-only and 213 are Proto-only. So a third of quoted items are invisible
  // on S$ and 15% are invisible on Proto — whichever scale you pick, some item
  // in a real trade will have no figure on it.
  //
  // Previously ANY single priced item produced a confident WIN/FAIR/LOSE, so a
  // trade of one priced boat against eight unpriced skins read as a clean win.
  // That is the worst failure this app can have: a wrong verdict carries more
  // authority than no verdict, and someone loses items to it.
  //
  // Summing across the two scales instead is NOT the fix — that is the named
  // Fisch scam. One scale per trade; when it cannot see the whole trade, the
  // verdict is still shown but flagged PROVISIONAL (see `verdictPartial`), for
  // two reasons:
  //   - Fish are excluded from S$ totals by design (they are C$), and fish are
  //     the most traded thing in the game. Withholding the verdict whenever one
  //     is present would disable the calculator for its commonest use.
  //   - game.guide, the incumbent, shows a verdict with N/A items too and warns
  //     only in an FAQ. Matching its capability while putting the warning
  //     INLINE, next to the number, is strictly better than hiding it.
  const hasTotal = hasSummary?.total || 0;
  const wantsTotal = wantsSummary?.total || 0;

  // You give more than you get.
  if (hasTotal > wantsTotal) return 'lose';
  if (hasTotal < wantsTotal) return 'win';
  return 'fair';
};

// ✅ Format values as simple numbers with commas
const formatValue = (value) => {
  if (value === null || value === undefined || value === 0) return '0';
  const numValue = Number(value);
  if (isNaN(numValue)) return '0';
  // Show fractional values as-is (e.g. 0.33), integers with commas (e.g. 500,000,000)
  if (numValue % 1 !== 0) return numValue.toFixed(2).replace(/\.?0+$/, '');
  return numValue.toLocaleString();
};

const HomeScreen = ({ selectedTheme }) => {
  const { theme, user, firestoreDB, appdatabase, single_offer_wall, reload } = useGlobalState();
  const tradesCollection = collection(firestoreDB, 'trades_new');
  const [gridStepIndex, setGridStepIndex] = useState(0); // 0 -> 9, 1 -> 12, 2 -> 15, 3 -> 18
  const [hasItems, setHasItems] = useState(() => createEmptySlots(GRID_STEPS[0]));
  const [wantsItems, setWantsItems] = useState(() => createEmptySlots(GRID_STEPS[0]));

  const [fruitRecords, setFruitRecords] = useState([]);
  const [selectedPetType, setSelectedPetType] = useState('INVENTORY');
  // const [wantsItems, setWantsItems] = useState(INITIAL_ITEMS);
  const [isDrawerVisible, setIsDrawerVisible] = useState(false);
  const [selectedSection, setSelectedSection] = useState(null);
  const [searchText, setSearchText] = useState('');
  const { triggerHapticFeedback } = useHaptic();
  const { localState, updateLocalState } = useLocalState();

  // Which catalogue prices this screen. The picker pool stays MM2 — the toggle
  // changes what items are WORTH, never which items exist, so nothing can
  // vanish from the grid mid-trade. See Code/Helper/valueSources.js.
  const valueSource = localState?.valueSource || DEFAULT_VALUE_SOURCE;

  // Totals are DERIVED from the grids, not accumulated alongside them. They
  // used to be state bumped by an updateTotal() call next to every mutation,
  // which meant any path that changed a grid without calling it drifted. The
  // grids are the source of truth — they are what a trade is built from.
  //
  // summarizeItems sums only `observed` values and counts the rest; see
  // Code/Helper/valueSources.js for why a modeled value must not be summed.
  const hasSummary = useMemo(() => summarizeItems(hasItems, valueSource), [hasItems, valueSource]);
  const wantsSummary = useMemo(() => summarizeItems(wantsItems, valueSource), [wantsItems, valueSource]);
  const hasTotal = hasSummary.total;
  const wantsTotal = wantsSummary.total;
  const navigation = useNavigation();
  const [modalVisible, setModalVisible] = useState(false);
  const [description, setDescription] = useState('');
  const [isSigninDrawerVisible, setIsSigninDrawerVisible] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showTradeCompletion, setShowTradeCompletion] = useState(false);
  const { language } = useLanguage();
  const [lastTradeTime, setLastTradeTime] = useState(null);
  const [adShowen, setadShowen] = useState(false);
  const [selectedTrade, setSelectedTrade] = useState(null);
  const [type, setType] = useState(null);
  const platform = Platform.OS.toLowerCase();
  const { t } = useTranslation();
  const isDarkMode = theme === 'dark';
  const c = getThemeColors(isDarkMode);
  const insets = useSafeAreaInsets();
  const bannerBottomPos = 0; // tab bar is docked (in layout flow), so screen bottom == tab bar top; banner sits flush above it
  const viewRef = useRef();
  // ✅ Add refs to track timeouts and animation frames for cleanup
  const timeoutRefs = useRef({});
  const rafRefs = useRef({});
  const isMountedRef = useRef(true);
  // ✅ MM2: Removed value type and modifier states - MM2 doesn't use these
  const [isAddingToFavorites, setIsAddingToFavorites] = useState(false);
  const [isShareModalVisible, setIsShareModalVisible] = useState(false);
  const [debouncedSearchText, setDebouncedSearchText] = useState(searchText);
  const [showofferwall, setShowofferwall] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  // When the VALUES last changed, read from the feed's own meta.generatedAt —
  // not when this screen mounted, and not when we last fetched. It used to be
  // `new Date()` at mount, so the label read "Updated just now" permanently no
  // matter how old the data was. Supreme publishes roughly twice every five
  // days; players believe it is every two to three weeks, and a label that
  // always says "just now" is why nobody could tell.
  //
  // Null for an older raw upload with no meta — the label hides rather than
  // inventing a time.
  const lastUpdatedTime = useMemo(() => {
    const parse = (raw) => {
      try {
        if (!raw) return null;
        return typeof raw === 'string' ? JSON.parse(raw) : raw;
      } catch (e) { return null; }
    };
    return newestGeneratedAt(parse(localState?.data), parse(localState?.suprime));
  }, [localState?.data, localState?.suprime]);

  // ✅ Cleanup all timeouts and animation frames on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      // Clear all timeouts
      Object.values(timeoutRefs.current).forEach(id => {
        if (id) clearTimeout(id);
      });
      timeoutRefs.current = {};
      // Cancel all animation frames
      Object.values(rafRefs.current).forEach(id => {
        if (id) cancelAnimationFrame(id);
      });
      rafRefs.current = {};
    };
  }, []);

  // ✅ Format last updated time as relative string
  const getLastUpdatedText = useCallback(() => {
    const now = new Date();
    if (!lastUpdatedTime) return '';
    const diffMs = now - lastUpdatedTime;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    if (diffMins < 1) return t('home.just_now', { defaultValue: 'just now' });
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return lastUpdatedTime.toLocaleDateString();
  }, [lastUpdatedTime, t]);

  // ✅ Hard refresh values - reloads data from CDN
  const handleRefresh = useCallback(async () => {
    if (refreshing || !isMountedRef.current) return;
    triggerHapticFeedback('impactLight');
    setRefreshing(true);
    try {
      await reload();
      if (!isMountedRef.current) return;
      // No stamping here: lastUpdatedTime is derived from the refreshed feed.
      showSuccessMessage(t('home.alert.success'), t('home.alert.values_reloaded', { defaultValue: 'Values updated!' }));
    } catch (error) {
      console.error('Error refreshing values:', error);
      if (!isMountedRef.current) return;
      showErrorMessage(t('home.alert.error'), t('home.alert.reload_error', { defaultValue: 'Failed to refresh' }));
    } finally {
      if (isMountedRef.current) setRefreshing(false);
    }
  }, [reload, refreshing, triggerHapticFeedback, t]);


  // ✅ MM2 Categories
  const CATEGORIES = useMemo(() => {
    return CALC_FILTERS;
  }, []);

  const tradeStatus = useMemo(() =>
    getTradeStatus(hasSummary, wantsSummary)
    , [hasSummary, wantsSummary]);

  // True when the active scale could not price part of the trade, so the
  // verdict above was computed from an incomplete picture. Measured: of 666
  // quoted cosmetics only 354 carry both figures — 213 are Proto-only and 99
  // are S$-only — so this is the normal case, not an edge case.
  const verdictPartial = useMemo(
    () => excludedCount(hasSummary) + excludedCount(wantsSummary) > 0,
    [hasSummary, wantsSummary],
  );


  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedSearchText(searchText);
    }, 300); // Adjust delay as needed

    return () => clearTimeout(timeout);
  }, [searchText]);
  const progressBarStyle = useMemo(() => {
    // When both sides are empty, show a balanced fair state (50-50)
    if (!hasTotal && !wantsTotal) return { left: '50%', right: '50%' };

    const total = hasTotal + wantsTotal;
    const hasPercentage = (hasTotal / total) * 100;
    const wantsPercentage = (wantsTotal / total) * 100;

    return {
      left: `${hasPercentage}%`,
      right: `${wantsPercentage}%`
    };
  }, [hasTotal, wantsTotal]);



  const handleLoginSuccess = useCallback(() => {
    setIsSigninDrawerVisible(false);
  }, []);

  const resetState = useCallback(() => {
    triggerHapticFeedback('impactLight');
    setSelectedSection(null);
    // hasTotal / wantsTotal are derived from the grids, so clearing the grids
    // below clears them too.
    setGridStepIndex(0);
    setHasItems(createEmptySlots(GRID_STEPS[0]));
    setWantsItems(createEmptySlots(GRID_STEPS[0]));
  }, [triggerHapticFeedback]);


  // See Code/Helper/valueSources.js. Stable reference, so no useCallback.
  const getImageUrl = resolveItemImage;


  // ✅ MM2: Removed handleBadgePress - MM2 doesn't use badges
  const maybeExpandGrid = useCallback(
    (nextHasItems, nextWantsItems) => {
      const currentSize = GRID_STEPS[gridStepIndex];
      const maxStepIndex = GRID_STEPS.length - 1;

      const hasCount = nextHasItems.filter(Boolean).length;
      const wantsCount = nextWantsItems.filter(Boolean).length;

      // Already at max (18 slots per side)
      if (gridStepIndex === maxStepIndex) {
        setHasItems(nextHasItems);
        setWantsItems(nextWantsItems);
        return;
      }

      // If either side filled all current slots -> grow to next step
      if (hasCount >= currentSize || wantsCount >= currentSize) {
        const nextSize = GRID_STEPS[gridStepIndex + 1];
        const diff = nextSize - currentSize;

        setGridStepIndex((prev) => prev + 1);
        setHasItems([...nextHasItems, ...createEmptySlots(diff)]);
        setWantsItems([...nextWantsItems, ...createEmptySlots(diff)]);
      } else {
        setHasItems(nextHasItems);
        setWantsItems(nextWantsItems);
      }
    },
    [gridStepIndex]
  );


  const selectItem = useCallback(
    (item) => {
      if (!item || !selectedSection) return;

      triggerHapticFeedback('impactLight');

      // ✅ MM2: Use Value directly (no modifiers needed)
      const value = Number(item.Value || 0);

      const selectedItem = {
        ...item,
        selectedValue: value,
        Value: value,
      };

      // Work on copies of both sides so we can decide expansion
      const nextHasItems = [...hasItems];
      const nextWantsItems = [...wantsItems];

      const targetArray =
        selectedSection === 'has' ? nextHasItems : nextWantsItems;

      let nextEmptyIndex = targetArray.indexOf(null);

      // No empty slot left even at 18 → do nothing
      if (nextEmptyIndex === -1) {
        return;
      }

      targetArray[nextEmptyIndex] = selectedItem;

      // This will also expand 9→12→15→18 if needed
      maybeExpandGrid(nextHasItems, nextWantsItems);

      setIsDrawerVisible(false);
    },
    [
      hasItems,
      wantsItems,
      selectedSection,
      triggerHapticFeedback,
      maybeExpandGrid,
    ]
  );


  const handleCellPress = useCallback((index, isHas) => {
    const items = isHas ? hasItems : wantsItems;

    const callbackfunction = () => { };

    if (items[index]) {
      triggerHapticFeedback('impactLight');
      const updatedItems = [...items];
      updatedItems[index] = null;

      if (isHas) {
        setHasItems(updatedItems);
      } else {
        setWantsItems(updatedItems);
      }
    } else {
      triggerHapticFeedback('impactLight');
      setSelectedSection(isHas ? 'has' : 'wants');
      setIsDrawerVisible(true);

      // ✅ Store timeout and animation frame IDs for cleanup
      const rafKey1 = `cellPress_${Date.now()}_1`;
      const timeoutKey1 = `cellPress_${Date.now()}_2`;
      const rafKey2 = `cellPress_${Date.now()}_3`;
      const timeoutKey2 = `cellPress_${Date.now()}_4`;

      rafRefs.current[rafKey1] = requestAnimationFrame(() => {
        if (!isMountedRef.current) return;

        timeoutRefs.current[timeoutKey1] = setTimeout(() => {
          if (!isMountedRef.current) return;

          if (!adShowen && index === 1 && !localState.isPro && !isHas) {
            rafRefs.current[rafKey2] = requestAnimationFrame(() => {
              if (!isMountedRef.current) return;

              timeoutRefs.current[timeoutKey2] = setTimeout(() => {
                if (!isMountedRef.current) return;

                try {
                  callbackfunction();
                } catch (err) {
                  console.warn('[AdManager] Failed to show ad:', err);
                  callbackfunction();
                }
                // Clean up after execution
                delete timeoutRefs.current[timeoutKey2];
              }, 400);
            });
          } else {
            callbackfunction();
          }
          // Clean up after execution
          delete timeoutRefs.current[timeoutKey1];
        }, 500);
      });
    }
  }, [hasItems, wantsItems, triggerHapticFeedback, adShowen, localState.isPro]);

  // ✅ MM2: Removed mode change effect - MM2 doesn't use Shark/Frost mode
  // ✅ MM2: Simplified toggleFavorite (no type needed)
  const toggleFavorite = useCallback((item) => {
    if (!item || (!item.name && !item.Name)) return;

    const currentFavorites = localState.favorites || [];
    const itemName = item.name || item.Name;
    // ✅ Save only identifiers to keep favorites updated with latest values
    const favoriteIdentifier = {
      name: itemName,
      id: item.id,
    };

    const isFavorite = currentFavorites.some(
      fav => (fav.id && fav.id === item.id) ||
        (fav.name && fav.name.toLowerCase() === itemName.toLowerCase())
    );

    let newFavorites;
    if (isFavorite) {
      // Remove by matching id or name
      newFavorites = currentFavorites.filter(
        fav => !((fav.id && fav.id === item.id) ||
          (fav.name && fav.name.toLowerCase() === itemName.toLowerCase()))
      );
    } else {
      newFavorites = [...currentFavorites, favoriteIdentifier];
    }

    updateLocalState('favorites', newFavorites);
    triggerHapticFeedback('impactLight');
  }, [localState.favorites, updateLocalState, triggerHapticFeedback]);

  // ✅ MM2: Simplified filteredData (no value types/modifiers needed)
  const filteredData = useMemo(() => {
    let list;
    if (selectedPetType === 'INVENTORY') {
      // ✅ INVENTORY = the user's My Stuff list (same list as MyStuffScreen /
      // Firestore reviews doc, mirrored in localState) — one list everywhere.
      const myItems = localState.ownedPets || [];
      const seen = new Set();
      list = myItems
        .map(owned => {
          // Match saved items with current fruitRecords to get latest values
          const foundItem = fruitRecords.find(
            item => item && (
              (owned.id && item.id === owned.id) ||
              (owned.name && item.name &&
                item.name.toLowerCase() === owned.name.toLowerCase())
            )
          );
          return foundItem || null;
        })
        .filter(Boolean)
        .filter(item => {
          // Dedupe (users can own the same item twice) — the calc grid adds
          // per-tap anyway, so one row per distinct item is what we want.
          const k = (item.name || '').toLowerCase();
          if (seen.has(k)) return false;
          seen.add(k);
          return true;
        });
    } else {
      list = fruitRecords;
    }
    return list
      .filter(item => {
        if (!item) return false;
        const matchesSearch = item.name?.toLowerCase().includes(debouncedSearchText.toLowerCase());
        // See matchesFilter in Code/Helper/valueSources.js — it matches on
        // `collection`, which is what buildItemPool actually tags rows with.
        return matchesSearch && matchesFilter(item, selectedPetType);
      })
      .sort((a, b) => (b.Value || 0) - (a.Value || 0));
  }, [
    fruitRecords,
    debouncedSearchText,
    selectedPetType,
    localState.ownedPets,
  ]);
  // ✅ MM2: Removed badge handlers - MM2 doesn't use badges

  // ✅ MM2: Simplified favorite item render (no badges needed)
  const renderFavoriteItem = useCallback(({ item }) => {
    const imageUrl = getImageUrl(item);
    // Priced from the active catalogue, like every other surface. Reading
    // item.Value here showed the MM2 number no matter which source was
    // selected, so an item Supreme prices differently — or not at all —
    // still read as its MM2 value in the inventory list.
    const priced = priceOf(item, valueSource);
    const currentValue = priced.value;
    const valueLabel = displayValueText(item, valueSource) || formatValue(currentValue);
    // Supreme declines to price leaderboard awards, and that is where the most
    // valuable items in the game sit. "Award only" alone would hide that this
    // is a 500,000,000 item, so MM2's figure rides along, labelled as MM2's.
    const reference = priced.referenceValue
      ? `MM2: ${formatValue(priced.referenceValue)}`
      : '';

    // Handler to add item to calculator
    const handleAddToCalculator = () => {
      if (!selectedSection) return;
      triggerHapticFeedback('impactLight');

      const selectedItem = {
        ...item,
        selectedValue: currentValue,
        Value: currentValue,
      };

      const nextHasItems = [...hasItems];
      const nextWantsItems = [...wantsItems];
      const targetArray = selectedSection === 'has' ? nextHasItems : nextWantsItems;
      let nextEmptyIndex = targetArray.indexOf(null);

      if (nextEmptyIndex === -1) return;

      targetArray[nextEmptyIndex] = selectedItem;
      maybeExpandGrid(nextHasItems, nextWantsItems);
      setIsDrawerVisible(false);
    };

    return (
      <View style={styles.favoriteRowItem}>
        {/* Left side: Image and Info (clickable to add to calculator) */}
        <TouchableOpacity
          style={styles.favoriteClickableArea}
          onPress={handleAddToCalculator}
          activeOpacity={0.7}
        >
          <View style={styles.favoriteImageContainer}>
            {imageUrl ? (
              <Image source={{ uri: imageUrl }} style={styles.favoriteItemImage} />
            ) : (
              <View style={[styles.favoriteItemImage, { backgroundColor: isDarkMode ? config.colors.surfaceElevatedDark : config.colors.dividerLight, justifyContent: 'center', alignItems: 'center' }]}>
                <Icon name="image-outline" size={18} color={isDarkMode ? config.colors.textTertiaryDark : config.colors.textTertiaryLight} />
              </View>
            )}
          </View>

          <View style={styles.favoriteItemInfo}>
            <Text style={styles.favoriteItemName} numberOfLines={1}>{item.name || item.Name}</Text>
            <Text style={styles.favoriteItemValue}>Value: {valueLabel}</Text>
            {reference ? <Text style={styles.referenceValue}>{reference}</Text> : null}
            {item.Tier && (
              <Text style={styles.favoriteItemRarity}>{item.Tier}</Text>
            )}
          </View>
        </TouchableOpacity>

        {/* Right side: Delete button (only removes from favorites) */}
        <TouchableOpacity
          style={styles.favoriteDeleteButton}
          activeOpacity={0.8}
          onPress={() => {
            triggerHapticFeedback('impactLight');
            toggleFavorite(item);
          }}
        >
          <Icon name="close-circle" size={20} color={config.colors.error} />
        </TouchableOpacity>
      </View>
    );
  }, [selectedSection, hasItems, wantsItems, maybeExpandGrid, triggerHapticFeedback, toggleFavorite, isDarkMode, getImageUrl, valueSource]);

  // ✅ MM2: Simplified grid item render
  const renderGridItem = useCallback(({ item }) => {
    const imageUrl = getImageUrl(item);
    const isFavorite = (localState.favorites || []).some(
      fav => (fav.id && fav.id === item.id) ||
        (fav.name && fav.name.toLowerCase() === (item.name || item.Name)?.toLowerCase())
    );

    return (
      <TouchableOpacity
        style={styles.gridItem}
        onPress={() => {
          if (isAddingToFavorites) {
            // When in "add to favorites" mode, clicking toggles favorite
            toggleFavorite(item);
          } else {
            // Normal mode: clicking adds item to calculator
            selectItem(item);
          }
        }}
      >
        {imageUrl ? (
          <Image
            source={{ uri: imageUrl }}
            style={styles.gridItemImage}
          />
        ) : (
          <View style={[styles.gridItemImage, { backgroundColor: isDarkMode ? config.colors.surfaceElevatedDark : config.colors.dividerLight, justifyContent: 'center', alignItems: 'center' }]}>
            <Icon name="image-outline" size={30} color={isDarkMode ? config.colors.textTertiaryDark : config.colors.textTertiaryLight} />
          </View>
        )}
        <Text numberOfLines={1} style={styles.gridItemText}>
          {item.name || item.Name}
        </Text>
        <Text numberOfLines={1} style={styles.gridItemValue}>
          {/* The source's own words when it has no real price — "Priceless",
              "Award only", "x3 T1 Legendaries" — all beat a derived 0.024.
              See Code/Helper/valueSources.js. */}
          {displayValueText(item, valueSource) || formatValue(priceOf(item, valueSource).value)}
        </Text>
        {priceOf(item, valueSource).referenceValue ? (
          <Text numberOfLines={1} style={[styles.referenceValue, { textAlign: 'center' }]}>
            MM2: {formatValue(priceOf(item, valueSource).referenceValue)}
          </Text>
        ) : null}
        {item.demand != null && item.demand !== 'N/A' && (
          <Text style={styles.gridItemDemand}>{item.demand}/10</Text>
        )}
        {isAddingToFavorites && (
          <TouchableOpacity
            style={styles.favoriteButton}
            activeOpacity={0.8}
            onPress={() => {
              toggleFavorite(item);
            }}
          >
            <Icon
              name={isFavorite ? "heart" : "heart-outline"}
              size={20}
              color={isFavorite ? STATUS.danger : "#666"}
            />
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    );
    // valueSource is load-bearing here: this row renders
    // displayValueText(item, valueSource). Without it in the deps the callback
    // keeps a stale closure over the OLD scale, so flipping the S$/Proto toggle
    // changed every total on the screen while the picker kept showing the old
    // scale's labels — which reads as "the toggle does nothing".
  }, [selectItem, toggleFavorite, localState.favorites, isAddingToFavorites, isDarkMode, getImageUrl, valueSource]);

  // Update renderFavoritesHeader function
  const renderFavoritesHeader = useCallback(() => {
    if (selectedPetType === 'INVENTORY') {
      const count = (localState.ownedPets || []).length;
      return (
        <View style={styles.favoritesHeader}>
          <Text style={styles.favoritesTitle}>{t('home.my_inventory')}{count > 0 ? ` (${count})` : ''}</Text>
        </View>
      );
    }
    return null;
  }, [selectedPetType, localState.ownedPets]);

  // Update renderFavoritesFooter function
  const renderFavoritesFooter = useCallback(() => {
    if (selectedPetType === 'INVENTORY') {
      // INVENTORY is managed in My Stuff (one list everywhere) — the CTA
      // routes there instead of the old separate in-calculator favorites.
      const hasItems = (localState.ownedPets || []).length > 0;
      return (
        <View style={styles.badgeContainer}>
          <TouchableOpacity
            style={styles.addToFavoritesButton}
            onPress={() => {
              requestAnimationFrame(() => navigation.navigate('MyStuff'));
            }}
          >
            <Icon name={hasItems ? 'create-outline' : 'add-circle'} size={26} color={config.colors.hasBlockGreen} />
            <Text style={styles.addToFavoritesText}>
              {hasItems ? t('home.manage_my_stuff', 'Manage My Stuff') : t('home.add_items_my_stuff', 'Add items in My Stuff')}
            </Text>
          </TouchableOpacity>
        </View>
      );
    }
    return null;
  }, [selectedPetType, localState.ownedPets, navigation]);

  // Memoize key extractor
  const keyExtractor = useCallback((item, index) =>
    item.id?.toString() || `${item.name}-${item.type}-${index}`, []);


  // Optimize FlatList performance
  const getItemLayout = useCallback((data, index) => {
    // For favorites: row layout with larger height, for grid: smaller height
    const itemHeight = selectedPetType === 'INVENTORY' && !isAddingToFavorites ? 100 : 100;
    return {
      length: itemHeight,
      offset: itemHeight * index,
      index,
    };
  }, [selectedPetType, isAddingToFavorites]);



  // ✅ MM2: Removed factor fetching - MM2 doesn't use Shark/Frost mode factor

  // console.log(localState.isGG)

  // ✅ Extract MM2 values from nested structure {category: {tier: [items]}}

  useEffect(() => {
    let isMounted = true;

    const parseAndSetData = async () => {
      try {
        const parseSource = (raw) => {
          if (!raw) return null;
          const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
          return parsed && typeof parsed === 'object' && Object.keys(parsed).length
            ? unwrapFeed(parsed)
            : null;
        };

        // One pool from both catalogues, deduped by name. The old
        // `[...mm2, ...supreme]` was not a merge — it produced 2,481 rows with
        // 953 duplicate names. buildItemPool keeps MM2's row where both list
        // an item (it owns the artwork) and appends Supreme-only tradables,
        // so neither catalogue's exclusives are unreachable.
        // See Code/Helper/valueSources.js.
        const items = buildItemPool(
          parseSource(localState.data),
          parseSource(localState.suprime),
        );
        // Only what the GAME allows in a trade. The wiki's Trading page is
        // explicit that the trade menu takes "any fish, bobber, boat, or rod
        // skin" — rods, baits, mutations, effects, accessories, companions,
        // harpoons and spears (885 items) cannot be traded at all. Offering
        // them here would let someone compose and POST a trade to the feed that
        // no one could ever complete in-game. The Values screen still lists
        // them; browsing a rod's stats is a different job. See config/game.js.
        const tradeableOnly = items.filter(
          (i) => i?.collection && GAME.tradeable.includes(i.collection),
        );
        if (isMounted) setFruitRecords(tradeableOnly);
      } catch (err) {
        console.error("❌ Error parsing data in HomeScreen:", err);
        if (isMounted) setFruitRecords([]);
      }
    };

    parseAndSetData();

    return () => {
      isMounted = false;
    };
  }, [localState.data, localState.suprime]);

  // console.log(filteredData.length)





  const handleCreateTradePress = useCallback(() => {
    // console.log(user.id);
    if (!user?.id) {
      setIsSigninDrawerVisible(true); // Open SignInDrawer if not logged in
      return;
    }

    // ✅ Store timeout ID for cleanup
    const timeoutKey = `createTrade_${Date.now()}`;
    timeoutRefs.current[timeoutKey] = setTimeout(() => {
      if (!isMountedRef.current) return;

      const hasItemsCount = hasItems.filter(Boolean).length;
      const wantsItemsCount = wantsItems.filter(Boolean).length;

      if (hasItemsCount === 0 && wantsItemsCount === 0) {
        showErrorMessage(t("home.alert.error"), t("home.alert.missing_items_error"));
        return;
      }

      setType('create');
      setModalVisible(true);
      // Clean up after execution
      delete timeoutRefs.current[timeoutKey];
    }, 100); // Small delay to allow React state to settle
  }, [hasItems, wantsItems, t, user?.id]);

  const handleCreateTrade = useCallback(async () => {
    if (isSubmitting) return;

    setIsSubmitting(true);
    try {
      // ✅ FIRESTORE ONLY: Read rating summary from user_ratings_summary (single source of truth)
      let userRating = null;
      let ratingCount = 0;

      if (firestoreDB && user?.id) {
        const summaryDocSnap = await getDoc(doc(firestoreDB, 'user_ratings_summary', user.id));
        if (summaryDocSnap.exists()) {
          const summaryData = summaryDocSnap.data();
          userRating = summaryData.averageRating || null;
          ratingCount = summaryData.count || 0;
        } else {
          // ✅ ONE-TIME MIGRATION: If Firestore summary doesn't exist, check RTDB and migrate (legacy data only)
          // This is a temporary migration path for existing data. New ratings only use Firestore.
          const database = getDatabase();
          const avgRatingSnap = await ref(database, `averageRatings/${user.id}`).once('value');
          const avgRatingData = avgRatingSnap.val();

          if (avgRatingData) {
            userRating = avgRatingData.value || null;
            ratingCount = avgRatingData.count || 0;

            // ✅ ONE-TIME MIGRATION: Copy to Firestore (async, don't wait)
            if (userRating || ratingCount > 0) {
              setDoc(
                doc(firestoreDB, 'user_ratings_summary', user.id),
                {
                  averageRating: userRating || 0,
                  count: ratingCount || 0,
                  updatedAt: serverTimestamp(),
                },
                { merge: true }
              ).catch(err => console.error('Error migrating rating summary to Firestore:', err));
            }
          }
        }
      }
      const now = Date.now(); // ✅ Use Date.now() for cooldown comparison
      const timestamp = serverTimestamp(); // ✅ Use serverTimestamp() for Firestore

      // ✅ Calculate hasRecentGameWin (similar to Trader.jsx)
      const hasRecentWin =
        typeof user?.lastGameWinAt === 'number' &&
        now - user.lastGameWinAt <= 24 * 60 * 60 * 1000; // last win within 24h

      // ✅ MM2: Simplified trade item mapping - save full URL for backward compatibility with old apps
      const mapTradeItem = item => {
        // An absolute URL is stored on every trade item, because old app
        // versions read it verbatim. An item with no art must land as '' —
        // better a missing image than a permanently broken URL baked into the
        // document.
        //
        // resolveItemImage returns `undefined` for those rows on purpose (its
        // callers spread it into `source={{ uri }}`, which warns on ''), so it
        // is a RENDER helper. Firestore rejects `undefined` outright — writing
        // it raised "Unsupported field value: undefined" and failed the whole
        // addDoc, so a trade containing any art-less item could not be posted
        // at all. Coalesce here, at the storage boundary.
        // See Code/Helper/valueSources.js.
        const imageUrl = resolveItemImage(item) ?? '';

        // Price from the catalogue the user was actually looking at. Taking
        // item.Value here instead would store MM2 prices under a Supreme total,
        // and the per-item values would not add up to hasTotal.
        const priced = priceOf(item, valueSource);

        return {
          name: item.name || item.Name,
          // Same Firestore rule as `image` above: a row carrying none of the
          // three spellings would otherwise write `undefined` and reject the
          // document. Matches slimItem() in Code/Engagement/journalUtils.js.
          type: item.type || item.Category || item.Type || '',
          value: priced.value,
          image: imageUrl, // ✅ Save full URL like old app expects
          // ✅ Include deprecated names if available
          deprecatedNames: item.deprecatedNames || item.deprecated_names || null,
          deprecatedName: item.deprecatedName || item.deprecated_name || null,
          // Additive, and null for anything that predates it. Without this the
          // trade cannot tell a real 25 from a bundle-tier 0.024 when it is
          // read back, and `value` alone would be summed as currency forever.
          // Readers must treat a missing field as summable — see isSummable().
          valueConfidence: priced.valueConfidence || null,
          valueText: priced.valueText || null,
        };
      };

      // ✅ Calculate trade status and convert to single letter: 'w' (win), 'l' (lose), 'f' (fair)
      const tradeStatus = getTradeStatus(hasSummary, wantsSummary);
      // No verdict (nothing priced) logs as 'f' — neutral, not a claimed win.
      const statusLetter = tradeStatus === 'win' ? 'w' : tradeStatus === 'lose' ? 'l' : 'f';

      const mappedHasItems = hasItems.filter(item => item && (item.name || item.Name)).map(mapTradeItem);
      const mappedWantsItems = wantsItems.filter(item => item && (item.name || item.Name)).map(mapTradeItem);

      const newTrade = {
        userId: user?.id || "Anonymous",
        traderName: user?.displayName || "Anonymous",
        avatar: user?.avatar || null,
        isPro: localState.isPro,
        isFeatured: false,
        hasItems: mappedHasItems,
        wantsItems: mappedWantsItems,
        // Search index. The trade screen queries these with array-contains;
        // until 2026-09-06 nothing wrote them, so every search matched nothing.
        // See Code/Trades/tradeSearchIndex.js.
        hasItemNames: buildSearchTokens(mappedHasItems),
        wantsItemNames: buildSearchTokens(mappedWantsItems),
        // ✅ Migration: Save in old format { value: number } for backward compatibility with old apps
        hasTotal: { value: hasTotal || 0 },
        wantsTotal: { value: wantsTotal || 0 },
        // Which catalogue these numbers came from. Absent on every trade made
        // before 2026-09, which readers must treat as 'mm2' — that is all
        // there was. Without it a Supreme-priced trade is indistinguishable
        // from an MM2 one, and the two disagree on 70% of shared items.
        valueSource,
        description: description || "",
        timestamp: timestamp, // ✅ Use serverTimestamp for Firestore
        status: statusLetter, // ✅ Trade status: 'w' (win), 'l' (lose), 'f' (fair)
        rating: userRating,
        ratingCount,
        flage: user.flage ? user.flage : null,
        robloxUsername: user?.robloxUsername || null,
        robloxUsernameVerified: user?.robloxUsernameVerified || false,
        hasRecentGameWin: hasRecentWin, // ✅ Game win info
        lastGameWinAt: user?.lastGameWinAt || null, // ✅ Game win timestamp


      };

      // ✅ 2-minute cooldown check (using Date.now() for accurate comparison)
      const COOLDOWN_MS = 120000; // 2 minutes
      if (lastTradeTime && (now - lastTradeTime) < COOLDOWN_MS) {
        const secondsLeft = Math.ceil((COOLDOWN_MS - (now - lastTradeTime)) / 1000);
        const minutesLeft = Math.floor(secondsLeft / 60);
        const remainingSeconds = secondsLeft % 60;
        const timeMessage = minutesLeft > 0
          ? `${minutesLeft} minute${minutesLeft === 1 ? '' : 's'} and ${remainingSeconds} second${remainingSeconds === 1 ? '' : 's'}`
          : `${secondsLeft} second${secondsLeft === 1 ? '' : 's'}`;
        showErrorMessage(t("home.alert.error"), `Please wait ${timeMessage} before creating a new trade.`);
        setIsSubmitting(false);
        return;
      }


      await addDoc(tradesCollection, newTrade);
      // Step 1: Close modal first
      setModalVisible(false);

      // Step 2: Reset calculator (both sides) after successful trade creation
      resetState();
      setDescription(''); // ✅ Clear description input

      // Step 3: Define the success callback
      const callbackfunction = () => {
        if (!isMountedRef.current) return;
        showSuccessMessage(t("home.alert.success"), "Your trade has been posted successfully!");
      };

      // Step 4: Update timestamp and analytics
      setLastTradeTime(now); // ✅ Use Date.now() for cooldown tracking
      mixpanel.track("Trade Created", { user: user?.id });

      // ✅ Store timeout and animation frame IDs for cleanup
      const rafKey1 = `createTrade_raf_${Date.now()}_1`;
      const timeoutKey1 = `createTrade_timeout_${Date.now()}_1`;
      const rafKey2 = `createTrade_raf_${Date.now()}_2`;
      const timeoutKey2 = `createTrade_timeout_${Date.now()}_2`;

      // Step 5: Wait for next frame (modal animation finish) then delay for iOS
      rafRefs.current[rafKey1] = requestAnimationFrame(() => {
        if (!isMountedRef.current) return;

        // Wait for modal animation to finish before showing ad
        timeoutRefs.current[timeoutKey1] = setTimeout(() => {
          if (!isMountedRef.current) return;

          if (!localState.isPro) {
            rafRefs.current[rafKey2] = requestAnimationFrame(() => {
              if (!isMountedRef.current) return;

              timeoutRefs.current[timeoutKey2] = setTimeout(() => {
                if (!isMountedRef.current) return;

                try {
                  InterstitialAdManager.showAd(callbackfunction);
                } catch (err) {
                  console.warn('[AdManager] Failed to show ad:', err);
                  callbackfunction();
                }
                // Clean up after execution
                delete timeoutRefs.current[timeoutKey2];
              }, 400); // Adjust based on animation time
            });
          } else {
            callbackfunction();
          }
          // Clean up after execution
          delete timeoutRefs.current[timeoutKey1];
        }, 500); // Give modal time to fully disappear on iOS
      });

    } catch (error) {
      console.error("Error creating trade:", error);
      showErrorMessage(t("home.alert.error"), "Something went wrong while posting the trade.");
    } finally {
      setIsSubmitting(false);
    }
  }, [isSubmitting, user, localState.isPro, hasItems, wantsItems, description, type, lastTradeTime, tradesCollection, t, resetState]);

  // ── Open the Log Trade sheet ──
  // Unlike "Create Trade" this posts nothing public — TradeCompletion records
  // the trade in the journal that My Stuff → History reads back.
  const handleLogTradePress = useCallback(() => {
    if (!user?.id) {
      setIsSigninDrawerVisible(true);
      return;
    }
    const filled = hasItems.filter(Boolean).length + wantsItems.filter(Boolean).length;
    if (filled === 0) {
      showErrorMessage(t("home.alert.error"), t("home.alert.missing_items_error"));
      return;
    }
    setShowTradeCompletion(true);
  }, [user?.id, hasItems, wantsItems, t]);

  // Fired when the sheet closes. `didSave` is false on a plain dismissal, in
  // which case the calculator is left exactly as the user had it.
  const handleTradeLogged = useCallback((didSave) => {
    setShowTradeCompletion(false);
    if (!didSave) return;
    resetState();
    mixpanel.track("Trade Logged", { user: user?.id, result: tradeStatus });

    const callbackfunction = () => {
      if (!isMountedRef.current) return;
      showSuccessMessage(
        '📋 ' + t('home.trade_logged', { defaultValue: 'Trade Logged!' }),
        t('home.trade_logged_message', { defaultValue: 'Saved to your Trade Journal.' })
      );
    };

    // Same monetization beat as Create Trade — interstitial, then the toast.
    if (!localState.isPro) {
      try {
        InterstitialAdManager.showAd(callbackfunction);
      } catch (err) {
        console.warn('[AdManager] Failed to show ad:', err);
        callbackfunction();
      }
    } else {
      callbackfunction();
    }
  }, [user?.id, tradeStatus, localState.isPro, t, resetState]);

  const handleShareTrade = useCallback(() => {
    const hasItemsCount = hasItems.filter(Boolean).length;
    const wantsItemsCount = wantsItems.filter(Boolean).length;

    if (hasItemsCount === 0 && wantsItemsCount === 0) {
      showErrorMessage(t("home.alert.error"), t("home.alert.missing_items_error"));
      return;
    }

    setIsShareModalVisible(true);
  }, [hasItems, wantsItems, t]);

  const profitLoss = wantsTotal - hasTotal;
  // Proto totals do not exist; see the em-dash comments in the header.
  const isProtoScale = valueSource === VALUE_SOURCE.PROTO;
  const isProfit = profitLoss >= 0;
  const neutral = profitLoss === 0;

  const isGG = localState.isGG

  const styles = useMemo(() => getStyles(isDarkMode, isGG), [isDarkMode, isGG]);

  const lastFilledIndexHas = useMemo(() =>
    hasItems.reduce((lastIndex, item, index) => (item ? index : lastIndex), -1)
    , [hasItems]);

  const lastFilledIndexWant = useMemo(() =>
    wantsItems.reduce((lastIndex, item, index) => (item ? index : lastIndex), -1)
    , [wantsItems]);

  // ✅ Aggregate demand for each side
  const hasAvgDemand = useMemo(() => {
    const items = hasItems.filter(i => i && i.demand != null && typeof i.demand === 'number');
    if (items.length === 0) return null;
    const avg = Math.min(10, items.reduce((sum, i) => sum + i.demand, 0) / items.length);
    return avg % 1 === 0 ? avg.toFixed(0) : avg.toFixed(1);
  }, [hasItems]);

  const wantsAvgDemand = useMemo(() => {
    const items = wantsItems.filter(i => i && i.demand != null && typeof i.demand === 'number');
    if (items.length === 0) return null;
    const avg = Math.min(10, items.reduce((sum, i) => sum + i.demand, 0) / items.length);
    return avg % 1 === 0 ? avg.toFixed(0) : avg.toFixed(1);
  }, [wantsItems]);

  const demandAdvice = useMemo(
    () => getDemandAdvice(hasAvgDemand, wantsAvgDemand),
    [hasAvgDemand, wantsAvgDemand],
  );

  return (
    <>
      <GestureHandlerRootView>
        <View style={styles.container} key={language}>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: bannerBottomPos + 80 }}>
            <ViewShot ref={viewRef} style={styles.screenshotView}>
              {config.isNoman && (
                <View style={styles.summaryContainer}>
                  <View style={styles.summaryInner}>
                    {/* Scale toggle. Changes what items are worth, not which
                        items exist, so switching can never empty the grid.
                        The two scales are NOT comparable: Proto is an ordinal
                        rank predating S$ pricing, three to four orders of
                        magnitude smaller. The whole trade stays on whichever
                        is selected — mixing them is the named Fisch scam. */}
                    <View style={styles.sourceToggleRow}>
                      {[VALUE_SOURCE.VALUE, VALUE_SOURCE.PROTO].map((src) => {
                        const active = valueSource === src;
                        return (
                          <TouchableOpacity
                            key={src}
                            style={[styles.sourceToggleButton, active && styles.sourceToggleButtonActive]}
                            activeOpacity={0.8}
                            onPress={() => {
                              if (active) return;
                              triggerHapticFeedback('impactLight');
                              updateLocalState('valueSource', src);
                            }}
                          >
                            <Text style={[styles.sourceToggleText, active && styles.sourceToggleTextActive]}>
                              {sourceLabel(src)}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                    <View style={styles.topSection}>
                      {/* Proto is ordinal — there is no such thing as a Proto
                          total, so showing "0" claims a number that does not
                          exist. An em dash says "not applicable" instead. */}
                      <Text style={styles.bigNumber} numberOfLines={1} adjustsFontSizeToFit>
                        {isProtoScale ? '—' : (formatValue(hasTotal) || '0')}
                      </Text>
                      <View style={styles.statusContainer}>
                        <Text style={[
                          styles.statusText,
                          tradeStatus === 'win' ? {
                            ...styles.statusActive,
                            backgroundColor: STATUS.success // Green for win
                          } : styles.statusInactive
                        ]}>{t('home.win')}</Text>
                        <Text style={[
                          styles.statusText,
                          tradeStatus === 'fair' ? {
                            ...styles.statusActive,
                            backgroundColor: config.colors.secondary // Blue for fair
                          } : styles.statusInactive
                        ]}>{t('home.fair')}</Text>
                        <Text style={[
                          styles.statusText,
                          tradeStatus === 'lose' ? {
                            ...styles.statusActive,
                            backgroundColor: config.colors.primary // Primary color for lose
                          } : styles.statusInactive
                        ]}>{t('home.lose')}</Text>
                      </View>
                      <Text style={styles.bigNumber} numberOfLines={1} adjustsFontSizeToFit>
                        {isProtoScale ? '—' : (formatValue(wantsTotal) || '0')}
                      </Text>
                    </View>
                    {/* <View style={styles.progressContainer}>
                      <View style={styles.progressBar}>
                        <View
                          style={[
                            styles.progressLeft,
                            { width: progressBarStyle.left }
                          ]}
                        />
                        <View
                          style={[
                            styles.progressRight,
                            { width: progressBarStyle.right }
                          ]}
                        />
                      </View>
                    </View> */}

                    {/* ✅ Aggregate demand row */}
                    {(hasAvgDemand || wantsAvgDemand) && (
                      <View style={styles.demandSummaryRow}>
                        <View style={styles.demandSummaryPill}>
                          <Text style={styles.demandSummaryText}>{hasAvgDemand || '—'}/10</Text>
                        </View>
                        <Text style={styles.demandSummaryLabel}>Demand</Text>
                        <View style={styles.demandSummaryPill}>
                          <Text style={styles.demandSummaryText}>{wantsAvgDemand || '—'}/10</Text>
                        </View>
                      </View>
                    )}

                    {/* Fish are valued by the game in C$, not by community
                        consensus in S$, so they cannot join the total above —
                        the Scrip Vendor's one-way C$100,000 -> S$1 sink would
                        price an average Megalodon at S$0.32 against skins worth
                        thousands. Adding a fish used to change nothing on this
                        header, which read as a broken calculator. It now gets
                        its own line, in its own currency. */}
                    {/* Priced, but on a scale that cannot be added up. On Proto
                        this is every item: it is a rank, not a currency. These
                        used to be counted as "Unpriced", which told a trader
                        their perfectly well-quoted skin had no value. */}
                    {(notSummableCount(hasSummary) > 0 || notSummableCount(wantsSummary) > 0) && (
                      <View style={styles.demandSummaryRow}>
                        <Text style={styles.excludedText}>
                          {notSummableCount(hasSummary) ? `${notSummableCount(hasSummary)} item${notSummableCount(hasSummary) === 1 ? '' : 's'}` : '—'}
                        </Text>
                        <Text style={styles.demandSummaryLabel}>
                          {t('home.ranked_not_summed', { defaultValue: 'Ranked, not summed' })}
                        </Text>
                        <Text style={styles.excludedText}>
                          {notSummableCount(wantsSummary) ? `${notSummableCount(wantsSummary)} item${notSummableCount(wantsSummary) === 1 ? '' : 's'}` : '—'}
                        </Text>
                      </View>
                    )}

                    {(hasSummary.cashCount > 0 || wantsSummary.cashCount > 0) && (
                      <View style={styles.demandSummaryRow}>
                        <Text style={styles.excludedText}>{hasSummary.cashTotalText || '—'}</Text>
                        <Text style={styles.demandSummaryLabel}>
                          {t('home.fish_cash_total', { defaultValue: 'Fish (C$)' })}
                        </Text>
                        <Text style={styles.excludedText}>{wantsSummary.cashTotalText || '—'}</Text>
                      </View>
                    )}

                    {/* What the total leaves out. A modeled value is a
                        bundle-tier rank, not a price, so it cannot be summed —
                        without this row a trade of cheap items just reads "0".
                        See Code/Helper/valueSources.js. */}
                    {(excludedCount(hasSummary) > 0 || excludedCount(wantsSummary) > 0) && (
                      <>
                        <View style={styles.demandSummaryRow}>
                          <Text style={styles.excludedText}>{excludedLabel(hasSummary)}</Text>
                          <Text style={styles.demandSummaryLabel}>Unpriced</Text>
                          <Text style={styles.excludedText}>{excludedLabel(wantsSummary)}</Text>
                        </View>
                        {/* The caveat belongs NEXT TO the verdict, not in a help
                            page. game.guide shows a verdict with N/A items and
                            explains the consequence only in its FAQ; a trader
                            reading a green WIN is not reading an FAQ. */}
                        {!!tradeStatus && verdictPartial && (
                          <Text style={styles.partialNote}>
                            {t('home.verdict_partial', {
                              defaultValue:
                                'Verdict ignores unpriced items — check those before you trade',
                            })}
                          </Text>
                        )}
                      </>
                    )}

                    <View style={styles.profitLossBox}>
                      <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.bigNumber2, { color: isProfit ? config.colors.hasBlockGreen : config.colors.wantBlockRed }]}>
                        {isProtoScale ? '—' : formatValue(Math.abs(profitLoss))}
                      </Text>
                      <View style={[styles.divider, { position: 'absolute', right: 0, bottom: 0 }]}>
                        <Image
                          source={require('../../assets/reset.png')}
                          style={{ width: 18, height: 18, tintColor: 'white' }}
                          onTouchEnd={resetState}
                        />
                      </View>
                    </View>
                  </View>
                </View>
              )}

              {/* Demand advice, moved OUT of the summary card so that one card
                  is not carrying every piece of information at once. Still
                  shown only when the gap clears DEMAND_GAP_THRESHOLD, now toned
                  by whether it runs for or against the user. */}
              {demandAdvice ? (
                <View style={[
                  styles.notice,
                  demandAdvice.tone === 'good' ? styles.noticeGood : styles.noticeCaution,
                ]}>
                  <Icon
                    name={demandAdvice.tone === 'good' ? 'trending-up-outline' : 'alert-circle-outline'}
                    size={15}
                    color={demandAdvice.tone === 'good' ? NOTICE_GOOD_FG : NOTICE_CAUTION_FG}
                    style={{ marginRight: 7 }}
                  />
                  <Text style={[
                    styles.noticeText,
                    { color: demandAdvice.tone === 'good' ? NOTICE_GOOD_FG : NOTICE_CAUTION_FG },
                  ]}>{demandAdvice.text}</Text>
                </View>
              ) : null}

              <View style={styles.labelContainer}>
                <Text style={styles.offerLabel}>{t('home.me')}</Text>
                <Text style={styles.dividerText}></Text>
                <Text style={styles.offerLabel}>{t('home.you')}</Text>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <View style={styles.itemRow}>
                  {hasItems?.map((item, index) => {
                    return (
                      <TouchableOpacity
                        key={index}
                        style={styles.addItemBlockNew}
                        onPress={() => handleCellPress(index, true)}
                      >
                        {item ? (
                          <>
                            {/* Art is never dimmed. The active source not
                                pricing an item is still signalled -- by the
                                unpricedBadge just below -- but fading the
                                artwork made the whole grid look washed out on
                                Supreme, where 62% of items are modeled or
                                unpriced against MM2's 44%. */}
                            <Image
                              source={{ uri: getImageUrl(item) }}
                              style={styles.itemImageOverlay}
                            />
                            {!isSummable(item, valueSource) && (
                              <View style={styles.unpricedBadge}>
                                <Text style={styles.unpricedBadgeText}>
                                  {priceOf(item, valueSource).missing ? '—' : '?'}
                                </Text>
                              </View>
                            )}
                            {/* ✅ MM2: Show demand pill if demand >= 5 */}
                            {item.demand != null && item.demand >= 5 && (
                              <View style={styles.calcDemandOverlay}>
                                <View style={[styles.calcDemandPill, item.demand >= 8 && { backgroundColor: '#EF4444CC' }]}>
                                  <Text style={styles.calcDemandPillText}>{item.demand}/10</Text>
                                </View>
                              </View>
                            )}
                          </>
                        ) : (
                          <Icon
                            name="add"
                            // An empty slot is an invitation, not a control that
                            // needs to compete with the items beside it. Muted
                            // token at 40% rather than two hardcoded hexes.
                            size={18}
                            color={c.textMuted + '66'}
                          />
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
                <View style={[styles.itemRow]}>
                  {wantsItems?.map((item, index) => {
                    return (
                      <TouchableOpacity
                        key={index}
                        style={styles.addItemBlockNew}
                        onPress={() => handleCellPress(index, false)}
                      >
                        {item ? (
                          <>
                            {/* Art is never dimmed. The active source not
                                pricing an item is still signalled -- by the
                                unpricedBadge just below -- but fading the
                                artwork made the whole grid look washed out on
                                Supreme, where 62% of items are modeled or
                                unpriced against MM2's 44%. */}
                            <Image
                              source={{ uri: getImageUrl(item) }}
                              style={styles.itemImageOverlay}
                            />
                            {!isSummable(item, valueSource) && (
                              <View style={styles.unpricedBadge}>
                                <Text style={styles.unpricedBadgeText}>
                                  {priceOf(item, valueSource).missing ? '—' : '?'}
                                </Text>
                              </View>
                            )}
                            {/* ✅ MM2: Show demand pill if demand >= 5 */}
                            {item.demand != null && item.demand >= 5 && (
                              <View style={styles.calcDemandOverlay}>
                                <View style={[styles.calcDemandPill, item.demand >= 8 && { backgroundColor: '#EF4444CC' }]}>
                                  <Text style={styles.calcDemandPillText}>{item.demand}/10</Text>
                                </View>
                              </View>
                            )}
                          </>
                        ) : (
                          <Icon
                            name="add"
                            // An empty slot is an invitation, not a control that
                            // needs to compete with the items beside it. Muted
                            // token at 40% rather than two hardcoded hexes.
                            size={18}
                            color={c.textMuted + '66'}
                          />
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
              {/* ✅ MM2: Removed Shark/Frost mode toggle - MM2 doesn't use these modes */}

              {!config.isNoman && (
                <View style={styles.summaryContainer}>
                  <View style={[styles.summaryBox, styles.hasBox]}>
                    <View style={{ width: '90%', backgroundColor: '#e0e0e0', alignSelf: 'center', }} />
                    <View style={{ justifyContent: 'space-between', flexDirection: 'row' }} >
                      <Text style={styles.priceValue}>{t('home.value')}:</Text>
                      <Text style={styles.priceValue}>${formatValue(hasTotal)}</Text>
                    </View>
                  </View>
                  <View style={[styles.summaryBox, styles.wantsBox]}>
                    <View style={{ width: '90%', backgroundColor: '#e0e0e0', alignSelf: 'center', }} />
                    <View style={{ justifyContent: 'space-between', flexDirection: 'row' }} >
                      <Text style={styles.priceValue}>{t('home.value')}:</Text>
                      <Text style={styles.priceValue}>${formatValue(wantsTotal)}</Text>
                    </View>
                  </View>
                </View>
              )}
            </ViewShot>
            <View style={styles.createtrade}>
              <TouchableOpacity
                style={styles.createtradeButton}
                onPress={() => handleCreateTradePress()}
              >
                <Text style={styles.tradeBtnText} numberOfLines={1}>{t('home.create_trade')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.logTradeButton}
                onPress={handleLogTradePress}
              >
                <Icon name="book-outline" size={13} color="#fff" style={{ marginRight: SPACE.xs }} />
                <Text style={styles.tradeBtnText} numberOfLines={1}>
                  {t('home.log_trade', { defaultValue: 'Log Trade' })}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.shareTradeButton}
                onPress={handleShareTrade}
              >
                <Text style={styles.tradeBtnText} numberOfLines={1}>{t('home.share_trade')}</Text>
              </TouchableOpacity>
            </View>
            {!localState.isPro && <View style={styles.createtradeAds}>
              <TouchableOpacity
                style={styles.removeAdsButton}
                activeOpacity={0.9}
                onPress={() => setShowofferwall(true)}
              >
                <View style={styles.removeAdsContent}>
                  {/* Crown icon / image */}
                  <View style={styles.crownWrapper}>
                    {/* <Icon name="trophy" size={18} color="#3b2500" /> */}

                    <Image
                      source={require('../../assets/pro.png')}
                      style={{ width: 20, height: 20 }}
                      resizeMode="contain"
                    />

                  </View>

                  <View style={styles.removeAdsTextWrapper}>
                    <Text style={styles.removeAdsTitle}>{t('home.remove_ads')}</Text>
                    {/* <Text style={styles.removeAdsSubtitle}>Unlock a clean experience</Text> */}
                  </View>
                </View>
              </TouchableOpacity>
            </View>}

            {/* ✅ Last Updated / Refresh Button */}
            <TouchableOpacity
              style={styles.lastUpdatedContainer}
              onPress={handleRefresh}
              disabled={refreshing}
              activeOpacity={0.7}
            >
              <View style={styles.lastUpdatedContent}>
                {refreshing ? (
                  <ActivityIndicator size="small" color={config.colors.primary} style={{ marginRight: SPACE.sm }} />
                ) : (
                  <Icon name="time-outline" size={14} color={isDarkMode ? '#aaa' : '#888'} style={{ marginRight: SPACE.sm }} />
                )}
                <Text style={[styles.lastUpdatedText, { color: c.textSecondary }]}>
                  {refreshing ? t('home.updating', { defaultValue: 'Updating...' }) : `${t('home.updated_prefix', { defaultValue: 'Updated ' })}${getLastUpdatedText()}`}
                </Text>
                {!refreshing && (
                  <Icon name="refresh-outline" size={14} color={config.colors.primary} style={{ marginLeft: SPACE.sm }} />
                )}
              </View>
            </TouchableOpacity>

          </ScrollView>
          <Modal
            visible={isDrawerVisible}
            transparent={true}
            animationType="slide"
            onRequestClose={() => setIsDrawerVisible(false)}
          >
            <Pressable style={styles.modalOverlay} onPress={() => setIsDrawerVisible(false)} />
            <View style={[styles.drawerContainer, { paddingBottom: insets.bottom }]}>
              <View style={styles.drawerHeader}>
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search..."
                  value={searchText}
                  onChangeText={setSearchText}
                  placeholderTextColor={isDarkMode ? '#999' : '#666'}
                />
                <TouchableOpacity
                  onPress={() => setIsDrawerVisible(false)}
                  style={styles.closeButton}
                >
                  <Text style={styles.closeButtonText}>{t('home.close')}</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.drawerContent}>
                <ScrollView
                  showsVerticalScrollIndicator={false}
                  style={styles.categoryListScroll}
                  contentContainerStyle={styles.categoryList}
                >
                  {CATEGORIES.map((category) => (
                    <TouchableOpacity
                      key={category}
                      style={[
                        styles.categoryButton,
                        selectedPetType === category && styles.categoryButtonActive
                      ]}
                      onPress={() => {
                        setSelectedPetType(category);
                        if (category !== 'INVENTORY') {
                          setIsAddingToFavorites(false);
                        } else {
                          // ✅ Force refresh when switching to INVENTORY tab
                          setIsAddingToFavorites(false);
                          // Trigger a re-render by updating a dummy state
                          // The filteredData will recalculate because it depends on localState.favorites
                        }
                      }}
                    >
                      <Text
                        numberOfLines={1}
                        adjustsFontSizeToFit
                        minimumFontScale={0.75}
                        style={[
                          styles.categoryButtonText,
                          selectedPetType === category && styles.categoryButtonTextActive
                        ]}>{category}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                <View style={styles.gridContainer}>
                  {renderFavoritesHeader()}
                  <FlatList
                    key={`${selectedPetType}-${isAddingToFavorites ? 'add' : 'view'}-${(localState.favorites || []).length}`}
                    data={filteredData}
                    keyExtractor={keyExtractor}
                    renderItem={selectedPetType === 'INVENTORY' && !isAddingToFavorites ? renderFavoriteItem : renderGridItem}
                    numColumns={selectedPetType === 'INVENTORY' && !isAddingToFavorites ? 1 : 3}
                    extraData={valueSource}
                    initialNumToRender={12}
                    maxToRenderPerBatch={12}
                    windowSize={5}
                    removeClippedSubviews={true}
                    getItemLayout={selectedPetType === 'INVENTORY' && !isAddingToFavorites ? undefined : getItemLayout}
                  />
                  {selectedPetType === 'INVENTORY' ? renderFavoritesFooter() : null}
                  {/* ✅ MM2: Removed badge buttons (N, F, M, R, D) - MM2 doesn't use value type/modifier badges */}
                </View>
              </View>
            </View>
          </Modal>
          <Modal
            visible={modalVisible}
            transparent
            animationType="slide"
            onRequestClose={() => setModalVisible(false)}
          >
            <Pressable style={styles.modalOverlay} onPress={() => setModalVisible(false)} />
            <ConditionalKeyboardWrapper>
              <View style={{ flexDirection: 'row', flex: 1 }}>
                <View style={[styles.drawerContainer2, { backgroundColor: isDarkMode ? config.colors.surfaceElevatedDark : 'white', paddingBottom: insets.bottom }]}>
                  <Text style={styles.modalMessage}>
                    {t("home.trade_description")}
                  </Text>
                  <Text style={styles.modalMessagefooter}>
                    {t("home.trade_description_hint")}
                  </Text>
                  <TextInput
                    style={styles.input}
                    placeholder={t("home.write_description")}
                    maxLength={40}
                    value={description}
                    onChangeText={setDescription}
                  />
                  <View style={styles.buttonContainer}>
                    <TouchableOpacity
                      style={[styles.button, styles.cancelButton]}
                      onPress={() => setModalVisible(false)}
                    >
                      <Text style={styles.buttonText}>{t('home.cancel')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.button, styles.confirmButton]}
                      onPress={handleCreateTrade}
                      disabled={isSubmitting}
                    >
                      <Text style={styles.buttonText}>
                        {isSubmitting ? t('home.submit') : t('home.confirm')}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </ConditionalKeyboardWrapper>
          </Modal>

          <SignInDrawer
            visible={isSigninDrawerVisible}
            onClose={handleLoginSuccess}
            selectedTheme={selectedTheme}
            screen='Chat'
            message={t("home.alert.sign_in_required")}
          />
        </View>
        <SubscriptionScreen visible={showofferwall} onClose={() => setShowofferwall(false)} track='Home' oneWallOnly={single_offer_wall} showoffer={!single_offer_wall} />
      </GestureHandlerRootView>
      {!localState.isPro && (
        <View style={{ position: 'absolute', bottom: bannerBottomPos, left: 0, right: 0, alignItems: 'center', zIndex: 5 }}>
          <BannerAdComponent collapsible />
        </View>
      )}
      <ShareTradeModal
        visible={isShareModalVisible}
        onClose={() => setIsShareModalVisible(false)}
        hasItems={hasItems}
        wantsItems={wantsItems}
        hasTotal={hasTotal}
        wantsTotal={wantsTotal}
        description={description}
      />
      <TradeCompletion
        visible={showTradeCompletion}
        onClose={handleTradeLogged}
        db={appdatabase}
        firestoreDB={firestoreDB}
        uid={user?.id}
        hasItems={hasItems}
        wantsItems={wantsItems}
        tradeResult={tradeStatus ?? 'fair'}
        t={t}
      />
    </>
  );
};

const getStyles = (isDarkMode, isGG, c = getThemeColors(isDarkMode)) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: isDarkMode ? config.colors.backgroundDark : config.colors.backgroundLight,
      paddingBottom: 5,
    },
    summaryContainer: {
      width: '100%',
      // Same sunken field as the item grid's panel (itemRow), so the summary
      // card sits recessed in it the way a slot tile sits in the grid. Keeps
      // one visual idea across the screen instead of a floating card up top and
      // a panel further down.
      backgroundColor: c.bgAlt,
      borderRadius: 12,
      padding: SPACE.sm,
      marginBottom: SPACE.lg,
    },
    summaryInner: {
      backgroundColor: isDarkMode ? config.colors.surfaceDark : config.colors.surfaceLight,
      // 10 to match the grid tiles; the old 15 agreed with nothing else.
      // marginBottom moved up to summaryContainer, which owns the spacing now.
      borderRadius: 10,
      padding: SPACE.lg,
      // Softened from the RN boilerplate shadow (opacity 0.25 / radius 3.84 /
      // elevation 2), which read as a hard dark edge. Wide and faint gives the
      // raised-on-a-field feel instead.
      shadowColor: config.colors.shadowDark,
      shadowOffset: {
        width: 0,
        height: 3,
      },
      shadowOpacity: 0.07,
      shadowRadius: 10,
      elevation: 1,
    },
    topSection: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      // marginBottom: SPACE.lg,


    },
    bigNumber: {
      fontSize: SIZE.heading,
      fontFamily: FONT.bold,
      textAlign: 'center',
      color: isDarkMode ? config.colors.textDark : config.colors.textLight,
      flex: 1,
    },
    referenceValue: {
      fontSize: SIZE.label,
      color: isDarkMode ? config.colors.textDark : config.colors.textLight,
      opacity: 0.55,
    },
    unpricedBadge: {
      position: 'absolute',
      top: 2,
      left: 2,
      minWidth: 14,
      height: 14,
      borderRadius: 7,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isDarkMode ? '#00000099' : '#00000066',
    },
    unpricedBadgeText: {
      fontSize: SIZE.label,
      fontFamily: FONT.bold,
      color: c.textInverse,
    },
    sourceToggleRow: {
      flexDirection: 'row',
      alignSelf: 'center',
      borderRadius: 8,
      padding: SPACE.hair,
      marginBottom: SPACE.md,
      backgroundColor: isDarkMode ? config.colors.surfaceElevatedDark : config.colors.dividerLight,
    },
    sourceToggleButton: {
      paddingHorizontal: SPACE.xxl,
      paddingVertical: SPACE.xs,
      borderRadius: 6,
    },
    sourceToggleButtonActive: {
      backgroundColor: config.colors.secondary,
    },
    sourceToggleText: {
      fontSize: SIZE.caption,
      fontFamily: FONT.regular,
      color: isDarkMode ? config.colors.textDark : config.colors.textLight,
      opacity: 0.7,
    },
    sourceToggleTextActive: {
      color: c.textInverse,
      opacity: 1,
    },
    partialNote: {
      fontSize: SIZE.caption,
      fontFamily: FONT.bold,
      color: STATUS.warning,
      textAlign: 'center',
      marginTop: SPACE.xs,
      paddingHorizontal: SPACE.lg,
    },
    excludedText: {
      fontSize: SIZE.small,
      textAlign: 'center',
      flex: 1,
      color: isDarkMode ? config.colors.textDark : config.colors.textLight,
      opacity: 0.6,
    },
    // ✅ Aggregate demand summary styles
    demandSummaryRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: SPACE.lg,
      marginTop: SPACE.xs,
    },
    demandSummaryPill: {
      backgroundColor: '#FF6B0020',
      paddingHorizontal: SPACE.md,
      paddingVertical: SPACE.hair,
      borderRadius: 10,
    },
    demandSummaryText: {
      fontSize: SIZE.small,
      fontFamily: FONT.bold,
      color: '#FF6B00',
    },
    demandSummaryLabel: {
      fontSize: SIZE.label,
      fontFamily: FONT.regular,
      color: c.textSecondary,
    },
    bigNumber2: {
      fontSize: 40,
      fontFamily: FONT.bold,
      textAlign: 'center',
      color: isDarkMode ? config.colors.textDark : config.colors.textLight,

    },
    statusContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: isDarkMode ? config.colors.surfaceElevatedDark : config.colors.dividerLight,
      borderRadius: 20,
      padding: 5,
      paddingHorizontal: SPACE.md,
    },
    statusText: {
      fontSize: SIZE.caption,
      fontFamily: FONT.regular,
      paddingHorizontal: SPACE.lg,
    },
    statusActive: {
      color: config.colors.white,
      backgroundColor: config.colors.hasBlockGreen,
      borderRadius: 20,
    },
    statusInactive: {
      color: isDarkMode ? config.colors.textTertiaryDark : config.colors.textTertiaryLight,
    },
    progressContainer: {
      marginVertical: 5,

    },
    progressBar: {
      height: 6,
      flexDirection: 'row',
      borderRadius: 3,
      overflow: 'hidden',
      backgroundColor: isDarkMode ? config.colors.surfaceElevatedDark : config.colors.dividerLight,
    },
    progressLeft: {
      height: '100%',
      backgroundColor: config.colors.hasBlockGreen,
      transition: 'width 0.3s ease',
    },
    progressRight: {
      height: '100%',
      backgroundColor: config.colors.wantBlockRed,
      transition: 'width 0.3s ease',
    },
    labelContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-evenly',
      // marginTop: 5,
      flex: 1,
      width: '100%',
      // backgroundColor:'red',

    },
    offerLabel: {
      fontSize: SIZE.caption,
      color: c.textSecondary,
      fontFamily: FONT.bold,
      paddingBottom: 5,
    },
    dividerText: {
      fontSize: SIZE.body,
      color: c.textMuted,
      paddingHorizontal: 5,
    },
    summaryBox: {
      width: '48%',
      padding: 5,
      borderRadius: 8,
    },
    profitLossBox: {
      justifyContent: 'center',
      alignItems: 'center',
      flexDirection: 'row',
      // paddingVertical: SPACE.lg,
    },
    hasBox: {
      backgroundColor: config.colors.hasBlockGreen,
    },
    wantsBox: {
      backgroundColor: config.colors.wantBlockRed,
    },
    priceValue: {
      color: 'white',
      textAlign: 'center',
      marginTop: 5,
      fontFamily: FONT.bold,
    },
    notice: {
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: 12,
      paddingVertical: 9,
      paddingHorizontal: SPACE.xl,
      marginBottom: SPACE.lg,
    },
    noticeGood: { backgroundColor: NOTICE_GOOD_BG },
    noticeCaution: { backgroundColor: NOTICE_CAUTION_BG },
    noticeText: {
      fontSize: SIZE.caption,
      fontFamily: FONT.regular,
      flex: 1,
    },
    itemRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      width: '49%',
      marginBottom: 5,
      marginHorizontal: 'auto',
      // A soft sunken panel, replacing the 1px brand-coloured outline at
      // radius 4. That hard rule around a 2x2 table was the most dated thing on
      // the screen; the slots now read as separate raised tiles on a recessed
      // surface. Environment.js has no "sunken" token, hence the literals --
      // each sits just under surfaceLight / surfaceDark respectively.
      backgroundColor: c.bgAlt,
      borderRadius: 12,
      padding: SPACE.sm,
      gap: SPACE.sm,
    },
    addItemBlockNew: {
      // flexBasis 30% + flexGrow lands exactly three per row and lets flex
      // absorb the gaps, so no percentage has to be hand-tuned: four 30% tiles
      // plus three gaps can never fit a row, three plus two gaps always can.
      // Three columns is what makes nine slots read as a 3x3 block rather than
      // an awkward 2-2-2-2-1.
      flexBasis: '30%',
      flexGrow: 1,
      height: 64,
      backgroundColor: isDarkMode ? config.colors.surfaceDark : config.colors.surfaceLight,
      justifyContent: 'center',
      alignItems: 'center',
      position: 'relative',
      borderRadius: 10,
      // Clips item art to the tile's corners.
      overflow: 'hidden',
    },
    itemText: {
      color: isDarkMode ? config.colors.textDark : config.colors.textLight,
      textAlign: 'center',
      fontFamily: FONT.bold,
      fontSize: SIZE.caption
    },
    removeButton: {
      position: 'absolute',
      top: 2,
      right: 2,
      // backgroundColor: config.colors.wantBlockRed,
      borderRadius: 50,
      opacity: .7
    },
    divider: {
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: config.colors.primary,
      margin: 'auto',
      borderRadius: 12,
      padding: 5,
    },
    drawerContainer: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: isDarkMode ? config.colors.surfaceElevatedDark : config.colors.surfaceLight,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      height: '80%',
      paddingTop: SPACE.xxl,
      paddingHorizontal: SPACE.xxl,
    },
    drawerContainer2: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: isDarkMode ? config.colors.surfaceElevatedDark : config.colors.surfaceLight,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      // height: '80%',
      paddingTop: SPACE.xxl,
      paddingHorizontal: SPACE.xxl,
    },
    drawerHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: SPACE.xxl,
    },
    drawerContent: {
      flex: 1,
      flexDirection: 'row',
    },
    categoryListScroll: {
      // INVENTORY and LANTERNS wrapped to two lines here. SIZE.label is 10pt,
      // already the smallest step on the type scale, so the fix is room rather
      // than a smaller font: trimming the gutter gives the labels ~8pt more,
      // and the Text above is numberOfLines={1} + adjustsFontSizeToFit so a
      // device with large system font scaling shrinks instead of wrapping.
      maxWidth: '25%',
      width: '25%',
      paddingRight: SPACE.md,
    },
    categoryList: {
      paddingVertical: SPACE.hair,
    },
    categoryButton: {
      marginVertical: SPACE.hair,
      marginHorizontal: SPACE.xs,
      paddingVertical: SPACE.md,
      paddingHorizontal: SPACE.xs,
      backgroundColor: c.bgAlt,
      borderRadius: 6,
      alignItems: 'center',
      minWidth: 40,
    },
    categoryButtonActive: {
      // Was MM2's #FF9999 pink, which is not in this app's palette at all.
      backgroundColor: config.colors.primary,
    },
    categoryButtonText: {
      fontSize: SIZE.label,
      fontFamily: FONT.bold,
      color: c.textSecondary,
    },
    categoryButtonTextActive: {
      color: c.textInverse,
    },
    lastUpdatedContainer: {
      paddingHorizontal: SPACE.xl,
      paddingVertical: SPACE.md,
      alignItems: 'center',
    },
    lastUpdatedContent: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
    },
    lastUpdatedText: {
      fontSize: SIZE.caption,
      fontFamily: FONT.regular,
    },
    gridContainer: {
      flex: 1,
      flexShrink: 1,
      flex: 1,
      // paddingBottom: 60,
    },
    gridItem: {
      flex: 1,
      margin: SPACE.xs,
      alignItems: 'center',
    },
    gridItemImage: {
      width: 70,
      height: 70,
      borderRadius: 10,
    },
    gridItemText: {
      fontSize: SIZE.small,
      marginTop: SPACE.xs,
      color: c.text,
    },
    gridItemValue: {
      fontSize: SIZE.label,
      color: c.textSecondary,
      fontFamily: FONT.bold,
    },
    gridItemDemand: {
      fontSize: SIZE.label,
      color: '#FF6B00',
      fontFamily: FONT.bold,
    },
    badgeContainer: {
      flexDirection: 'row',
      justifyContent: 'center',
      paddingVertical: SPACE.md,
      borderTopWidth: 1,
      borderTopColor: c.border,
      // marginTop: SPACE.md,
    },
    badge: {
      color: 'white',
      padding: 0.5,
      borderRadius: 10,
      fontSize: SIZE.label,
      minWidth: 10,
      textAlign: 'center',
      overflow: 'hidden',
      fontFamily: FONT.bold,
    },
    badgeButton: {
      marginHorizontal: SPACE.xs,
      paddingVertical: SPACE.md,
      paddingHorizontal: SPACE.xl,
      borderRadius: 16,
      backgroundColor: isDarkMode ? config.colors.surfaceElevatedDark : '#f0f0f0',
    },
    badgeButtonActive: {
      backgroundColor: STATUS.primary,
    },
    badgeButtonText: {
      fontSize: SIZE.caption,
      fontFamily: FONT.regular,
      color: c.textSecondary,
    },
    badgeButtonTextActive: {
      color: c.textInverse,
    },
    modalOverlay: {
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      flex: 1,
    },
    searchInput: {
      width: '75%',
      borderColor: '#333',
      borderWidth: 1,
      borderRadius: 5,
      height: 40,
      paddingHorizontal: SPACE.lg,
      backgroundColor: c.card,
      color: c.text,
    },
    closeButton: {
      backgroundColor: config.colors.wantBlockRed,
      padding: SPACE.lg,
      borderRadius: 5,
      height: 40,

      width: '24%',
      alignItems: 'center',
      justifyContent: 'center'
    },
    closeButtonText: {
      color: 'white',
      textAlign: 'center',
      fontFamily: FONT.regular,
      fontSize: SIZE.caption
    },
    itemImageOverlay: {
      width: 65,
      height: 65,
      borderRadius: 5,
      resizeMode: 'contain',
    },
    // ✅ Demand overlay styles for calc grid cells
    calcDemandOverlay: {
      position: 'absolute',
      top: 1,
      left: 1,
    },
    calcDemandPill: {
      backgroundColor: '#FF6B00CC',
      paddingHorizontal: SPACE.hair,
      paddingVertical: 0.5,
      borderRadius: 2,
    },
    calcDemandPillText: {
      fontSize: SIZE.label,
      fontFamily: FONT.bold,
      color: 'white',
    },
    screenshotView: {
      padding: SPACE.lg,
      flex: 1,
    },


    // 3-segment pill: Create | Log | Share. Segments flex so they fit small
    // screens; only the outer two carry the rounded corners.
    createtrade: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignSelf: 'stretch',
      paddingHorizontal: SPACE.xxl,
    },
    createtradeButton: {
      backgroundColor: config.colors.hasBlockGreen,
      flex: 1,
      padding: SPACE.lg,
      justifyContent: 'center',
      alignItems: 'center',
      flexDirection: 'row',
      borderTopStartRadius: 20,
      borderBottomStartRadius: 20,
      marginRight: 1
    },
    logTradeButton: {
      backgroundColor: config.colors.primary,
      flex: 1,
      padding: SPACE.lg,
      justifyContent: 'center',
      alignItems: 'center',
      flexDirection: 'row',
      marginHorizontal: 1,
    },
    shareTradeButton: {
      backgroundColor: config.colors.wantBlockRed,
      flex: 1,
      padding: SPACE.lg,
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      borderTopEndRadius: 20,
      borderBottomEndRadius: 20,
      marginLeft: 1
    },
    tradeBtnText: {
      color: 'white',
      fontSize: SIZE.caption,
      fontFamily: FONT.bold,
    },
    modalMessage: {
      fontSize: SIZE.caption,
      marginBottom: SPACE.xs,
      color: isDarkMode ? 'white' : 'black',
      fontFamily: FONT.regular
    },
    modalMessagefooter: {
      fontSize: SIZE.label,
      marginBottom: SPACE.lg,
      color: isDarkMode ? 'grey' : 'grey',
      fontFamily: FONT.regular
    },
    input: {
      width: '100%',
      height: 40,
      borderColor: 'gray',
      borderWidth: 1,
      borderRadius: 5,
      paddingHorizontal: SPACE.lg,
      marginBottom: SPACE.xxxl,
      color: isDarkMode ? 'white' : 'black',
      fontFamily: FONT.regular
    },
    buttonContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      width: '100%',
      marginBottom: SPACE.lg,
      paddingHorizontal: SPACE.xxxl
    },
    button: {
      paddingVertical: SPACE.lg,
      paddingHorizontal: SPACE.xxxl,
      borderRadius: 5,
    },
    cancelButton: {
      backgroundColor: config.colors.wantBlockRed,
    },
    confirmButton: {
      backgroundColor: config.colors.hasBlockGreen,
    },
    buttonText: {
      color: 'white',
      fontSize: SIZE.body,
      fontFamily: FONT.bold,
    },

    text: {
      color: "white",
      fontSize: SIZE.caption,
      fontFamily: FONT.regular,
      lineHeight: 12
    },


    typeContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: SPACE.lg,
      marginBottom: SPACE.xxxl,
      position: 'relative',
    },
    recommendedContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: SPACE.md,
    },
    recommendedText: {
      fontSize: SIZE.caption,
      color: c.textSecondary,
      marginLeft: SPACE.xs,
      fontFamily: FONT.regular,
    },
    curvedArrow: {
      transform: [{ rotate: '-90deg' }],
      marginRight: SPACE.hair,
    },
    typeButtonsContainer: {
      flexDirection: 'row',
      backgroundColor: 'rgb(253, 229, 229)',
      borderRadius: 20,
      padding: SPACE.xs,
    },
    typeButton: {
      paddingVertical: SPACE.md,
      paddingHorizontal: SPACE.xxxl,
      borderRadius: 16,
    },
    typeButtonActive: {
      backgroundColor: 'rgb(255, 102, 102)',
    },
    typeButtonText: {
      fontSize: SIZE.body,
      color: c.textSecondary,
      fontFamily: FONT.regular,
    },
    typeButtonTextActive: {
      color: 'white',
      fontFamily: FONT.regular,
    },
    valueText: {
      fontSize: SIZE.label,
      color: c.textSecondary,
      marginTop: SPACE.hair,
    },
    itemBadgesContainer: {
      position: 'absolute',
      bottom: 0,
      right: 0,
      flexDirection: 'row',
      gap: SPACE.hair,
      padding: SPACE.hair,
    },
    itemBadge: {
      color: 'white',
      padding: 1,
      borderRadius: 5,
      fontSize: SIZE.label,
      minWidth: 10,
      textAlign: 'center',
      overflow: 'hidden',
      fontFamily: FONT.bold,
    },
    itemBadgeFly: {
      backgroundColor: STATUS.primary,
    },
    itemBadgeRide: {
      backgroundColor: STATUS.danger,
    },
    itemBadgeMega: {
      backgroundColor: '#9b59b6',
    },
    itemBadgeNeon: {
      backgroundColor: STATUS.success,
    },
    // ✅ Favorites row layout styles - matching ValueScreen.js (compact version)
    favoriteRowItem: {
      backgroundColor: isDarkMode ? config.colors.surfaceDark : '#ffffff',
      borderRadius: 6,
      marginHorizontal: SPACE.xs,
      marginBottom: SPACE.xs,
      padding: SPACE.sm,
      shadowColor: c.shadow,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 1,
      position: 'relative',
    },
    favoriteClickableArea: {
      flexDirection: 'row',
      gap: SPACE.sm,
      marginBottom: SPACE.xs,
    },
    favoriteImageContainer: {
      position: 'relative',
    },
    favoriteItemImage: {
      width: 36,
      height: 36,
      borderRadius: 8,
      backgroundColor: isDarkMode ? config.colors.surfaceElevatedDark : '#f8f9fa',
    },
    favoriteItemInfo: {
      flex: 1,
      justifyContent: 'center',
    },
    favoriteItemName: {
      fontSize: SIZE.small,
      fontFamily: FONT.bold,
      color: c.text,
      marginBottom: 1,
      letterSpacing: -0.3,
    },
    favoriteItemValue: {
      fontSize: SIZE.label,
      color: c.text,
      marginBottom: 1,
      fontFamily: FONT.regular,
    },
    favoriteItemRarity: {
      fontSize: SIZE.label,
      color: config.colors.primary,
      fontFamily: FONT.bold,
      textTransform: 'uppercase',
      letterSpacing: 0.3,
    },
    favoriteBadgesContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: SPACE.hair,
      backgroundColor: isDarkMode ? config.colors.surfaceElevatedDark : '#f0f0f0',
      borderRadius: 8,
      padding: SPACE.xs,
      marginTop: SPACE.hair,
    },
    favoriteBadgeButton: {
      paddingVertical: SPACE.xs,
      paddingHorizontal: SPACE.md,
      borderRadius: 8,
      backgroundColor: isDarkMode ? config.colors.surfaceElevatedDark : '#ffffff',
      shadowColor: c.shadow,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 1,
      minWidth: 24,
      alignItems: 'center',
      justifyContent: 'center',
    },
    favoriteBadgeButtonActive: {
      backgroundColor: config.colors.primary,
    },
    favoriteBadgeButtonText: {
      fontSize: SIZE.label,
      fontFamily: FONT.bold,
      color: c.textSecondary,
      textAlign: 'center',
    },
    favoriteBadgeButtonTextActive: {
      color: c.textInverse,
    },
    favoriteDeleteButton: {
      position: 'absolute',
      top: 4,
      right: 4,
      padding: SPACE.hair,
      zIndex: 10,
    },
    favoriteButton: {
      position: 'absolute',
      top: 5,
      right: 5,
      padding: 5,
      borderRadius: 50,
    },
    emptyFavoritesContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: SPACE.xxxl,
      marginTop: 50,
    },
    emptyFavoritesText: {
      fontSize: SIZE.subtitle,
      color: c.textSecondary,
      marginTop: SPACE.lg,
      marginBottom: SPACE.xxxl,
    },
    addToFavoritesButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isDarkMode ? config.colors.surfaceElevatedDark : '#f0f0f0',
      padding: SPACE.lg,
      borderRadius: 8,
      margin: SPACE.lg,
      width: '100%',
    },
    addToFavoritesText: {
      marginLeft: SPACE.md,
      fontSize: SIZE.label,
      color: c.textSecondary,
    },
    favoritesHeader: {
      padding: SPACE.lg,
      alignItems: 'center',
    },
    favoritesTitle: {
      fontSize: SIZE.subtitle,
      fontFamily: FONT.regular,
      color: c.text,
    },
    createtradeAds: {
      paddingHorizontal: SPACE.xxl,
      paddingVertical: SPACE.md,
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },

    removeAdsButton: {
      borderRadius: 999,
      paddingVertical: 5,
      paddingHorizontal: SPACE.lg,
      backgroundColor: STATUS.warning, // warm gold
      shadowColor: c.shadow,
      shadowOpacity: 0.15,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 3 },
      elevation: 4,
      // minWidth:244
      marginTop: SPACE.xxxl

    },

    removeAdsContent: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
    },

    crownWrapper: {
      width: 25,
      height: 25,
      borderRadius: 12,
      backgroundColor: '#fde68a',
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: SPACE.md,
    },

    removeAdsTextWrapper: {
      flexDirection: 'column',
    },

    removeAdsTitle: {
      color: c.text,
      fontSize: SIZE.caption,
      fontFamily: FONT.bold,
    },

    removeAdsSubtitle: {
      color: config.colors.surfaceElevatedDark,
      fontSize: SIZE.label,
      fontFamily: FONT.regular,
      opacity: 0.9,
    },

  });

export default HomeScreen;