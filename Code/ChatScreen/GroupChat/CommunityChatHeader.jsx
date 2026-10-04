import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useGlobalState } from '../../GlobelStats';
import { useNavigation } from '@react-navigation/native';
import config from '../../Helper/Environment';
import { useTranslation } from 'react-i18next';

import { useHaptic } from '../../Helper/HepticFeedBack';
// Game invites were removed with the mini-games; Fisch has no gaming features.
import { collection, query, where, onSnapshot } from '@react-native-firebase/firestore';
import { SIZE } from '../../Design/tokens';
import { SPACE } from '../../Design/tokens';
import { FONT } from '../../Design/tokens';
const CommunityChatHeader = ({
  selectedTheme,
  unreadcount,
  setunreadcount,
  groupUnreadCount = 0,
  setGroupUnreadCount,
  triggerHapticFeedback,
  onOnlineUsersPress,

}) => {
  const { user, firestoreDB, theme, isAdmin, canGrantJmd } = useGlobalState();
  // Same gate Home uses for its Moderation tile.
  const canOpenModeration = isAdmin || !!user?.isModerator || !!user?.isBabyMod || !!canGrantJmd;
  const navigation = useNavigation();
  const { t } = useTranslation();
  // ✅ MM2: Removed gameModalVisible, hasValidInvite - MM2 doesn't use gaming features
  const [pendingGroupInvitationsCount, setPendingGroupInvitationsCount] = useState(0);
  const [pendingJoinRequestsCount, setPendingJoinRequestsCount] = useState(0);
  const isDarkMode = theme === 'dark';

  // ✅ MM2: Removed game invitation listening logic - MM2 doesn't use gaming features

  // ✅ Listen to pending group invitations
  useEffect(() => {
    if (!firestoreDB || !user?.id) {
      setPendingGroupInvitationsCount(0);
      return;
    }

    const invitationsQuery = query(
      collection(firestoreDB, 'group_invitations'),
      where('invitedUserId', '==', user.id),
      where('status', '==', 'pending')
    );

    const unsubscribe = onSnapshot(
      invitationsQuery,
      (snapshot) => {
        const now = Date.now();
        let validCount = 0;
        
        snapshot.forEach((doc) => {
          const data = doc.data();
          // Check if invitation is not expired
          if (data.expiresAt && now < data.expiresAt) {
            validCount++;
          } else if (!data.expiresAt) {
            // If no expiry, consider it valid
            validCount++;
          }
        });
        
        setPendingGroupInvitationsCount(validCount);
      },
      (error) => {
        console.error('Error loading group invitations:', error);
        setPendingGroupInvitationsCount(0);
      }
    );

    return () => unsubscribe();
  }, [firestoreDB, user?.id]);

  // ✅ Listen to pending join requests for groups where user is creator (optimized - only count)
  useEffect(() => {
    if (!firestoreDB || !user?.id) {
      setPendingJoinRequestsCount(0);
      return;
    }

    const joinRequestsQuery = query(
      collection(firestoreDB, 'group_join_requests'),
      where('creatorId', '==', user.id),
      where('status', '==', 'pending')
    );

    const unsubscribe = onSnapshot(
      joinRequestsQuery,
      (snapshot) => {
        setPendingJoinRequestsCount(snapshot.size);
      },
      (error) => {
        console.error('Error loading join requests count:', error);
        if (error.code === 'failed-precondition') {
          console.error('⚠️ Firestore index required. Please create index for group_join_requests: creatorId (Ascending), status (Ascending)');
        }
        setPendingJoinRequestsCount(0);
      }
    );

    return () => unsubscribe();
  }, [firestoreDB, user?.id]);

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: SPACE.md , }}>
      {user?.id && (
        <>
          {/* ✅ MM2: Removed Pet Guessing Game Button - MM2 doesn't use gaming features */}

          {/* Inbox Button (Private Chats) */}
          <TouchableOpacity
            onPress={() => {
              navigation.navigate('Inbox');
              triggerHapticFeedback('impactLight');
              // No local zeroing: the chats are still unread until opened. The
              // inbox listener owns this count; clearing it here made the badge
              // vanish and then reappear on the next chat_meta_data event.
            }}
            style={{ position: 'relative', padding: SPACE.md, marginRight: SPACE.xs }}
          >
            <Icon
              name="chatbox-outline"
              size={24}
              color={config.colors.primary}
            />
            {unreadcount > 0 && (
              <View style={{ position: 'absolute', top: 4, right: 4, backgroundColor: 'red', borderRadius: 8, minWidth: 16, height: 16, justifyContent: 'center', alignItems: 'center', paddingHorizontal: SPACE.xs }}>
                <Text style={{ color: '#fff', fontSize: SIZE.label, fontFamily: FONT.bold }}>
                  {unreadcount > 9 ? '9+' : unreadcount}
                </Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Groups Button */}
          <TouchableOpacity
            onPress={() => {
              navigation.navigate('Groups');
              triggerHapticFeedback('impactLight');
              // Not zeroed here either — see the Inbox button.
            }}
            style={{ position: 'relative', padding: SPACE.md, marginRight: SPACE.xs }}
          >
            <Icon
              name="people-circle-outline"
              size={24}
              color={config.colors.primary}
            />
            {/* Show "!" if there are pending invitations or join requests (prioritized), otherwise show unread count */}
            {(pendingGroupInvitationsCount > 0 || pendingJoinRequestsCount > 0 || groupUnreadCount > 0) && (
              <View style={{ position: 'absolute', top: 4, right: 4, backgroundColor: '#10B981', borderRadius: 8, minWidth: 16, height: 16, justifyContent: 'center', alignItems: 'center', paddingHorizontal: SPACE.xs }}>
                <Text style={{ color: '#fff', fontSize: SIZE.label, fontFamily: FONT.bold }}>
                  {(pendingGroupInvitationsCount > 0 || pendingJoinRequestsCount > 0) ? '!' : (groupUnreadCount > 9 ? '9+' : groupUnreadCount)}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </>
      )}
      {/* Online users. The sheet was already mounted by ChatHeaderContent and
          wired through ChatNavigator, but no button ever opened it. */}
      <TouchableOpacity
        onPress={() => {
          triggerHapticFeedback('impactLight');
          if (onOnlineUsersPress) onOnlineUsersPress();
        }}
        style={{ padding: SPACE.md, marginRight: SPACE.xs }}
        accessibilityLabel={t('chat.online_users', { defaultValue: 'Online users' })}
      >
        <Icon name="globe-outline" size={24} color={config.colors.primary} />
      </TouchableOpacity>

      {user?.id && canOpenModeration && (
        <TouchableOpacity
          onPress={() => {
            triggerHapticFeedback('impactLight');
            navigation.navigate('Admin');
          }}
          style={{ padding: SPACE.md, marginRight: SPACE.xs }}
          accessibilityLabel="Moderation"
        >
          <Icon name="shield-checkmark-outline" size={24} color={config.colors.primary} />
        </TouchableOpacity>
      )}

      {user?.id && (
        <>

          {/* Blocked Users */}
          <TouchableOpacity
            onPress={() => {
              navigation?.navigate('BlockedUsers');
              triggerHapticFeedback('impactLight');
            }}
            style={{ padding: SPACE.md }}
          >
            <Icon name="ban-outline" size={24} color={config.colors.primary} />
          </TouchableOpacity>
        </>
      )}

      {/* ✅ MM2: Removed Pet Guessing Game Modal - MM2 doesn't use gaming features */}

    </View>
  );
};

export default CommunityChatHeader;

