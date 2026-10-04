import React, { useState, useMemo, useCallback, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  FlatList,
  Image,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useGlobalState } from '../../GlobelStats';
import { createGroup, updateGroupName, updateGroupDescription, updateGroupAvatar } from '../utils/groupUtils';
import { showSuccessMessage, showErrorMessage } from '../../Helper/MessageHelper';
import { useHaptic } from '../../Helper/HepticFeedBack';
import { useNavigation } from '@react-navigation/native';
import { pickImages } from '../../Helper/imagePicker';
import RNFS from 'react-native-fs';
import { useTranslation } from 'react-i18next';
import config from '../../Helper/Environment';
import { GAME } from '../../config/game';
import { STATUS } from '../../Design/tokens';
import { getThemeColors } from '../../Helper/themeColors';
import { ModalKeyboardView } from '../../Helper/keyboardAvoidingContainer';
import { SIZE } from '../../Design/tokens';
import { SPACE } from '../../Design/tokens';
import { FONT } from '../../Design/tokens';

const BUNNY_STORAGE_HOST = 'storage.bunnycdn.com';
const BUNNY_STORAGE_ZONE = 'post-gag';
const BUNNY_ACCESS_KEY = '1b7e1a85-dff7-4a98-ba701fc7f9b9-6542-46e2';
const BUNNY_CDN_BASE = 'https://pull-gag.b-cdn.net';

const base64ToBytes = (base64) => {
  if (!base64 || typeof base64 !== 'string') {
    throw new Error('Invalid base64 input');
  }

  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
  let str = base64.replace(/[\r\n]+/g, '');
  let output = [];

  let i = 0;
  while (i < str.length) {
    const enc1 = chars.indexOf(str.charAt(i++));
    const enc2 = chars.indexOf(str.charAt(i++));
    const enc3 = chars.indexOf(str.charAt(i++));
    const enc4 = chars.indexOf(str.charAt(i++));

    if (enc1 === -1 || enc2 === -1 || enc3 === -1 || enc4 === -1) {
      throw new Error('Invalid base64 character');
    }

    const chr1 = (enc1 << 2) | (enc2 >> 4);
    const chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
    const chr3 = ((enc3 & 3) << 6) | enc4;

    if (enc3 !== 64) {
      output.push(chr1, chr2);
    } else {
      output.push(chr1);
    }
    if (enc4 !== 64 && enc3 !== 64) {
      output.push(chr3);
    }
  }

  return Uint8Array.from(output);
};

const MAX_GROUP_MEMBERS = 50;

// onGroupCreated(groupId, groupName): optional. When given, the caller owns
// what happens after a successful create (close its own sheet, navigate);
// otherwise this modal navigates to the new chat itself.
const CreateGroupModal = ({ visible, onClose, selectedUsers = [], editGroupId = null, editGroupName = null, editGroupDescription = null, editGroupAvatar = null, isAdmin = false, onGroupUpdated = null, onGroupCreated = null }) => {
  const { theme, user, firestoreDB, appdatabase } = useGlobalState();
  const insets = useSafeAreaInsets();
  const isEditMode = !!editGroupId;
  const { triggerHapticFeedback } = useHaptic();
  const navigation = useNavigation();
  const isDarkMode = theme === 'dark';
  const c = getThemeColors(isDarkMode);
  const styles = useMemo(() => getStyles(isDarkMode), [isDarkMode]);
  const { t } = useTranslation();

  const [groupName, setGroupName] = useState('');
  const [groupDescription, setGroupDescription] = useState('');
  const [creating, setCreating] = useState(false);
  const [selectedMemberIds, setSelectedMemberIds] = useState([]);
  const [groupAvatarUri, setGroupAvatarUri] = useState(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const previousVisibleRef = useRef(false);
  const initializedEditGroupIdRef = useRef(null);
  const hasInitializedSelectedUsersRef = useRef(false);

  // Initialize selectedMemberIds from selectedUsers when modal opens (only once per modal open)
  React.useEffect(() => {
    if (visible && !isEditMode) {
      // Only initialize once when modal opens
      if (!hasInitializedSelectedUsersRef.current) {
        const currentIds = selectedUsers.map((u) => u.id).filter((id) => id !== user?.id);
        setSelectedMemberIds(currentIds);
        hasInitializedSelectedUsersRef.current = true;
      }
    } else if (!visible) {
      // Reset flag when modal closes
      hasInitializedSelectedUsersRef.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, isEditMode]); // Only depend on visible and isEditMode, not selectedUsers to avoid resetting when parent clears

  // Reset when modal closes
  React.useEffect(() => {
    if (!visible && previousVisibleRef.current) {
      // Modal just closed - reset everything
      setGroupName('');
      setGroupDescription('');
      setCreating(false);
      setSelectedMemberIds([]);
      setGroupAvatarUri(null);
      setUploadingAvatar(false);
      initializedEditGroupIdRef.current = null;
    }
    previousVisibleRef.current = visible;
  }, [visible]);

  // Initialize edit data when modal opens in edit mode (only once per group)
  React.useEffect(() => {
    if (!visible) return;
    
    if (isEditMode && editGroupId) {
      // Only initialize if we haven't initialized for this group yet
      if (initializedEditGroupIdRef.current !== editGroupId) {
        setGroupName(editGroupName || '');
        setGroupDescription(editGroupDescription || '');
        setGroupAvatarUri(editGroupAvatar || null);
        initializedEditGroupIdRef.current = editGroupId;
      }
    } else if (!isEditMode) {
      // Create mode - ensure fields are empty and reset ref
      if (initializedEditGroupIdRef.current !== null) {
        setGroupName('');
        setGroupDescription('');
        setGroupAvatarUri(null);
        initializedEditGroupIdRef.current = null;
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, isEditMode, editGroupId]); // Only depend on these to avoid loops

  // Upload image to BunnyCDN
  const uploadToBunny = useCallback(async (imagePath) => {
    try {
      const base64 = await RNFS.readFile(imagePath.replace('file://', ''), 'base64');
      const bytes = base64ToBytes(base64);
      const fileName = `group_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.jpg`;
      const filePath = `groups/${fileName}`;

      const response = await fetch(`https://${BUNNY_STORAGE_HOST}/${BUNNY_STORAGE_ZONE}/${filePath}`, {
        method: 'PUT',
        headers: {
          AccessKey: BUNNY_ACCESS_KEY,
          'Content-Type': 'image/jpeg',
        },
        body: bytes,
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      return `${BUNNY_CDN_BASE}/${filePath}`;
    } catch (error) {
      console.error('Error uploading to BunnyCDN:', error);
      throw error;
    }
  }, []);

  // Handle image picker
  const handlePickImage = useCallback(() => {
    pickImages(
      {
        mediaType: 'photo',
        selectionLimit: 1,
        quality: 0.8,
      },
      async (response) => {
        if (response.didCancel || response.errorCode) {
          return;
        }

        const asset = response.assets?.[0];
        if (asset?.uri) {
          setGroupAvatarUri(asset.uri);
        }
      }
    );
  }, []);

  // Filter out current user and get selected users
  const displayUsers = useMemo(() => {
    return selectedUsers.filter((u) => u.id !== user?.id);
  }, [selectedUsers, user?.id]);

  const handleRemoveUser = (userId) => {
    triggerHapticFeedback('impactLight');
    setSelectedMemberIds((prev) => prev.filter((id) => id !== userId));
  };

  // Handle submit (create or update)
  const handleSubmit = async () => {
    if (!user?.id || !firestoreDB || !appdatabase) {
      showErrorMessage(t('home.alert.error'), t('create_group.missing_data'));
      return;
    }

    // Validate group name (required for both create and edit)
    if (!groupName.trim()) {
      showErrorMessage(t('home.alert.error'), t('create_group.name_required'));
      return;
    }

    if (isEditMode) {
      // Edit mode - only update name, description, and avatar
      await handleUpdateGroup();
    } else {
      // Create mode - validate members and create group
      await handleCreateGroup();
    }
  };

  // Handle create group
  const handleCreateGroup = async () => {
    // Validate description (required for create)
    if (!groupDescription.trim()) {
      showErrorMessage(t('home.alert.error'), t('create_group.description_required'));
      return;
    }

    // Validate member count
    const totalMembers = 1 + selectedMemberIds.length; // Creator + selected members
    if (totalMembers < 2) {
      showErrorMessage(t('home.alert.error'), t('create_group.min_member'));
      return;
    }

    if (totalMembers > MAX_GROUP_MEMBERS) {
      showErrorMessage(t('home.alert.error'), t('create_group.max_member', { count: MAX_GROUP_MEMBERS }));
      return;
    }

    setCreating(true);
    triggerHapticFeedback('impactMedium');

    try {
      // Upload group avatar if selected
      let groupAvatarUrl = null;
      if (groupAvatarUri) {
        setUploadingAvatar(true);
        try {
          groupAvatarUrl = await uploadToBunny(groupAvatarUri);
        } catch (error) {
          console.error('Error uploading group avatar:', error);
          showErrorMessage(t('home.alert.error'), t('create_group.create_avatar_upload_failed'));
        } finally {
          setUploadingAvatar(false);
        }
      }

      // ✅ Build user data map from selectedUsers to avoid extra Firestore read
      const invitedUsersMap = {};
      displayUsers.forEach((u) => {
        if (u.id && selectedMemberIds.includes(u.id)) {
          invitedUsersMap[u.id] = {
            displayName: u.displayName || t('private_chat.anonymous'),
            avatar: u.avatar || null,
          };
        }
      });

      const result = await createGroup(
        firestoreDB,
        appdatabase,
        {
          id: user.id,
          displayName: user.displayName || t('private_chat.anonymous'),
          avatar: user.avatar || null,
        },
        selectedMemberIds,
        groupName.trim(),
        invitedUsersMap, // ✅ Pass user data to avoid extra Firestore read
        groupAvatarUrl, // Pass group avatar URL
        groupDescription.trim() // Pass group description
      );

      if (result.success) {
        showSuccessMessage(t('home.alert.success'), t('create_group.create_success'));
        onClose();
        // The member picker this opens from is itself a Modal. Navigating from
        // here left that sheet open on top of the new chat, so the picker
        // passes onGroupCreated to close itself first and navigate.
        if (result.groupId && typeof onGroupCreated === 'function') {
          onGroupCreated(result.groupId, groupName.trim() || t('groups_screen.group'));
        } else if (result.groupId && navigation && typeof navigation.navigate === 'function') {
          navigation.navigate('GroupChatDetail', {
            groupId: result.groupId,
            groupName: groupName.trim() || t('groups_screen.group'),
          });
        }
      } else {
        showErrorMessage(t('home.alert.error'), result.error || t('create_group.create_failed'));
      }
    } catch (error) {
      console.error('Error creating group:', error);
      showErrorMessage(t('home.alert.error'), t('create_group.create_failed_try_again'));
    } finally {
      setCreating(false);
    }
  };

  // Handle update group (edit mode)
  const handleUpdateGroup = async () => {
    if (!editGroupId) {
      showErrorMessage(t('home.alert.error'), t('create_group.missing_group_id'));
      return;
    }

    setCreating(true);
    triggerHapticFeedback('impactMedium');

    try {
      // Upload group avatar if a new one was selected
      let groupAvatarUrl = null;
      if (groupAvatarUri && groupAvatarUri !== editGroupAvatar) {
        // Only upload if it's a new image (different from the original)
        setUploadingAvatar(true);
        try {
          groupAvatarUrl = await uploadToBunny(groupAvatarUri);
        } catch (error) {
          console.error('Error uploading group avatar:', error);
          showErrorMessage(t('home.alert.error'), t('create_group.update_avatar_upload_failed'));
        } finally {
          setUploadingAvatar(false);
        }
      } else if (groupAvatarUri === editGroupAvatar) {
        // Same image, use existing URL
        groupAvatarUrl = editGroupAvatar;
      }

      // Update group name if changed
      if (groupName.trim() !== (editGroupName || '')) {
        const nameResult = await updateGroupName(
          firestoreDB,
          appdatabase,
          editGroupId,
          user.id,
          groupName.trim(),
          isAdmin
        );
        if (!nameResult.success) {
          showErrorMessage(t('home.alert.error'), nameResult.error || t('create_group.update_name_failed'));
          setCreating(false);
          return;
        }
      }

      // Update group description if changed (max 100 chars)
      const trimmedDescription = groupDescription.trim().substring(0, 100);
      if (trimmedDescription !== (editGroupDescription || '')) {
        const descResult = await updateGroupDescription(
          firestoreDB,
          appdatabase,
          editGroupId,
          user.id,
          trimmedDescription,
          isAdmin
        );
        if (!descResult.success) {
          showErrorMessage(t('home.alert.error'), descResult.error || t('create_group.update_desc_failed'));
          setCreating(false);
          return;
        }
      }

      // Update group avatar if changed
      if (groupAvatarUrl !== null && groupAvatarUrl !== editGroupAvatar) {
        const avatarResult = await updateGroupAvatar(
          firestoreDB,
          appdatabase,
          editGroupId,
          user.id,
          groupAvatarUrl,
          isAdmin
        );
        if (!avatarResult.success) {
          showErrorMessage(t('home.alert.error'), avatarResult.error || t('create_group.update_icon_failed'));
          setCreating(false);
          return;
        }
      }

      showSuccessMessage(t('home.alert.success'), t('create_group.update_success'));
      if (onGroupUpdated && typeof onGroupUpdated === 'function') {
        onGroupUpdated();
      }
      onClose();
    } catch (error) {
      console.error('Error updating group:', error);
      showErrorMessage(t('home.alert.error'), t('create_group.update_failed_try_again'));
    } finally {
      setCreating(false);
    }
  };

  const totalMembers = 1 + selectedMemberIds.length;

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      {/* ModalKeyboardView, not a bare KeyboardAvoidingView: inside a Modal,
          Android already resizes the window for the keyboard, and the old
          behavior 'height' moved the sheet a second time. The bottom inset
          lives only on the footer below -- it used to be added here too, so
          the sheet sat a full nav-bar height too high. */}
      <ModalKeyboardView style={styles.keyboardAvoidingView}>
        <View style={styles.overlay}>
          <View style={[styles.container, { backgroundColor: isDarkMode ? config.colors.surfaceDark : '#fff' }]}>
            {/* Header */}
            <View style={styles.header}>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <Icon name="close" size={24} color={isDarkMode ? '#fff' : '#000'} />
              </TouchableOpacity>
              <Text style={styles.headerTitle}>{isEditMode ? t('create_group.edit_title') : t('create_group.create_title')}</Text>
              <View style={styles.placeholder} />
            </View>

            <ScrollView showsVerticalScrollIndicator={false} bounces={false} keyboardShouldPersistTaps="handled">
              {/* Group Icon Selection */}
              <View style={styles.avatarContainer}>
                <Text style={styles.label}>{t('create_group.group_icon_label')}</Text>
                <TouchableOpacity
                  onPress={handlePickImage}
                  style={styles.avatarButton}
                  disabled={uploadingAvatar}
                >
                  {groupAvatarUri ? (
                    <Image source={{ uri: groupAvatarUri }} style={styles.avatarPreview} />
                  ) : (
                    <View style={[styles.avatarPlaceholder, { backgroundColor: c.card }]}>
                      <Icon name="camera" size={32} color={isDarkMode ? '#666' : '#999'} />
                    </View>
                  )}
                  {uploadingAvatar && (
                    <View style={styles.uploadingOverlay}>
                      <ActivityIndicator size="small" color="#fff" />
                    </View>
                  )}
                  {groupAvatarUri && !uploadingAvatar && (
                    <TouchableOpacity
                      style={styles.removeAvatarButton}
                      onPress={() => setGroupAvatarUri(null)}
                    >
                      <Icon name="close-circle" size={20} color={STATUS.danger} />
                    </TouchableOpacity>
                  )}
                </TouchableOpacity>
              </View>

              {/* Group Name Input */}
              <View style={styles.inputContainer}>
                <Text style={styles.label}>{t('create_group.group_name_label')} <Text style={{ color: STATUS.danger }}>*</Text></Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: c.card,
                      color: c.text,
                    },
                  ]}
                  placeholder={t('create_group.group_name_placeholder')}
                  placeholderTextColor={isDarkMode ? '#999' : '#888'}
                  value={groupName}
                  onChangeText={setGroupName}
                  maxLength={50}
                />
              </View>

              {/* Group Description Input */}
              <View style={styles.inputContainer}>
                <Text style={styles.label}>
                  {t('create_group.description_label')} {!isEditMode && <Text style={{ color: STATUS.danger }}>*</Text>}
                  {isEditMode && <Text style={{ fontSize: SIZE.caption, color: c.textSecondary }}> {t('create_group.max_char', { max: 100 })}</Text>}
                </Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: c.card,
                      color: c.text,
                      minHeight: 80,
                      textAlignVertical: 'top',
                    },
                  ]}
                  placeholder={isEditMode ? t('create_group.desc_placeholder_optional') : t('create_group.desc_placeholder_required')}
                  placeholderTextColor={isDarkMode ? '#999' : '#888'}
                  value={groupDescription}
                  onChangeText={setGroupDescription}
                  multiline
                  maxLength={isEditMode ? 100 : 200}
                />
              </View>

              {/* Selected Members Count - Only show in create mode */}
              {!isEditMode && (
                <>
                  <View style={styles.memberCountContainer}>
                    <Text style={styles.memberCountText}>
                      {selectedMemberIds.length === 1 ? t('create_group.members_selected_singular', { count: selectedMemberIds.length }) : t('create_group.members_selected_plural', { count: selectedMemberIds.length })}
                      {totalMembers >= MAX_GROUP_MEMBERS && (
                        <Text style={styles.maxReachedText}> {t('create_group.max_reached')}</Text>
                      )}
                    </Text>
                  </View>

                  {/* Selected Members List */}
                  <FlatList removeClippedSubviews={false}
                    data={displayUsers.filter((u) => selectedMemberIds.includes(u.id))}
                    keyExtractor={(item) => item.id}
                    scrollEnabled={false}
                    renderItem={({ item }) => (
                      <View style={styles.memberItem}>
                        <Image
                          source={{
                            uri:
                              item.avatar ||
                              GAME.defaultAvatar,
                          }}
                          style={styles.memberAvatar}
                        />
                        <Text style={styles.memberName} numberOfLines={1}>
                          {item.displayName || t('private_chat.anonymous')}
                        </Text>
                        <TouchableOpacity
                          onPress={() => handleRemoveUser(item.id)}
                          style={styles.removeButton}
                        >
                          <Icon name="close-circle" size={24} color={STATUS.danger} />
                        </TouchableOpacity>
                      </View>
                    )}
                    ListEmptyComponent={
                      <View style={styles.emptyContainer}>
                        <Text style={styles.emptyText}>{t('create_group.no_members')}</Text>
                      </View>
                    }
                    style={styles.membersList}
                  />
                </>
              )}
            </ScrollView>

            {/* Create Button */}
            {/* Own base padding plus the inset (edge-to-edge Android draws
                under the nav bar), never one in place of the other. */}
            <View style={[styles.footer, { paddingBottom: SPACE.xl + insets.bottom }]}>
              <TouchableOpacity
                style={[
                  styles.createButton,
                (creating || (!isEditMode && (totalMembers < 2 || totalMembers > MAX_GROUP_MEMBERS || !groupName.trim() || !groupDescription.trim())) || (isEditMode && !groupName.trim())) &&
                  styles.createButtonDisabled,
              ]}
              onPress={handleSubmit}
                disabled={creating || uploadingAvatar || (!isEditMode && (totalMembers < 2 || totalMembers > MAX_GROUP_MEMBERS || !groupName.trim() || !groupDescription.trim())) || (isEditMode && !groupName.trim())}
              >
                {(creating || uploadingAvatar) ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Icon name={isEditMode ? "checkmark" : "people"} size={20} color="#fff" />
                    <Text style={styles.createButtonText}>{isEditMode ? t('create_group.update_button') : t('create_group.create_button')}</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ModalKeyboardView>
    </Modal>
  );
};

const getStyles = (isDark, c = getThemeColors(isDark)) =>
  StyleSheet.create({
    keyboardAvoidingView: {
      flex: 1,
      justifyContent: 'flex-end',
    },
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'flex-end',
    },
    container: {
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      paddingTop: SPACE.xxxl,
      paddingHorizontal: SPACE.xxxl,
      maxHeight: '90%',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: SPACE.xxxl,
    },
    closeButton: {
      padding: SPACE.xs,
    },
    headerTitle: {
      fontSize: SIZE.heading,
      fontFamily: FONT.bold,
      color: c.text,
    },
    placeholder: {
      width: 32,
    },
    avatarContainer: {
      marginBottom: SPACE.xxl,
      alignItems: 'center',
    },
    avatarButton: {
      position: 'relative',
      width: 100,
      height: 100,
      borderRadius: 50,
      overflow: 'hidden',
      marginTop: SPACE.md,
    },
    avatarPreview: {
      width: 100,
      height: 100,
      borderRadius: 50,
    },
    avatarPlaceholder: {
      width: 100,
      height: 100,
      borderRadius: 50,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: c.border,
      borderStyle: 'dashed',
    },
    uploadingOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 50,
    },
    removeAvatarButton: {
      position: 'absolute',
      top: -5,
      right: -5,
      backgroundColor: c.card,
      borderRadius: 12,
    },
    inputContainer: {
      marginBottom: SPACE.xxl,
    },
    label: {
      fontSize: SIZE.body,
      fontFamily: FONT.bold,
      color: c.text,
      marginBottom: SPACE.md,
    },
    input: {
      borderRadius: 12,
      padding: SPACE.xl,
      fontSize: SIZE.subtitle,
      fontFamily: FONT.regular,
    },
    memberCountContainer: {
      marginBottom: SPACE.xl,
    },
    memberCountText: {
      fontSize: SIZE.body,
      fontFamily: FONT.bold,
      color: c.textSecondary,
    },
    maxReachedText: {
      color: STATUS.danger,
    },
    membersList: {
      maxHeight: 300,
      marginBottom: SPACE.xxl,
    },
    memberItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: SPACE.xl,
      paddingHorizontal: SPACE.xl,
      backgroundColor: c.card,
      borderRadius: 12,
      marginBottom: SPACE.md,
    },
    memberAvatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      marginRight: SPACE.xl,
    },
    memberName: {
      flex: 1,
      fontSize: SIZE.subtitle,
      fontFamily: FONT.regular,
      color: c.text,
    },
    removeButton: {
      padding: SPACE.xs,
    },
    emptyContainer: {
      padding: 40,
      alignItems: 'center',
    },
    emptyText: {
      fontSize: SIZE.body,
      fontFamily: FONT.regular,
      color: c.textSecondary,
    },
    footer: {
      paddingTop: SPACE.xxl,
      borderTopWidth: 1,
      borderTopColor: c.border,
    },
    createButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#8B5CF6',
      paddingVertical: 14,
      borderRadius: 12,
      gap: SPACE.md,
    },
    createButtonDisabled: {
      backgroundColor: '#6b7280',
      opacity: 0.6,
    },
    createButtonText: {
      fontSize: SIZE.subtitle,
      fontFamily: FONT.bold,
      color: c.textInverse,
    },
  });

export default CreateGroupModal;

