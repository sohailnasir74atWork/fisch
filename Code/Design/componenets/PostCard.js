import React, { useState, useCallback, memo, useEffect, useMemo } from 'react';
import {
  View, Text, Image, StyleSheet, TouchableOpacity, Alert, Animated,
} from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome';
import FontAwesome6 from 'react-native-vector-icons/FontAwesome6';
import InterstitialAdManager from '../../Ads/IntAd';
import { mixpanel } from '../../AppHelper/MixPenel';
import { useNavigation } from '@react-navigation/native';
import CommentModal from './CommentsModal';
import config from '../../Helper/Environment';
import { useGlobalState } from '../../GlobelStats';
import { Menu, MenuOption, MenuOptions, MenuTrigger } from 'react-native-popup-menu';
import { showMessage } from 'react-native-flash-message';
import ReportModal from './ReportModal';
import dayjs from 'dayjs';
import { get, getDatabase, ref, set } from '@react-native-firebase/database';
import ProfileBottomDrawer from '../../ChatScreen/GroupChat/BottomDrawer';
import { isUserOnline } from '../../ChatScreen/utils';
import FramedAvatar from '../../ChatScreen/GroupChat/FramedAvatar';
import { getCachedProfile } from '../../Helper/profileCache';
import UserBadgePill, { getFirstBadgeType } from '../../Helper/UserBadgePill';
import { GAME } from '../../config/game';
import { STATUS } from '../tokens';
import { getThemeColors } from '../../Helper/themeColors';
import { LIGHT } from '../tokens';
import { FONT } from '../tokens';

const REACTION_EMOJIS = ['❤️', '🔥', '😍', '💀', '🎯'];

const TAG_CONFIG = {
  'scam alert': { color: STATUS.danger, icon: 'shield-halved' },
  'looking for trade': { color: STATUS.success, icon: 'handshake' },
  'discussion': { color: STATUS.primary, icon: 'comments' },
  'real or fake': { color: '#8B5CF6', icon: 'magnifying-glass' },
  'need help': { color: STATUS.warning, icon: 'circle-question' },
  'misc': { color: LIGHT.textSecondary, icon: 'ellipsis' },
  'misc.': { color: LIGHT.textSecondary, icon: 'ellipsis' },
};

const PostCard = ({ item, userId, onLike, onReaction, localState, appdatabase, onDelete, onDeleteAll }) => {
  const navigation = useNavigation();

  // Support both old onLike and new onReaction
  const handleReaction = onReaction || onLike;

  // Merge likes + reactions into a unified map
  const mergedReactions = useMemo(() => {
    const map = {};
    if (item.likes) {
      Object.keys(item.likes).forEach(uid => {
        if (!item.reactions?.[uid]) map[uid] = '❤️';
      });
    }
    if (item.reactions) {
      Object.entries(item.reactions).forEach(([uid, emoji]) => {
        map[uid] = emoji;
      });
    }
    return map;
  }, [item.likes, item.reactions]);

  const myReaction = mergedReactions[userId] || null;
  const totalReactions = Object.keys(mergedReactions).length;

  const reactionCounts = useMemo(() => {
    const counts = {};
    Object.values(mergedReactions).forEach(emoji => {
      counts[emoji] = (counts[emoji] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 3);
  }, [mergedReactions]);

  const [showComments, setShowComments] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [isDrawerVisible, setIsDrawerVisible] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [heartScale] = useState(new Animated.Value(1));
  const [bannedUsers, setBannedUsers] = useState([]);
  const [isOnline, setIsOnline] = useState(false);

  useEffect(() => {
    setBannedUsers(localState.bannedUsers);
  }, [localState.bannedUsers]);

  const { theme, isAdmin } = useGlobalState();
  const isDark = theme === 'dark';
  const c = getThemeColors(isDark);

  const getTagConfig = (tag) => TAG_CONFIG[tag.toLowerCase()] || { color: config.colors.primary, icon: 'tag' };

  const banUserwithEmail = async (email, userId) => {
    const encodeEmail = (email) => email.replace(/\./g, '(dot)');
    try {
      const db = getDatabase();
      const banRef = ref(db, `banned_users_by_email_post/${encodeEmail(email)}`);
      const snap = await get(banRef);
      let strikeCount = 1;
      let bannedUntil = Date.now() + 24 * 60 * 60 * 1000;
      if (snap.exists()) {
        const data = snap.val();
        // Fallbacks matter here, and not just for tidiness: without them
        // `data.strikeCount + 1` is NaN whenever the stored record has no
        // strikeCount, and a NaN anywhere in a set() payload kills the process
        // rather than rejecting the promise — the native write throws a raw
        // DatabaseException ("Value cannot be NaN or Inf") that
        // @react-native-firebase blind-casts, so it surfaces as an uncaught
        // ClassCastException on a Play-services worker thread that no JS
        // try/catch can reach.
        //
        // The old code also *created* that state: the non-admin branch assigned
        // `undefined`, Firebase drops undefined keys, so the record came back
        // without a strikeCount and the next admin ban on the same user crashed.
        // Same hardening as banUserByEmail() in ChatScreen/utils.js.
        if (data && typeof data === 'object') {
          strikeCount = isAdmin ? (data.strikeCount || 0) + 1 : (data.strikeCount || 1);
        }
        if (strikeCount === 2) bannedUntil = Date.now() + 3 * 24 * 60 * 60 * 1000;
        else if (strikeCount >= 3) bannedUntil = "permanent";
      }
      await set(banRef, { strikeCount, bannedUntil, reason: `Strike ${strikeCount}` });
      await onDeleteAll(userId);
      if (isAdmin) { Alert.alert('User Banned', `Strike ${strikeCount} applied.`); }
    } catch (err) {
      console.error('Ban error:', err);
      if (isAdmin) { Alert.alert('Error', 'Could not ban user.'); }
    }
  };

  const closeProfileDrawer = () => setIsDrawerVisible(false);

  const openProfileDrawer = async () => {
    if (!userId) {
      showMessage({ message: 'Please sign in to message', type: 'warning' });
      return;
    }
    setIsOnline(false);
    try {
      const online = await isUserOnline(item?.userId);
      setIsOnline(online);
    } catch (error) {
      setIsOnline(false);
    }
    setIsDrawerVisible(true);
  };

  const selectedUser = {
    senderId: item.userId,
    sender: item.displayName,
    avatar: item.avatar,
    flage: item.flage ? item.flage : null,
    robloxUsername: item?.robloxUsername || null,
    robloxUsernameVerified: item?.robloxUsernameVerified || false,
  };

  const handleChatNavigation = useCallback(() => {
    const callback = () => {
      if (!userId) {
        showMessage({ message: 'Please sign in to message', type: 'warning' });
        return;
      }
      // Close drawer first (iOS doesn't auto-dismiss modals on navigation)
      setIsDrawerVisible(false);
      setTimeout(() => {
        mixpanel.track('Design Screen');
        navigation.navigate('PrivateChatDesign', { selectedUser, item });
      }, 300);
    };
    if (!localState?.isPro) {
      InterstitialAdManager.showAd(callback);
    } else {
      callback();
    }
  }, [userId, item, navigation, localState?.isPro]);

  const handleEmojiTap = useCallback((emoji) => {
    setShowEmojiPicker(false);
    Animated.sequence([
      Animated.spring(heartScale, { toValue: 1.4, useNativeDriver: true, speed: 40 }),
      Animated.spring(heartScale, { toValue: 1.0, useNativeDriver: true, speed: 40 }),
    ]).start();
    if (handleReaction) {
      handleReaction(item, emoji);
    }
  }, [item, handleReaction]);

  const handleQuickReact = useCallback(() => {
    Animated.sequence([
      Animated.spring(heartScale, { toValue: 1.35, useNativeDriver: true, speed: 40 }),
      Animated.spring(heartScale, { toValue: 1.0, useNativeDriver: true, speed: 40 }),
    ]).start();
    if (handleReaction) {
      if (myReaction) {
        handleReaction(item, myReaction);
      } else {
        handleReaction(item, '❤️');
      }
    }
  }, [myReaction, item, handleReaction]);

  const s = useMemo(() => getStyles(isDark), [isDark]);
  const formattedTime = item.createdAt ? dayjs(item.createdAt.toDate()).fromNow() : 'Anonymous';
  const hasNoImages = !Array.isArray(item.imageUrl) || item.imageUrl.length === 0;

  return (
    <View style={s.card}>
      {/* ── Header ── */}
      <View style={s.header}>
        <TouchableOpacity onPress={openProfileDrawer} activeOpacity={0.8}>
          <View style={s.avatarWrapper}>
            {/* Newer posts stamp the poster's frame; older ones fall back to
                the shared profile cache. */}
            <FramedAvatar
              avatarUri={item.avatar || GAME.defaultAvatar}
              frame={item.profileFrame || getCachedProfile(item.userId)?.profileFrame || null}
              isDarkMode={isDark}
              avatarSize={28}
              forceDetail
            />
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={{ marginLeft: 10, flex: 1 }} onPress={openProfileDrawer} activeOpacity={0.8}>
          <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 4 }}>
            <Text style={s.name} numberOfLines={1}>{item.displayName}</Text>
            {item.isPro && (
              <Image source={require('../../../assets/pro.png')} style={s.badge} />
            )}
            {item.robloxUsernameVerified && (
              <Image source={require('../../../assets/verification.png')} style={s.badge} />
            )}

            {/* Role pills, resolved from the profile cache — trade and post
                documents predate the role fields, so stamping them on the
                document would leave older rows badge-less. */}
            {(() => {
              const rp = getCachedProfile(item.userId) || {};
              const firstBadge = getFirstBadgeType(rp);
              return (
                <>
                  {rp.isAdmin && <UserBadgePill type="admin" size="sm" isDarkMode={isDark} glow={firstBadge === 'admin'} />}
                  {!rp.isAdmin && rp.isModerator && <UserBadgePill type="mod" size="sm" isDarkMode={isDark} glow={firstBadge === 'mod'} />}
                  {!rp.isAdmin && !rp.isModerator && rp.isBabyMod && <UserBadgePill type="jmd" size="sm" isDarkMode={isDark} glow={firstBadge === 'jmd'} />}
                  {rp.isTrusted && <UserBadgePill type="trusted" size="sm" isDarkMode={isDark} glow={firstBadge === 'trusted'} />}
                  {rp.isCMSR && <UserBadgePill type="cmsr" size="sm" isDarkMode={isDark} glow={firstBadge === 'cmsr'} />}
                  {rp.isHelper && <UserBadgePill type="helper" size="sm" isDarkMode={isDark} glow={firstBadge === 'helper'} />}
                </>
              );
            })()}
            {(() => {
              const hasRecentWin =
                !!item?.hasRecentGameWin ||
                (typeof item?.lastGameWinAt === 'number' &&
                  Date.now() - item.lastGameWinAt <= 24 * 60 * 60 * 1000);
              return hasRecentWin ? (
                <Image source={require('../../../assets/trophy.webp')} style={s.badge} />
              ) : null;
            })()}
          </View>
          <Text style={s.time}>{formattedTime}</Text>
        </TouchableOpacity>

        {/* Kebab menu */}
        <Menu>
          <MenuTrigger>
            <View style={s.menuBtn}>
              <Icon name="ellipsis-v" size={14} color={isDark ? '#94a3b8' : '#64748b'} />
            </View>
          </MenuTrigger>
          <MenuOptions customStyles={{ optionsContainer: { borderRadius: 14, overflow: 'hidden', backgroundColor: isDark ? config.colors.surfaceDark : '#fff', shadowColor: c.shadow, shadowOpacity: 0.15, shadowRadius: 12, elevation: 8, minWidth: 160 } }}>
            <MenuOption onSelect={() => setShowReportModal(true)}>
              <View style={s.menuItem}>
                <FontAwesome6 name="flag" size={12} color={STATUS.warning} solid />
                <Text style={[s.menuItemText, { color: STATUS.warning }]}>Report</Text>
              </View>
            </MenuOption>
            {(userId === item.userId || isAdmin) && (
              <MenuOption onSelect={() => Alert.alert('Delete Post', 'Are you sure you want to delete this post?', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Delete', onPress: () => onDelete(item.id), style: 'destructive' },
              ])}>
                <View style={[s.menuItem, { borderTopWidth: 1, borderTopColor: c.border }]}>
                  <FontAwesome6 name="trash" size={12} color={STATUS.danger} solid />
                  <Text style={[s.menuItemText, { color: STATUS.danger }]}>Delete</Text>
                </View>
              </MenuOption>
            )}
            {isAdmin && (
              <MenuOption onSelect={() => banUserwithEmail(item.email, item.userId)}>
                <View style={[s.menuItem, { borderTopWidth: 1, borderTopColor: c.border }]}>
                  <FontAwesome6 name="ban" size={12} color={STATUS.danger} solid />
                  <Text style={[s.menuItemText, { color: STATUS.danger }]}>Ban User</Text>
                </View>
              </MenuOption>
            )}
            {isAdmin && (
              <MenuOption onSelect={() => Alert.alert('Delete All', 'Are you sure?', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Delete', onPress: () => onDeleteAll(item.userId), style: 'destructive' },
              ])}>
                <View style={[s.menuItem, { borderTopWidth: 1, borderTopColor: c.border }]}>
                  <FontAwesome6 name="trash-can" size={12} color={STATUS.danger} solid />
                  <Text style={[s.menuItemText, { color: STATUS.danger }]}>Delete All</Text>
                </View>
              </MenuOption>
            )}
          </MenuOptions>
        </Menu>
      </View>

      {/* ── Text-only: desc + tags ── */}
      {hasNoImages && (
        <View style={s.textOnlyWrapper}>
          {item.selectedTags?.length > 0 && (
            <View style={s.tagOverlay}>
              {item.selectedTags.map((tag, idx) => {
                const cfg = getTagConfig(tag);
                return (
                  <View key={idx} style={[s.overlayPill, { backgroundColor: cfg.color }]}>
                    <FontAwesome6 name={cfg.icon} size={9} color="#fff" solid />
                    <Text style={s.overlayPillText}>{tag}</Text>
                  </View>
                );
              })}
            </View>
          )}
          {!!item?.desc && (
            <Text style={[s.desc, item.selectedTags?.length > 0 && { paddingRight: 80 }]}>
              {item.desc}
            </Text>
          )}
        </View>
      )}

      {/* ── Image(s) with overlay tags ── */}
      {!hasNoImages && (
        <View style={s.imageWrapper}>
          {/* Desc above image */}
          {!!item?.desc && (
            <Text style={[s.desc, { paddingHorizontal: 14, paddingBottom: 8 }]}>{item.desc}</Text>
          )}
          {/* Tag overlay */}
          <View style={s.tagOverlay}>
            {item.selectedTags?.map((tag, idx) => {
              const cfg = getTagConfig(tag);
              return (
                <View key={idx} style={[s.overlayPill, { backgroundColor: cfg.color }]}>
                  <FontAwesome6 name={cfg.icon} size={9} color="#fff" solid />
                  <Text style={s.overlayPillText}>{tag}</Text>
                </View>
              );
            })}
          </View>

          <View style={s.imageContainer}>
            {item.imageUrl.length === 1 ? (
              <TouchableOpacity
                activeOpacity={0.95}
                onPress={() => navigation.navigate('ImageViewerScreen', { images: item.imageUrl, initialIndex: 0 })}
              >
                <Image source={{ uri: item.imageUrl[0] }} style={s.singleImage} />
              </TouchableOpacity>
            ) : (
              <View style={s.multiGrid}>
                {item.imageUrl.slice(0, 4).map((url, idx) => (
                  <TouchableOpacity
                    key={idx}
                    style={[
                      s.gridCell,
                      item.imageUrl.length === 3 && idx === 0 && s.gridCellWide,
                    ]}
                    activeOpacity={0.9}
                    onPress={() => navigation.navigate('ImageViewerScreen', { images: item.imageUrl, initialIndex: idx })}
                  >
                    <Image source={{ uri: url }} style={s.gridImage} />
                    {idx === 3 && item.imageUrl.length > 4 && (
                      <View style={s.moreOverlay}>
                        <Text style={s.moreText}>+{item.imageUrl.length - 4}</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
          <ReportModal visible={showReportModal} onClose={() => setShowReportModal(false)} item={item} banUserwithEmail={banUserwithEmail} />
        </View>
      )}

      {hasNoImages && (
        <ReportModal visible={showReportModal} onClose={() => setShowReportModal(false)} item={item} banUserwithEmail={banUserwithEmail} />
      )}

      {/* ── Reaction summary chips ── */}
      {reactionCounts.length > 0 && (
        <View style={s.reactionSummary}>
          {reactionCounts.map(([emoji, count]) => (
            <View key={emoji} style={[s.reactionChip, mergedReactions[userId] === emoji && s.reactionChipActive]}>
              <Text style={{ fontSize: 11 }}>{emoji}</Text>
              <Text style={s.reactionChipCount}>{count}</Text>
            </View>
          ))}
          {totalReactions > 0 && (
            <Text style={s.totalReactionsText}>{totalReactions} {totalReactions === 1 ? 'reaction' : 'reactions'}</Text>
          )}
        </View>
      )}

      {/* ── Action Bar ── */}
      <View style={s.actionBar}>
        {/* React button */}
        <Animated.View style={{ transform: [{ scale: heartScale }] }}>
          <TouchableOpacity
            style={[s.actionBtn, myReaction && s.actionBtnActive]}
            onPress={() => setShowEmojiPicker(v => !v)}
            activeOpacity={0.75}
          >
            <Text style={{ fontSize: 14 }}>{myReaction || '🤍'}</Text>
            {totalReactions > 0 && (
              <Text style={[s.actionBtnLabel, myReaction && { color: STATUS.danger }]}>{totalReactions}</Text>
            )}
          </TouchableOpacity>
        </Animated.View>

        {/* Comment button */}
        <TouchableOpacity style={s.actionBtn} onPress={() => setShowComments(true)} activeOpacity={0.75}>
          <Icon name="comment-o" size={14} color={isDark ? '#94a3b8' : '#64748b'} />
          <Text style={s.actionBtnLabel}>
            {item.commentCount ? `${item.commentCount} comments` : '0 Comments'}
          </Text>
        </TouchableOpacity>

        <View style={{ flex: 1 }} />

        {/* Chat / DM button */}
        <TouchableOpacity style={s.chatBtn} onPress={openProfileDrawer} activeOpacity={0.8}>
          <Icon name="paper-plane" size={11} color="#fff" />
          <Text style={s.chatBtnLabel}>Chat</Text>
        </TouchableOpacity>
      </View>

      {/* ── Emoji Picker ── */}
      {showEmojiPicker && (
        <View style={s.emojiPicker}>
          {REACTION_EMOJIS.map((emoji) => (
            <TouchableOpacity
              key={emoji}
              style={[s.emojiBtn, myReaction === emoji && s.emojiBtnActive]}
              onPress={() => handleEmojiTap(emoji)}
              activeOpacity={0.8}
            >
              <Text style={{ fontSize: 22 }}>{emoji}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <CommentModal
        visible={showComments}
        onClose={() => setShowComments(false)}
        postId={item.id}
        appdatabase={appdatabase}
      />

      <ProfileBottomDrawer
        isVisible={isDrawerVisible}
        toggleModal={closeProfileDrawer}
        startChat={handleChatNavigation}
        selectedUser={selectedUser}
        isOnline={isOnline}
        bannedUsers={bannedUsers}
      />
    </View>
  );
};

const getStyles = (isDark, c = getThemeColors(isDark)) =>
  StyleSheet.create({
    card: {
      marginHorizontal: 12,
      marginVertical: 6,
      borderRadius: 20,
      backgroundColor: c.card,
      borderWidth: 1,
      borderColor: c.border,
      shadowColor: c.shadow,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: isDark ? 0.35 : 0.07,
      shadowRadius: 12,
      elevation: isDark ? 6 : 3,
      overflow: 'hidden',
    },

    /* Header */
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 14,
      paddingTop: 14,
      paddingBottom: 10,
    },
    avatarWrapper: {
      shadowColor: config.colors.primary,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.3,
      shadowRadius: 6,
    },
    avatar: {
      width: 42,
      height: 42,
      borderRadius: 21,
      borderWidth: 2.5,
      borderColor: config.colors.primary,
    },
    badge: {
      width: 11,
      height: 11,
    },
    name: {
      fontFamily: FONT.bold,
      fontSize: 14,
      color: isDark ? '#e2e8f0' : config.colors.backgroundDark,
      letterSpacing: 0.1,
    },
    time: {
      fontSize: 11,
      color: c.textMuted,
      marginTop: 2,
    },
    menuBtn: {
      width: 30,
      height: 30,
      borderRadius: 15,
      backgroundColor: c.card,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: c.border,
    },
    menuItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingVertical: 12,
      paddingHorizontal: 14,
    },
    menuItemText: {
      fontSize: 13,
      fontFamily: FONT.regular,
    },

    /* Description */
    desc: {
      fontSize: 14,
      color: isDark ? '#cbd5e1' : config.colors.surfaceElevatedDark,
      lineHeight: 21,
    },

    /* Text-only wrapper */
    textOnlyWrapper: {
      position: 'relative',
      minHeight: 44,
      paddingHorizontal: 14,
      paddingBottom: 10,
    },

    /* Images */
    imageWrapper: {
      marginHorizontal: 14,
      marginBottom: 8,
      borderRadius: 16,
      overflow: 'hidden',
    },
    tagOverlay: {
      position: 'absolute',
      top: 8,
      right: 8,
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 4,
      zIndex: 10,
    },
    overlayPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 9,
      paddingVertical: 4,
      borderRadius: 999,
    },
    overlayPillText: {
      fontSize: 10,
      color: c.textInverse,
      fontFamily: FONT.bold,
    },
    imageContainer: {
      borderRadius: 16,
      overflow: 'hidden',
    },
    singleImage: {
      width: '100%',
      height: 230,
      resizeMode: 'cover',
    },
    multiGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 3,
    },
    gridCell: {
      width: '49.3%',
      height: 140,
      borderRadius: 10,
      overflow: 'hidden',
    },
    gridCellWide: {
      width: '100%',
      height: 180,
    },
    gridImage: {
      width: '100%',
      height: '100%',
      resizeMode: 'cover',
    },
    moreOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0,0,0,0.55)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    moreText: {
      color: c.textInverse,
      fontSize: 22,
      fontFamily: FONT.bold,
    },

    /* Reaction summary */
    reactionSummary: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 14,
      paddingBottom: 6,
      flexWrap: 'wrap',
    },
    reactionChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 999,
      backgroundColor: isDark ? config.colors.surfaceDark : '#f1f5f9',
      borderWidth: 1,
      borderColor: c.border,
    },
    reactionChipActive: {
      backgroundColor: c.card,
      borderColor: isDark ? '#6A5ACD' : '#bfdbfe',
    },
    reactionChipCount: {
      fontSize: 10,
      fontFamily: FONT.bold,
      color: c.textSecondary,
    },
    totalReactionsText: {
      fontSize: 10,
      color: c.textMuted,
      marginLeft: 2,
    },

    /* Action bar */
    actionBar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 14,
      paddingBottom: 12,
      paddingTop: 6,
      borderTopWidth: 1,
      borderTopColor: c.border,
    },
    actionBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
      backgroundColor: isDark ? config.colors.backgroundDark : '#f8fafc',
      borderWidth: 1,
      borderColor: c.border,
    },
    actionBtnActive: {
      backgroundColor: isDark ? config.colors.surfaceDark : '#fff1f2',
      borderColor: STATUS.danger,
    },
    actionBtnLabel: {
      fontSize: 11,
      fontFamily: FONT.regular,
      color: c.textSecondary,
    },
    chatBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 13,
      paddingVertical: 7,
      borderRadius: 999,
      backgroundColor: config.colors.primary,
      shadowColor: config.colors.primary,
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.35,
      shadowRadius: 6,
      elevation: 4,
    },
    chatBtnLabel: {
      color: c.textInverse,
      fontFamily: FONT.bold,
      fontSize: 11,
    },

    /* Emoji picker */
    emojiPicker: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 6,
      paddingVertical: 10,
      marginHorizontal: 14,
      marginBottom: 10,
      backgroundColor: isDark ? config.colors.backgroundDark : '#f8fafc',
      borderRadius: 20,
      borderWidth: 1,
      borderColor: c.border,
    },
    emojiBtn: {
      width: 42,
      height: 42,
      borderRadius: 21,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: isDark ? config.colors.surfaceDark : '#ffffff',
      borderWidth: 1,
      borderColor: c.border,
    },
    emojiBtnActive: {
      backgroundColor: c.card,
      borderWidth: 2,
      borderColor: config.colors.primary,
    },
  });

export default memo(PostCard, (prevProps, nextProps) => {
  return (
    prevProps.item.id === nextProps.item.id &&
    prevProps.item.likes === nextProps.item.likes &&
    prevProps.item.reactions === nextProps.item.reactions &&
    prevProps.item.commentCount === nextProps.item.commentCount &&
    prevProps.item.imageUrl === nextProps.item.imageUrl &&
    prevProps.userId === nextProps.userId &&
    prevProps.localState?.isPro === nextProps.localState?.isPro &&
    prevProps.appdatabase === nextProps.appdatabase &&
    prevProps.onReaction === nextProps.onReaction &&
    prevProps.onLike === nextProps.onLike &&
    prevProps.onDelete === nextProps.onDelete &&
    prevProps.onDeleteAll === nextProps.onDeleteAll
  );
});
