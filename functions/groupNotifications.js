/**
 * groupNotifications.js — push notifications for group chats.
 *
 * 📅 2026-09-23. Until now nothing in this project notified on group
 * activity: no push for a group message, an invitation, or a join request.
 * The in-app mute switch on a group wrote `group_meta_data/{u}/{g}/muted`
 * and nothing read it. Ported from Adopt Me's RTDB-era notifiers
 * (notifyGroupMessageLegacy, notifyGroupInvitation, notifyGroupJoinRequest),
 * which fire off exactly the fields this app already writes — the client
 * needs no change.
 *
 * Adopt Me's per-user `notificationSettings` checks are left out: this app
 * has no such settings screen, so they would be a read per push for a flag
 * nobody can set.
 *
 * Cost: groupUtils.sendGroupMessage bumps `unreadCount` only for members who
 * are NOT in the chat, so this runs once per away member per message (~3
 * reads each). Groups cap at 50 members.
 */

const admin = require('firebase-admin');
const functions = require('firebase-functions/v1');

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = () => admin.database();

const DEAD_TOKEN_CODES = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
  'messaging/invalid-argument',
]);

// Same clean-up notifyNewMessage does: a dead token never works again, and
// isTokenInvalid makes the app re-register on its next launch.
const sendOrClearToken = async (userId, message) => {
  try {
    await admin.messaging().send(message);
  } catch (error) {
    console.error('Push failed:', error && error.code, error && error.message);
    if (error && DEAD_TOKEN_CODES.has(error.code)) {
      try {
        await db().ref(`/users/${userId}`).update({ fcmToken: null, isTokenInvalid: true });
      } catch (e) {
        console.warn('Could not clear token:', e.message);
      }
    }
  }
};

// ── Group message ─────────────────────────────────────────────────────────
// Fired off the member's own unread counter, like notifyNewMessage. Only a
// genuine increase is a new message; the reader's reset-to-zero is ignored.
exports.notifyGroupMessage = functions
  .runWith({ memory: '128MB', timeoutSeconds: 30 })
  .database
  .ref('/group_meta_data/{userId}/{groupId}/unreadCount')
  .onWrite(async (change, context) => {
    const { userId, groupId } = context.params;

    const beforeUnread = change.before.val();
    const afterUnread = change.after.val();
    if (!afterUnread || afterUnread <= beforeUnread) return null;

    const [activeSnap, metaSnap, tokenSnap] = await Promise.all([
      db().ref(`/activeGroupChats/${groupId}/${userId}`).once('value'),
      db().ref(`/group_meta_data/${userId}/${groupId}`).once('value'),
      db().ref(`/users/${userId}/fcmToken`).once('value'),
    ]);

    // Reading the group right now.
    if (activeSnap.val() === true) return null;
    if (!metaSnap.exists()) return null;

    const meta = metaSnap.val() || {};
    // The group's mute switch (GroupsScreen menu / bell).
    if (meta.muted === true) return null;

    const fcmToken = tokenSnap.val();
    if (!fcmToken) return null;

    const title = meta.groupName || 'Group Chat';
    const body = meta.lastMessageSenderName
      ? `${meta.lastMessageSenderName}: ${meta.lastMessage || 'New message'}`
      : (meta.lastMessage || 'You have a new message.');

    await sendOrClearToken(userId, {
      notification: { title, body },
      data: {
        type: 'groupChat',
        groupId: groupId || '',
        senderId: meta.lastMessageSenderId || '',
        timestamp: meta.lastMessageTimestamp ? String(meta.lastMessageTimestamp) : String(Date.now()),
      },
      token: fcmToken,
      android: { priority: 'high' },
    });
    return null;
  });

// ── Group invitation ──────────────────────────────────────────────────────
exports.notifyGroupInvitation = functions
  .runWith({ memory: '128MB', timeoutSeconds: 30 })
  .firestore
  .document('group_invitations/{inviteId}')
  .onCreate(async (snap, context) => {
    const invite = snap.data() || {};
    const { inviteId } = context.params;

    if (invite.status !== 'pending') return null;
    if (invite.expiresAt && Date.now() > invite.expiresAt) return null;

    const userId = invite.invitedUserId;
    if (!userId) return null;

    const fcmToken = (await db().ref(`/users/${userId}/fcmToken`).once('value')).val();
    if (!fcmToken) return null;

    const groupName = invite.groupName || 'a group';
    const inviter = invite.invitedByDisplayName || 'Someone';

    await sendOrClearToken(userId, {
      notification: {
        title: 'Group Invitation',
        body: `${inviter} invited you to join "${groupName}"`,
      },
      data: {
        type: 'groupInvitation',
        inviteId: inviteId || '',
        groupId: invite.groupId || '',
        invitedBy: invite.invitedBy || '',
        timestamp: String(Date.now()),
      },
      token: fcmToken,
      android: { priority: 'high' },
    });
    return null;
  });

// ── Join request (to the group's owner) ───────────────────────────────────
exports.notifyGroupJoinRequest = functions
  .runWith({ memory: '128MB', timeoutSeconds: 30 })
  .firestore
  .document('group_join_requests/{requestId}')
  .onCreate(async (snap, context) => {
    const request = snap.data() || {};
    const { requestId } = context.params;

    if (request.status !== 'pending') return null;

    const ownerId = request.creatorId;
    if (!ownerId) return null;

    const fcmToken = (await db().ref(`/users/${ownerId}/fcmToken`).once('value')).val();
    if (!fcmToken) return null;

    const groupName = request.groupName || 'your group';
    const requester = request.requesterDisplayName || 'Someone';

    await sendOrClearToken(ownerId, {
      notification: {
        title: 'Join Request',
        body: `${requester} wants to join "${groupName}"`,
      },
      data: {
        type: 'groupJoinRequest',
        requestId: requestId || '',
        groupId: request.groupId || '',
        requesterId: request.requesterId || '',
        timestamp: String(Date.now()),
      },
      token: fcmToken,
      android: { priority: 'high' },
    });
    return null;
  });
