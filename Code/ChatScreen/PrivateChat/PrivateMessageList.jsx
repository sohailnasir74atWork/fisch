import React, { memo, useMemo, useState, useCallback } from 'react';
import {
  FlatList,
  View,
  Text,
  RefreshControl,
  Image,
  ActivityIndicator,
  Vibration,
  Keyboard,
  Alert,
  StyleSheet,
  TouchableOpacity,          // 👈 add this
  useWindowDimensions,
} from 'react-native';
import { Menu, MenuOptions, MenuOption, MenuTrigger } from 'react-native-popup-menu';
import { useGlobalState } from '../../GlobelStats';
import { getStyles } from '../Style';
import ReportPopup from '../ReportPopUp';
import { useTranslation } from 'react-i18next';
import Clipboard from '@react-native-clipboard/clipboard';
import { useHaptic } from '../../Helper/HepticFeedBack';
import { showSuccessMessage } from '../../Helper/MessageHelper';
import { useLocalState } from '../../LocalGlobelStats';
import axios from 'axios';
import { getDeviceLanguage } from '../../../i18n';
import { FRUIT_KEYWORDS } from '../../Helper/filter';
import ScamSafetyBox from './Scamwarning';
import { useNavigation } from '@react-navigation/native';
import config from '../../Helper/Environment';
import { resolveItemImage, displayValueText, summarizeItems, normalizeScale, sourceLabel } from '../../Helper/valueSources';
import { GAME } from '../../config/game';
import { STATUS } from '../../Design/tokens';
import { getThemeColors } from '../../Helper/themeColors';
import { SIZE } from '../../Design/tokens';
import { SPACE } from '../../Design/tokens';
import { LIGHT } from '../../Design/tokens';
import { FONT } from '../../Design/tokens';



// Bubble geometry, shared by the bubble itself and the image grid it holds so
// the two cannot drift apart.
const BUBBLE_MAX_WIDTH_RATIO = 0.8;
const BUBBLE_PADDING_H = SPACE.lg;
const IMAGE_GAP = SPACE.xs;
const SINGLE_IMAGE_MAX = 250;

const PrivateMessageList = ({
  messages,
  userId,
  user,
  selectedUser,
  handleLoadMore,
  refreshing,
  onRefresh,
  isBanned,
  onReply,
  onReportSubmit,
  loading,
  canRate,
  hasRated,
  setShowRatingModal,
  isPaginating,        // 👈 add this
  otherLastRead, // 👈 Other user's lastRead timestamp for read receipts
  chatKey, // RTDB key of this conversation; the report popup needs the path
}) => {
  const { theme, isAdmin, api, freeTranslation } = useGlobalState();
  const isDarkMode = theme === 'dark';
  const c = getThemeColors(isDarkMode);
  // ✅ Memoize styles
  const styles = useMemo(() => getStyles(isDarkMode), [isDarkMode]);
  
  const fruitColors = useMemo(
    () => ({
      wrapperBg: isDarkMode ? `${config.colors.surfaceDark}55` : '#e5e7eb55',
      name:      isDarkMode ? '#f9fafb' : '#111827',
      value:     isDarkMode ? '#e5e7eb' : '#4b5563',
      divider:   isDarkMode ? '#ffffff22' : '#00000011',
      totalLabel:isDarkMode ? '#e5e7eb' : '#4b5563',
      totalValue:isDarkMode ? '#f97373' : '#b91c1c',
    }),
    [isDarkMode],
  );
  const { t } = useTranslation();
  const deviceLanguage = useMemo(() => getDeviceLanguage(), []);

  // Widest a row of images can be: the bubble is capped at 80% of the screen
  // and adds 10pt of padding either side. The sizes used to be hard-coded
  // (250 / 150 / 110), so on a 360pt-wide screen a pair of 150s needed 304pt
  // of a 268pt box and flex-wrapped into a single stacked column.
  const { width: screenWidth } = useWindowDimensions();
  const maxImageRowWidth = Math.floor(screenWidth * BUBBLE_MAX_WIDTH_RATIO) - BUBBLE_PADDING_H * 2;

  // ✅ Pre-compile regex patterns for FRUIT_KEYWORDS
  const fruitRegexPatterns = useMemo(() => {
    return FRUIT_KEYWORDS.map((word, index) => ({
      regex: new RegExp(`\\b${word}\\b`, 'gi'),
      placeholder: `__FRUIT_${index}__`,
      word,
    }));
  }, []);


  const [selectedMessage, setSelectedMessage] = useState(null);
  const [showReportPopup, setShowReportPopup] = useState(false);
  const { triggerHapticFeedback } = useHaptic();
  const { canTranslate, incrementTranslationCount, getRemainingTranslationTries, localState } = useLocalState();
  const navigation = useNavigation()

  // See Code/Helper/valueSources.js. It reads Image / image / imageUrl, so the
  // imageUrl passthrough this used to do is covered. Stable, so no useCallback.
  const getImageUrl = resolveItemImage;

  // ✅ Memoize handleCopy
  const handleCopy = useCallback((message) => {
    if (!message || !message.text) return;
    Clipboard.setString(message.text);
    triggerHapticFeedback('impactLight');
    showSuccessMessage(t('home.alert.success'), t('private_chat.msg_copied'));
  }, [triggerHapticFeedback]);

  // ✅ Memoize filteredMessages
  // Dedupe by id (first occurrence wins). The live listener, a page load and
  // a gap-fill can each deliver the same row; keys are ids, so a repeat both
  // shows twice and trips React's duplicate-key path. Cheap: one Set pass.
  const filteredMessages = useMemo(() => {
    if (!Array.isArray(messages)) return [];
    const seen = new Set();
    const out = [];
    for (const message of messages) {
      const id = message?.id != null ? String(message.id) : null;
      if (id && seen.has(id)) continue;
      if (id) seen.add(id);
      if (isBanned && userId && message?.senderId !== userId) continue;
      out.push(message);
    }
    return out;
  }, [messages, isBanned, userId]);

  // ✅ Memoize handleReport
  const handleReport = useCallback((message) => {
    if (!message) return;
    // Private messages store no sender name, so the popup printed
    // "Anonymous". Only the partner's messages can be reported here.
    setSelectedMessage({ ...message, sender: message.sender || selectedUser?.sender });
    setShowReportPopup(true);
  }, [selectedUser?.sender]);

  // ✅ Memoize handleSubmitReport
  const handleSubmitReport = useCallback((message, reason) => {
    if (onReportSubmit && typeof onReportSubmit === 'function') {
      onReportSubmit(message, reason);
    }
    setShowReportPopup(false);
  }, [onReportSubmit]);
  // console.log(selectedUserId === userId)
 


  // ✅ Memoize translateText
  const translateText = useCallback(async (text, targetLang = deviceLanguage) => {
    if (!text || typeof text !== 'string') return null;

    const placeholders = {};
    let maskedText = text;

    // Step 1: Replace fruit names with placeholders using pre-compiled regex
    fruitRegexPatterns.forEach(({ regex, placeholder, word }) => {
      maskedText = maskedText.replace(regex, placeholder);
      placeholders[placeholder] = word;
    });

    try {
      // Step 2: Send masked text for translation
      const response = await axios.post(
        `https://translation.googleapis.com/language/translate/v2`,
        {},
        {
          params: {
            q: maskedText,
            target: targetLang,
            key: api,
          },
        }
      );

      let translated = response.data.data.translations[0].translatedText;

      // Step 3: Replace placeholders back with original fruit names
      Object.entries(placeholders).forEach(([placeholder, word]) => {
        translated = translated.replace(new RegExp(placeholder, 'g'), word);
      });

      return translated;
    } catch (err) {
      console.error('Translation Error:', err);
      return null;
    }
  }, [fruitRegexPatterns, deviceLanguage, api]);

  // ✅ Memoize handleTranslate
  const handleTranslate = useCallback(async (item) => {
    if (!item || !item.text) {
      Alert.alert(t('home.alert.error'), t('private_chat.invalid_translate'));
      return;
    }

    const isUnlimited = freeTranslation || localState?.isPro;
  
    if (!isUnlimited && canTranslate && typeof canTranslate === 'function' && !canTranslate()) {
      Alert.alert(t('private_chat.limit_reached'), t('private_chat.translate_limit'));
      return;
    }
  
    const translated = await translateText(item.text, deviceLanguage);
  
    if (translated) {
      if (!isUnlimited && incrementTranslationCount && typeof incrementTranslationCount === 'function') {
        incrementTranslationCount();
      }
  
      const remainingLabel = isUnlimited 
        ? t('private_chat.unlimited') 
        : (getRemainingTranslationTries && getRemainingTranslationTries() === 1 ? t('private_chat.remaining_tries_singular', { count: 1 }) : t('private_chat.remaining_tries_plural', { count: getRemainingTranslationTries ? getRemainingTranslationTries() : 0 }));
      const upgradeLabel = isUnlimited ? '' : `\n\n🔓 ${t('private_chat.upgrade_pro')}`;
  
      Alert.alert(
        t('private_chat.translated_title'),
        `${translated}\n\n🧠 ${t('private_chat.daily_limit')}: ${remainingLabel}${upgradeLabel}`
      );
    } else {
      Alert.alert(t('home.alert.error'), t('private_chat.translate_failed'));
    }
  }, [freeTranslation, localState?.isPro, canTranslate, incrementTranslationCount, getRemainingTranslationTries, translateText, deviceLanguage]);
  
  // ✅ Date separator helper
  const getDateLabel = useCallback((timestamp) => {
    if (!timestamp) return '';
    const msgDate = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    if (msgDate.toDateString() === today.toDateString()) return t('chat.today', { defaultValue: 'Today' });
    if (msgDate.toDateString() === yesterday.toDateString()) return t('chat.yesterday', { defaultValue: 'Yesterday' });
    return msgDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }, [t]);

  // ✅ Memoize renderMessage — WhatsApp-style bubbles (no avatars)
  const renderMessage = useCallback(({ item, index }) => {
    // ✅ Safety checks
    if (!item || typeof item !== 'object') return null;

    const isMyMessage = item.senderId === userId;

    // Attached items (the field is still called `fruits` on the wire).
    // Values go through Code/Helper/valueSources.js, not Number(value): an
    // unpriced item has value null, so the raw sum printed "Value: 0" with no
    // unit, and a Proto figure was shown as if it were money. Each item is
    // priced on the scale it was picked under (valueSource), and the total is
    // only summed when every item shares one scale — S$ and Proto are
    // different lists and must never be added together.
    const fruits = Array.isArray(item.fruits) ? item.fruits.filter(Boolean) : [];
    const hasFruits = fruits.length > 0;
    const fruitScales = hasFruits
      ? [...new Set(fruits.map(f => normalizeScale(f?.valueSource)))]
      : [];
    const singleScale = fruitScales.length === 1 ? fruitScales[0] : null;
    const fruitSummary = hasFruits && singleScale ? summarizeItems(fruits, singleScale) : null;
    // Items from before the Fisch catalogue have no `collection`, so the
    // helpers would call them "Not tradeable"; they simply have no quote.
    const fruitValueText = (fruit) => (fruit?.collection
      ? displayValueText(fruit, normalizeScale(fruit.valueSource))
      : 'Unpriced');
    let totalText = null;
    if (fruits.length > 1) {
      if (!fruitSummary) {
        totalText = 'Mixed S$ / Proto — not summed';
      } else if (fruitSummary.observed === 0) {
        totalText = 'Unpriced';
      } else {
        totalText = `${fruitSummary.unit} ${fruitSummary.totalText}` +
          (fruitSummary.unpriced > 0 ? ` + ${fruitSummary.unpriced} unpriced` : '');
      }
    }

    const msgBubble = (
      <View
        style={{
          alignSelf: isMyMessage ? 'flex-end' : 'flex-start',
          maxWidth: `${BUBBLE_MAX_WIDTH_RATIO * 100}%`,
          marginBottom: SPACE.xs,
          marginHorizontal: SPACE.lg,
        }}
      >
        {/* WhatsApp-style bubble — no avatar */}
        <View style={{
          backgroundColor: isMyMessage
            ? (isDarkMode ? '#0B5E3F' : '#DCF8C6')
            : (isDarkMode ? config.colors.surfaceDark : '#FFFFFF'),
          borderRadius: 16,
          borderTopLeftRadius: isMyMessage ? 16 : 4,
          borderTopRightRadius: isMyMessage ? 4 : 16,
          paddingHorizontal: BUBBLE_PADDING_H,
          paddingVertical: SPACE.sm,
          shadowColor: c.shadow,
          shadowOpacity: 0.05,
          shadowRadius: 2,
          shadowOffset: { width: 0, height: 1 },
          elevation: 1,
        }}>

        {/* Message Content */}

        <Menu>
        {/* Images - Support multiple images */}
        {(item.imageUrls || item.imageUrl) && (() => {
          const imageArray = Array.isArray(item.imageUrls) && item.imageUrls.length > 0
            ? item.imageUrls
            : (item.imageUrl ? [item.imageUrl] : []);

          if (imageArray.length === 0) return null;

          return (
            <View style={{ marginBottom: SPACE.xs, flexDirection: 'row', flexWrap: 'wrap', gap: IMAGE_GAP }}>
              {imageArray.map((imageUri, imgIndex) => {
                const perRow = Math.min(imageArray.length, 3);
                const imageSize = Math.min(
                  SINGLE_IMAGE_MAX,
                  Math.floor((maxImageRowWidth - IMAGE_GAP * (perRow - 1)) / perRow),
                );

                return (
                  <TouchableOpacity
                    key={`img-${imgIndex}`}
                    activeOpacity={0.8}
                    onPress={() =>
                      navigation.navigate('ImageViewerScreenChat', {
                        images: imageArray,
                        initialIndex: imgIndex,
                      })
                    }
                  >
                    <Image
                      source={{ uri: imageUri }}
                      style={{
                        width: imageSize,
                        height: imageSize,
                        borderRadius: 8,
                        resizeMode: 'cover',
                      }}
                    />
                  </TouchableOpacity>
                );
              })}
            </View>
          );
        })()}
          <MenuTrigger
            onLongPress={() => triggerHapticFeedback('impactMedium')}
            customStyles={{ triggerTouchable: { activeOpacity: 1 } }}
          >

            {/* 🐾 Fruits list */}
            {hasFruits && (
              <View style={[fruitStyles.fruitsWrapper]}>
                {fruits.map((fruit, index) => {
                  return (
                    <View
                      key={`${fruit.id || fruit.name}-${index}`}
                      style={fruitStyles.fruitCard}
                    >
                      <Image
                        source={{ uri: getImageUrl(fruit) || fruit.imageUrl || GAME.defaultAvatar }}
                        style={fruitStyles.fruitImage}
                      />
                      <View style={fruitStyles.fruitInfo}>
                        <Text
                          style={[fruitStyles.fruitName, { color: fruitColors.name }]}
                          numberOfLines={1}
                        >
                          {`${fruit.name || fruit.Name}  `}
                        </Text>
                        <Text style={[fruitStyles.fruitValue, { color: fruitColors.value }]}>
                          · {fruitValueText(fruit)}
                          {Number.isInteger(fruit.quantity) && fruit.quantity > 1 ? ` ×${fruit.quantity}` : ''}{' '}
                        </Text>
                        {/* (F/R Fly/Ride badges removed: Adopt Me pet flags
                            that no Fisch item carries.) */}
                      </View>
                    </View>
                  );
                })}

                {/* ✅ Total row – only if more than one item */}
                {totalText != null && (
                  <View style={[fruitStyles.totalRow, { borderTopColor: fruitColors.divider }]}>
                    <Text style={[fruitStyles.totalLabel, { color: fruitColors.totalLabel }]}>{t('private_chat.total_value')}</Text>
                    <Text style={[fruitStyles.totalValue, { color: fruitColors.totalValue }]}>
                      {totalText}
                    </Text>
                  </View>
                )}

                {/* Which list priced these items. S$ and Proto are separate
                    community lists on different scales, so a reader needs to
                    know which one the numbers came from. */}
                {singleScale && (
                  <Text style={fruitStyles.sourceNote}>
                    Based on {sourceLabel(singleScale)} values
                  </Text>
                )}
              </View>
            )}

            {/* Normal text */}
            {!!item.text && (
              <Text style={{
                fontSize: SIZE.caption,
                color: c.text,
                lineHeight: 18,
              }}>
                {item.text}
              </Text>
            )}
          </MenuTrigger>

          {/* Menu options */}
          <MenuOptions
            customStyles={{
              optionsContainer: styles.menuoptions,
              optionWrapper: styles.menuOption,
              optionText: styles.menuOptionText,
            }}
          >
            <MenuOption onSelect={() => handleCopy(item)}>
              <Text style={styles.menuOptionText}>{t('private_chat.copy')}</Text>
            </MenuOption>
            <MenuOption onSelect={() => handleTranslate(item)}>
              <Text style={styles.menuOptionText}>{t('private_chat.translate')}</Text>
            </MenuOption>
            {!isMyMessage && !!chatKey && (
              <MenuOption onSelect={() => handleReport(item)}>
                <Text style={styles.menuOptionText}>{t('chat.report')}</Text>
              </MenuOption>
            )}
          </MenuOptions>
        </Menu>

          {/* Timestamp + Read receipts inside bubble — WhatsApp style */}
          <View style={{ flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-end', marginTop: SPACE.hair, gap: 3 }}>
            <Text style={{
              fontSize: SIZE.label,
              color: isMyMessage
                ? (isDarkMode ? '#ffffffaa' : '#00000066')
                : (isDarkMode ? '#ffffff77' : '#00000055'),
            }}>
              {item.timestamp ? new Date(item.timestamp).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              }) : ''}
            </Text>
            {/* ✅ Read receipt ticks for own messages */}
            {isMyMessage && (localState?.showReadReceipts ?? true) && (
              <Text style={{
                fontSize: SIZE.caption,
                fontFamily: FONT.bold,
                color: (otherLastRead && item.timestamp && item.timestamp <= otherLastRead)
                  ? '#53BDEB'  // Blue ticks = read
                  : (isDarkMode ? '#ffffff77' : '#00000044'),
                marginLeft: 1,
              }}>
                ✓✓
              </Text>
            )}
          </View>
        </View>
      </View>
    );

    // Date separator: in an inverted list the next item in the array is older,
    // so this is true for the oldest message of each day — the one that shows
    // highest up the screen in that day's run. The separator therefore has to
    // render BEFORE the bubble: a row's own children are not inverted, only
    // the row order is, so emitting it after the bubble (as this did) dropped
    // each day's heading below its first message and left it sitting in the
    // middle of the previous day's run.
    const nextMsg = filteredMessages[index + 1];
    const showDateSep = !nextMsg || getDateLabel(item.timestamp) !== getDateLabel(nextMsg.timestamp);

    // ONE wrapping View, not a Fragment: since RN 0.7x an inverted list lays
    // each cell out with column-reverse before flipping it, so a Fragment's
    // two children came out swapped and the day label sat BELOW the message
    // ("Today" under the message you just sent). A single child keeps its own
    // top-to-bottom order. Same fix as mm2values (ec45459).
    return (
      <View>
        {showDateSep && (
          <View style={{ alignItems: 'center', marginVertical: SPACE.lg }}>
            <View style={{
              backgroundColor: isDarkMode ? config.colors.surfaceElevatedDark : '#e0e0e0',
              borderRadius: 12,
              paddingHorizontal: 14,
              paddingVertical: SPACE.xs,
            }}>
              <Text style={{
                fontSize: SIZE.small,
                color: c.textSecondary,
                fontFamily: FONT.regular,
              }}>
                {getDateLabel(item.timestamp)}
              </Text>
            </View>
          </View>
        )}
        {msgBubble}
      </View>
    );
  }, [userId, selectedUser, user, styles, fruitColors, handleCopy, handleTranslate, handleReport, onReply, navigation, t, filteredMessages, getDateLabel, otherLastRead, localState?.showReadReceipts, isDarkMode, maxImageRowWidth, chatKey]);

  // ✅ Memoize keyExtractor
  const keyExtractor = useCallback((item, index) => {
    return item?.id || `msg-${index}`;
  }, []);

  return (
    <View style={[styles.container]}>
      {loading && messages.length === 0 ? (
        <ActivityIndicator size="large" color={STATUS.primary} style={styles.loader} />
      ) : (
        /* flex:1, not a content-sized wrapper. A FlatList with no bounded
            height lays every row out past the viewport: the list then has
            nothing to scroll (the overflow is simply clipped) and Android's
            view clipping detaches the tall rows, which is why image bubbles
            arrived as empty white rectangles. The 140pt bottom padding that
            used to sit here was dead space above the message input — the
            input is a sibling in normal flow, so nothing had to be reserved
            for it. */
        <View style={{ flex: 1 }}>
        <ScamSafetyBox setShowRatingModal={setShowRatingModal} canRate={canRate} hasRated={hasRated} selectedUserId={selectedUser?.senderId} />

        <FlatList
          style={{ flex: 1 }}
          data={filteredMessages}
          // Rows must repaint when the partner reads, or the ticks stay grey.
          extraData={otherLastRead}
          removeClippedSubviews={false}
          keyExtractor={keyExtractor}
          renderItem={renderMessage}
          inverted
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.3}
          onScroll={() => Keyboard.dismiss()}
          onTouchStart={() => Keyboard.dismiss()}
          keyboardShouldPersistTaps="handled"
          maxToRenderPerBatch={10}
          windowSize={10}
          initialNumToRender={15}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        />
        </View>

      )}
      {/* channelPath: without it the popup looked the message up in the
          public room, so every private report failed "Message not found". */}
      <ReportPopup
        visible={showReportPopup}
        message={selectedMessage}
        onClose={() => setShowReportPopup(false)}
        onSubmit={handleSubmitReport}
        channelPath={chatKey ? `private_messages/${chatKey}/messages` : undefined}
      />
    </View>
  );
};
export const fruitStyles = StyleSheet.create({
  sourceNote: {
    fontSize: SIZE.label,
    opacity: 0.6,
    marginTop: SPACE.xs,
    alignSelf: 'flex-end',
  },
  fruitsWrapper: {
    marginTop: 1,
    // gap: 1,
    padding: SPACE.xs,
    // borderRadius: 8,

  },
  fruitCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent:'flex-start',
    marginBottom:3,
    // NOT flex:1. These are rows in an auto-height column inside a chat
    // bubble: flex:1 makes Yoga size the bubble from an unbounded main axis,
    // which blew it up to ~1200pt and left Android painting the bubble
    // background with NONE of its children - a blank white rectangle.
    alignSelf: 'stretch',
  },
  fruitImage: {
    width: 20,
    height: 20,
    borderRadius: 2,
    marginRight: SPACE.hair,
  },
  fruitInfo: {
    // flex: 1,
    flexDirection:'row',
    justifyContent:'flex-start',
    // backgroundColor:'red',
    alignItems:'center',
  },
  fruitName: {
    fontSize: SIZE.caption,
    fontFamily: FONT.regular,
    // color: c.textInverse,
  },
  fruitValue: {
    fontSize: SIZE.small,
    // color: '#e5e5e5',
    marginTop: SPACE.hair,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.hair,
    // marginTop: SPACE.xs,
  },
  badge: {
    paddingHorizontal: SPACE.sm,
    paddingVertical: SPACE.hair,
    borderRadius: 8,
    // minWidth: 16,
    // justifyContent: 'center',
    alignItems: 'center',
  },
  badgeText: {
    fontSize: SIZE.label,
    fontFamily: FONT.bold,
    color: LIGHT.textInverse,
  },
  badgeDefault: {
    backgroundColor: '#FF6666', // D
  },
  badgeNeon: {
    backgroundColor: STATUS.success, // N
  },
  badgeMega: {
    backgroundColor: '#9b59b6', // M
  },
  badgeFly: {
    backgroundColor: STATUS.primary, // F
  },
  badgeRide: {
    backgroundColor: STATUS.danger, // R
  },
  totalRow: {
    flexDirection: 'row',
    // justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: SPACE.xs,
    paddingTop: SPACE.xs,
    borderTopWidth: 1,
    borderTopColor: LIGHT.border,
  },
  totalLabel: {
    fontSize: SIZE.small,
    fontFamily: FONT.regular,
    color: LIGHT.textSecondary,
  },
  totalValue: {
    fontSize: SIZE.small,
    fontFamily: FONT.bold,
    color: '#FF6666',
  },
});

export default memo(PrivateMessageList);
