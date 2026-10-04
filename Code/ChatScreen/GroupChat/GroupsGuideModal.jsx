import React, { useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useGlobalState } from '../../GlobelStats';
import config from '../../Helper/Environment';
import { getThemeColors } from '../../Helper/themeColors';
import { SIZE } from '../../Design/tokens';
import { SPACE } from '../../Design/tokens';
import { FONT } from '../../Design/tokens';

const GroupsGuideModal = ({ visible, onClose }) => {
  const { theme } = useGlobalState();
  const isDarkMode = theme === 'dark';
  const c = getThemeColors(isDarkMode);

  const styles = useMemo(() => getStyles(isDarkMode), [isDarkMode]);

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={[styles.modalContent, { backgroundColor: isDarkMode ? config.colors.surfaceDark : '#FFFFFF' }]}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: c.text }]}>
              Groups Guide
            </Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Icon name="close-circle" size={28} color={isDarkMode ? '#9CA3AF' : '#6B7280'} />
            </TouchableOpacity>
          </View>

          {/* Content. Rewritten to match the screens as they actually are:
              the old copy pointed at a "+ in the header" that does not exist,
              said the creator always stays admin (ownership can be handed
              over), talked about pets, and promised new-message
              notifications that nothing currently sends. Plain English, like
              the rest of this modal -- it has never used translation keys. */}
          <ScrollView
            showsVerticalScrollIndicator={false}
            style={styles.scrollContainer}
            contentContainerStyle={styles.scrollContent}
          >
            <View style={styles.section}>
              <View style={styles.iconContainer}>
                <Icon name="people" size={24} color={config.colors.primary} />
              </View>
              <Text style={[styles.sectionTitle, { color: c.text }]}>
                How to Create a Group
              </Text>
              <Text style={[styles.sectionText, { color: c.textSecondary }]}>
                1. On this Groups screen, open the Joined Groups tab and tap the "Create" button at the bottom right.{'\n\n'}
                2. Pick members. The list shows who is online right now; to find anyone else, type at least 2 letters in "Search by name" (it matches the start of a name). Tap people to select them.{'\n\n'}
                3. Tap "Create" at the top of the list.{'\n\n'}
                4. Enter a group name and a short description (both required), and optionally pick a group icon.{'\n\n'}
                5. Tap "Create Group". Everyone you picked gets an invitation to join.
              </Text>
            </View>

            <View style={styles.divider} />

            <View style={styles.section}>
              <View style={styles.iconContainer}>
                <Icon name="person-add" size={24} color={config.colors.primary} />
              </View>
              <Text style={[styles.sectionTitle, { color: c.text }]}>
                Joining a Group
              </Text>
              <Text style={[styles.sectionText, { color: c.textSecondary }]}>
                • <Text style={styles.boldText}>Invitations:</Text> They appear under "Pending Invitations" on the Joined Groups tab. You join only after you accept, and an invitation expires after 7 days.{'\n\n'}
                • <Text style={styles.boldText}>Requests:</Text> On the All Groups tab, tap "Send Request" on any group. Its owner can approve or reject it from "Join Requests".
              </Text>
            </View>

            <View style={styles.divider} />

            <View style={styles.section}>
              <View style={styles.iconContainer}>
                <Icon name="information-circle" size={24} color={config.colors.primary} />
              </View>
              <Text style={[styles.sectionTitle, { color: c.text }]}>
                Important Rules
              </Text>
              <Text style={[styles.sectionText, { color: c.textSecondary }]}>
                • <Text style={styles.boldText}>One Group Each:</Text> You can own one group at a time. Once you own one, the bottom button becomes "Add Members" and invites people to it.{'\n\n'}
                • <Text style={styles.boldText}>Size:</Text> You need to invite at least 1 person to create a group, and a group can have up to 50 members.{'\n\n'}
                • <Text style={styles.boldText}>Owner:</Text> The group owner can invite and remove members, edit the group's name, description and icon from its ⋮ menu, and delete the group.{'\n\n'}
                • <Text style={styles.boldText}>Passing Ownership:</Text> In the chat, tap the member count at the top, then the star next to a member to make them the owner. This is permanent: you become a regular member.{'\n\n'}
                • <Text style={styles.boldText}>Leaving:</Text> Anyone can leave at any time. If the owner leaves, a random remaining member becomes the owner. When the last member leaves, the group is deleted.
              </Text>
            </View>

            <View style={styles.divider} />

            <View style={styles.section}>
              <View style={styles.iconContainer}>
                <Icon name="chatbubbles" size={24} color={config.colors.primary} />
              </View>
              <Text style={[styles.sectionTitle, { color: c.text }]}>
                Group Features
              </Text>
              <Text style={[styles.sectionText, { color: c.textSecondary }]}>
                • Send text, up to 3 images, and up to 18 items (fish, rods, rod skins, bobbers, lanterns) per message.{'\n\n'}
                • Tap a message to copy it or reply to it.{'\n\n'}
                • Tap the member count at the top of a chat to see the members and who is online.{'\n\n'}
                • You can mute a group from its ⋮ menu or the bell next to it in your groups list.
              </Text>
            </View>
          </ScrollView>

          {/* Close Button */}
          <TouchableOpacity
            style={[styles.gotItButton, { backgroundColor: config.colors.primary }]}
            onPress={onClose}
          >
            <Text style={styles.gotItButtonText}>Got It!</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const getStyles = (isDarkMode, c = getThemeColors(isDarkMode)) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    modalContent: {
      width: '90%',
      height: '85%',
      borderRadius: 20,
      padding: SPACE.xxxl,
      shadowColor: c.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 4,
      elevation: 5,
      justifyContent: 'space-between',
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: SPACE.xxxl,
    },
    modalTitle: {
      fontSize: SIZE.title,
      fontFamily: FONT.bold,
    },
    closeButton: {
      padding: SPACE.xs,
    },
    scrollContainer: {
      flex: 1,
      marginBottom: SPACE.xxxl,
    },
    scrollContent: {
      paddingBottom: SPACE.lg,
    },
    section: {
      marginBottom: SPACE.xxxl,
    },
    iconContainer: {
      marginBottom: SPACE.xl,
    },
    sectionTitle: {
      fontSize: SIZE.subtitle,
      fontFamily: FONT.bold,
      marginBottom: SPACE.xl,
    },
    sectionText: {
      fontSize: SIZE.body,
      fontFamily: FONT.regular,
      lineHeight: 22,
    },
    boldText: {
      fontFamily: FONT.bold,
      color: config.colors.primary,
    },
    divider: {
      height: 1,
      backgroundColor: isDarkMode ? config.colors.surfaceElevatedDark : '#E5E7EB',
      marginVertical: SPACE.xxxl,
    },
    gotItButton: {
      paddingVertical: 14,
      paddingHorizontal: 30,
      borderRadius: 10,
      alignItems: 'center',
      marginTop: SPACE.lg,
    },
    gotItButtonText: {
      color: c.textInverse,
      fontSize: SIZE.subtitle,
      fontFamily: FONT.bold,
    },
  });

export default GroupsGuideModal;

