import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { View, TextInput, TouchableOpacity, Text, Modal, StyleSheet, Image, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getStyles } from './../Style';
import Icon from 'react-native-vector-icons/Ionicons';
import config from '../../Helper/Environment';
import { useHaptic } from '../../Helper/HepticFeedBack';
import { useTranslation } from 'react-i18next';
import { useLocalState } from '../../LocalGlobelStats';
import InterstitialAdManager from '../../Ads/IntAd';
import { CHAT_MESSAGES_PER_AD } from '../../Ads/adPolicy';
import { useGlobalState } from '../../GlobelStats';
import { validateContent } from '../../Helper/ContentModeration';
import { showMessage } from 'react-native-flash-message';
import { STATUS } from '../../Design/tokens';
import { SIZE } from '../../Design/tokens';
import { SPACE } from '../../Design/tokens';

// ✅ Move Emojies array outside component to prevent recreation
const Emojies = [
  'pic_1.png',
  'pic_2.png',
  'pic_3.png',
  'pic_4.png',
  'pic_5.png',
  'pic_6.png',
  'pic_7.png',
  'pic_8.png',
  'pic_9.png',
  'pic_10.png',
  'pic_11.png',
  'pic_12.png',
  'pic_13.png',
  'pic_14.png',
  'pic_15.png',
  'pic_16.png',
  'pic_17.png',
  'pic_18.png',
  'pic_19.png',
  'pic_20.png',
  'pic_21.png',
  'pic_22.png',
  'pic_23.png',
  'pic_24.png',
  'pic_25.png',
  'pic_26.png',
  'pic_27.png',
  'pic_28.png',
  'pic_29.png',
  'pic_30.png',
  'pic_31.png',
];

const MessageInput = ({
  draftResetKey,
  handleSendMessage,
  selectedTheme,
  replyTo,
  selectedEmoji, 
  onCancelReply,
  setPetModalVisible,
  selectedFruits,
  setSelectedFruits,
  setSelectedEmoji
}) => {
  // ✅ Memoize styles
  const isDarkMode = selectedTheme?.colors?.text === 'white';
  const styles = useMemo(() => getStyles(isDarkMode), [isDarkMode]);
  
  const [isSending, setIsSending] = useState(false);
  const [messageCount, setMessageCount] = useState(0);
  // The draft lives here, not in Trader. Lifted up, every keystroke
  // re-rendered the whole room and, through fresh callback props, every
  // message row. Trader only needs the trimmed text, which handleSend passes.
  const [input, setInput] = useState('');

  // Switching language rooms drops the half-typed draft (Trader used to do
  // this from its own copy). Skip the first run so mounting clears nothing.
  const lastDraftKeyRef = useRef(draftResetKey);
  useEffect(() => {
    if (lastDraftKeyRef.current === draftResetKey) return;
    lastDraftKeyRef.current = draftResetKey;
    setInput('');
  }, [draftResetKey]);

  const { triggerHapticFeedback } = useHaptic();
  const { t } = useTranslation();
  const { localState } = useLocalState();
  const { theme, isAdmin, user } = useGlobalState();
  // Admins and full moderators (not Junior Mods) bypass the word filter, and
  // Pro users may post links — the send path in Trader.jsx allows both, but
  // this pre-check used to refuse them first, so neither ever worked.
  const canBypassModeration = !!isAdmin || (!!user?.isModerator && !user?.isBabyMod);
  const isDark = theme === 'dark';
  const insets = useSafeAreaInsets();
  const [showEmojiPopup, setShowEmojiPopup] = useState(false);

  // ✅ Memoize computed values
  const hasFruits = useMemo(() => Array.isArray(selectedFruits) && selectedFruits.length > 0, [selectedFruits]);
  const hasContent = useMemo(() => {
    return (input || '').trim().length > 0 || hasFruits || !!selectedEmoji;
  }, [input, hasFruits, selectedEmoji]);

  // ✅ Memoize handleSend
  const handleSend = useCallback(async (emojiArg) => {
    triggerHapticFeedback('impactLight');

    const trimmedInput = (input || '').trim();
  
    const emojiFromArg = typeof emojiArg === 'string' ? emojiArg : undefined;
    const emojiToSend  = emojiFromArg || selectedEmoji || null;
    const hasEmoji     = !!emojiToSend;
    const fruits = hasFruits ? [...selectedFruits] : [];
    if (!trimmedInput && !hasFruits && !hasEmoji) return;
    if (isSending) return;

    // ✅ Comprehensive content moderation check
    if (trimmedInput) {
      const validation = validateContent(trimmedInput, {
        skipAll: canBypassModeration,
        skipLinkCheck: canBypassModeration || !!localState?.isPro,
      });
      if (!validation.isValid) {
        showMessage({
          message: validation.reason || "Inappropriate content detected.",
          type: "danger",
          duration: 3000,
        });
        return;
      }
    }

    setIsSending(true);

    const adCallback = () => {
      setIsSending(false);
    };

    try {
      const sent = await handleSendMessage(replyTo, trimmedInput, fruits, emojiToSend);
      // Refused (muted, banned, cooldown, duplicate, too long...): keep what
      // the user typed so they can fix it instead of retyping.
      if (sent === false) {
        setIsSending(false);
        return;
      }

      // Clear input + reply UI
      setInput('');
      setSelectedFruits([]);
      setSelectedEmoji(null)
      if (onCancelReply) onCancelReply();

      // Increment message count then maybe show ad
      const newCount = messageCount + 1;
      setMessageCount(newCount);

      if (!localState?.isPro && newCount % CHAT_MESSAGES_PER_AD === 0) {
        // Show ad only if user is NOT pro
        InterstitialAdManager.showAd(adCallback);
      } else {
        // One message before the ad message: warm the interstitial so the
        // trigger actually has something to show (lazy-load pipeline).
        if (!localState?.isPro && newCount % CHAT_MESSAGES_PER_AD === CHAT_MESSAGES_PER_AD - 1) InterstitialAdManager.prepare();
        setIsSending(false);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      setIsSending(false);
    }
  }, [input, hasFruits, selectedEmoji, replyTo, handleSendMessage, onCancelReply, setSelectedFruits, setSelectedEmoji, localState?.isPro, messageCount, triggerHapticFeedback, canBypassModeration, isSending, selectedFruits]);

  // ✅ Memoize selectEmoji
  const selectEmoji = useCallback((emojiUrl) => {
    if (!emojiUrl || typeof emojiUrl !== 'string') return;
    setSelectedEmoji(emojiUrl);
    handleSend(emojiUrl);
    setShowEmojiPopup(false);
  }, [handleSend]);
  

  // console.log(selectedFruits);

  return (
    <View style={{ backgroundColor: isDark ? config.colors.backgroundDark : config.colors.backgroundLight }}>
      <View style={[styles.inputWrapper, { backgroundColor: isDark ? config.colors.backgroundDark : config.colors.backgroundLight }]}>
        {/* Reply context UI */}
        {replyTo && (
          <View style={styles.replyContainer}>
            <Text style={styles.replyText} numberOfLines={2}>
              {t('chat.replying_to')}: {replyTo.text
                || (replyTo.gif ? '[Emoji]'
                  : (Array.isArray(replyTo.fruits) && replyTo.fruits.length > 0 ? `[${replyTo.fruits.length} item(s)]` : ''))}
            </Text>
            <TouchableOpacity
              onPress={onCancelReply}
              style={styles.cancelReplyButton}
            >
              <Icon name="close-circle" size={24} color={config.colors.error} />
            </TouchableOpacity>
          </View>
        )}

        <View style={[styles.inputContainer, {backgroundColor: isDark ? config.colors.backgroundDark : config.colors.backgroundLight}]}>
        <TouchableOpacity
          style={[styles.sendButton, { marginRight: 3, paddingHorizontal: 3 }]}
          onPress={() => setPetModalVisible && setPetModalVisible(true)}
          disabled={isSending}
        >
          <Icon
            name="fish-outline"
            size={20}
            color={isDark ? config.colors.textDark : config.colors.textLight}
          />
        </TouchableOpacity>

        <TextInput
          style={[
            styles.input, 
            { 
              color: selectedTheme.colors.text,
              backgroundColor: isDark ? config.colors.surfaceDark : config.colors.surfaceLight,
            }
          ]}
          placeholder={t('chat.type_message')}
          placeholderTextColor={isDark ? config.colors.placeholderDark : config.colors.placeholderLight}
          value={input}
          onChangeText={setInput}
          multiline
          // The send path refuses anything longer; stop it at the keyboard
          // rather than after the user has typed it all.
          maxLength={250}
        />

<TouchableOpacity onPress={() => setShowEmojiPopup(true)} style={styles.gifButton}>
          <Text style={{ fontSize: SIZE.title }}>😊</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.sendButton,
            {
              backgroundColor:
                hasContent && !isSending ? STATUS.primary : config.colors.primary,
            },
          ]}
          onPress={handleSend}
          disabled={isSending || !hasContent}
        >
          <Text style={styles.sendButtonText}>
            {isSending ? t('chat.sending') : t('chat.send')}
          </Text>
        </TouchableOpacity>
      </View>

      {hasFruits && (
        <View
          style={{
            paddingHorizontal: SPACE.lg,
            paddingTop: SPACE.xs,
            flexDirection: 'row',
            alignItems: 'center',
          }}
        >
          <Text style={{ color: isDark ? config.colors.textSecondaryDark : config.colors.textSecondaryLight, fontSize: SIZE.caption }}>
            {selectedFruits.length} item(s) selected
          </Text>

          <TouchableOpacity
            onPress={() => setSelectedFruits([])}
            style={{ marginLeft: SPACE.md }}
          >
            <Icon
              name="close-circle"
              size={18}
              color={isDark ? config.colors.textSecondaryDark : config.colors.textSecondaryLight}
            />
          </TouchableOpacity>
        </View>
      )}
      <Modal visible={showEmojiPopup} transparent animationType="slide" onRequestClose={() => setShowEmojiPopup(false)}>
        <TouchableOpacity 
          style={[modalStyles.backdrop, { backgroundColor: isDark ? 'rgba(0,0,0,0.6)' : 'rgba(0,0,0,0.35)' }]} 
          onPress={() => setShowEmojiPopup(false)}
          activeOpacity={1}
        >
          <View style={[modalStyles.sheet, { backgroundColor: isDark ? config.colors.surfaceDark : config.colors.surfaceLight, paddingBottom: SPACE.xxxl + insets.bottom }]} onStartShouldSetResponder={() => true}>
            <ScrollView 
              style={[modalStyles.emojiScrollContainer, { backgroundColor: isDark ? config.colors.surfaceDark : config.colors.surfaceLight }]}
              showsVerticalScrollIndicator={false}
            >
              <View style={modalStyles.emojiListContainer}>
                {Emojies.map((item) => {
                  if (!item || typeof item !== 'string') return null;
                  const emojiUrl = `https://bloxfruitscalc.com/wp-content/uploads/2025/Emojies/${item}`;
                  return (
                    <TouchableOpacity
                      key={item}
                      onPress={() => selectEmoji(emojiUrl)}
                      style={modalStyles.emojiContainer}
                    >
                      <Image
                        source={{ uri: emojiUrl }}
                        style={modalStyles.emojiImage}
                      />
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
      </View>
    </View>
  );
};
const modalStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    padding: SPACE.xxxl,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '50%',
  },
  emojiScrollContainer: {
    maxHeight: 200,
  },
  emojiListContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginTop: SPACE.lg,
  },
  emojiContainer: {
    margin: SPACE.lg,
    width: 25,
    height: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emojiImage: {
    width: 25,
    height: 25,
    borderRadius: 8,
  },
});
export default MessageInput;
