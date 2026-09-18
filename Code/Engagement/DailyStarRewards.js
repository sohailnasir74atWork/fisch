/**
 * DailyStarRewards.js
 * 7-day login reward modal with animated star claiming.
 *
 * Shows a calendar grid of 7 days with escalating rewards.
 * Tap to claim today's star → XP animation → close.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  Animated,
  StyleSheet,
  Dimensions,
  ScrollView,
} from 'react-native';
import { DAILY_REWARDS, getStarStatus, claimDailyStar } from './starUtils';
import { getThemeColors } from '../Helper/themeColors';
import { useTranslation } from 'react-i18next';
import { STATUS } from '../Design/tokens';
import { SIZE } from '../Design/tokens';
import { SPACE } from '../Design/tokens';
import { FONT } from '../Design/tokens';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const DailyStarRewards = ({ visible, onClose, db, uid, isDarkMode = false }) => {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const [status, setStatus] = useState(null);
  const [claiming, setClaiming] = useState(false);
  const [claimedReward, setClaimedReward] = useState(null);
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const bounceAnim = useRef(new Animated.Value(1)).current;

  // Fetch status when modal opens
  useEffect(() => {
    if (visible && db && uid) {
      getStarStatus(db, uid).then(setStatus);
    }
  }, [visible, db, uid]);

  // Claim star
  const handleClaim = useCallback(async () => {
    if (!status?.canClaim || claiming) return;
    setClaiming(true);

    const reward = await claimDailyStar(db, uid);
    if (reward) {
      setClaimedReward(reward);
      setStatus(prev => ({ ...prev, canClaim: false, currentDay: reward.currentDay }));

      // Bounce animation
      Animated.sequence([
        Animated.spring(bounceAnim, { toValue: 1.3, friction: 3, useNativeDriver: true }),
        Animated.spring(bounceAnim, { toValue: 1, friction: 3, useNativeDriver: true }),
      ]).start();

      // XP pop animation
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }).start();
    }
    setClaiming(false);
  }, [status, db, uid, claiming]);

  const handleClose = useCallback(() => {
    setClaimedReward(null);
    scaleAnim.setValue(0);
    bounceAnim.setValue(1);
    onClose();
  }, [onClose]);

  if (!visible) return null;

  const c = getThemeColors(isDarkMode);
  const bg = c.bg;
  const cardBg = c.bgAlt;
  const textColor = c.text;
  const subtextColor = c.textSecondary;
  const accentColor = c.rewardGold;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <View style={[styles.container, { backgroundColor: bg, paddingBottom: insets.bottom }]}>
          {/* Drag handle */}
          <View style={styles.handleBar}>
            <View style={[styles.handle, { backgroundColor: c.border }]} />
          </View>

          {/* Header */}
          <View style={styles.header}>
            <Text style={[styles.title, { color: textColor }]}>{t('daily_stars.title')}</Text>
            <TouchableOpacity onPress={handleClose} style={styles.closeBtn}>
              <Text style={{ fontSize: SIZE.heading, color: subtextColor }}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Streak info */}
          {status?.streakBroken && (
            <View style={[styles.streakAlert, { backgroundColor: isDarkMode ? '#3b1515' : '#FEF2F2' }]}>
              <Text style={{ color: STATUS.danger, fontSize: SIZE.caption, fontFamily: FONT.regular }}>
                {t('daily_stars.streak_broken')}
              </Text>
            </View>
          )}

          {/* Already claimed banner */}
          {status && !status.canClaim && !claimedReward && (
            <View style={[styles.streakAlert, { backgroundColor: isDarkMode ? '#0a2e1f' : '#ECFDF5' }]}>
              <Text style={{ color: c.success, fontSize: SIZE.caption, fontFamily: FONT.bold }}>
                {t('daily_stars.already_claimed')}
              </Text>
            </View>
          )}

          {/* 7-day grid */}
          <View style={styles.grid}>
            {DAILY_REWARDS.map((reward) => {
              const isToday = status?.currentDay === reward.day;
              const alreadyClaimed = status && !status.canClaim;
              const isPast = reward.day < (status?.currentDay || 1);
              const isFuture = reward.day > (status?.currentDay || 1);

              return (
                <TouchableOpacity
                  key={reward.day}
                  disabled={!isToday || !status?.canClaim || claiming}
                  onPress={isToday && status?.canClaim ? handleClaim : undefined}
                  activeOpacity={0.7}
                  style={[
                    styles.dayCard,
                    { backgroundColor: cardBg, borderColor: c.border },
                    isToday && status?.canClaim && {
                      borderColor: accentColor,
                      borderWidth: 2,
                      backgroundColor: isDarkMode ? '#1f1a10' : '#FFFBEB',
                    },
                    isToday && alreadyClaimed && {
                      borderColor: c.success,
                      borderWidth: 2,
                      backgroundColor: isDarkMode ? '#0a2e1f' : '#ECFDF5',
                    },
                    isPast && { opacity: 0.5 },
                    isFuture && { opacity: 0.4 },
                  ]}
                >
                  {/* Day number */}
                  <Text style={[styles.dayNumber, { color: subtextColor }]}>
                    {t('daily_stars.day')} {reward.day}
                  </Text>

                  {/* Emoji */}
                  <Animated.Text
                    style={[
                      styles.dayEmoji,
                      isToday && claimedReward && {
                        transform: [{ scale: bounceAnim }],
                      },
                    ]}
                  >
                    {isPast ? '✅' : (isToday && alreadyClaimed) ? '✅' : reward.emoji}
                  </Animated.Text>

                  {/* Reward */}
                  <Text style={[styles.rewardLabel, { color: textColor }]}>
                    {reward.label}
                  </Text>

                  {/* Today indicator */}
                  {isToday && status?.canClaim && (
                    <View style={[styles.claimBadge, { backgroundColor: accentColor }]}>
                      <Text style={styles.claimText}>{t('daily_stars.tap')}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Claimed reward popup */}
          {claimedReward && (
            <Animated.View
              style={[
                styles.rewardPopup,
                {
                  backgroundColor: isDarkMode ? c.bgAlt : '#FFFBEB',
                  borderColor: accentColor,
                  opacity: scaleAnim,
                  transform: [{
                    scale: scaleAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.5, 1],
                    }),
                  }],
                },
              ]}
            >
              <Text style={{ fontSize: SIZE.title }}>🎉</Text>
              <Text style={[styles.rewardTitle, { color: textColor }]}>
                {t(claimedReward.description)}
              </Text>
              <Text style={[styles.rewardXP, { color: accentColor }]}>
                +{claimedReward.stars} ⭐ · {claimedReward.label}
              </Text>
            </Animated.View>
          )}

          {/* Cycle info */}
          <Text style={[styles.cycleText, { color: subtextColor }]}>
            {t('daily_stars.cycle_info', { cycle: status?.cycleNumber || 1, stars: status?.totalStarsEarned || 0 })}
          </Text>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    width: '100%',
    padding: SPACE.xxxl,
    paddingBottom: 36,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
  },
  handleBar: {
    alignItems: 'center',
    marginBottom: SPACE.xl,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACE.xxl,
  },
  title: {
    fontSize: SIZE.heading,
    fontFamily: FONT.bold,
  },
  closeBtn: {
    padding: SPACE.xs,
  },
  streakAlert: {
    padding: SPACE.md,
    borderRadius: 8,
    marginBottom: SPACE.xl,
    alignItems: 'center',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACE.md,
    justifyContent: 'center',
  },
  dayCard: {
    width: (SCREEN_WIDTH - 80) / 4,
    aspectRatio: 0.85,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACE.sm,
    borderWidth: 1,
  },
  dayNumber: {
    fontSize: SIZE.label,
    fontFamily: FONT.regular,
    marginBottom: SPACE.hair,
  },
  dayEmoji: {
    fontSize: SIZE.title,
    marginBottom: SPACE.xs,
  },
  rewardLabel: {
    fontSize: SIZE.label,
    fontFamily: FONT.regular,
    textAlign: 'center',
  },
  claimBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    borderRadius: 8,
    paddingHorizontal: SPACE.sm,
    paddingVertical: SPACE.hair,
  },
  claimText: {
    // Module-scope stylesheet: no theme in scope here. White on the filled
    // claim button is correct in both themes anyway, so it is a constant
    // rather than a lookup that cannot run.
    color: '#FFFFFF',
    fontSize: SIZE.label,
    fontFamily: FONT.bold,
  },
  rewardPopup: {
    marginTop: SPACE.xxl,
    padding: SPACE.xxl,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 2,
  },
  rewardTitle: {
    fontSize: SIZE.subtitle,
    fontFamily: FONT.bold,
    marginTop: SPACE.xs,
  },
  rewardXP: {
    fontSize: SIZE.heading,
    fontFamily: FONT.bold,
    marginTop: SPACE.xs,
  },
  cycleText: {
    textAlign: 'center',
    marginTop: SPACE.xl,
    fontSize: SIZE.small,
    fontFamily: FONT.regular,
  },
});

export default React.memo(DailyStarRewards);
