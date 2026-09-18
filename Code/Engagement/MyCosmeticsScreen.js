/**
 * MyCosmeticsScreen.js — Standalone screen to view & manage won cosmetics
 * Extracted from MysteryEgg.js InventorySection
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  StatusBar, Platform, Modal, Dimensions, ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useGlobalState } from '../GlobelStats';
import { getMyCosmetics, syncMyCosmetics, getCachedEggData, setCachedEggInventory } from '../Helper/cosmeticsCache';
import { getInventory, activateItem, deactivateItem, formatTimeRemaining } from './shopUtils';
import { RARITY_CONFIG, ALL_ITEMS, COSMETIC_TYPE, FRAMES, TEXT_COLORS, TRADE_BG_COLORS, BANNER_GRADIENTS, CHAT_BG_COLORS } from './shopItems';
import FramedAvatar from '../ChatScreen/GroupChat/FramedAvatar';
import config from '../Helper/Environment';
import { STATUS } from '../Design/tokens';
import { SIZE } from '../Design/tokens';
import { SPACE } from '../Design/tokens';
import { FONT } from '../Design/tokens';

// ── DEV: Generate full inventory with all cosmetics for testing ──
const generateTestInventory = () => {
  const now = Date.now();
  const farFuture = now + 365 * 24 * 60 * 60 * 1000; // 1 year from now

  const makeItems = (items, type) =>
    Object.values(items).map((item, idx) => ({
      ...item,
      type,
      _key: `test_${item.id}_${idx}`,
      activatedAt: now,
      expiresAt: item.duration === -1 ? -1 : farFuture,
    }));

  return {
    // MM2 scope: frames + chat text colors only (matches egg drop pools).
    profileFrame: makeItems(FRAMES, 'profileFrame'),
    chatTextColor: makeItems(TEXT_COLORS, 'chatTextColor'),
  };
};

const TYPE_LABELS = {
  profileFrame: { emoji: '🖼️', label: 'Profile Frames' },
  chatTextColor: { emoji: '🔤', label: 'Text Colors' },
  tradeCardBg: { emoji: '🃏', label: 'Trade Backgrounds' },
  profileBanner: { emoji: '🌈', label: 'Profile Banners' },
  chatBubbleBg: { emoji: '💬', label: 'Chat Bubbles' },
};

// Users allowed to see the test-mode toggle (flask) outside of dev builds —
// it unlocks all cosmetics locally so they can preview & equip any of them
// (equipping writes activeItems, so the choice persists). Add UIDs as needed.
const COSMETIC_TEST_UIDS = ['DNvBQC5ySWP8QiJNGpIvqd9DSWB2'];

const MyCosmeticsScreen = ({ navigation }) => {
  const { theme, user, appdatabase } = useGlobalState();
  const isDark = theme === 'dark';
  const insets = useSafeAreaInsets();

  const [cosmetics, setCosmetics] = useState(() => getMyCosmetics());
  const [inventory, setInventory] = useState(() => getCachedEggData().inventory);
  const [loading, setLoading] = useState(true);
  const [testMode, setTestMode] = useState(false);
  const [previewItem, setPreviewItem] = useState(null);

  // Sync from DB
  useEffect(() => {
    if (!user?.id || !appdatabase) return;

    const load = async () => {
      const synced = await syncMyCosmetics(appdatabase, user.id, true);
      setCosmetics(synced);
      const inv = await getInventory(appdatabase, user.id);
      setInventory(inv);
      setCachedEggInventory(inv);
      setLoading(false);
    };
    load();
  }, [user?.id, appdatabase]);

  const handleActivate = useCallback(async (type, item) => {
    const ok = await activateItem(appdatabase, user.id, type, item);
    if (ok) setCosmetics(getMyCosmetics());
  }, [appdatabase, user?.id]);

  const handleDeactivate = useCallback(async (type) => {
    const ok = await deactivateItem(appdatabase, user.id, type);
    if (ok) setCosmetics(getMyCosmetics());
  }, [appdatabase, user?.id]);

  // Use test inventory when testMode is on
  const displayInventory = useMemo(() => testMode ? generateTestInventory() : inventory, [testMode, inventory]);
  const hasAnyItems = useMemo(() => Object.keys(displayInventory).length > 0, [displayInventory]);
  const bgColor = isDark ? '#0f172a' : '#F8FAFC';

  return (
    <View style={[s.container, { backgroundColor: bgColor }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      {/* ═══ HEADER ═══ */}
      <View style={[s.header, { paddingTop: insets.top + 8, backgroundColor: isDark ? '#1e1040' : config.colors.primary }]}>
        {/* Decorative bubbles */}
        <View style={[s.bubble, { top: insets.top - 20, right: -10, width: 90, height: 90, backgroundColor: isDark ? 'rgba(168,85,247,0.1)' : 'rgba(255,255,255,0.06)' }]} />
        <View style={[s.bubble, { top: insets.top + 10, left: -15, width: 70, height: 70, backgroundColor: isDark ? 'rgba(59,130,246,0.08)' : 'rgba(255,255,255,0.05)' }]} />

        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn} activeOpacity={0.7}>
          <Icon name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>

        <View style={s.headerCenter}>
          <Text style={{ fontSize: SIZE.title }}>✨</Text>
          <View>
            <Text style={s.headerTitle}>My Cosmetics</Text>
            <Text style={s.headerSub}>Tap to equip • Tap active to remove</Text>
          </View>
        </View>

        {/* Test mode toggle — dev builds, or allowlisted users (COSMETIC_TEST_UIDS) */}
        {(__DEV__ || COSMETIC_TEST_UIDS.includes(user?.id)) && (
          <TouchableOpacity
            onPress={() => setTestMode(prev => !prev)}
            style={[s.backBtn, testMode && { backgroundColor: STATUS.success }]}
            activeOpacity={0.7}
          >
            <Icon name={testMode ? 'flask' : 'flask-outline'} size={18} color="#fff" />
          </TouchableOpacity>
       )}
      </View>

      <ScrollView contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
        {testMode && (
          <View style={s.testBanner}>
            <Text style={s.testBannerText}>🧪 TEST MODE — All cosmetics unlocked. Tap to equip & preview.</Text>
          </View>
        )}
        {loading ? (
          /* ── Loading State ── */
          <View style={s.emptyState}>
            <ActivityIndicator size="large" color={isDark ? '#a78bfa' : '#7c3aed'} />
            <Text style={[s.emptySubtitle, { color: isDark ? '#64748b' : '#94a3b8', marginTop: SPACE.xxl }]}>
              Loading your cosmetics...
            </Text>
          </View>
        ) : !hasAnyItems ? (
          /* ── Empty State ── */
          <View style={s.emptyState}>
            <Text style={{ fontSize: 60, marginBottom: SPACE.xxl }}>🎒</Text>
            <Text style={[s.emptyTitle, { color: isDark ? '#e2e8f0' : '#0f172a' }]}>
              No cosmetics yet!
            </Text>
            <Text style={[s.emptySubtitle, { color: isDark ? '#64748b' : '#94a3b8' }]}>
              Hatch Mystery Eggs to win profile frames, chat colors, trade backgrounds, and more!
            </Text>
            <TouchableOpacity
              style={s.emptyBtn}
              onPress={() => navigation.navigate('MysteryEggScreen')}
              activeOpacity={0.85}
            >
              <Text style={{ fontSize: SIZE.subtitle }}>🥚</Text>
              <Text style={s.emptyBtnText}>Hatch Mystery Eggs</Text>
            </TouchableOpacity>
          </View>
        ) : (
          /* ── Cosmetics Inventory ── */
          <>
            {Object.entries(displayInventory).map(([type, items]) => {
              const typeInfo = TYPE_LABELS[type] || { emoji: '🎁', label: type };
              const activeId = cosmetics?.[type]?.id;

              return (
                <View key={type} style={[s.typeSection, { backgroundColor: isDark ? '#1e293b' : '#fff' }]}>
                  <Text style={[s.typeLabel, { color: isDark ? '#e2e8f0' : '#0f172a' }]}>
                    {typeInfo.emoji} {typeInfo.label}
                  </Text>

                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: SPACE.lg, paddingVertical: SPACE.md }}>
                    {items.map((item, idx) => {
                      const isActive = activeId === item.id;
                      const rc = RARITY_CONFIG[item.rarity];
                      const isFrame = type === 'profileFrame';
                      const isTextColor = type === 'chatTextColor';
                      const itemDef = ALL_ITEMS[item.id];

                      return (
                        <TouchableOpacity
                          key={item._key || `${item.id}-${idx}`}
                          activeOpacity={0.7}
                          onPress={() => isFrame ? setPreviewItem({ type, item, isActive }) : (isActive ? handleDeactivate(type) : handleActivate(type, item))}
                          style={[
                            s.itemCard,
                            {
                              backgroundColor: isDark ? '#0f172a' : '#f8fafc',
                              borderColor: isActive ? STATUS.success : (rc?.color + '40'),
                              borderWidth: isActive ? 3 : 2,
                              shadowColor: isActive ? STATUS.success : 'transparent',
                              shadowOpacity: isActive ? 0.3 : 0,
                              shadowRadius: isActive ? 8 : 0,
                              elevation: isActive ? 4 : 0,
                            },
                          ]}
                        >
                          {/* Active badge */}
                          {isActive && (
                            <View style={s.activeBadge}>
                              <Text style={{ fontSize: SIZE.label, color: '#fff', fontFamily: FONT.bold }}>✓ ON</Text>
                            </View>
                          )}

                          {/* Preview */}
                          <View style={s.previewWrap}>
                            {isFrame ? (
                              <FramedAvatar
                                avatarUri={null}
                                frame={{
                                  id: item.id,
                                  borderColors: item.borderColors || itemDef?.borderColors,
                                  borderWidth: item.borderWidth || itemDef?.borderWidth,
                                  glowColor: item.glowColor || itemDef?.glowColor,
                                }}
                                isDarkMode={isDark}
                                avatarSize={28}
                                isOnline={false}
                              />
                            ) : isTextColor ? (
                              <View style={{
                                width: 34, height: 34, borderRadius: 17,
                                backgroundColor: (item.color || itemDef?.color) === 'rainbow' ? '#A855F7' : (item.color || itemDef?.color || '#94a3b8'),
                                alignItems: 'center', justifyContent: 'center',
                              }}>
                                <Text style={{ color: '#fff', fontSize: SIZE.body, fontFamily: FONT.bold }}>Aa</Text>
                              </View>
                            ) : type === 'profileBanner' ? (
                              <View style={{
                                width: 44, height: 22, borderRadius: 6,
                                backgroundColor: (item.gradient || itemDef?.gradient)?.[0] || '#7c3aed',
                                overflow: 'hidden',
                              }}>
                                <View style={{
                                  position: 'absolute', right: 0, top: 0, bottom: 0, width: 16,
                                  backgroundColor: (item.gradient || itemDef?.gradient)?.[2] || '#ec4899',
                                  opacity: 0.7,
                                }} />
                              </View>
                            ) : (
                              <View style={{
                                width: 34, height: 22, borderRadius: 10,
                                backgroundColor: isDark
                                  ? (item.darkColor || itemDef?.darkColor || item.color || itemDef?.color || '#94a3b8')
                                  : (item.color || itemDef?.color || '#94a3b8'),
                                borderWidth: 1, borderColor: 'rgba(0,0,0,0.1)',
                              }} />
                            )}
                          </View>

                          {/* Name + Rarity */}
                          <Text style={[s.itemName, { color: isDark ? '#e2e8f0' : '#334155' }]} numberOfLines={1}>
                            {item.name}
                          </Text>
                          <Text style={[s.itemRarity, { color: rc?.color }]}>
                            {rc?.emoji} {rc?.label}
                          </Text>
                          <Text style={[s.itemTime, { color: isDark ? '#64748b' : '#94a3b8' }]}>
                            {formatTimeRemaining(item.expiresAt)}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>
              );
            })}

            {/* Link to get more */}
            <TouchableOpacity
              style={[s.getMoreBtn, { backgroundColor: isDark ? '#1e293b' : '#fff' }]}
              onPress={() => navigation.navigate('MysteryEggScreen')}
              activeOpacity={0.85}
            >
              <Text style={{ fontSize: SIZE.heading }}>🥚</Text>
              <View style={{ flex: 1 }}>
                <Text style={[s.getMoreTitle, { color: isDark ? '#e2e8f0' : '#0f172a' }]}>Want more?</Text>
                <Text style={[s.getMoreSub, { color: isDark ? '#64748b' : '#94a3b8' }]}>Hatch Mystery Eggs to win cosmetics!</Text>
              </View>
              <Icon name="chevron-forward" size={18} color={isDark ? '#64748b' : '#94a3b8'} />
            </TouchableOpacity>
          </>
        )}
      </ScrollView>

      {/* ═══ FRAME PREVIEW MODAL ═══ */}
      {previewItem && (() => {
        const { type, item, isActive } = previewItem;
        const itemDef = ALL_ITEMS[item.id];
        const rc = RARITY_CONFIG[item.rarity];
        const screenW = Dimensions.get('window').width;
        const previewSize = Math.min(screenW * 0.45, 180);

        return (
          <Modal transparent animationType="fade" visible onRequestClose={() => setPreviewItem(null)}>
            <TouchableOpacity
              style={s.modalOverlay}
              activeOpacity={1}
              onPress={() => setPreviewItem(null)}
            >
              <TouchableOpacity activeOpacity={1} style={[s.modalCard, { backgroundColor: isDark ? '#1e293b' : '#fff' }]}>
                {/* Close button */}
                <TouchableOpacity style={s.modalClose} onPress={() => setPreviewItem(null)}>
                  <Icon name="close" size={20} color={isDark ? '#94a3b8' : '#64748b'} />
                </TouchableOpacity>

                {/* Large frame preview */}
                <View style={{ alignItems: 'center', marginTop: SPACE.md }}>
                  <FramedAvatar
                    avatarUri={user?.avatar || null}
                    frame={{
                      id: item.id,
                      borderColors: item.borderColors || itemDef?.borderColors,
                      borderWidth: item.borderWidth || itemDef?.borderWidth,
                      glowColor: item.glowColor || itemDef?.glowColor,
                    }}
                    isDarkMode={isDark}
                    avatarSize={previewSize}
                    isOnline={false}
                  />
                </View>

                {/* Frame name */}
                <Text style={{
                  fontSize: SIZE.subtitle, fontFamily: FONT.bold, textAlign: 'center',
                  color: itemDef?.borderColors?.[0] || (isDark ? '#e2e8f0' : '#0f172a'),
                  marginTop: SPACE.xxl,
                }}>
                  {item.name}
                </Text>

                {/* Rarity pill */}
                <View style={{
                  alignSelf: 'center', marginTop: SPACE.sm,
                  paddingHorizontal: SPACE.lg, paddingVertical: 3, borderRadius: 999,
                  backgroundColor: isDark ? rc?.bgDark : rc?.bgLight,
                }}>
                  <Text style={{ fontSize: SIZE.small, fontFamily: FONT.bold, color: rc?.color }}>
                    {rc?.emoji} {rc?.label}
                  </Text>
                </View>

                {/* Time remaining */}
                <Text style={{
                  fontSize: SIZE.small, color: isDark ? '#64748b' : '#94a3b8',
                  textAlign: 'center', marginTop: SPACE.sm,
                }}>
                  {formatTimeRemaining(item.expiresAt)}
                </Text>

                {/* Equip / Remove button */}
                <TouchableOpacity
                  style={[s.modalBtn, {
                    backgroundColor: isActive ? STATUS.danger : STATUS.success,
                  }]}
                  activeOpacity={0.8}
                  onPress={() => {
                    if (isActive) {
                      handleDeactivate(type);
                    } else {
                      handleActivate(type, item);
                    }
                    setPreviewItem(null);
                  }}
                >
                  <Icon name={isActive ? 'close-circle' : 'checkmark-circle'} size={18} color="#fff" />
                  <Text style={{ color: '#fff', fontSize: SIZE.body, fontFamily: FONT.bold }}>
                    {isActive ? 'Remove' : 'Equip'}
                  </Text>
                </TouchableOpacity>
              </TouchableOpacity>
            </TouchableOpacity>
          </Modal>
        );
      })()}
    </View>
  );
};

const s = StyleSheet.create({
  container: { flex: 1 },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACE.xxl,
    paddingBottom: SPACE.xxl,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    overflow: 'hidden',
    position: 'relative',
  },
  bubble: { position: 'absolute', borderRadius: 999 },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
    zIndex: 2,
  },
  headerCenter: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    gap: SPACE.lg, marginLeft: SPACE.xl, zIndex: 2,
  },
  headerTitle: { fontSize: SIZE.heading, fontFamily: FONT.bold, color: '#fff' },
  headerSub: { fontSize: SIZE.small, color: 'rgba(255,255,255,0.7)', marginTop: 1 },

  scrollContent: { padding: SPACE.xxl, paddingBottom: 40 },
  testBanner: {
    backgroundColor: STATUS.success,
    borderRadius: 12, padding: SPACE.lg, marginBottom: SPACE.xl,
    alignItems: 'center',
  },
  testBannerText: { color: '#fff', fontSize: SIZE.caption, fontFamily: FONT.bold, textAlign: 'center' },

  // Empty state
  emptyState: {
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: SPACE.huge,
  },
  emptyTitle: { fontSize: SIZE.heading, fontFamily: FONT.bold, marginBottom: SPACE.md },
  emptySubtitle: { fontSize: SIZE.body, textAlign: 'center', lineHeight: 20, marginBottom: SPACE.huge },
  emptyBtn: {
    flexDirection: 'row', alignItems: 'center', gap: SPACE.md,
    backgroundColor: '#EC4899',
    paddingVertical: 14, paddingHorizontal: 28,
    borderRadius: 18,
    shadowColor: '#EC4899', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 5,
  },
  emptyBtnText: { color: '#fff', fontSize: SIZE.body, fontFamily: FONT.bold },

  // Type sections
  typeSection: {
    borderRadius: 18, padding: 14, marginBottom: SPACE.xl,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  typeLabel: { fontSize: SIZE.body, fontFamily: FONT.bold },

  // Item card
  itemCard: {
    width: 90, borderRadius: 14, padding: SPACE.lg,
    alignItems: 'center', position: 'relative', overflow: 'visible',
  },
  activeBadge: {
    position: 'absolute', top: -6, right: -4,
    backgroundColor: STATUS.success,
    paddingHorizontal: SPACE.sm, paddingVertical: SPACE.hair, borderRadius: 8,
    zIndex: 10,
    shadowColor: STATUS.success, shadowOpacity: 0.4, shadowRadius: 4,
  },
  previewWrap: { marginBottom: SPACE.sm, height: 38, justifyContent: 'center', alignItems: 'center' },
  itemName: { fontSize: SIZE.label, fontFamily: FONT.bold, textAlign: 'center' },
  itemRarity: { fontSize: SIZE.label, fontFamily: FONT.bold, marginTop: SPACE.hair },
  itemTime: { fontSize: SIZE.label, fontFamily: FONT.regular, marginTop: 1 },

  // Get more button
  getMoreBtn: {
    flexDirection: 'row', alignItems: 'center', gap: SPACE.xl,
    padding: SPACE.xxl, borderRadius: 18, marginTop: SPACE.xs,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  getMoreTitle: { fontSize: SIZE.body, fontFamily: FONT.bold },
  getMoreSub: { fontSize: SIZE.small, marginTop: 1 },

  // Preview modal
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center', alignItems: 'center',
    padding: SPACE.giant,
  },
  modalCard: {
    width: '100%', maxWidth: 320,
    borderRadius: 24, padding: SPACE.huge,
    alignItems: 'stretch',
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2, shadowRadius: 24, elevation: 10,
  },
  modalClose: {
    position: 'absolute', top: 12, right: 12, zIndex: 10,
    width: 32, height: 32, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
  },
  modalBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: SPACE.md, marginTop: 18, paddingVertical: SPACE.xl, borderRadius: 14,
    shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 8, elevation: 4,
  },
});

export default MyCosmeticsScreen;
