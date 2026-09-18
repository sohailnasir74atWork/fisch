/**
 * BadgesScreen.js — Visual Badges & Achievements screen
 * Shows: XP progress, earned badges, level roadmap.
 *
 * Simplified for MM2 — no Lottie, no ViewShot/Share,
 * uses emoji-based badges with XP level progression.
 */

import React, { useEffect, useState, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Dimensions, Platform,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import { useGlobalState } from '../GlobelStats';
import config from '../Helper/Environment';
import { getThemeColors } from '../Helper/themeColors';
import { STATUS } from '../Design/tokens';
import { SIZE } from '../Design/tokens';
import { SPACE } from '../Design/tokens';
import { LIGHT } from '../Design/tokens';
import { FONT } from '../Design/tokens';
import {
  LEVELS, getLevelFromXP, getNextLevel, getXPProgress, getUserXP,
} from '../Engagement/xpUtils';

const { width } = Dimensions.get('window');
const BADGE_CARD_WIDTH = (width - 64) / 3;

// ── MM2-specific badge definitions ──
const MM2_BADGES = [
  { id: 'firstTrade', emoji: '🤝', name: 'First Trade', hint: 'Complete your first trade check', color: '#4A7FB5' },
  { id: 'collector10', emoji: '📦', name: 'Collector', hint: 'Add 10 items to favorites', color: '#3D9B7A' },
  { id: 'collector50', emoji: '💎', name: 'Hoarder', hint: 'Add 50 items to favorites', color: '#7E6CB5' },
  { id: 'quizPerfect', emoji: '🧠', name: 'Quiz Master', hint: 'Perfect score in Daily Quiz', color: STATUS.warning },
  { id: 'spinner', emoji: '🎡', name: 'Lucky Spin', hint: 'Spin the wheel 10 times', color: '#B06048' },
  { id: 'streak3', emoji: '🔥', name: 'On Fire', hint: '3-day app streak', color: '#B06048' },
  { id: 'streak7', emoji: '⚡', name: 'Dedicated', hint: '7-day app streak', color: STATUS.warning },
  { id: 'streak30', emoji: '🌟', name: 'Legendary', hint: '30-day app streak', color: '#7E6CB5' },
  { id: 'chatActive', emoji: '💬', name: 'Social', hint: 'Send 50 chat messages', color: '#4A7FB5' },
  { id: 'level5', emoji: '🏅', name: 'Rising', hint: 'Reach level 5', color: '#3D9B7A' },
  { id: 'level10', emoji: '🏆', name: 'Veteran', hint: 'Reach level 10', color: STATUS.warning },
  { id: 'level20', emoji: '👑', name: 'Mythic', hint: 'Reach level 20', color: '#7E6CB5' },
  { id: 'starDay7', emoji: '⭐', name: 'Star Week', hint: 'Claim all 7 daily stars', color: STATUS.warning },
  { id: 'valuator', emoji: '📊', name: 'Analyst', hint: 'Check analytics 10 times', color: '#5A94AA' },
  { id: 'nightOwl', emoji: '🦉', name: 'Night Owl', hint: 'Use app after midnight', color: LIGHT.textSecondary },
];

// ── XP Progress Header ──
const XPHeader = ({ xp, c, t }) => {
  const currentLevel = getLevelFromXP(xp);
  const nextLevel = getNextLevel(xp);
  const progress = getXPProgress(xp);
  const isMax = currentLevel.level === nextLevel.level;

  return (
    <View style={[s.xpCard, { backgroundColor: c.bgAlt, borderColor: c.border }]}>
      <View style={s.xpTopRow}>
        <Text style={{ fontSize: SIZE.title }}>{currentLevel.emoji}</Text>
        <View style={{ flex: 1, marginLeft: SPACE.lg }}>
          <Text style={[s.xpTitle, { color: c.text }]}>{currentLevel.title}</Text>
          <Text style={[s.xpSubtitle, { color: c.textSecondary }]}>
            {t('badges.level_info', { level: currentLevel.level, xp: xp.toLocaleString() })}
          </Text>
        </View>
        {!isMax && (
          <View style={s.xpNextBadge}>
            <Text style={{ fontSize: SIZE.label, color: c.textMuted, fontFamily: FONT.bold }}>{t('badges.next')}</Text>
            <Text style={{ fontSize: SIZE.body }}>{nextLevel.emoji}</Text>
          </View>
        )}
      </View>
      <View style={[s.progressBg, { backgroundColor: c.border }]}>
        <View style={[s.progressFill, {
          width: `${Math.max(3, Math.round(progress * 100))}%`,
          backgroundColor: c.primary,
        }]} />
      </View>
      <Text style={[s.progressLabel, { color: c.textMuted }]}>
        {isMax ? t('badges.max_level') : t('badges.xp_to_next', { xp: (nextLevel.xp - xp).toLocaleString(), levelTitle: nextLevel.title })}
      </Text>
    </View>
  );
};

// ── Badge Card ──
const BadgeCard = ({ badge, earned, c, t }) => (
  <View style={[s.badgeCard, {
    backgroundColor: earned ? badge.color + '15' : c.bgAlt,
    borderColor: earned ? badge.color + '40' : c.border,
    opacity: earned ? 1 : 0.55,
  }]}>
    <Text style={{ fontSize: SIZE.title, opacity: earned ? 1 : 0.3 }}>
      {earned ? badge.emoji : '🔒'}
    </Text>
    <Text style={[s.badgeName, { color: earned ? badge.color : c.textMuted }]} numberOfLines={1}>
      {t(`badges.list.${badge.id}.name`)}
    </Text>
    {earned ? (
      <View style={[s.earnedTag, { backgroundColor: badge.color + '20' }]}>
        <Text style={[s.earnedTagText, { color: badge.color }]}>{t('badges.earned')}</Text>
      </View>
    ) : (
      <Text style={[s.badgeHint, { color: c.textMuted }]} numberOfLines={2}>
        {t(`badges.list.${badge.id}.hint`)}
      </Text>
    )}
  </View>
);

// ── Level Roadmap ──
const LevelRow = ({ level, currentLevel, c, t }) => {
  const reached = currentLevel >= level.level;
  const isCurrent = currentLevel === level.level;

  return (
    <View style={[s.levelRow, {
      backgroundColor: isCurrent ? c.primary + '15' : 'transparent',
      borderColor: isCurrent ? c.primary + '40' : c.border,
    }]}>
      <Text style={{ fontSize: SIZE.heading, opacity: reached ? 1 : 0.35 }}>{level.emoji}</Text>
      <View style={{ flex: 1, marginLeft: SPACE.lg }}>
        <Text style={[s.levelName, { color: reached ? c.text : c.textMuted }]}>
          {level.title}
        </Text>
        <Text style={[s.levelXP, { color: c.textMuted }]}>
          {level.xp.toLocaleString()} XP
        </Text>
      </View>
      {reached && <Icon name="checkmark-circle" size={18} color={c.primary} />}
      {isCurrent && <Text style={[s.currentTag, { color: c.primary }]}>{t('badges.you')}</Text>}
    </View>
  );
};

const BadgesScreen = ({ navigation }) => {
  const { theme, appdatabase, user } = useGlobalState();
  const { t } = useTranslation();
  const isDarkMode = theme === 'dark';
  const c = getThemeColors(isDarkMode);

  const [xp, setXp] = useState(0);
  const [earnedBadges, setEarnedBadges] = useState(new Set());
  const [activeTab, setActiveTab] = useState(0);

  useEffect(() => {
    if (!appdatabase || !user?.id) return;
    getUserXP(appdatabase, user.id).then(data => {
      setXp(data.total || 0);

      // Determine earned badges based on XP level
      const earned = new Set();
      const level = getLevelFromXP(data.total || 0).level;
      if (level >= 5) earned.add('level5');
      if (level >= 10) earned.add('level10');
      if (level >= 20) earned.add('level20');

      // Future: also check Firestore for activity-based badges
      setEarnedBadges(earned);
    });
  }, [appdatabase, user?.id]);

  const currentLevel = getLevelFromXP(xp);

  const TABS = [t('badges.tabs_badges'), t('badges.tabs_levels')];

  return (
    <View style={[s.container, { backgroundColor: c.bg }]}>
      {/* Header */}
      <View style={[s.header, { borderBottomColor: c.divider }]}>
        {navigation?.goBack && (
          <TouchableOpacity onPress={navigation.goBack} style={s.backBtn}>
            <Icon name="arrow-back" size={22} color={c.text} />
          </TouchableOpacity>
        )}
        <Text style={[s.headerTitle, { color: c.text }]}>{t('badges.title')}</Text>
        <View style={{ width: 32 }} />
      </View>

      {/* XP Header */}
      <XPHeader xp={xp} c={c} t={t} />

      {/* Tabs */}
      <View style={[s.tabBar, { backgroundColor: isDarkMode ? config.colors.surfaceDark : '#f0f0f0' }]}>
        {TABS.map((tab, idx) => (
          <TouchableOpacity
            key={tab}
            style={[s.tab, activeTab === idx && { backgroundColor: c.primary }]}
            onPress={() => setActiveTab(idx)}
          >
            <Text style={[s.tabText, { color: activeTab === idx ? '#fff' : c.textSecondary }]}>
              {tab}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.content}>
        {/* Badges Tab */}
        {activeTab === 0 && (
          <>
            <Text style={[s.sectionTitle, { color: c.text }]}>
              {t('badges.earned_count', { count: earnedBadges.size, total: MM2_BADGES.length })}
            </Text>
            <View style={s.badgeGrid}>
              {MM2_BADGES.map(badge => (
                <BadgeCard
                  key={badge.id}
                  badge={badge}
                  earned={earnedBadges.has(badge.id)}
                  c={c}
                  t={t}
                />
              ))}
            </View>
          </>
        )}

        {/* Levels Tab */}
        {activeTab === 1 && (
          <View style={s.levelList}>
            {LEVELS.map(level => (
              <LevelRow
                key={level.level}
                level={level}
                currentLevel={currentLevel.level}
                c={c}
                t={t}
              />
            ))}
          </View>
        )}

        <View style={{ height: 30 }} />
      </ScrollView>
    </View>
  );
};

const s = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACE.xxl, paddingVertical: SPACE.xl, borderBottomWidth: StyleSheet.hairlineWidth,
    paddingTop: Platform.OS === 'ios' ? 50 : 12,
  },
  backBtn: { padding: SPACE.xs },
  headerTitle: { fontSize: SIZE.subtitle, fontFamily: FONT.bold },
  tabBar: {
    flexDirection: 'row', marginHorizontal: SPACE.xxl, marginVertical: SPACE.lg,
    borderRadius: 10, padding: 3,
  },
  tab: { flex: 1, paddingVertical: SPACE.md, borderRadius: 8, alignItems: 'center' },
  tabText: { fontSize: SIZE.caption, fontFamily: FONT.bold },
  content: { padding: SPACE.xxl, paddingTop: SPACE.xs },

  xpCard: {
    marginHorizontal: SPACE.xxl, marginTop: SPACE.xl, padding: SPACE.xxl, borderRadius: 16,
    borderWidth: 1,
  },
  xpTopRow: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACE.lg },
  xpTitle: { fontSize: SIZE.subtitle, fontFamily: FONT.bold },
  xpSubtitle: { fontSize: SIZE.caption, marginTop: 1 },
  xpNextBadge: { alignItems: 'center', gap: SPACE.hair },
  progressBg: { height: 8, borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 4, backgroundColor: '#4A7FB5' },
  progressLabel: { fontSize: SIZE.label, marginTop: SPACE.sm, fontFamily: FONT.regular },

  sectionTitle: { fontSize: SIZE.body, fontFamily: FONT.bold, marginBottom: SPACE.xl },

  badgeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.md },
  badgeCard: {
    width: BADGE_CARD_WIDTH, padding: SPACE.xl, borderRadius: 14, borderWidth: 1,
    alignItems: 'center', gap: SPACE.xs,
  },
  badgeName: { fontSize: SIZE.small, fontFamily: FONT.bold, textAlign: 'center' },
  earnedTag: { paddingHorizontal: SPACE.md, paddingVertical: SPACE.hair, borderRadius: 6 },
  earnedTagText: { fontSize: SIZE.label, fontFamily: FONT.bold },
  badgeHint: { fontSize: SIZE.label, textAlign: 'center', lineHeight: 12 },

  levelList: { gap: SPACE.sm },
  levelRow: {
    flexDirection: 'row', alignItems: 'center', padding: SPACE.xl,
    borderRadius: 12, borderWidth: 1, gap: SPACE.xs,
  },
  levelName: { fontSize: SIZE.body, fontFamily: FONT.bold },
  levelXP: { fontSize: SIZE.small, marginTop: 1 },
  currentTag: { fontSize: SIZE.label, fontFamily: FONT.bold, marginLeft: SPACE.xs },
});

export default BadgesScreen;
