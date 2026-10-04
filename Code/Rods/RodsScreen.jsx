/**
 * RodsScreen — compare all 262 rods on the stats that decide a purchase.
 *
 * Why this screen exists: "fisch rods" and rod-name queries are ~32% of all
 * Fisch search demand, and no values app has a rod screen. The data has been
 * sitting in our feed since the first build — every rod carries luck, lure,
 * control, resilience, line distance and max weight at 100% coverage.
 *
 * It deliberately does NOT show a price. Rods are not priced by the community
 * (all 666 community quotes sit in cosmetics; rods have exactly one), so a
 * "value" column would be an invention. Stats are the game's own numbers and
 * are what the question "which rod is better" actually turns on.
 */
import React, { useMemo, useState, useCallback } from 'react';
import {
  View, Text, TextInput, FlatList, TouchableOpacity, Image,
  StyleSheet, ScrollView,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useLocalState } from '../LocalGlobelStats';
import { useUI } from '../Design/ui';
import { SPACE, SIZE, TYPE, RADIUS, SHADOW, STATUS } from '../Design/tokens';
import { unwrapFeed, resolveItemImage } from '../Helper/valueSources';
import { FONT } from '../Design/tokens';

/**
 * The six stats every rod carries. `key` is the feed field, `higherIsBetter`
 * drives both the sort direction and the "best" highlight.
 *
 * max_weight arrives as a formatted string ("300,000"), so it needs parsing
 * before it can be compared — sorting it as text puts "90" above "300,000".
 */
const STATS = [
  { key: 'luck', label: 'Luck', hint: 'Chance of rarer fish', higherIsBetter: true },
  { key: 'lure', label: 'Lure', hint: 'Bite speed', higherIsBetter: true },
  { key: 'control', label: 'Control', hint: 'Bar steadiness', higherIsBetter: true },
  { key: 'resilience', label: 'Resil.', hint: 'Bar damage resistance', higherIsBetter: true },
  { key: 'line_dist', label: 'Distance', hint: 'Cast range', higherIsBetter: true },
  { key: 'max_weight', label: 'Max kg', hint: 'Heaviest catch it can land', higherIsBetter: true },
];

/** "300,000" -> 300000. Returns null for genuinely absent values, not 0. */
const num = (v) => {
  if (v == null || v === '') return null;
  const n = Number(String(v).replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
};

/**
 * Compact stat display across the real range, which is far wider than it looks:
 * rod stats run from -1e21 to 1e21 because joke and admin rods (Dave Rod, Tryhard
 * Rod) carry absurd numbers. A naive "divide by 1e6 and add M" renders 1e18 as
 * "1000000000000.0M", which wraps the row onto two lines and means nothing.
 * Past a trillion, exponential is both shorter and more honest.
 *
 * Control is fractional (0.22, -0.37) and must survive without being rounded to 0.
 */
const UNITS = [
  { at: 1e12, suffix: 'T' },
  { at: 1e9, suffix: 'B' },
  { at: 1e6, suffix: 'M' },
  { at: 1e3, suffix: 'K' },
];

const fmt = (v) => {
  const n = num(v);
  if (n == null) return '—';
  const abs = Math.abs(n);
  if (abs >= 1e15) return n.toExponential(0).replace('e+', 'e');
  for (const u of UNITS) {
    if (abs >= u.at) {
      const scaled = n / u.at;
      return `${Number(scaled.toFixed(Math.abs(scaled) >= 100 ? 0 : 1))}${u.suffix}`;
    }
  }
  return n % 1 === 0 ? n.toLocaleString('en-US') : String(n);
};

const RodsScreen = () => {
  const ui = useUI();
  const c = ui.c;
  const { localState } = useLocalState();

  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState('luck');
  const [compare, setCompare] = useState([]); // up to two page_ids

  const rods = useMemo(() => {
    const parse = (raw) => {
      try {
        if (!raw) return null;
        const p = typeof raw === 'string' ? JSON.parse(raw) : raw;
        return p && typeof p === 'object' ? unwrapFeed(p) : null;
      } catch { return null; }
    };
    const feed = parse(localState.data);
    const list = Array.isArray(feed?.rods) ? feed.rods : [];
    // Tag with `collection` so resolveItemImage and the rest of the app treat
    // these rows exactly like any other item.
    return list.map((r) => ({ ...r, collection: 'rods' }));
  }, [localState.data]);

  /** Best value per stat, for the "best in game" highlight. */
  const best = useMemo(() => {
    const out = {};
    for (const s of STATS) {
      let top = null;
      for (const r of rods) {
        const n = num(r[s.key]);
        if (n == null) continue;
        if (top == null || n > top) top = n;
      }
      out[s.key] = top;
    }
    return out;
  }, [rods]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = q ? rods.filter((r) => r.name?.toLowerCase().includes(q)) : rods;
    // Rods missing the sorted stat sink to the bottom rather than sorting as 0,
    // which would otherwise bury good rods that simply lack one number.
    return [...filtered].sort((a, b) => {
      const av = num(a[sortKey]);
      const bv = num(b[sortKey]);
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      return bv - av;
    });
  }, [rods, search, sortKey]);

  const toggleCompare = useCallback((rod) => {
    setCompare((prev) => {
      const id = rod.page_id;
      if (prev.some((r) => r.page_id === id)) return prev.filter((r) => r.page_id !== id);
      // Two is the useful number — three columns of six stats stops being
      // readable on a phone.
      return prev.length >= 2 ? [prev[1], rod] : [...prev, rod];
    });
  }, []);

  const s = useMemo(() => makeStyles(c), [c]);

  const renderRod = useCallback(({ item }) => {
    const picked = compare.some((r) => r.page_id === item.page_id);
    return (
      <TouchableOpacity
        style={[s.row, picked && s.rowPicked]}
        onPress={() => toggleCompare(item)}
        activeOpacity={0.7}
      >
        <Image source={{ uri: resolveItemImage(item) }} style={s.icon} resizeMode="contain" />
        <View style={s.rowBody}>
          <Text style={s.rodName} numberOfLines={1}>{item.name}</Text>
          <View style={s.statLine}>
            {STATS.map((st) => {
              const v = num(item[st.key]);
              const isBest = v != null && v === best[st.key];
              const isSorted = st.key === sortKey;
              return (
                <View key={st.key} style={s.statCell}>
                  <Text style={[s.statLabel, isSorted && s.statLabelActive]}>{st.label}</Text>
                  <Text
                    style={[
                      s.statValue,
                      isSorted && s.statValueActive,
                      isBest && s.statValueBest,
                    ]}
                  >
                    {fmt(item[st.key])}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>
        <Icon
          name={picked ? 'checkmark-circle' : 'ellipse-outline'}
          size={SIZE.subtitle}
          color={picked ? c.primary : c.textMuted}
        />
      </TouchableOpacity>
    );
  }, [compare, best, sortKey, c, s, toggleCompare]);

  return (
    <View style={ui.screen}>
      {/* Search */}
      <View style={s.searchWrap}>
        <Icon name="search" size={SIZE.body} color={c.textMuted} />
        <TextInput
          style={s.search}
          placeholder="Search 262 rods…"
          placeholderTextColor={c.textMuted}
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Icon name="close-circle" size={SIZE.body} color={c.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {/* Sort selector — doubles as the legend for what each column means */}
      {/* flexGrow/flexShrink 0 is load-bearing: a horizontal ScrollView inside a
          flex column otherwise negotiates for the remaining height, and when the
          compare tray mounts it gets squeezed to a sliver — the chips kept their
          pill backgrounds but clipped their labels away entirely. */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={s.sortScroll}
        contentContainerStyle={s.sortRow}
      >
        {STATS.map((st) => (
          <TouchableOpacity
            key={st.key}
            style={[s.sortChip, sortKey === st.key && s.sortChipActive]}
            onPress={() => setSortKey(st.key)}
            activeOpacity={0.8}
          >
            <Text style={[s.sortChipText, sortKey === st.key && s.sortChipTextActive]}>
              {st.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      <Text style={s.hint}>
        {STATS.find((x) => x.key === sortKey)?.hint} · tap rods to compare
      </Text>

      {/* Compare tray */}
      {compare.length > 0 && (
        <View style={s.compare}>
          <View style={s.compareHead}>
            <Text style={s.compareTitle}>
              {compare.length === 1 ? 'Pick one more to compare' : 'Head to head'}
            </Text>
            <TouchableOpacity onPress={() => setCompare([])}>
              <Text style={s.clear}>Clear</Text>
            </TouchableOpacity>
          </View>

          <View style={s.compareNames}>
            <View style={s.compareCol}>
              <Text style={s.compareName} numberOfLines={2}>{compare[0]?.name}</Text>
            </View>
            <View style={s.compareMid} />
            <View style={s.compareCol}>
              <Text style={s.compareName} numberOfLines={2}>
                {compare[1]?.name || '—'}
              </Text>
            </View>
          </View>

          {compare.length === 2 && STATS.map((st) => {
            const a = num(compare[0][st.key]);
            const b = num(compare[1][st.key]);
            // A missing stat is not a loss — neither side wins the row.
            const aWins = a != null && b != null && a > b;
            const bWins = a != null && b != null && b > a;
            return (
              <View key={st.key} style={s.compareRow}>
                <Text style={[s.compareVal, aWins && s.compareWin]}>{fmt(compare[0][st.key])}</Text>
                <Text style={s.compareLabel}>{st.label}</Text>
                <Text style={[s.compareVal, bWins && s.compareWin]}>{fmt(compare[1][st.key])}</Text>
              </View>
            );
          })}
        </View>
      )}

      <FlatList
        data={visible}
        keyExtractor={(item) => String(item.page_id)}
        renderItem={renderRod}
        contentContainerStyle={s.list}
        initialNumToRender={12}
        windowSize={10}
        removeClippedSubviews={false}
        ListEmptyComponent={
          <View style={ui.emptyContainer}>
            <Text style={ui.emptyText}>
              {rods.length === 0 ? 'Rod data still loading…' : `No rod matches “${search}”`}
            </Text>
          </View>
        }
      />
    </View>
  );
};

const makeStyles = (c) =>
  StyleSheet.create({
    searchWrap: {
      flexDirection: 'row', alignItems: 'center', gap: SPACE.sm,
      margin: SPACE.lg, marginBottom: SPACE.sm,
      paddingHorizontal: SPACE.md, height: 44,
      backgroundColor: c.inputBg, borderRadius: RADIUS.md,
      borderWidth: StyleSheet.hairlineWidth, borderColor: c.inputBorder,
    },
    search: { flex: 1, ...TYPE.body, color: c.text, padding: 0 },

    sortScroll: { flexGrow: 0, flexShrink: 0 },
    sortRow: { paddingHorizontal: SPACE.lg, gap: SPACE.sm, alignItems: 'center' },
    sortChip: {
      paddingHorizontal: SPACE.md, paddingVertical: SPACE.sm,
      backgroundColor: c.bgAlt, borderRadius: RADIUS.pill,
      borderWidth: StyleSheet.hairlineWidth, borderColor: c.border,
    },
    sortChipActive: { backgroundColor: c.primary, borderColor: c.primary },
    sortChipText: { ...TYPE.label, color: c.textSecondary },
    sortChipTextActive: { color: c.onPrimary },
    hint: {
      ...TYPE.caption, color: c.textMuted,
      paddingHorizontal: SPACE.lg, paddingTop: SPACE.sm, paddingBottom: SPACE.xs,
    },

    compare: {
      margin: SPACE.lg, marginTop: SPACE.sm, padding: SPACE.lg,
      backgroundColor: c.card, borderRadius: RADIUS.lg,
      borderWidth: StyleSheet.hairlineWidth, borderColor: c.cardBorder,
      ...SHADOW.sm,
    },
    compareHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    compareTitle: { ...TYPE.label, color: c.textSecondary },
    clear: { ...TYPE.label, color: c.primary },
    compareNames: { flexDirection: 'row', alignItems: 'flex-start', marginTop: SPACE.sm },
    compareCol: { flex: 1 },
    compareMid: { width: 72 },
    compareName: { ...TYPE.callout, color: c.text, textAlign: 'center' },
    compareRow: {
      flexDirection: 'row', alignItems: 'center',
      paddingVertical: SPACE.sm,
      borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.divider,
    },
    compareVal: { flex: 1, ...TYPE.body, color: c.textSecondary, textAlign: 'center' },
    compareWin: { color: STATUS.success, fontFamily: FONT.bold },
    compareLabel: { width: 72, ...TYPE.caption, color: c.textMuted, textAlign: 'center' },

    list: { paddingHorizontal: SPACE.lg, paddingBottom: SPACE.xxxl },
    row: {
      flexDirection: 'row', alignItems: 'center', gap: SPACE.md,
      padding: SPACE.md, marginBottom: SPACE.sm,
      backgroundColor: c.card, borderRadius: RADIUS.md,
      borderWidth: StyleSheet.hairlineWidth, borderColor: c.cardBorder,
    },
    rowPicked: { borderColor: c.primary, backgroundColor: c.primaryTint },
    icon: { width: 44, height: 44 },
    rowBody: { flex: 1 },
    rodName: { ...TYPE.callout, color: c.text },
    statLine: { flexDirection: 'row', marginTop: SPACE.xs },
    statCell: { flex: 1 },
    statLabel: { ...TYPE.label, color: c.textMuted },
    statLabelActive: { color: c.primary },
    statValue: { ...TYPE.caption, color: c.textSecondary },
    statValueActive: { color: c.text, fontFamily: FONT.bold },
    statValueBest: { color: STATUS.success, fontFamily: FONT.bold },
  });

export default RodsScreen;
