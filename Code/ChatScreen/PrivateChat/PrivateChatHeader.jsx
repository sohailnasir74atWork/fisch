import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import config from '../../Helper/Environment';
import { useLocalState } from '../../LocalGlobelStats';
import { useTranslation } from 'react-i18next';
import { useOnlineStatus, setPersonalBlock } from '../utils';
import { showSuccessMessage } from '../../Helper/MessageHelper';
import Clipboard from '@react-native-clipboard/clipboard';
import { useHaptic } from '../../Helper/HepticFeedBack';
import { useGlobalState } from '../../GlobelStats';
import { ref, get, set, remove } from '@react-native-firebase/database';
import FramedAvatar from '../GroupChat/FramedAvatar';
import { getCachedProfile, warmProfileCache, getOrFetchFullProfile } from '../../Helper/profileCache';
import UserBadgePill, { getPrimaryRoleType } from '../../Helper/UserBadgePill';
import { GAME } from '../../config/game';
import { STATUS } from '../../Design/tokens';
import { SIZE } from '../../Design/tokens';
import { SPACE } from '../../Design/tokens';
import { FONT } from '../../Design/tokens';

// Presence needs its own two colours so Online and Offline never collapse into
// the same swatch. Green/grey is the convention every chat app uses, and grey
// reads as "away" rather than "error" the way a red dot would.
const ONLINE_COLOR = '#10B981';
const OFFLINE_COLOR = '#9CA3AF';

const PrivateChatHeader = React.memo(({ selectedUser, selectedTheme, bannedUsers, isDrawerVisible, setIsDrawerVisible }) => {
  const { localState, updateLocalState } = useLocalState();
  const { t } = useTranslation();
  // Live presence. This was a one-time read when the header mounted, so the
  // dot stayed on whatever it was when the chat opened.
  const isOnline = useOnlineStatus(selectedUser?.senderId || selectedUser?.id);
  const { triggerHapticFeedback } = useHaptic();
  const { user, appdatabase } = useGlobalState();
  
  // ✅ State for fetched user data (roblox username, etc.)
  const [userData, setUserData] = useState(null);

  // Pull this user's cosmetics into the shared cache so their frame renders.
  const [frameVersion, setFrameVersion] = useState(0);
  useEffect(() => {
    const uid = selectedUser?.senderId || selectedUser?.id;
    if (!uid || !appdatabase || getCachedProfile(uid)) return;
    let cancelled = false;
    warmProfileCache(appdatabase, [uid])
      .then(() => { if (!cancelled) setFrameVersion(v => v + 1); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [selectedUser?.senderId, selectedUser?.id, appdatabase]);

  // ✅ Memoize copyToClipboard
  const copyToClipboard = useCallback((code) => {
    if (!code || typeof code !== 'string') return;
    triggerHapticFeedback('impactLight');
    Clipboard.setString(code);
    showSuccessMessage(t("value.copy"), "Copied to Clipboard");
  }, [triggerHapticFeedback, t]);

  // Fetch the profile record for roles, Pro and verification. This used to
  // bail out whenever the caller already passed robloxUsername — which Trades
  // and the Feed always do — so those headers never showed any role badge.
  // getOrFetchFullProfile is cached, so fetching unconditionally is cheap;
  // mergedUser still keeps the caller's name and avatar.
  useEffect(() => {
    const selectedUserId = selectedUser?.senderId || selectedUser?.id;
    if (!selectedUserId || !appdatabase) return;

    let isMounted = true;

    const fetchUserData = async () => {
      try {
        // ✅ OPTIMIZED: Fetch only specific fields instead of full user object
        // One cached read of users/{uid} instead of five parallel leaf reads
        // (PLAN_2026-09.md F1); it also carries the role flags the pills need.
        const record = await getOrFetchFullProfile(appdatabase, selectedUserId);

        if (!isMounted) return;

        setUserData(record ? {
          robloxUsername: record.robloxUsername ?? null,
          robloxUserId: record.robloxUserId ?? null,
          robloxUsernameVerified: !!record.robloxUsernameVerified,
          isPro: !!record.isPro,
          lastGameWinAt: record.lastGameWinAt ?? null,
          isAdmin: !!record.admin || !!record.isAdmin,
          isModerator: !!record.isModerator,
          isBabyMod: !!record.isBabyMod,
          isTrusted: !!record.isTrusted,
          isCMSR: !!record.isCMSR,
          isHelper: !!record.isHelper,
        } : null);
      } catch (error) {
        console.error('Error fetching user data in PrivateChatHeader:', error);
        if (isMounted) setUserData(null);
      }
    };

    fetchUserData();

    return () => {
      isMounted = false;
    };
  }, [selectedUser?.senderId, selectedUser?.id, appdatabase]);

  // ✅ Merge selectedUser with fetched userData
  const mergedUser = useMemo(() => {
    if (!userData) return selectedUser;
    return {
      ...selectedUser,
      robloxUsername: selectedUser?.robloxUsername || userData.robloxUsername,
      robloxUserId: selectedUser?.robloxUserId || userData.robloxUserId,
      // The live record wins: Trades and the Feed pass a snapshot that is
      // `|| false` when absent, which used to hide a real verified tick.
      robloxUsernameVerified: userData.robloxUsernameVerified || !!selectedUser?.robloxUsernameVerified,
      isPro: selectedUser?.isPro !== undefined ? selectedUser.isPro : userData.isPro,
      // Roles only ever come from the RTDB record.
      isAdmin: userData.isAdmin,
      isModerator: userData.isModerator,
      isBabyMod: userData.isBabyMod,
      isTrusted: userData.isTrusted,
      isCMSR: userData.isCMSR,
      isHelper: userData.isHelper,
      lastGameWinAt: selectedUser?.lastGameWinAt !== undefined 
        ? selectedUser.lastGameWinAt 
        : userData.lastGameWinAt, // ✅ Game win timestamp
    };
  }, [selectedUser, userData]);

  // ✅ Memoize avatarUri and userName
  const avatarUri = useMemo(() => 
    mergedUser?.avatar || GAME.defaultAvatar,
    [mergedUser?.avatar]
  );
  
  const userName = useMemo(() => 
    mergedUser?.sender || 'User',
    [mergedUser?.sender]
  );

  // ✅ Check if user is banned with array validation
  const isBanned = useMemo(() => {
    const selectedUserId = mergedUser?.senderId || mergedUser?.id;
    if (!selectedUserId) return false;
    // Device list first: the prop is [] on the Trades / Feed stacks.
    const device = Array.isArray(localState?.bannedUsers) ? localState.bannedUsers : [];
    const banned = Array.isArray(bannedUsers) ? bannedUsers : [];
    return device.includes(selectedUserId) || banned.includes(selectedUserId);
  }, [bannedUsers, localState?.bannedUsers, mergedUser?.senderId, mergedUser?.id]);

  // ✅ Memoize handleBanToggle
  const handleBanToggle = useCallback(async () => {
    const selectedUserId = mergedUser?.senderId || mergedUser?.id;
    if (!selectedUserId) {
      console.warn('⚠️ Invalid user ID for ban toggle');
      return;
    }

    const action = !isBanned ? 'Block' : 'Unblock';
    Alert.alert(
      `${action}`,
      `${t("chat.are_you_sure")} ${action.toLowerCase()} ${userName}?`,
      [
        { text: t("chat.cancel"), style: 'cancel' },
        {
          text: action,
          style: 'destructive',
          onPress: async () => {
            try {
              // Merge into the DEVICE list: the bannedUsers prop is [] when
              // this chat was opened from Trades / Feed, and building from it
              // replaced the whole block list with this one user.
              await setPersonalBlock({
                db: appdatabase,
                myId: user?.id,
                targetId: selectedUserId,
                block: !isBanned,
                current: Array.isArray(localState?.bannedUsers) ? localState.bannedUsers : bannedUsers,
                updateLocalState,
                displayName: userName,
                avatar: avatarUri,
              });
            } catch (error) {
              console.error('❌ Error toggling ban status:', error);
              Alert.alert(t('home.alert.error'), 'Could not update the block list. Please try again.');
            }
          },
        },
      ]
    );
  }, [isBanned, bannedUsers, localState?.bannedUsers, mergedUser?.senderId, mergedUser?.id, userName, avatarUri, user?.id, appdatabase, t, updateLocalState]);

  // ✅ Memoize drawer open handler
  const handleOpenDrawer = useCallback(() => {
    if (setIsDrawerVisible && typeof setIsDrawerVisible === 'function') {
      setIsDrawerVisible(true);
    }
  }, [setIsDrawerVisible]);

  // Role tags this user actually holds, in the app's canonical order:
  // one authority pill (admin > mod > jmd, mutually exclusive) followed by any
  // community pills. Only the first one glows, matching every other surface.
  const badgeTypes = useMemo(() => {
    if (!mergedUser) return [];
    const list = [];
    const primary = getPrimaryRoleType(mergedUser);
    if (primary) list.push(primary);
    if (mergedUser.isTrusted) list.push('trusted');
    if (mergedUser.isCMSR) list.push('cmsr');
    if (mergedUser.isHelper) list.push('helper');
    return list;
  }, [mergedUser]);
  const firstBadge = badgeTypes[0] || null;

  const hasRecentWin = useMemo(() => (
    !!mergedUser?.hasRecentGameWin ||
    (typeof mergedUser?.lastGameWinAt === 'number' &&
      Date.now() - mergedUser.lastGameWinAt <= 24 * 60 * 60 * 1000)
  ), [mergedUser?.hasRecentGameWin, mergedUser?.lastGameWinAt]);

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={handleOpenDrawer}>
        <FramedAvatar
          avatarUri={avatarUri}
          frame={getCachedProfile(selectedUser?.senderId || selectedUser?.id)?.profileFrame || null}
          isDarkMode={selectedTheme?.dark ?? false}
          avatarSize={40}
          forceDetail
        />
      </TouchableOpacity>
      <TouchableOpacity style={styles.infoContainer} onPress={handleOpenDrawer} activeOpacity={0.7}>
        {/* Line 1 — name, then the small status icons, then copy.
            These used to be nested inside the <Text> alongside the role pills.
            A <View> inside <Text> only lays out on Android with fixed
            dimensions, so the pills (flex rows with padding and a border) were
            squeezed to nothing and a long username pushed everything off the
            end with no way to truncate. They are real siblings now. */}
        <View style={styles.nameRow}>
          <Text
            style={[styles.userName, { color: selectedTheme?.colors?.text || '#000' }]}
            numberOfLines={1}
          >
            {userName}
          </Text>
          {mergedUser?.isPro && (
            <Image source={require('../../../assets/pro.png')} style={styles.inlineIcon} />
          )}
          {mergedUser?.robloxUsernameVerified && (
            <Image source={require('../../../assets/verification.png')} style={styles.inlineIcon} />
          )}
          {hasRecentWin && (
            <Image source={require('../../../assets/trophy.webp')} style={styles.trophyIcon} />
          )}
          <TouchableOpacity
            onPress={() => copyToClipboard(userName)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Icon name="copy-outline" size={15} color={STATUS.primary} />
          </TouchableOpacity>
        </View>

        {/* Line 2 — presence, then whatever role tags this user holds. Giving
            the tags their own line is what "room for them" means here: on the
            name line a single ADMIN pill would eat the width a real username
            needs. The row collapses to just the status when a user has no
            roles, so nobody pays for blank space they never use. */}
        <View style={styles.metaRow}>
          <View
            style={[
              styles.presenceDot,
              { backgroundColor: isOnline ? ONLINE_COLOR : OFFLINE_COLOR },
            ]}
          />
          <Text
            style={[
              styles.statusText,
              { color: isOnline ? ONLINE_COLOR : OFFLINE_COLOR },
            ]}
          >
            {isOnline
              ? t('chat.online', { defaultValue: 'Online' })
              : t('chat.offline', { defaultValue: 'Offline' })}
          </Text>
          {badgeTypes.map((type) => (
            <UserBadgePill
              key={type}
              type={type}
              size="sm"
              isDarkMode={selectedTheme?.dark ?? false}
              glow={type === firstBadge}
            />
          ))}
        </View>
      </TouchableOpacity>
      <TouchableOpacity onPress={handleBanToggle}>
        <Icon
          name={isBanned ? 'shield-checkmark-outline' : 'ban-outline'}
          size={24}
          color={isBanned ? config.colors.hasBlockGreen : config.colors.wantBlockRed}
          style={styles.banIcon}
        />
      </TouchableOpacity>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: SPACE.lg,
    backgroundColor: 'white',
  },
  infoContainer: {
    flex: 1,
    marginLeft: SPACE.lg,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  userName: {
    fontSize: SIZE.subtitle,
    fontFamily: FONT.bold,
    // Shrink before the icons do, so a long username truncates with an
    // ellipsis instead of shoving the verified tick and copy button off-screen.
    flexShrink: 1,
  },
  inlineIcon: {
    width: 13,
    height: 13,
  },
  trophyIcon: {
    width: 11,
    height: 11,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 5,
    marginTop: 3,
  },
  presenceDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: SIZE.label,
    fontFamily: FONT.bold,
  },
  banIcon: {
    marginLeft: SPACE.lg,
  },
});

export default PrivateChatHeader;
