/* NPC sale estimates in C$; separate from community market quotes. */
import React, { useMemo, useState, useCallback } from 'react';
import {
  View, Text, TextInput, FlatList, TouchableOpacity, Image,
  StyleSheet, ScrollView, Modal, KeyboardAvoidingView, Platform,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalState } from '../LocalGlobelStats';
import { useUI } from '../Design/ui';
import { SPACE, SIZE, TYPE, RADIUS, SHADOW, STATUS, RARITY } from '../Design/tokens';
import { unwrapFeed, resolveItemImage } from '../Helper/valueSources';
import { fishValue, mutationTable, weightRange, formatFishValue, selectModifier, sizeLabel } from '../Helper/fischValue';

const FishValueScreen = () => {
  const ui = useUI();
  const c = ui.c;
  const { localState } = useLocalState();

  const [fish, setFish] = useState(null);
  const [weight, setWeight] = useState('');
  const [picked, setPicked] = useState([]);   // mutation names
  const [pickerOpen, setPickerOpen] = useState(false);
  // The picker is a full-screen Modal painting its own surface, so nothing
  // else reserves the system bars for it: the title sat under the status bar
  // and the last row of the list under the navigation bar.
  const insets = useSafeAreaInsets();
  const [fishQuery, setFishQuery] = useState('');
  const [mutQuery, setMutQuery] = useState('');

  const feed = useMemo(() => {
    try {
      const raw = localState.data;
      if (!raw) return null;
      const p = typeof raw === 'string' ? JSON.parse(raw) : raw;
      return p && typeof p === 'object' ? unwrapFeed(p) : null;
    } catch { return null; }
  }, [localState.data]);

  const allFish = useMemo(
    () => (Array.isArray(feed?.fish) ? feed.fish.map((f) => ({ ...f, collection: 'fish' })) : []),
    [feed],
  );
  const allMutations = useMemo(
    () => (Array.isArray(feed?.mutations) ? feed.mutations.map((m) => ({ ...m, collection: 'mutations' })) : []),
    [feed],
  );

  // Built once from the catalogue, so a mutation added upstream works here
  // without an app release.
  const table = useMemo(() => mutationTable(allMutations), [allMutations]);

  const range = useMemo(() => (fish ? weightRange(fish) : null), [fish]);

  const result = useMemo(
    () => fishValue(fish, weight, picked, table),
    [fish, weight, picked, table],
  );

  const fishResults = useMemo(() => {
    const q = fishQuery.trim().toLowerCase();
    if (!q) return allFish.slice(0, 50);
    return allFish.filter((f) => f.name?.toLowerCase().includes(q)).slice(0, 50);
  }, [allFish, fishQuery]);

  const mutResults = useMemo(() => {
    const q = mutQuery.trim().toLowerCase();
    const withMult = allMutations.filter((m) => table[m.name] !== undefined);
    const list = q ? withMult.filter((m) => m.name?.toLowerCase().includes(q)) : withMult;
    // Strongest first: the multiplier is the only reason to pick one.
    return [...list].sort((a, b) => table[b.name].max - table[a.name].max);
  }, [allMutations, mutQuery, table]);

  const toggleMutation = useCallback((name) => {
    setPicked(prev => selectModifier(prev, name, table));
  }, [table]);

  const s = useMemo(() => makeStyles(c), [c]);

  const rarityColor = fish?.rarity ? RARITY[fish.rarity] || c.textMuted : c.textMuted;

  return (
    <KeyboardAvoidingView
      style={ui.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">

        {/* ── 1. Which fish ── */}
        <Text style={s.step}>1 · Pick your fish</Text>
        <TouchableOpacity style={s.fishPick} onPress={() => setPickerOpen(true)} activeOpacity={0.8}>
          {fish ? (
            <>
              <Image source={{ uri: resolveItemImage(fish) }} style={s.fishIcon} resizeMode="contain" />
              <View style={{ flex: 1 }}>
                <Text style={s.fishName}>{fish.name}</Text>
                <Text style={[s.fishRarity, { color: rarityColor }]}>{fish.rarity}</Text>
              </View>
            </>
          ) : (
            <>
              <Icon name="fish-outline" size={SIZE.title} color={c.textMuted} />
              <Text style={s.placeholder}>Tap to choose from {allFish.length} fish</Text>
            </>
          )}
          <Icon name="chevron-forward" size={SIZE.subtitle} color={c.textMuted} />
        </TouchableOpacity>

        {/* ── 2. Weight ── */}
        {!!fish && (
          <>
            <Text style={s.step}>2 · Weight</Text>
            <View style={s.weightRow}>
              <TextInput
                style={s.weightInput}
                value={weight}
                onChangeText={setWeight}
                keyboardType="decimal-pad"
                placeholder="0"
                placeholderTextColor={c.textMuted}
              />
              <Text style={s.kg}>kg</Text>
            </View>

            {/* Shortcuts. The bounds are derived, not stored: base_weight is the
                MAXIMUM, and min = base_weight - weight_range. Offering them
                stops the commonest input error, which is guessing a weight the
                fish cannot physically reach. */}
            {!!range && (
              <View style={s.shortcuts}>
                {[
                  { label: 'Normal min', v: range.min },
                  { label: 'Average', v: range.avg },
                  { label: 'Normal max', v: range.max },
                ].map((p) => (
                  <TouchableOpacity
                    key={p.label}
                    style={s.shortcut}
                    onPress={() => setWeight(String(Number(p.v.toFixed(2))))}
                    activeOpacity={0.8}
                  >
                    <Text style={s.shortcutLabel}>{p.label}</Text>
                    <Text style={s.shortcutValue}>{Number(p.v.toFixed(1)).toLocaleString('en-US')}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
            {!!range && Number(weight) > range.max && (
              <Text style={s.warn}>
                {sizeLabel(fish, weight)} catch — size is reflected in its weight.
              </Text>
            )}
          </>
        )}

        {/* ── 3. Mutations ── */}
        {!!fish && (
          <>
            <Text style={s.step}>3 · One mutation + attributes {picked.length > 0 ? `(${picked.length})` : ''}</Text>
            <View style={s.searchWrap}>
              <Icon name="search" size={SIZE.body} color={c.textMuted} />
              <TextInput
                style={s.search}
                value={mutQuery}
                onChangeText={setMutQuery}
                placeholder="Search mutations…"
                placeholderTextColor={c.textMuted}
              />
            </View>
            <View style={s.mutWrap}>
              {mutResults.slice(0, 24).map((m) => {
                const on = picked.includes(m.name);
                return (
                  <TouchableOpacity
                    key={m.page_id ?? m.name}
                    style={[s.mutChip, on && s.mutChipOn]}
                    onPress={() => toggleMutation(m.name)}
                    activeOpacity={0.8}
                  >
                    <Text style={[s.mutName, on && s.mutNameOn]}>{m.name}</Text>
                    <Text style={[s.mutMult, on && s.mutNameOn]}>x{table[m.name].min === table[m.name].max ? table[m.name].min : table[m.name].min + '–' + table[m.name].max}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            {mutResults.length > 24 && (
              <Text style={s.more}>{mutResults.length - 24} more — search to narrow</Text>
            )}
          </>
        )}

        {/* ── Result ── */}
        {!!fish && (
          <View style={s.result}>
            <Text style={s.resultLabel}>NPC sale estimate · C$</Text>
            <Text style={s.resultValue}>
              {result.range ? formatFishValue(result.range.min) + '–' + formatFishValue(result.range.max) : formatFishValue(result.value)}
            </Text>
            <Text style={s.resultHint}>
              {result.error || (result.range ? 'Variable multiplier: actual sale value can fall within this range.' : picked.join(' · ') || 'No mutation or attributes')}
            </Text>
            <Text style={s.formula}>Uses wiki sale rules and the entered weight. This is not a trade value in S$ or Proto.</Text>
          </View>
        )}
      </ScrollView>

      {/* ── Fish picker ── */}
      <Modal visible={pickerOpen} animationType="slide" onRequestClose={() => setPickerOpen(false)}>
        <View style={[ui.screen, s.modal, { paddingTop: insets.top + SPACE.lg, paddingBottom: insets.bottom }]}>
          <View style={s.modalHead}>
            <Text style={s.modalTitle}>Choose a fish</Text>
            <TouchableOpacity onPress={() => setPickerOpen(false)}>
              <Icon name="close" size={SIZE.title} color={c.text} />
            </TouchableOpacity>
          </View>
          <View style={s.searchWrap}>
            <Icon name="search" size={SIZE.body} color={c.textMuted} />
            <TextInput
              style={s.search}
              value={fishQuery}
              onChangeText={setFishQuery}
              placeholder={`Search ${allFish.length} fish…`}
              placeholderTextColor={c.textMuted}
              autoFocus
            />
          </View>
          <FlatList
            data={fishResults}
            keyExtractor={(item) => String(item.page_id)}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: SPACE.giant }}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={s.fishRow}
                activeOpacity={0.7}
                onPress={() => {
                  setFish(item);
                  setPicked([]);
                  // Pre-fill the average so the screen shows a real number
                  // immediately rather than a dash.
                  const r = weightRange(item);
                  if (r) setWeight(String(Number(r.avg.toFixed(2))));
                  setPickerOpen(false);
                  setFishQuery('');
                }}
              >
                <Image source={{ uri: resolveItemImage(item) }} style={s.fishRowIcon} resizeMode="contain" />
                <View style={{ flex: 1 }}>
                  <Text style={s.fishRowName} numberOfLines={1}>{item.name}</Text>
                  <Text style={[s.fishRowRarity, { color: RARITY[item.rarity] || c.textMuted }]}>
                    {item.rarity}
                  </Text>
                </View>
                <Text style={s.fishRowAvg}>
                  C$ ~{formatFishValue(item.avg_value)}
                </Text>
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <View style={ui.emptyContainer}>
                <Text style={ui.emptyText}>No fish matches “{fishQuery}”</Text>
              </View>
            }
          />
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
};

const makeStyles = (c) =>
  StyleSheet.create({
    content: { padding: SPACE.lg, paddingBottom: SPACE.giant },

    step: { ...TYPE.label, color: c.textMuted, marginTop: SPACE.xl, marginBottom: SPACE.sm },

    fishPick: {
      flexDirection: 'row', alignItems: 'center', gap: SPACE.md,
      padding: SPACE.lg, backgroundColor: c.card, borderRadius: RADIUS.lg,
      borderWidth: StyleSheet.hairlineWidth, borderColor: c.cardBorder, ...SHADOW.sm,
    },
    fishIcon: { width: 48, height: 48 },
    fishName: { ...TYPE.subtitle, color: c.text },
    fishRarity: { ...TYPE.caption },
    placeholder: { ...TYPE.body, color: c.textMuted, flex: 1 },

    weightRow: {
      flexDirection: 'row', alignItems: 'center',
      backgroundColor: c.inputBg, borderRadius: RADIUS.md,
      borderWidth: StyleSheet.hairlineWidth, borderColor: c.inputBorder,
      paddingHorizontal: SPACE.lg,
    },
    weightInput: { flex: 1, ...TYPE.heading, color: c.text, paddingVertical: SPACE.md },
    kg: { ...TYPE.body, color: c.textMuted },

    shortcuts: { flexDirection: 'row', gap: SPACE.sm, marginTop: SPACE.sm },
    shortcut: {
      flex: 1, alignItems: 'center', paddingVertical: SPACE.md,
      backgroundColor: c.bgAlt, borderRadius: RADIUS.md,
      borderWidth: StyleSheet.hairlineWidth, borderColor: c.border,
    },
    shortcutLabel: { ...TYPE.label, color: c.textMuted },
    shortcutValue: { ...TYPE.caption, color: c.text },
    warn: { ...TYPE.caption, color: STATUS.warning, marginTop: SPACE.sm },

    searchWrap: {
      flexDirection: 'row', alignItems: 'center', gap: SPACE.sm,
      paddingHorizontal: SPACE.md, height: 42, marginBottom: SPACE.sm,
      backgroundColor: c.inputBg, borderRadius: RADIUS.md,
      borderWidth: StyleSheet.hairlineWidth, borderColor: c.inputBorder,
    },
    search: { flex: 1, ...TYPE.body, color: c.text, padding: 0 },

    mutWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.sm },
    mutChip: {
      flexDirection: 'row', alignItems: 'center', gap: SPACE.xs,
      paddingHorizontal: SPACE.md, paddingVertical: SPACE.sm,
      backgroundColor: c.bgAlt, borderRadius: RADIUS.pill,
      borderWidth: StyleSheet.hairlineWidth, borderColor: c.border,
    },
    mutChipOn: { backgroundColor: c.primary, borderColor: c.primary },
    mutName: { ...TYPE.caption, color: c.textSecondary },
    mutMult: { ...TYPE.label, color: c.textMuted },
    mutNameOn: { color: c.onPrimary },
    more: { ...TYPE.caption, color: c.textMuted, marginTop: SPACE.sm },

    result: {
      marginTop: SPACE.huge, padding: SPACE.xxl, alignItems: 'center',
      backgroundColor: c.primaryTint, borderRadius: RADIUS.lg,
      borderWidth: StyleSheet.hairlineWidth, borderColor: c.primary,
    },
    resultLabel: { ...TYPE.label, color: c.textSecondary },
    resultValue: { ...TYPE.display, color: c.primary },
    resultExact: { ...TYPE.callout, color: c.text },
    resultHint: { ...TYPE.caption, color: c.textSecondary, marginTop: SPACE.xs, textAlign: 'center' },
    formula: {
      ...TYPE.small, color: c.textMuted, marginTop: SPACE.lg,
      textAlign: 'center', paddingTop: SPACE.md,
      borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.primary,
      alignSelf: 'stretch',
    },

    modal: { padding: SPACE.lg },
    modalHead: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      marginBottom: SPACE.lg,
    },
    modalTitle: { ...TYPE.title, color: c.text },
    fishRow: {
      flexDirection: 'row', alignItems: 'center', gap: SPACE.md,
      paddingVertical: SPACE.md,
      borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.divider,
    },
    fishRowIcon: { width: 40, height: 40 },
    fishRowName: { ...TYPE.body, color: c.text },
    fishRowRarity: { ...TYPE.caption },
    fishRowAvg: { ...TYPE.caption, color: c.textMuted },
  });

export default FishValueScreen;
