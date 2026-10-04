import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  Platform,
  Linking,
  Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useGlobalState } from '../../GlobelStats';
import config from '../../Helper/Environment';
import { useTranslation } from 'react-i18next';
import ChatRulesModal from './ChatRuleModal';
import OnlineUsersList from './OnlineUsersList';
import { getThemeColors } from '../../Helper/themeColors';
import { SIZE } from '../../Design/tokens';
import { SPACE } from '../../Design/tokens';
import { FONT } from '../../Design/tokens';

const URL_REGEX = /(https?:\/\/[^\s]+)/g;

const ChatHeaderContent = ({
  selectedTheme,
  modalVisibleChatinfo,
  setModalVisibleChatinfo,
  triggerHapticFeedback,
  pinnedMessages,
  onUnpinMessage,
  onlineUsersVisible,
  setOnlineUsersVisible,
}) => {
  const { theme, isAdmin, user } = useGlobalState();
  // Moderators pin, so they can unpin too (Adopt Me allows both).
  const canManagePins = isAdmin || !!user?.isModerator;
  const isDarkMode = theme === 'dark';
  const { t } = useTranslation();
  const [pinMessageOpen, setPinMessageOpen] = useState(false);
  
  const styles = useMemo(() => getStyles(isDarkMode), [isDarkMode]);

  const renderMessageWithLinks = useCallback((message) => {
    if (!message || typeof message !== 'string') {
      return <Text style={styles.pinnedText}>Invalid message</Text>;
    }

    const parts = message.split(URL_REGEX);
    return parts.map((part, index) => {
      if (part && (part.startsWith('http://') || part.startsWith('https://'))) {
        return (
          <Text
            key={index}
            style={[styles.pinnedText, { textDecorationLine: 'underline', color: 'blue' }]}
            onPress={() => {
              Linking.openURL(part).catch((error) => {
                console.error('Failed to open URL:', error);
                Alert.alert('Error', 'Could not open the link.');
              });
            }}
          >
            {part}
          </Text>
        );
      }
      return <Text key={index} style={styles.pinnedText}>{part}</Text>;
    });
  }, []);

  const uniquePinnedMessages = useMemo(() => {
    if (!Array.isArray(pinnedMessages) || pinnedMessages.length === 0) {
      return [];
    }
    return Array.from(
      new Map(pinnedMessages.map((msg) => [msg?.firebaseKey, msg]).filter(([key]) => key)).values()
    );
  }, [pinnedMessages]);

  return (
    <>
      <View style={{
        flexDirection: 'row', justifyContent: 'space-between', padding: SPACE.lg, alignItems: 'center', borderBottomWidth: .3, borderBottomColor: 'lightgrey',
      }}>
        <Text style={{ fontSize: SIZE.caption, color: isDarkMode ? 'white' : 'black' }}>
          {t('chat.rules_banner', { defaultValue: '🚫 No Spamming ❌ No Abuse 🛑 Be Civil & Polite 😊' })}
        </Text>
        <TouchableOpacity onPress={() => { setModalVisibleChatinfo(true); triggerHapticFeedback('impactLight'); }}>
          <Icon name="information-circle-outline" size={20} color={config.colors.primary} style={{ marginRight: SPACE.lg }} />
        </TouchableOpacity>
      </View>

      {/* Displaying truncated pinned messages */}
      {uniquePinnedMessages.length > 0 && (
        <View style={styles.pinnedContainer}>
          {uniquePinnedMessages.slice(0, 1).map((msg) => {
            const msgText = msg?.text || '';
            const normalizedText = msgText.replace(/\n/g, ' ');
            const displayText = normalizedText.length > 40 
              ? normalizedText.substring(0, 40) + '...' 
              : normalizedText;

            return (
              <View key={msg?.firebaseKey || 'unknown'} style={styles.singlePinnedMessage}>
                <View>
                  <Text style={styles.pinnedTextheader}>Pin Message</Text>
                  <Text style={styles.pinnedText}>{displayText}</Text>
                </View>
                <TouchableOpacity onPress={() => setPinMessageOpen(true)} style={{ justifyContent: 'center' }}>
                  <Icon name="chevron-forward-outline" size={20} color={config.colors.primary} style={styles.pinIcon} />
                </TouchableOpacity>
              </View>
            );
          })}
        </View>
      )}

      {/* Modal for showing all pinned messages */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={pinMessageOpen}
        onRequestClose={() => setPinMessageOpen(false)}
      >
        <View style={styles.modalContainer}>
          <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', minWidth: 320 }}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Pin Messages</Text>
              {uniquePinnedMessages.map((msg) => {
                if (!msg || !msg.firebaseKey) return null;
                
                return (
                  <View key={msg.firebaseKey} style={styles.singlePinnedMessageModal}>
                    {renderMessageWithLinks(msg.text || '')}
                    {canManagePins && (
                      <TouchableOpacity 
                        onPress={() => {
                          if (onUnpinMessage && typeof onUnpinMessage === 'function') {
                            onUnpinMessage(msg.firebaseKey);
                          }
                        }} 
                        style={{ backgroundColor: config.colors.primary, marginVertical: 3 }}
                      >
                        <Text style={{ paddingHorizontal: SPACE.lg, paddingVertical: 5, borderRadius: 5, color: 'white' }}>Delete</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })}
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setPinMessageOpen(false)}
              >
                <Text style={styles.closeButtonText}>{t("chat.got_it")}</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>
      <ChatRulesModal
        visible={modalVisibleChatinfo}
        onClose={() => setModalVisibleChatinfo(false)}
        isDarkMode={isDarkMode}
      />
      {onlineUsersVisible !== undefined && setOnlineUsersVisible && (
        <OnlineUsersList
          visible={onlineUsersVisible}
          onClose={() => setOnlineUsersVisible(false)}
          mode="view"
        />
      )}
    </>
  );
};

const getStyles = (isDarkMode, c = getThemeColors(isDarkMode)) => StyleSheet.create({
  pinnedText: {
    fontSize: SIZE.caption,
    fontFamily: FONT.regular,
    color: c.text,
  },
  modalContent: {
    width: '95%',
    backgroundColor: isDarkMode ? config.colors.backgroundDark : '#f2f2f7',
    borderRadius: 10,
    padding: SPACE.xxxl,
  },
  modalTitle: {
    fontSize: SIZE.heading,
    fontFamily: FONT.bold,
    marginBottom: SPACE.xxxl,
    color: c.text,
  },
  pinnedContainer: {
    borderBottomWidth: 0.3,
    borderBottomColor: 'lightgrey',
  },
  singlePinnedMessage: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 5,
    borderBottomWidth: 0.2,
    paddingHorizontal: SPACE.lg,
  },
  singlePinnedMessageModal: {
    justifyContent: 'space-between',
    lineHeight: 24,
    paddingVertical: SPACE.lg,
    borderBottomWidth: 0.2,
  },
  pinnedTextheader: {
    fontSize: SIZE.caption,
    paddingRight: SPACE.xxxl,
    fontFamily: FONT.regular,
    color: config.colors.primary,
  },
  pinIcon: {
    marginLeft: SPACE.lg,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    width: '100%',
  },
  closeButton: {
    backgroundColor: config.colors.hasBlockGreen,
    padding: SPACE.lg,
    borderRadius: 5,
    alignItems: 'center',
    marginTop: SPACE.xxxl,
  },
  closeButtonText: {
    color: c.textInverse,
    fontSize: SIZE.subtitle,
    fontFamily: FONT.bold,
  },
});

export default ChatHeaderContent;

