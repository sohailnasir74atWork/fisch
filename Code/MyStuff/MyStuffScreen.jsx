import { resolveItem, canTrade, sourceLabel, summarizeItems as summarizeMarketItems } from '../Helper/valueSources';
import { quantityOf } from '../Helper/feedContract';
/**
 * MyStuffScreen — "My Items" + "My Goals" inventory manager
 * Compact 4-col grid for items, intelligent goal cards with progress bars.
 */
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Image, Dimensions, ActivityIndicator, Animated, ScrollView, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import FontAwesome from 'react-native-vector-icons/FontAwesome6';
import {
  doc, onSnapshot, setDoc, serverTimestamp,
  collection, query, orderBy, limit, startAfter, getDocs,
} from '@react-native-firebase/firestore';
import { useGlobalState } from '../GlobelStats';
import { useLocalState } from '../LocalGlobelStats';
import { useThemeColors } from '../Helper/themeColors';
import {
  buildItemPool, unwrapFeed, priceOf, isSummable, DEFAULT_VALUE_SOURCE,
} from '../Helper/valueSources';
import config from '../Helper/Environment';
import PetModal from '../ChatScreen/PrivateChat/PetsModel';
import SignInDrawer from '../Firebase/SigninDrawer';
import { useTranslation } from 'react-i18next';
import { useFocusEffect } from '@react-navigation/native';
import { syncValueAlertTopics } from '../Helper/valueAlerts';
import { getJournalRevision, clearJournal, deleteJournalEntry } from '../Engagement/journalUtils';
import { GAME } from '../config/game';
import { STATUS } from '../Design/tokens';
import { SIZE } from '../Design/tokens';
import { SPACE } from '../Design/tokens';
import { FONT } from '../Design/tokens';

const { width: W } = Dimensions.get('window');
const GRID_COLS = 4;
const CARD_GAP = 8;
const CARD_W = (W - 32 - CARD_GAP * (GRID_COLS - 1)) / GRID_COLS;

const fmt = (v) => {
  if (!v || typeof v !== 'number') return '0';
  const smart = (n, u) => { const s = n.toFixed(1); return (s.endsWith('.0') ? n.toFixed(0) : s) + u; };
  if (v >= 1e9) return smart(v / 1e9, 'B');
  if (v >= 1e6) return smart(v / 1e6, 'M');
  if (v >= 1e3) return smart(v / 1e3, 'K');
  if (v < 1) return v.toLocaleString('en-US', { maximumFractionDigits: 8 });
  return v % 1 === 0 ? v.toLocaleString() : v.toFixed(1);
};

const TABS = [
  { key: 'items',   label: 'My Items',  icon: 'box-open',          emoji: '📦', labelKey: 'mystuff.my_items' },
  { key: 'goals',   label: 'My Goals',  icon: 'bullseye',          emoji: '🎯', labelKey: 'mystuff.my_goals' },
  { key: 'history', label: 'History',   icon: 'clock-rotate-left', emoji: '📋', labelKey: 'mystuff.history' },
];

// Trade-result palette, shared with the calculator's Log Trade flow
const RESULT_META = {
  win:  { emoji: '🏆', label: 'Win',  color: STATUS.success },
  fair: { emoji: '🤝', label: 'Fair', color: STATUS.warning },
  not_evaluated: { emoji: '—', label: 'Not evaluated', color: '#64748b' },
  loss: { emoji: '📉', label: 'Loss', color: STATUS.danger },
};

const HISTORY_PAGE = 15;

const MyStuffScreen = ({ selectedTheme }) => {
  const { user, firestoreDB } = useGlobalState();
  const { localState, updateLocalState } = useLocalState();
  const C = useThemeColors();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();

  const [activeTab, setActiveTab] = useState('items');
  const [ownedPets, setOwnedPets] = useState([]);
  const [wishlistPets, setWishlistPets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [petModalVisible, setPetModalVisible] = useState(false);
  const [petModalOwned, setPetModalOwned] = useState(true);
  const [signinVisible, setSigninVisible] = useState(false);

  // ── Trade history (logged from the calculator) ──
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [historyLastDoc, setHistoryLastDoc] = useState(null);
  const [historyHasMore, setHistoryHasMore] = useState(true);
  const [clearingHistory, setClearingHistory] = useState(false);
  // Journal revision this screen's data was fetched at — see the focus effect
  const historyRevisionRef = useRef(-1);

  // Tab indicator animation
  const tabAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const idx = Math.max(0, TABS.findIndex(tb => tb.key === activeTab));
    Animated.spring(tabAnim, {
      toValue: idx,
      useNativeDriver: true,
      tension: 60,
      friction: 10,
    }).start();
  }, [activeTab]);

  // Load from Firestore
  useEffect(() => {
    if (!user?.id || !firestoreDB) {
      setOwnedPets([]);
      setWishlistPets([]);
      setLoading(false);
      return;
    }

    const userReviewRef = doc(firestoreDB, 'reviews', user.id);
    const unsubscribe = onSnapshot(userReviewRef, (snap) => {
      const data = snap.data();
      const owned = data && Array.isArray(data.ownedPets) ? data.ownedPets : [];
      const wishlist = data && Array.isArray(data.wishlistPets) ? data.wishlistPets : [];
      setOwnedPets(owned);
      setWishlistPets(wishlist);
      // Mirror into localState (MMKV) — the calculator INVENTORY tab and the
      // chat item picker read from there, so all surfaces share ONE list.
      updateLocalState('ownedPets', owned);
      updateLocalState('wishlistPets', wishlist);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user?.id, firestoreDB]);

  // Parse values data for lookups (merge regular + supreme)
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

  /**
   * Is this something the game will actually let you trade?
   *
   * Verified against the wiki's Trading page — fish, bobbers, boats, rod skins,
   * gliders and lanterns only. See Code/config/game.js. Owned rows are slimmed
   * copies that may predate `collection`, so fall back to `type` and finally
   * assume tradeable rather than demoting an item we simply cannot classify.
   */
  const isTradeable = useCallback(item => canTrade(resolveItem(parsedData, item)), [parsedData]);

  // Portfolio stats
  const stats = useMemo(() => {
    const items = activeTab === 'items' ? ownedPets : wishlistPets;
    const total = items.reduce((s, p) => s + lookupVal(p), 0);
    // `tradeable` is what the worth figure is actually built from. Showing only
    // a total next to a raw item count implies every item contributed, so a
    // rod-heavy inventory looked like the app had lost the money.
    const tradeable = items.filter((p) => isTradeable(p)).length;
    return { count: items.length, total, tradeable, gear: items.length - tradeable, incomplete: items.some(p => lookupVal(p) == null) };
  }, [activeTab, ownedPets, wishlistPets, lookupVal, isTradeable]);

  // Goal progress stats
  const goalStats = useMemo(() => {
    if (wishlistPets.length === 0 || ownedPets.length === 0) return { reachable: 0, total: wishlistPets.length };
    const ownedSorted = ownedPets.map(p => lookupVal(p)).sort((a, b) => b - a);
    const bestVal = ownedSorted[0] || 0;
    let reachable = 0;
    wishlistPets.forEach(p => {
      const v = lookupVal(p);
      if (v == null) return false;
      if (v > 0 && bestVal >= v) reachable++;
    });
    return { reachable, total: wishlistPets.length };
  }, [wishlistPets, ownedPets, lookupVal]);

  // Save to Firestore
  const savePetsToReviews = useCallback(async (newOwned, newWishlist) => {
    if (!user?.id || !firestoreDB) return;
    const userReviewRef = doc(firestoreDB, 'reviews', user.id);
    await setDoc(
      userReviewRef,
      { ownedPets: newOwned, wishlistPets: newWishlist, updatedAt: serverTimestamp() },
      { merge: true },
    );
    setOwnedPets(newOwned);
    setWishlistPets(newWishlist);
  }, [user?.id, firestoreDB]);

  // Keep FCM value-alert topics in sync with the portfolio: one topic per
  // owned/wishlist item. Runs on initial Firestore load and after every
  // add/remove (both paths land in these two states). Diffed in MMKV, so
  // repeat renders are no-ops.
  useEffect(() => {
    const names = [...ownedPets, ...wishlistPets].map((p) => p?.name).filter(Boolean);
    syncValueAlertTopics(names);
  }, [ownedPets, wishlistPets]);

  const handleAddItems = useCallback((forOwned) => {
    if (!user?.id) { setSigninVisible(true); return; }
    setPetModalOwned(forOwned);
    setPetModalVisible(true);
  }, [user?.id]);

  // Removal matches the ROW OBJECT, not its position. The displayed list is
  // reordered (tradeable first), so an index from the grid no longer lines up
  // with `ownedPets` — deleting by index would silently remove a different item
  // than the one whose X was tapped.
  const removeOwnedPet = useCallback((row) => {
    const newOwned = ownedPets.filter((p) => p !== row);
    setOwnedPets(newOwned);
    savePetsToReviews(newOwned, wishlistPets);
  }, [ownedPets, wishlistPets, savePetsToReviews]);

  const removeWishlistPet = useCallback((row) => {
    const newWishlist = wishlistPets.filter((p) => p !== row);
    setWishlistPets(newWishlist);
    savePetsToReviews(ownedPets, newWishlist);
  }, [ownedPets, wishlistPets, savePetsToReviews]);

  // Tradeable first, so the things that make up the worth figure lead.
  const currentList = useMemo(() => {
    const base = activeTab === 'items' ? ownedPets : wishlistPets;
    return [...base].sort((a, b) => isTradeable(b) - isTradeable(a));
  }, [activeTab, ownedPets, wishlistPets, isTradeable]);

  // Render compact item card
  const renderItem = useCallback(({ item }) => {
    const val = lookupVal(item);
    const tradeable = isTradeable(item);
    return (
      <View style={[$.card, { backgroundColor: C.bgAlt, borderColor: C.border }]}>
        {/* Remove button */}
        <TouchableOpacity
          onPress={() => removeOwnedPet(item)}
          style={$.cardRemoveBtn}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        >
          <FontAwesome name="xmark" size={9} color="#fff" />
        </TouchableOpacity>
        <Image
          source={{ uri: item.imageUrl || GAME.defaultAvatar }}
          style={$.cardImage}
          resizeMode="contain"
        />
        <Text style={[$.cardName, { color: C.text }]} numberOfLines={1}>
          {item.name || t('mystuff.unknown')}
        </Text>
        {val > 0 ? (
          <View style={[$.cardValueBadge, { backgroundColor: config.colors.primary + '18' }]}>
            <Text style={[$.cardValueText, { color: config.colors.primary }]}>
              {val == null ? 'Unpriced' : sourceLabel(valueSource) + ' ' + fmt(val)}
            </Text>
          </View>
        ) : !tradeable ? (
          // Says WHY there is no figure. "Gear" is a fact about the game — the
          // trade menu refuses these — whereas a blank tile reads as the app
          // failing to find a price that was never going to exist.
          <View style={[$.cardValueBadge, { backgroundColor: C.border }]}>
            <Text style={[$.cardValueText, { color: C.textSecondary }]}>
              {t('mystuff.gear', { defaultValue: 'Gear' })}
            </Text>
          </View>
        ) : null}
      </View>
    );
  }, [lookupVal, valueSource, C, removeOwnedPet]);

  // ── Intelligent Goal Card ──
  const renderGoalCard = useCallback(({ item }) => {
    const petVal = lookupVal(item);
    const ownedSorted = ownedPets.map(p => ({ name: p.name, value: lookupVal(p) }))
      .filter(p => p.value > 0).sort((a, b) => b.value - a.value);
    const bestOwnedValue = ownedSorted.length > 0 ? ownedSorted[0].value : 0;

    // Progress
    const progress = petVal > 0 && bestOwnedValue > 0
      ? Math.min(1, bestOwnedValue / petVal) : 0;
    const canAfford = petVal > 0 && bestOwnedValue >= petVal;
    const pct = Math.round(progress * 100);

    // Difficulty
    let difficulty;
    if (canAfford) {
      difficulty = { label: t('mystuff.reachable'), color: STATUS.success, bg: '#D1FAE5', emoji: '✅' };
    } else if (progress >= 0.7) {
      difficulty = { label: t('mystuff.almost'), color: STATUS.primary, bg: '#DBEAFE', emoji: '🎯' };
    } else if (progress >= 0.3) {
      difficulty = { label: t('mystuff.building'), color: STATUS.warning, bg: '#FEF3C7', emoji: '⚡' };
    } else {
      difficulty = { label: t('mystuff.dreaming'), color: '#94a3b8', bg: '#F1F5F9', emoji: '💭' };
    }

    // Smart tip
    const closestPet = ownedSorted.find(op => op.value >= petVal * 0.7 && op.value <= petVal * 2.5);
    let tip = null;
    if (canAfford && closestPet) {
      tip = { emoji: '🎉', text: t('mystuff.tip_trade', { name: closestPet.name }), color: STATUS.success };
    } else if (closestPet && closestPet.value >= petVal * 0.7 && closestPet.value < petVal) {
      const gap = petVal - closestPet.value;
      tip = { emoji: '🤏', text: t('mystuff.tip_close', { name: closestPet.name, gap: fmt(gap) }), color: STATUS.primary };
    } else if (ownedPets.length === 0) {
      tip = { emoji: '📦', text: t('mystuff.tip_add_first'), color: STATUS.warning };
    } else if (petVal > 0 && bestOwnedValue > 0 && bestOwnedValue < petVal * 0.3) {
      tip = { emoji: '📈', text: t('mystuff.tip_keep_going'), color: STATUS.warning };
    } else if (petVal > 0 && bestOwnedValue >= petVal * 0.3) {
      tip = { emoji: '💪', text: t('mystuff.tip_getting_closer'), color: STATUS.primary };
    }

    return (
      <View style={[$.goalCard, {
        backgroundColor: C.bgAlt,
        borderLeftWidth: 3,
        borderLeftColor: difficulty.color,
      }]}>
        {/* Row: Image + Info + Delete */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.lg }}>
          <Image
            source={{ uri: item.imageUrl || GAME.defaultAvatar }}
            style={$.goalImage}
            resizeMode="contain"
          />
          <View style={{ flex: 1 }}>
            <Text style={[$.goalName, { color: C.text }]} numberOfLines={1}>{item.name || t('mystuff.unknown')}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.xs, marginTop: 3, flexWrap: 'wrap' }}>
              {petVal > 0 && (
                <View style={[$.pill, { backgroundColor: C.bg }]}>
                  <Text style={[$.pillText, { color: STATUS.primary }]}>💎 {petVal == null ? 'Unpriced' : sourceLabel(valueSource) + ' ' + fmt(petVal)}</Text>
                </View>
              )}
              <View style={[$.pill, { backgroundColor: difficulty.bg }]}>
                <Text style={[$.pillText, { color: difficulty.color }]}>{difficulty.emoji} {difficulty.label}</Text>
              </View>
              {petVal > 0 && ownedPets.length > 0 && (
                <View style={[$.pill, { backgroundColor: C.bg }]}>
                  <Text style={[$.pillText, { color: canAfford ? STATUS.success : C.textSecondary }]}>{pct}%</Text>
                </View>
              )}
            </View>
          </View>
          <TouchableOpacity onPress={() => removeWishlistPet(item)} style={{ padding: SPACE.sm }}>
            <FontAwesome name="xmark" size={12} color="#cbd5e1" />
          </TouchableOpacity>
        </View>

        {/* Progress bar */}
        {petVal > 0 && ownedPets.length > 0 && (
          <View style={[$.progressBg, { backgroundColor: C.bg, marginTop: SPACE.md }]}>
            <View style={[$.progressFill, {
              width: `${Math.max(3, pct)}%`,
              backgroundColor: canAfford ? STATUS.success : progress >= 0.7 ? STATUS.primary : '#94a3b8',
            }]} />
          </View>
        )}

        {/* Smart tip */}
        {tip && (
          <Text style={{ fontSize: SIZE.label, color: tip.color, fontFamily: FONT.regular, marginTop: SPACE.sm }}>
            {tip.emoji} {tip.text}
          </Text>
        )}
      </View>
    );
  }, [lookupVal, valueSource, ownedPets, C, removeWishlistPet, t]);

  // ── Trade history: Firestore trade_journal/{uid}/trades, newest first ──
  const fetchHistory = useCallback(async (reset = false) => {
    if (!user?.id || !firestoreDB) { setHistoryLoaded(true); return; }
    if (historyLoading) return;
    setHistoryLoading(true);
    try {
      const base = collection(firestoreDB, 'trade_journal', user.id, 'trades');
      const q = (!reset && historyLastDoc)
        ? query(base, orderBy('createdAt', 'desc'), startAfter(historyLastDoc), limit(HISTORY_PAGE))
        : query(base, orderBy('createdAt', 'desc'), limit(HISTORY_PAGE));
      const snap = await getDocs(q);
      const rows = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      if (reset) historyRevisionRef.current = getJournalRevision();
      setHistory(prev => (reset ? rows : [...prev, ...rows]));
      setHistoryLastDoc(snap.docs.length ? snap.docs[snap.docs.length - 1] : null);
      setHistoryHasMore(snap.docs.length >= HISTORY_PAGE);
    } catch (e) {
      console.warn('[MyStuff] history error:', e?.message);
    } finally {
      setHistoryLoading(false);
      setHistoryLoaded(true);
    }
  }, [user?.id, firestoreDB, historyLastDoc, historyLoading]);

  // Load lazily — only when the tab is first opened
  useEffect(() => {
    if (activeTab === 'history' && !historyLoaded) fetchHistory(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, historyLoaded]);

  const invalidateHistory = useCallback(() => {
    setHistory([]);
    setHistoryLastDoc(null);
    setHistoryHasMore(true);
    setHistoryLoaded(false);
  }, []);

  // Reset when the signed-in user changes
  useEffect(() => { invalidateHistory(); }, [user?.id, invalidateHistory]);

  // Re-fetch on focus ONLY when a trade was actually logged since the last
  // fetch. Blindly invalidating here would re-read 15 docs (and discard any
  // pages already scrolled) every single time this screen regains focus.
  useFocusEffect(useCallback(() => {
    if (getJournalRevision() !== historyRevisionRef.current) invalidateHistory();
  }, [invalidateHistory]));

  const historyStats = useMemo(() => {
    const s = { total: history.length, win: 0, fair: 0, loss: 0, given: 0, received: 0 };
    history.forEach(h => {
      if (h.valuation?.version !== 2) return;
      if (s[h.result] !== undefined) s[h.result]++;
      if (h.valuation.scale !== valueSource || h.valuation.evaluation.status !== 'complete') return;
      s.given += Number(h.givenValue) || 0;
      s.received += Number(h.receivedValue) || 0;
    });
    s.net = s.received - s.given;
    return s;
  }, [history, valueSource]);

  // Remove a single logged trade. Optimistic: the row disappears immediately
  // and is restored if the delete fails, so the list never lies about what's
  // actually stored.
  const handleDeleteEntry = useCallback((entry) => {
    if (!user?.id || !firestoreDB || !entry?.id) return;
    Alert.alert(
      t('mystuff.delete_entry_title', { defaultValue: 'Delete this trade?' }),
      t('mystuff.delete_entry_msg', { defaultValue: 'It will be removed from your history. This cannot be undone.' }),
      [
        { text: t('mystuff.cancel', { defaultValue: 'Cancel' }), style: 'cancel' },
        {
          text: t('mystuff.delete', { defaultValue: 'Delete' }),
          style: 'destructive',
          onPress: async () => {
            const snapshot = history;
            setHistory(prev => prev.filter(h => h.id !== entry.id));
            try {
              await deleteJournalEntry(firestoreDB, user.id, entry.id);
              historyRevisionRef.current = getJournalRevision();
            } catch (e) {
              console.warn('[MyStuff] delete entry error:', e?.message);
              setHistory(snapshot); // put it back — the delete didn't happen
              Alert.alert(t('mystuff.delete_failed', { defaultValue: 'Could not delete that trade' }), e?.message || '');
            }
          },
        },
      ],
    );
  }, [user?.id, firestoreDB, history, t]);

  // Destructive and irreversible — always confirm, and name the count so the
  // user knows exactly what they're about to lose.
  const handleClearHistory = useCallback(() => {
    if (!user?.id || !firestoreDB || clearingHistory) return;
    Alert.alert(
      t('mystuff.clear_history_title', { defaultValue: 'Clear trade history?' }),
      t('mystuff.clear_history_msg', {
        defaultValue: 'This permanently deletes every logged trade. Your items and goals are not affected. This cannot be undone.',
      }),
      [
        { text: t('mystuff.cancel', { defaultValue: 'Cancel' }), style: 'cancel' },
        {
          text: t('mystuff.clear_history', { defaultValue: 'Clear History' }),
          style: 'destructive',
          onPress: async () => {
            setClearingHistory(true);
            try {
              await clearJournal(firestoreDB, user.id);
              setHistory([]);
              setHistoryLastDoc(null);
              setHistoryHasMore(false);
              historyRevisionRef.current = getJournalRevision();
            } catch (e) {
              console.warn('[MyStuff] clear history error:', e?.message);
              Alert.alert(
                t('mystuff.clear_failed', { defaultValue: 'Could not clear history' }),
                e?.message || ''
              );
            } finally {
              setClearingHistory(false);
            }
          },
        },
      ],
    );
  }, [user?.id, firestoreDB, clearingHistory, t]);

  // Stats panel above the timeline — result mix, win rate, value flow.
  // Reflects the rows loaded so far, so it grows as more pages are pulled in.
  const historyHeader = useMemo(() => {
    const { total, win, fair, loss, given, received, net } = historyStats;
    if (!total) return null;
    const winRate = Math.round((win / total) * 100);
    const legend = [
      { key: 'win', n: win, color: RESULT_META.win.color, label: t('mystuff.wins', { defaultValue: 'Wins' }) },
      { key: 'fair', n: fair, color: RESULT_META.fair.color, label: t('mystuff.fair', { defaultValue: 'Fair' }) },
      { key: 'loss', n: loss, color: RESULT_META.loss.color, label: t('mystuff.losses', { defaultValue: 'Losses' }) },
    ];

    return (
      <View style={[$.statsPanel, { backgroundColor: C.bgAlt, borderColor: C.border }]}>
        <View style={$.statsTopRow}>
          <Text style={[$.statsTitle, { color: C.text }]}>
            📊 {t('mystuff.trade_results', { defaultValue: 'Trade Results' })}
          </Text>
          <Text style={[$.winRate, { color: config.colors.primary }]}>
            {winRate}% {t('mystuff.win_rate', { defaultValue: 'win rate' })}
          </Text>
        </View>

        {/* Stacked result bar — segments sized by share of trades */}
        <View style={[$.resultBar, { backgroundColor: C.border }]}>
          {legend.map(seg => seg.n > 0 && (
            <View key={seg.key} style={{ flex: seg.n, backgroundColor: seg.color }} />
          ))}
        </View>

        <View style={$.legendRow}>
          {legend.map(seg => (
            <View key={seg.key} style={$.legendItem}>
              <View style={[$.legendDot, { backgroundColor: seg.color }]} />
              <Text style={[$.legendText, { color: C.textSecondary }]}>{seg.label} {seg.n}</Text>
            </View>
          ))}
        </View>

        <View style={[$.statsDivider, { backgroundColor: C.border }]} />

        <Text style={[$.statsFootnote, { color: C.textSecondary }]}>Complete market estimates on {sourceLabel(valueSource)} only.</Text>
        <View style={$.statsValueRow}>
          <Text style={[$.statsValueLabel, { color: C.textSecondary }]}>{t('mystuff.value_given', { defaultValue: 'Value Given' })}</Text>
          <Text style={[$.statsValueNum, { color: STATUS.danger }]}>{sourceLabel(valueSource)} {fmt(given)}</Text>
        </View>
        <View style={$.statsValueRow}>
          <Text style={[$.statsValueLabel, { color: C.textSecondary }]}>{t('mystuff.value_received', { defaultValue: 'Value Received' })}</Text>
          <Text style={[$.statsValueNum, { color: STATUS.success }]}>{sourceLabel(valueSource)} {fmt(received)}</Text>
        </View>
        <View style={$.statsValueRow}>
          <Text style={[$.statsValueLabel, { color: C.text, fontFamily: FONT.bold }]}>{t('mystuff.net', { defaultValue: 'Net' })}</Text>
          <Text style={[$.statsValueNum, { color: net >= 0 ? STATUS.success : STATUS.danger, fontFamily: FONT.bold }]}>
            {sourceLabel(valueSource)} {net >= 0 ? '+' : '−'}{fmt(Math.abs(net))}
          </Text>
        </View>

        {historyHasMore && (
          <Text style={[$.statsFootnote, { color: C.textSecondary }]}>
            {t('mystuff.stats_partial', { defaultValue: 'Based on trades loaded so far — scroll for more.' })}
          </Text>
        )}

        <TouchableOpacity
          style={[$.clearBtn, { borderColor: '#EF444455' }]}
          onPress={handleClearHistory}
          disabled={clearingHistory}
          activeOpacity={0.7}
        >
          {clearingHistory
            ? <ActivityIndicator size="small" color={STATUS.danger} />
            : (
              <>
                <FontAwesome name="trash-can" size={11} color={STATUS.danger} solid />
                <Text style={$.clearBtnText}>
                  {t('mystuff.clear_history', { defaultValue: 'Clear History' })}
                </Text>
              </>
            )}
        </TouchableOpacity>
      </View>
    );
  }, [historyStats, historyHasMore, valueSource, C, t, handleClearHistory, clearingHistory]);

  const renderHistoryCard = useCallback(({ item }) => {
    const meta = item.valuation?.version === 2 ? RESULT_META[item.result] || RESULT_META.not_evaluated : RESULT_META.not_evaluated;
    const date = item.createdAt?.toDate
      ? item.createdAt.toDate().toLocaleDateString()
      : '';
    return (
      <View style={[$.histCard, { backgroundColor: C.bgAlt, borderLeftColor: meta.color }]}>
        <View style={$.histTop}>
          <View style={[$.histBadge, { backgroundColor: meta.color + '1F' }]}>
            <Text style={{ fontSize: SIZE.small }}>{meta.emoji}</Text>
            <Text style={[$.histBadgeText, { color: meta.color }]}>{meta.label}</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.lg }}>
            <Text style={[$.histDate, { color: C.textSecondary }]}>{date}</Text>
            <TouchableOpacity
              onPress={() => handleDeleteEntry(item)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <FontAwesome name="trash-can" size={12} color={C.textSecondary} solid />
            </TouchableOpacity>
          </View>
        </View>

        <View style={$.histBody}>
          <View style={{ flex: 1 }}>
            <Text style={[$.histSideLabel, { color: C.textSecondary }]}>{t('mystuff.gave', { defaultValue: 'Gave' })}</Text>
            <Text style={[$.histItems, { color: C.text }]} numberOfLines={2}>{item.given || '—'}</Text>
            <Text style={[$.histValue, { color: STATUS.danger }]}>{item.valuation?.version === 2 ? item.valuation.unit + ' ' + fmt(item.givenValue) + (item.valuation.has.complete ? '' : ' subtotal') : '—'}</Text>
          </View>
          <FontAwesome name="right-left" size={12} color={C.textSecondary} solid style={{ alignSelf: 'center', marginHorizontal: SPACE.md }} />
          <View style={{ flex: 1 }}>
            <Text style={[$.histSideLabel, { color: C.textSecondary }]}>{t('mystuff.got', { defaultValue: 'Got' })}</Text>
            <Text style={[$.histItems, { color: C.text }]} numberOfLines={2}>{item.received || '—'}</Text>
            <Text style={[$.histValue, { color: STATUS.success }]}>{item.valuation?.version === 2 ? item.valuation.unit + ' ' + fmt(item.receivedValue) + (item.valuation.wants.complete ? '' : ' subtotal') : '—'}</Text>
          </View>
        </View>

        {!!item.userRating && <Text style={[$.histNote, { color: C.textSecondary }]}>Your rating: {item.userRating}</Text>}
        {!!item.note && (
          <Text style={[$.histNote, { color: C.textSecondary }]} numberOfLines={2}>📝 {item.note}</Text>
        )}
      </View>
    );
  }, [C, t, handleDeleteEntry]);

  const tabWidth = (W - 32) / TABS.length;
  const indicatorTranslateX = tabAnim.interpolate({
    inputRange: TABS.map((_, i) => i),
    outputRange: TABS.map((_, i) => i * tabWidth),
  });

  if (loading) {
    return (
      <View style={[$.root, { backgroundColor: C.bg }]}>
        <ActivityIndicator size="large" color={config.colors.primary} style={{ marginTop: 80 }} />
      </View>
    );
  }

  return (
    <View style={[$.root, { backgroundColor: C.bg }]}>
      {/* Portfolio Summary Card — on History it summarizes logged trades */}
      {activeTab === 'history' ? (
        <View style={[$.summaryCard, { backgroundColor: C.bgAlt, borderColor: C.border }]}>
          <View style={$.summaryLeft}>
            <Text style={[$.summaryLabel, { color: C.textSecondary }]}>
              {t('mystuff.net_gain', { defaultValue: 'Net Gain' })}
            </Text>
            <Text style={[$.summaryValue, { color: historyStats.net >= 0 ? STATUS.success : STATUS.danger }]}>
              {historyStats.net >= 0 ? '+' : '−'}{fmt(Math.abs(historyStats.net))}
            </Text>
          </View>
          <View style={[$.summaryDivider, { backgroundColor: C.border }]} />
          <View style={$.summaryRight}>
            <Text style={[$.summaryLabel, { color: C.textSecondary }]}>
              {t('mystuff.record', { defaultValue: 'W / F / L' })}
            </Text>
            <Text style={[$.summaryCount, { color: C.text }]}>
              {historyStats.win}/{historyStats.fair}/{historyStats.loss}
            </Text>
          </View>
        </View>
      ) : (
        <View style={[$.summaryCard, { backgroundColor: C.bgAlt, borderColor: C.border }]}>
          <View style={$.summaryLeft}>
            <Text style={[$.summaryLabel, { color: C.textSecondary }]}>
              {activeTab === 'items' ? t('mystuff.inventory_value') : t('mystuff.goals_value')}
            </Text>
            <Text style={[$.summaryValue, { color: C.text }]}>
              {sourceLabel(valueSource)} {stats.total.toLocaleString('en-US', { maximumFractionDigits: 8 })}{stats.incomplete ? ' · subtotal' : ''}
            </Text>
          </View>
          <View style={[$.summaryDivider, { backgroundColor: C.border }]} />
          <View style={$.summaryRight}>
            <Text style={[$.summaryLabel, { color: C.textSecondary }]}>
              {activeTab === 'goals' ? t('mystuff.reachable_label') : t('mystuff.items_count')}
            </Text>
            <Text style={[$.summaryCount, { color: C.text }]}>
              {activeTab === 'goals'
                ? `${goalStats.reachable}/${goalStats.total}`
                : stats.count}
            </Text>
            {activeTab !== 'goals' && stats.gear > 0 && (
              <Text style={[$.summaryLabel, { color: C.textSecondary, marginTop: 1 }]}>
                {t('mystuff.gear_count', {
                  defaultValue: '{{n}} gear, not tradeable',
                  n: stats.gear,
                })}
              </Text>
            )}
          </View>
        </View>
      )}

      {/* Tab Switcher */}
      <View style={[$.tabBar, { backgroundColor: C.bgAlt, borderColor: C.border }]}>
        <Animated.View
          style={[
            $.tabIndicator,
            {
              width: tabWidth,
              backgroundColor: config.colors.primary + '18',
              borderColor: config.colors.primary + '40',
              transform: [{ translateX: indicatorTranslateX }],
            },
          ]}
        />
        {TABS.map((tab) => {
          const active = activeTab === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              style={$.tabBtn}
              onPress={() => setActiveTab(tab.key)}
              activeOpacity={0.7}
            >
              <Text style={{ fontSize: SIZE.subtitle }}>{tab.emoji}</Text>
              <Text
                style={[
                  $.tabLabel,
                  { color: active ? config.colors.primary : C.textSecondary },
                  active && { fontFamily: FONT.bold },
                ]}
              >
                {t(tab.labelKey, { defaultValue: tab.label })}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ── HISTORY TAB ── */}
      {activeTab === 'history' && (
        historyLoading && history.length === 0 ? (
          <ActivityIndicator size="large" color={config.colors.primary} style={{ marginTop: 60 }} />
        ) : history.length === 0 ? (
          <View style={$.emptyWrap}>
            <Text style={{ fontSize: 48, marginBottom: SPACE.xl }}>📋</Text>
            <Text style={[$.emptyTitle, { color: C.text }]}>
              {t('mystuff.no_history_yet', { defaultValue: 'No trades logged yet' })}
            </Text>
            <Text style={[$.emptySubtitle, { color: C.textSecondary }]}>
              {user?.id
                ? t('mystuff.history_desc', { defaultValue: 'Calculate a trade, then tap "Log Trade" to record it here.' })
                : t('mystuff.sign_in_desc')}
            </Text>
          </View>
        ) : (
          <FlatList
            key="history-list"
            data={history}
            keyExtractor={(item, i) => `hist-${item.id || i}`}
            renderItem={renderHistoryCard}
            contentContainerStyle={{ paddingHorizontal: SPACE.xxl, paddingTop: SPACE.md, paddingBottom: 180 }}
            showsVerticalScrollIndicator={false}
            onEndReachedThreshold={0.5}
            onEndReached={() => { if (historyHasMore && !historyLoading) fetchHistory(false); }}
            ListHeaderComponent={historyHeader}
            ListFooterComponent={
              historyLoading && history.length > 0
                ? <ActivityIndicator color={config.colors.primary} style={{ marginVertical: SPACE.xxl }} />
                : null
            }
          />
        )
      )}

      {/* ── ITEMS TAB ── */}
      {activeTab === 'items' && (
        currentList.length === 0 ? (
          <View style={$.emptyWrap}>
            <Text style={{ fontSize: 48, marginBottom: SPACE.xl }}>📦</Text>
            <Text style={[$.emptyTitle, { color: C.text }]}>
              {t('mystuff.no_items_yet')}
            </Text>
            <Text style={[$.emptySubtitle, { color: C.textSecondary }]}>
              {user?.id ? t('mystuff.add_items_desc') : t('mystuff.sign_in_desc')}
            </Text>
            <TouchableOpacity
              style={[$.addBtn, { backgroundColor: config.colors.primary }]}
              onPress={() => handleAddItems(true)}
              activeOpacity={0.8}
            >
              <FontAwesome name="plus" size={14} color="#fff" solid />
              <Text style={$.addBtnText}>
                {user?.id ? t('mystuff.add_items') : t('mystuff.sign_in')}
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            key="items-grid"
            data={currentList}
            keyExtractor={(item, i) => `${item.id || item.name || i}-${i}`}
            renderItem={renderItem}
            numColumns={GRID_COLS}
            columnWrapperStyle={$.gridRow}
            contentContainerStyle={{ paddingHorizontal: SPACE.xxl, paddingTop: SPACE.md, paddingBottom: 180 }}
            showsVerticalScrollIndicator={false}
            ListHeaderComponent={
              <TouchableOpacity
                style={[$.addBarBtn, { borderColor: config.colors.primary + '50' }]}
                onPress={() => handleAddItems(true)}
                activeOpacity={0.7}
              >
                <FontAwesome name="pen-to-square" size={12} color={config.colors.primary} solid />
                <Text style={[$.addBarText, { color: config.colors.primary }]}>
                  {t('mystuff.edit_items')}
                </Text>
              </TouchableOpacity>
            }
          />
        )
      )}

      {/* ── GOALS TAB ── */}
      {activeTab === 'goals' && (
        wishlistPets.length === 0 ? (
          <View style={$.emptyWrap}>
            <Text style={{ fontSize: 48, marginBottom: SPACE.xl }}>🎯</Text>
            <Text style={[$.emptyTitle, { color: C.text }]}>
              {t('mystuff.no_goals_yet')}
            </Text>
            <Text style={[$.emptySubtitle, { color: C.textSecondary }]}>
              {user?.id ? t('mystuff.add_goals_desc') : t('mystuff.sign_in_desc')}
            </Text>
            <TouchableOpacity
              style={[$.addBtn, { backgroundColor: STATUS.warning }]}
              onPress={() => handleAddItems(false)}
              activeOpacity={0.8}
            >
              <FontAwesome name="plus" size={14} color="#fff" solid />
              <Text style={$.addBtnText}>
                {user?.id ? t('mystuff.add_items') : t('mystuff.sign_in')}
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            key="goals-list"
            data={wishlistPets}
            keyExtractor={(item, i) => `goal-${item.name || i}-${i}`}
            renderItem={renderGoalCard}
            contentContainerStyle={{ paddingHorizontal: SPACE.xxl, paddingTop: SPACE.md, paddingBottom: 180 }}
            showsVerticalScrollIndicator={false}
            ListHeaderComponent={
              <TouchableOpacity
                style={[$.addBarBtn, { borderColor: '#F59E0B50' }]}
                onPress={() => handleAddItems(false)}
                activeOpacity={0.7}
              >
                <FontAwesome name="pen-to-square" size={12} color={STATUS.warning} solid />
                <Text style={[$.addBarText, { color: STATUS.warning }]}>
                  {t('mystuff.edit_goals')}
                </Text>
              </TouchableOpacity>
            }
          />
        )
      )}

      {/* PetModal */}
      <PetModal
        fromSetting={true}
        ownedPets={ownedPets}
        setOwnedPets={setOwnedPets}
        wishlistPets={wishlistPets}
        setWishlistPets={setWishlistPets}
        onClose={async () => {
          setPetModalVisible(false);
          await savePetsToReviews(ownedPets, wishlistPets);
        }}
        visible={petModalVisible}
        owned={petModalOwned}
      />

      {/* Sign In Drawer */}
      <SignInDrawer
        visible={signinVisible}
        onClose={() => setSigninVisible(false)}
        selectedTheme={selectedTheme}
        screen="MyStuff"
        message={t('mystuff.sign_in_manage')}
      />
    </View>
  );
};

const $ = StyleSheet.create({
  root: { flex: 1 },

  // Summary Card
  summaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: SPACE.xxl,
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginTop: SPACE.md,
    marginBottom: SPACE.lg,
  },
  summaryLeft: { flex: 1 },
  summaryRight: { alignItems: 'center', paddingLeft: SPACE.xxl },
  summaryDivider: { width: 1, height: 32, marginHorizontal: 0 },
  summaryLabel: { fontSize: SIZE.label, fontFamily: FONT.regular, marginBottom: 3, textTransform: 'uppercase', letterSpacing: 0.5 },
  summaryValue: { fontSize: SIZE.heading, fontFamily: FONT.bold },
  summaryCount: { fontSize: SIZE.heading, fontFamily: FONT.bold },

  // Tab Bar
  tabBar: {
    flexDirection: 'row',
    marginHorizontal: SPACE.xxl,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
    marginBottom: SPACE.xs,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACE.lg,
    gap: SPACE.sm,
    zIndex: 2,
  },
  tabLabel: { fontSize: SIZE.caption, fontFamily: FONT.bold },
  tabIndicator: {
    position: 'absolute',
    top: 2,
    bottom: 2,
    left: 2,
    borderRadius: 10,
    borderWidth: 1.5,
    zIndex: 1,
  },

  // Grid — compact 4-col
  gridRow: { gap: CARD_GAP, marginBottom: CARD_GAP },
  card: {
    width: CARD_W,
    borderRadius: 10,
    borderWidth: 1,
    padding: SPACE.sm,
    alignItems: 'center',
    position: 'relative',
  },
  cardRemoveBtn: {
    position: 'absolute',
    top: 4,
    right: 4,
    zIndex: 5,
    backgroundColor: STATUS.danger,
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardImage: {
    width: CARD_W - 20,
    height: CARD_W - 20,
    borderRadius: 8,
    marginBottom: SPACE.xs,
  },
  cardName: {
    fontSize: SIZE.label,
    fontFamily: FONT.bold,
    textAlign: 'center',
    marginBottom: SPACE.hair,
  },
  cardValueBadge: {
    paddingHorizontal: SPACE.sm,
    paddingVertical: SPACE.hair,
    borderRadius: 6,
  },
  cardValueText: {
    fontSize: SIZE.label,
    fontFamily: FONT.bold,
  },

  // Goal Card
  // Trade history stats panel
  statsPanel: { borderRadius: 12, borderWidth: 1, padding: 14, marginBottom: SPACE.xl },
  statsTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACE.lg },
  statsTitle: { fontSize: SIZE.caption, fontFamily: FONT.bold },
  winRate: { fontSize: SIZE.caption, fontFamily: FONT.bold },
  resultBar: { flexDirection: 'row', height: 8, borderRadius: 4, overflow: 'hidden' },
  legendRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.xl, marginTop: SPACE.md },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: SIZE.label, fontFamily: FONT.regular },
  statsDivider: { height: StyleSheet.hairlineWidth, marginVertical: SPACE.xl },
  statsValueRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 3 },
  statsValueLabel: { fontSize: SIZE.small, fontFamily: FONT.regular },
  statsValueNum: { fontSize: SIZE.caption, fontFamily: FONT.bold },
  statsFootnote: { fontSize: SIZE.label, fontFamily: FONT.regular, marginTop: SPACE.lg, fontStyle: 'italic' },
  clearBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACE.sm,
    marginTop: 14, paddingVertical: 9,
    borderRadius: 10, borderWidth: 1,
  },
  clearBtnText: { fontSize: SIZE.small, fontFamily: FONT.bold, color: STATUS.danger },

  // Trade history rows — left rail coloured by result, matching goalCard metrics
  histCard: {
    borderRadius: 12,
    padding: SPACE.xl,
    marginBottom: SPACE.md,
    borderLeftWidth: 3,
  },
  histTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACE.md },
  histBadge: { flexDirection: 'row', alignItems: 'center', gap: SPACE.xs, paddingHorizontal: SPACE.md, paddingVertical: 3, borderRadius: 8 },
  histBadgeText: { fontSize: SIZE.label, fontFamily: FONT.bold },
  histDate: { fontSize: SIZE.label, fontFamily: FONT.regular },
  histBody: { flexDirection: 'row', alignItems: 'flex-start' },
  histSideLabel: { fontSize: SIZE.label, fontFamily: FONT.bold, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: SPACE.hair },
  histItems: { fontSize: SIZE.caption, fontFamily: FONT.regular, lineHeight: 16 },
  histValue: { fontSize: SIZE.caption, fontFamily: FONT.bold, marginTop: 3 },
  histNote: { fontSize: SIZE.small, fontFamily: FONT.regular, marginTop: SPACE.md, fontStyle: 'italic' },

  goalCard: {
    borderRadius: 12,
    padding: SPACE.xl,
    marginBottom: SPACE.md,
  },
  goalImage: {
    width: 40,
    height: 40,
    borderRadius: 10,
  },
  goalName: {
    fontSize: SIZE.caption,
    fontFamily: FONT.bold,
  },
  pill: {
    paddingHorizontal: SPACE.sm,
    paddingVertical: SPACE.hair,
    borderRadius: 6,
  },
  pillText: {
    fontSize: SIZE.label,
    fontFamily: FONT.bold,
  },
  progressBg: {
    height: 4,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: 4,
    borderRadius: 3,
  },

  // Empty
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    paddingBottom: 80,
  },
  emptyTitle: { fontSize: SIZE.subtitle, fontFamily: FONT.bold, marginBottom: SPACE.sm },
  emptySubtitle: { fontSize: SIZE.caption, fontFamily: FONT.regular, textAlign: 'center', lineHeight: 18, marginBottom: SPACE.xxxl },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.md,
    paddingHorizontal: SPACE.huge,
    paddingVertical: SPACE.xl,
    borderRadius: 12,
  },
  addBtnText: { color: '#fff', fontSize: SIZE.body, fontFamily: FONT.bold },

  // Add bar
  addBarBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACE.md,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderRadius: 10,
    paddingVertical: SPACE.md,
    marginBottom: SPACE.md,
  },
  addBarText: { fontSize: SIZE.caption, fontFamily: FONT.bold },
});

export default MyStuffScreen;
