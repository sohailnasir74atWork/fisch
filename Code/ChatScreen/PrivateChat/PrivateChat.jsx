import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  View,
  ActivityIndicator,
  Alert,
  Text,
  Image,
  TouchableOpacity,  TextInput,
  Modal,
} from 'react-native';
import { useFocusEffect, useRoute } from '@react-navigation/native';
import { getStyles } from '../Style';
import PrivateMessageInput from './PrivateMessageInput';
import PrivateMessageList from './PrivateMessageList';
import { useGlobalState } from '../../GlobelStats';
import { chatTypeForRoute, fetchChatAvailability, resolveChatBlock } from '../chatAvailability';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { clearActiveChat, setActiveChat, useOtherLastRead, updateLastRead, useOnlineStatus } from '../utils';
import { useLocalState } from '../../LocalGlobelStats';
import  { get, set, increment, ref, update } from '@react-native-firebase/database';
import { useTranslation } from 'react-i18next';
import { showSuccessMessage, showErrorMessage } from '../../Helper/MessageHelper';
import { showMessage } from 'react-native-flash-message';
import { serverNowMs } from '../../Helper/serverTime';
import { getThemeColors } from '../../Helper/themeColors';

import config from '../../Helper/Environment';
import ConditionalKeyboardWrapper, { ModalKeyboardView } from '../../Helper/keyboardAvoidingContainer';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import BannerAdComponent from '../../Ads/bannerAds';

import PetModal from './PetsModel';
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from '@react-native-firebase/firestore';
import ProfileBottomDrawer from '../GroupChat/BottomDrawer';
import { resolveItemImage } from '../../Helper/valueSources';
import { GAME } from '../../config/game';
import { SIZE } from '../../Design/tokens';
import { SPACE } from '../../Design/tokens';
import { FONT } from '../../Design/tokens';




const INITIAL_PAGE_SIZE = 10; // ✅ Initial load: 10 messages
const PAGE_SIZE = 10; // ✅ Pagination: load 10 messages per batch

const PrivateChatScreen = ({route, bannedUsers, isDrawerVisible, setIsDrawerVisible, noTabBar }) => {
  const { selectedUser, selectedTheme, item } = route.params || {};

  const { user, theme, appdatabase, updateLocalStateAndDatabase, firestoreDB, isUserBlocked, strikeInfo } = useGlobalState();
  const [trade, setTrade] = useState(null)
  // A feed post the chat was opened from. Kept apart from `trade` because a
  // post has no items: treated as a trade it was written over the pair's real
  // trade at private_messages/{chatId}/trade and drew an empty trade strip.
  const [post, setPost] = useState(null)
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isPaginating, setIsPaginating] = useState(false);
  const lastLoadedKeyRef = useRef(null);
  const [lastLoadedKey, setLastLoadedKey] = useState(null);
  const previousChatKeyRef = useRef(null); // ✅ Track previous chatKey to prevent unnecessary resets
  const [replyTo, setReplyTo] = useState(null);
  const [input, setInput] = useState('');
  const { localState } = useLocalState()
  const selectedUserId = selectedUser?.senderId;
  const myUserId = user?.id;
  const { t } = useTranslation();
  const [canRate, setCanRate] = useState(false);
const [hasRated, setHasRated] = useState(false);
const [showRatingModal, setShowRatingModal] = useState(false);
const [rating, setRating] = useState(0);
const [petModalVisible, setPetModalVisible] = useState(false);
const [selectedFruits, setSelectedFruits] = useState([]); 
const [reviewText, setReviewText] = useState('');   // 👈 new
const [startRating,setStartRating] = useState(false)
const isOnline = useOnlineStatus(selectedUserId);
const insets = useSafeAreaInsets();
const bannerBottomPos = noTabBar ? Math.max(insets.bottom, 8) + 12 : 0; // with the docked tab bar, in-tab screen bottom == tab bar top; full-screen chat (noTabBar) still clears the home indicator
// Is the banner actually showing an ad right now? The spacer below the input
// used to reserve the banner's height unconditionally, so a no-fill (or a Pro
// user) left a dead gap between the message input and the tab bar.
const [bannerHeight, setBannerHeight] = useState(0); // measured, 0 when no ad is on screen
// Set when a partner message lands while this chat is open. The sender always
// bumps our unreadCount (it cannot know we are reading), so we clear it once
// when we leave — but only if something arrived, so a quiet visit costs no
// extra write.
const unreadWhileFocusedRef = useRef(false);

  const closeProfileDrawer = () => {
    setIsDrawerVisible(false);
  };

  // Moderation gate. isUserBlocked is the authoritative, server-time checked
  // flag from GlobelStats; strikeInfo only formats the "time left" message.
  // Private chat had neither, so banned and muted users kept messaging and
  // rating people one to one.
  const isMeBanned = !!isUserBlocked;
  const rejectIfBanned = useCallback(() => {
    if (isMeBanned) {
      showMessage({
        message: t('chat.access_denied', { defaultValue: 'Access Denied' }),
        description: t('chat.banned_message', { defaultValue: 'You are banned from sending messages.' }),
        type: 'danger',
      });
      return true;
    }
    if (strikeInfo) {
      const { strikeCount, bannedUntil } = strikeInfo;
      const now = serverNowMs();
      if (bannedUntil === 'permanent') {
        showMessage({
          message: '⛔ Permanently Banned',
          description: 'You are permanently banned from sending messages.',
          type: 'danger',
        });
        return true;
      }
      if (typeof bannedUntil === 'number' && now < bannedUntil) {
        const totalMinutes = Math.ceil((bannedUntil - now) / 60000);
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;
        const timeLeftText = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
        showMessage({
          message: `⚠️ Strike ${strikeCount}`,
          description: `You are banned from chatting for ${timeLeftText} more minute(s).`,
          type: 'warning',
          duration: 5000,
        });
        return true;
      }
    }
    return false;
  }, [isMeBanned, strikeInfo, t]);

  // Trades carry item lists; feed posts carry a description and/or images.
  // Anything else is not persisted, so an unexpected shape can never be
  // written over the pair's trade.
  const itemKind = useMemo(() => {
    if (!item || typeof item !== 'object') return null;
    if (item.hasItems || item.wantsItems) return 'trade';
    if (item.desc !== undefined || item.imageUrl) return 'post';
    return null;
  }, [item]);

  useEffect(() => {
    if (!Array.isArray(messages) || messages.length === 0) return;
    if (!myUserId || !selectedUserId) return;
  
    const myMsgs = messages.filter(m => m?.senderId === myUserId);
    const theirMsgs = messages.filter(m => m?.senderId === selectedUserId);
  
    if (myMsgs.length > 1 && theirMsgs.length > 1) {
      setCanRate(true);
    } else {
      setCanRate(false);
    }
  }, [messages, myUserId, selectedUserId]);
  
  // ✅ FIRESTORE ONLY: Check if user already rated
  useEffect(() => {
    if (!selectedUserId || !myUserId || !firestoreDB) return;
  
    const reviewDocId = `${selectedUserId}_${myUserId}`; // toUser_fromUser
    const reviewRef = doc(firestoreDB, "reviews", reviewDocId);
    
    getDoc(reviewRef)
      .then(snapshot => {
        if (snapshot.exists() && snapshot.data()?.rating) {
          setHasRated(true);
        } else {
          setHasRated(false);
        }
      })
      .catch(error => {
        console.error("Error checking existing rating:", error);
        setHasRated(false);
      });
  }, [selectedUserId, myUserId, firestoreDB]);
  
  
  // ✅ Safety check for bannedUsers array
  const isBanned = useMemo(() => {
    if (!selectedUserId) return false;
    const banned = Array.isArray(bannedUsers) ? bannedUsers : [];
    return banned.includes(selectedUserId);
  }, [bannedUsers, selectedUserId]);

  // ── Chat availability ────────────────────────────────────────────────────
  // The door decides which switch applies: the Trades screen pushes
  // PrivateChatTrade, everything else (inbox, feed, profiles) is general.
  const navRoute = useRoute();
  const routeName = route?.name || navRoute?.name;
  const chatType = useMemo(() => chatTypeForRoute(routeName), [routeName]);

  const [theirAvailability, setTheirAvailability] = useState(null);
  useEffect(() => {
    let cancelled = false;
    if (!appdatabase || !selectedUserId) { setTheirAvailability(null); return undefined; }
    fetchChatAvailability(appdatabase, selectedUserId).then((a) => {
      if (!cancelled) setTheirAvailability(a);
    });
    return () => { cancelled = true; };
  }, [appdatabase, selectedUserId]);

  // Blocks both ways: 'them' = they closed this door, 'me' = I did.
  const chatBlockedBy = useMemo(
    () => resolveChatBlock(chatType, user, theirAvailability),
    [chatType, user, theirAvailability]
  );
  const isChatUnavailable = !!chatBlockedBy;
  const isDarkMode = theme === 'dark';
  const styles = useMemo(() => getStyles(isDarkMode), [isDarkMode]);
  const themeColors = getThemeColors(isDarkMode);

  // Generate a unique chat key
  const chatKey = useMemo(
    () =>
      myUserId < selectedUserId
        ? `${myUserId}_${selectedUserId}`
        : `${selectedUserId}_${myUserId}`,
    [myUserId, selectedUserId]
  );

  // Read receipts: the other user's lastRead timestamp. This must come after
  // chatKey — it used to be called ~80 lines above it, where chatKey was still
  // undefined, so the listener never attached and ticks never turned blue.
  const otherLastRead = useOtherLastRead(chatKey, selectedUserId);

  // (The active-chat flag is cleared by the focus effect further down, which
  // also sets it. A second effect here cleared it again on every blur.)

  // ✅ Memoize handleRating - FIRESTORE ONLY (no RTDB)
  const handleRating = useCallback(async () => {
    if (!rating || rating < 1 || rating > 5) {
      showErrorMessage(t('home.alert.error'), t('private_chat.select_rating'));
      return;
    }

    // ✅ Safety checks
    if (!selectedUserId || !myUserId || !firestoreDB) {
      showErrorMessage(t('home.alert.error'), t('private_chat.missing_data'));
      return;
    }

    // Banned users cannot rate or review others either.
    if (rejectIfBanned()) return;

    try {
      setStartRating(true);
      
      // ✅ FIRESTORE ONLY: Read existing rating from reviews collection
      const reviewDocId = `${selectedUserId}_${myUserId}`; // toUser_fromUser
      const reviewRef = doc(firestoreDB, "reviews", reviewDocId);
      const existingReviewSnap = await getDoc(reviewRef);
      const oldRating = existingReviewSnap.exists() ? existingReviewSnap.data()?.rating : undefined;
      
      // ✅ FIRESTORE ONLY: Read current summary from user_ratings_summary
      const summaryRef = doc(firestoreDB, 'user_ratings_summary', selectedUserId);
      const summarySnap = await getDoc(summaryRef);
      const summaryData = summarySnap.exists() ? summarySnap.data() : null;
      const oldAverage = summaryData?.averageRating || 0;
      const oldCount = summaryData?.count || 0;
  
      let newAverage = 0;
      let newCount = oldCount;
  
      if (oldRating !== undefined && oldRating !== null) {
        // 🔁 Updating existing rating
        newAverage = ((oldAverage * oldCount) - oldRating + rating) / oldCount;
      } else {
        // 🆕 New rating
        newCount = oldCount + 1;
        newAverage = ((oldAverage * oldCount) + rating) / newCount;
      }

      // ✅ FIRESTORE ONLY: Update user_ratings_summary (single source of truth)
      await setDoc(
        summaryRef,
        {
          averageRating: parseFloat(newAverage.toFixed(2)),
          count: newCount,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      
      // ✅ FIRESTORE ONLY: Save/update rating in reviews collection (even without text review)
      // This ensures we track who rated whom, even if they didn't write a review
      const now = serverTimestamp();
      const isUpdate = existingReviewSnap.exists();
      
      await setDoc(
        reviewRef,
        {
          fromUserId: myUserId,
          toUserId: selectedUserId,
          rating,
          userName: user?.displayName || user?.displayname || null,
          createdAt: isUpdate ? existingReviewSnap.data()?.createdAt ?? now : now,
          updatedAt: now,
          edited: isUpdate,
        },
        { merge: true }
      );

      // ✅ Optional review text in Firestore
      const trimmedReview = (reviewText || "").trim();
      let reviewWasSaved = false;
      let reviewWasUpdated = false;

      if (trimmedReview) {
        // Update review with text
        await setDoc(
          reviewRef,
          {
            review: trimmedReview,
            updatedAt: now,
            edited: isUpdate,
          },
          { merge: true }
        );

        reviewWasSaved = true;
        reviewWasUpdated = isUpdate;
      }

// 🎉 feedback based on whether we actually saved a text review
showSuccessMessage(
  t('home.alert.success'),
  reviewWasSaved
    ? reviewWasUpdated
      ? t('private_chat.review_updated')
      : t('private_chat.review_thanks')
    : t('private_chat.rating_thanks')
);

      setShowRatingModal(false);
      setHasRated(true);
      setReviewText('');
      setStartRating(false);
  
    } catch (error) {
      console.error("Rating error:", error);
      showErrorMessage(t('home.alert.error'), t('private_chat.rating_error'));
      setStartRating(false);
    }
  }, [rating, selectedUserId, myUserId, firestoreDB, reviewText, user?.id, user?.displayName, rejectIfBanned]);
  
  




  const messagesRef = useMemo(
    () => (chatKey ? ref(appdatabase, `private_messages/${chatKey}/messages`) : null),
    [chatKey, appdatabase],
  );
  
    // console.log(selecte÷dUser)

  // A page that resolves after the user opened another chat belongs to the
  // old conversation; compare against the live ref and drop it. The in-flight
  // flag stops onEndReached (which fires repeatedly, faster than isPaginating
  // state can update) from requesting the same page twice.
  const liveMessagesDbRef = useRef(messagesRef);
  liveMessagesDbRef.current = messagesRef;
  const loadingMoreRef = useRef(false);

  // Load messages with pagination
  const loadMessages = useCallback(
    async (reset = false) => {
      if (!messagesRef) return;
      // No cursor means there is nothing older; without this a stray
      // load-more fetched the NEWEST page again and appended nothing.
      if (!reset && !lastLoadedKeyRef.current) return;
      // Guard OUTSIDE the try: an early return inside it would run `finally`
      // and clear the flag that the in-flight request still owns.
      if (!reset) {
        if (loadingMoreRef.current) return;
        loadingMoreRef.current = true;
      }
  
      if (reset) {
        setLoading(true);
        // ✅ Only clear messages if we're actually resetting (chat changed or manual refresh)
        setMessages([]);
        lastLoadedKeyRef.current = null;
      } else {
        setIsPaginating(true);
      }
  
      let stale = false;
      try {
        const requestRef = messagesRef;
        let query = messagesRef.orderByKey();
  
        // endAt() is INCLUSIVE: a page ending at the cursor re-reads the
        // cursor message, which is already on screen, and a full-looking page
        // of one repeat never let paging stop. Fetch one extra and drop the
        // cursor key — same fix as Trader.jsx's community-chat pagination.
        const lastKey = lastLoadedKeyRef.current;
        const limitSize = reset ? INITIAL_PAGE_SIZE : PAGE_SIZE;
        if (!reset && lastKey) {
          query = query.endAt(lastKey).limitToLast(limitSize + 1);
        } else {
          query = query.limitToLast(limitSize);
        }

        const snapshot = await query.once('value');
        if (liveMessagesDbRef.current !== requestRef) { stale = true; return; } // chat switched mid-request
        const data = snapshot.val() || {};
        if (!reset && lastKey) delete data[lastKey];

        // The cursor comes from the raw keys: push keys sort chronologically,
        // so the smallest key is the oldest row this page returned.
        const rawKeys = Object.keys(data).sort();
        const oldestKey = rawKeys.length > 0 ? rawKeys[0] : null;
        // Fewer NEW rows than a page means the start of the chat was reached:
        // stop paging instead of re-querying on every onEndReached.
        const reachedStart = rawKeys.length < limitSize;
  
        let parsedMessages = Object.entries(data)
          .map(([key, value]) => ({ id: key, ...value }))
          .sort((a, b) => (b?.timestamp || 0) - (a?.timestamp || 0)); // ✅ DESCENDING: newest -> oldest (for inverted FlatList to show newest at bottom)

        // ✅ If reset and no messages found, keep loading state but don't clear existing messages unnecessarily
        if (parsedMessages.length === 0) {
          // No more messages to load - null the cursor to stop pagination
          lastLoadedKeyRef.current = null;
          return;
        }

        // console.log(parsedMessages.length)
  
        setMessages(prev => {
          if (!Array.isArray(prev)) return parsedMessages;
          const existingIds = new Set(prev.map(m => String(m?.id)));
          const onlyNew = parsedMessages.filter(m => !existingIds.has(String(m?.id)));
          
          if (reset) {
            // Initial load: use parsed messages as-is (already sorted descending)
            return parsedMessages;
          } else {
            // Load more (older messages): append and maintain descending order
            const combined = [...prev, ...onlyNew];
            return combined.sort((a, b) => (b?.timestamp || 0) - (a?.timestamp || 0));
          }
        });
  
        lastLoadedKeyRef.current = reachedStart ? null : oldestKey;
      } catch (err) {
        console.warn('Error loading messages:', err);
      } finally {
        // A stale reset must not clear the spinner the new chat's own load owns.
        if (reset) { if (!stale) setLoading(false); }
        else loadingMoreRef.current = false;
        setIsPaginating(false);
      }
    },
    [messagesRef],
  );
  
  
  

  // ✅ Only load messages when chatKey actually changes (not when loadMessages reference changes)
  useEffect(() => {
    if (!messagesRef) return;
    
    // Only reset if chatKey actually changed
    const currentChatKey = chatKey;
    const previousChatKey = previousChatKeyRef.current;
    
    if (currentChatKey !== previousChatKey) {
      // Chat changed - reset and load messages
      previousChatKeyRef.current = currentChatKey;
      loadMessages(true);
    } else if (previousChatKey === null) {
      // Initial load
      previousChatKeyRef.current = currentChatKey;
      loadMessages(true);
    }
    // If chatKey hasn't changed, don't reload (preserves existing messages)
  }, [chatKey, messagesRef, loadMessages]);
  
  const handleLoadMore = useCallback(() => {
    // ✅ Prevent loading if already paginating or no more messages
    if (isPaginating || !lastLoadedKeyRef.current) {
      return;
    }
    // explicitly say "this is NOT a reset"
    loadMessages(false);
  }, [loadMessages, isPaginating]);
  // ✅ Memoize groupItems
  const groupItems = useCallback((items) => {
    if (!Array.isArray(items)) return [];
    const grouped = {};
    items.forEach((item) => {
      if (!item || typeof item !== 'object') return;
      const key = `${item.name || ''}-${item.type || ''}`;
      if (grouped[key]) {
        grouped[key].count = (grouped[key].count || 0) + 1;
      } else {
        grouped[key] = { 
          ...item,
          count: 1
        };
      }
    });
    return Object.values(grouped);
  }, []);

  // ✅ Memoize formatName
  const formatName = useCallback((name) => {
    if (!name || typeof name !== 'string') return '';
    let formattedName = name.replace(/^\+/, '');
    formattedName = formattedName.replace(/\s+/g, '-');
    return formattedName;
  }, []);

  useEffect(() => {
    if (!myUserId || !selectedUserId || !appdatabase) return;

    const chatId = [myUserId, selectedUserId].sort().join('_');
    const tradeRef = ref(appdatabase, `private_messages/${chatId}/trade`);
    // Posts get their own sibling node. It is new and additive: older builds
    // never read it, and they keep reading /trade, which a post no longer
    // touches.
    const postRef = ref(appdatabase, `private_messages/${chatId}/post`);

    if (itemKind === 'trade') {
      setTrade(item);
      setPost(null);
      set(tradeRef, item).catch((error) => {
        console.error("Error updating trade in Firebase:", error);
      });
    } else if (itemKind === 'post') {
      setPost(item);
      setTrade(null);
      // Only what the reminder card shows. The raw post carries Firestore
      // timestamps and every image, none of which belong in the chat node.
      set(postRef, {
        desc: typeof item.desc === 'string' ? item.desc.slice(0, 300) : '',
        imageUrl: Array.isArray(item.imageUrl) ? item.imageUrl.slice(0, 1) : [],
        displayName: item.displayName || '',
        selectedTags: Array.isArray(item.selectedTags) ? item.selectedTags.slice(0, 3) : [],
      }).catch((error) => {
        console.error("Error updating post in Firebase:", error);
      });
    } else {
      // Opened without context (inbox, profile): show whatever this pair last
      // talked about. A trade wins over a post, as the strip is more useful.
      get(tradeRef)
        .then((snapshot) => {
          if (snapshot.exists()) {
            const tradeData = snapshot.val();
            if (tradeData && typeof tradeData === 'object') {
              // Older builds wrote feed POSTS into /trade too. Only a real
              // trade has item lists; showing a post here drew an empty trade
              // strip and hid the post card. Treat those as the post (the
              // /post read below wins if it finds one).
              if (tradeData.hasItems || tradeData.wantsItems) {
                setTrade(tradeData);
              } else if (tradeData.desc || tradeData.imageUrl) {
                setPost((prev) => prev || tradeData);
              }
            }
          }
        })
        .catch((error) => {
          console.error("Error fetching trade from Firebase:", error);
        });
      get(postRef)
        .then((snapshot) => {
          if (snapshot.exists()) {
            const postData = snapshot.val();
            if (postData && typeof postData === 'object') {
              setPost(postData);
            }
          }
        })
        .catch((error) => {
          console.error("Error fetching post from Firebase:", error);
        });
    }
  }, [item, itemKind, myUserId, selectedUserId, appdatabase]);
  
  // ✅ Memoize grouped items
  const groupedHasItems = useMemo(() => {
    if (!trade || !trade.hasItems || !Array.isArray(trade.hasItems)) return [];
    return groupItems(trade.hasItems);
  }, [trade?.hasItems, groupItems]);

  const groupedWantsItems = useMemo(() => {
    if (!trade || !trade.wantsItems || !Array.isArray(trade.wantsItems)) return [];
    return groupItems(trade.wantsItems);
  }, [trade?.wantsItems, groupItems]);

  // See Code/Helper/valueSources.js. Stable reference, so no useCallback.
  const getImageUrl = resolveItemImage;

  // ✅ Memoize sendMessage
  //
  // Returns true once the message is stored, false when it was refused or
  // failed. PrivateMessageInput clears the box before calling this and puts
  // the text, photos and items back on false — so every early return below
  // must return false, or the user loses what they typed.
  const sendMessage = useCallback(async (text, image, fruits) => {
    // Guard for a stale screen — the input is already disabled when this door
    // is shut, so this only fires if the switch flipped while the chat was open.
    if (chatBlockedBy) {
      Alert.alert(
        t('home.alert.error', { defaultValue: 'Error' }),
        chatBlockedBy === 'them'
          ? (chatType === 'trade'
            ? 'This user has disabled trade chat. You cannot message them from a trade.'
            : 'This user has disabled chat. You cannot message them right now.')
          : (chatType === 'trade'
            ? 'You have disabled trade chat. Turn it back on in Settings.'
            : 'You have disabled chat. Turn it back on in Settings.')
      );
      return false;
    }

    // Same ban / strike gate the public chat applies (Trader.jsx).
    if (rejectIfBanned()) return false;

    const trimmedText = (text || '').trim(); // safe guard
    // Handle both single image (string) and multiple images (array)
    const hasImage = !!image && (typeof image === 'string' || (Array.isArray(image) && image.length > 0));
    const hasFruits = Array.isArray(fruits) && fruits.length > 0;

    // ✅ Validate fruits count - maximum 18 fruits allowed
    if (hasFruits && fruits.length > 18) {
      showErrorMessage(t("home.alert.error"), t('private_chat.max_pets_error'));
      return false;
    }

    // Block only if there's no text, no image AND no fruits
    if (!trimmedText && !hasImage && !hasFruits) {
      showErrorMessage(t("home.alert.error"), t("chat.cannot_empty"));
      return false;
    }

    // ✅ Safety checks
    if (!myUserId || !selectedUserId || !appdatabase) {
      showErrorMessage(t("home.alert.error"), t('private_chat.missing_data'));
      return false;
    }

    // ⚠️ NOTE: Block prevention check is missing here
    // Currently, blocked users can still send messages (they're just filtered on receiver's side)
    // See BLOCK_FUNCTIONALITY_ANALYSIS.md for details and recommended solution

    const timestamp = Date.now();
    const chatId = [myUserId, selectedUserId].sort().join('_');

    // Build message payload
    const messageData = {
      text: trimmedText,
      senderId: myUserId,
      timestamp,
      // Which door this came through. The RTDB rule reads it to pick which of
      // the recipient's two switches applies; absent from older clients, which
      // the rule treats as 'general'.
      origin: chatType,
      // flage: user.flage ? user.flage : null,
    };
  
    if (hasImage) {
      // Store as array if multiple images, single string if one image
      if (Array.isArray(image)) {
        messageData.imageUrls = image; // Array of image URLs
        messageData.imageUrl = image[0]; // Keep first for backward compatibility
      } else {
        messageData.imageUrl = image; // Single image URL
      }
    }
  
    if (hasFruits) {
      messageData.fruits = fruits;       // 👈 your array of selected fruits
    }
  
    // What to show as last message in chat list
    const imageCount = Array.isArray(image) ? image.length : (image ? 1 : 0);
    const photosCountStr = imageCount > 1 ? t('private_chat.multiple_photos', { count: imageCount }) : t('private_chat.single_photo');
    const petsCountStr = hasFruits ? (fruits.length === 1 ? t('private_chat.pets_count_singular', { count: fruits.length }) : t('private_chat.pets_count_plural', { count: fruits.length })) : '';
    const lastMessagePreview = trimmedText || (hasImage ? photosCountStr : hasFruits ? petsCountStr : '');
  
    // One atomic multi-path write: the message and both inbox rows land
    // together or not at all. These used to be four sequential writes, so an
    // app killed mid-send left a message the recipient never saw in their
    // inbox, with no unread badge and no push.
    //
    // Every inbox field is its own path. Writing the row as a single object
    // would REPLACE it and wipe fields this client does not own — `muted` in
    // particular, which the recipient sets from their inbox bell.
    //
    // The recipient's unreadCount always goes up by one, server-side. The old
    // code first read users/{uid}/activeChat to skip the bump for a reader,
    // but nothing writes that path, so the read was wasted. The reader clears
    // its own count when it leaves the chat (see the focus effect), and the
    // push function already stays silent for the chat that is open.
    const senderPath = `chat_meta_data/${myUserId}/${selectedUserId}`;
    const receiverPath = `chat_meta_data/${selectedUserId}/${myUserId}`;
    const updates = {
      [`private_messages/${chatId}/messages/${timestamp}`]: messageData,

      [`${senderPath}/chatId`]: chatId,
      [`${senderPath}/receiverId`]: selectedUserId,
      [`${senderPath}/receiverName`]: selectedUser?.sender || t('private_chat.anonymous'),
      [`${senderPath}/receiverAvatar`]: selectedUser?.avatar || GAME.defaultAvatar,
      [`${senderPath}/lastMessage`]: lastMessagePreview,
      [`${senderPath}/timestamp`]: timestamp,
      [`${senderPath}/unreadCount`]: 0,

      [`${receiverPath}/chatId`]: chatId,
      [`${receiverPath}/receiverId`]: myUserId,
      [`${receiverPath}/receiverName`]: user?.displayName || t('private_chat.anonymous'),
      [`${receiverPath}/receiverAvatar`]: user?.avatar || GAME.defaultAvatar,
      [`${receiverPath}/lastMessage`]: lastMessagePreview,
      [`${receiverPath}/timestamp`]: timestamp,
      // notifyNewMessage fires on this counter rising — keep it an increment.
      [`${receiverPath}/unreadCount`]: increment(1),
    };

    try {
      await update(ref(appdatabase, '/'), updates);

      setInput('');
      setReplyTo(null);
      return true;
    } catch (error) {
      console.error("Error sending message:", error);
      Alert.alert(t('home.alert.error'), t('private_chat.send_failed'));
      return false;
    }
  }, [myUserId, selectedUserId, appdatabase, selectedUser, user, t, chatBlockedBy, chatType, rejectIfBanned]);
  
  

  useFocusEffect(
    useCallback(() => {
      if (!user?.id || !selectedUserId) return;

      const chatMetaRef = ref(appdatabase, `chat_meta_data/${user.id}/${selectedUserId}`);
      unreadWhileFocusedRef.current = false;

      // Mark this chat open FIRST, then clear the badge, so a message that
      // lands in between is already silenced by the push function instead of
      // notifying someone who is reading the chat.
      setActiveChat(user.id, chatKey).then(() => {
        update(chatMetaRef, { unreadCount: 0 }).catch(() => {});
      });

      // ✅ Update lastRead timestamp for read receipts
      if (localState?.showReadReceipts ?? true) {
        updateLastRead(chatKey, user.id);
      }

      return () => {
        clearActiveChat(user.id);
        // Messages that arrived while we were reading still bumped our
        // unreadCount (the sender always increments). Clear it on the way out
        // so the inbox does not show a phantom badge for a chat already read.
        if (unreadWhileFocusedRef.current) {
          unreadWhileFocusedRef.current = false;
          update(chatMetaRef, { unreadCount: 0 }).catch(() => {});
        }
      };
    }, [user?.id, selectedUserId, chatKey, appdatabase])
  );
  // console.log(selectedUser.senderId)

  // Handle refresh
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadMessages(true);
    setRefreshing(false);
  }, [loadMessages]);

  // (removed a second setActiveChat effect here — the focus effect above
  // already calls it. setActiveChat performs 2 writes plus an onDisconnect
  // registration, so this duplicate doubled that on every chat open. Its
  // teardown also double-called clearActiveChat.)



// ✅ OPTIMIZED: Only listen to the newest message to avoid duplicate reads
// This prevents child_added from firing for all existing messages when listener is attached
useEffect(() => {
  if (!messagesRef) return;

  // ✅ Use limitToLast(1) to only listen to the newest message
  // This ensures we only get NEW messages, not all existing ones
  const limitedRef = messagesRef.limitToLast(1);
  
  const handleChildAdded = snapshot => {
    if (!snapshot || !snapshot.key) return;
    const data = snapshot.val();
    if (!data || typeof data !== 'object') return;

    const newMessage = { id: snapshot.key, ...data };
    if (!newMessage.timestamp) {
      newMessage.timestamp = Date.now();
    }

    if (newMessage.senderId && newMessage.senderId !== myUserId && myUserId) {
      // The sender bumped our unreadCount for this one; clear it on leave.
      // (limitToLast(1) also replays the newest existing message on attach,
      // which can cost one redundant reset write per visit — cheaper than a
      // read to tell the two apart.)
      unreadWhileFocusedRef.current = true;
      // ✅ Update lastRead when receiving a new message while in chat
      if (localState?.showReadReceipts ?? true) {
        updateLastRead(chatKey, myUserId);
      }
    }

    setMessages(prev => {
      if (!Array.isArray(prev)) return [newMessage];
      const exists = prev.some(m => String(m?.id) === String(newMessage.id));
      if (exists) return prev; // don't duplicate

      // ✅ Keep DESCENDING order: add to the beginning (newest first for inverted FlatList)
      return [newMessage, ...prev].sort((a, b) => (b?.timestamp || 0) - (a?.timestamp || 0));
    });
  };

  const listener = limitedRef.on('child_added', handleChildAdded);

  return () => {
    if (limitedRef) {
      limitedRef.off('child_added', listener);
    }
  };
}, [messagesRef]);





  return (
    <>

      <GestureHandlerRootView>


        <View style={[styles.container,]}>

          <ConditionalKeyboardWrapper style={{ flex: 1 }} privatechatscreen={true} noTabBar={noTabBar}>
            {/* <View style={{ flex: 1 }}> */}
              {trade && (
                <View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', padding: SPACE.md, borderBottomColor:!isDarkMode ? 'lightgrey' : 'grey', borderBottomWidth:1 }}>
                  <View style={{ width: '48%', flexWrap: 'wrap', flexDirection: 'row', gap: SPACE.xs }}>
                    {groupedHasItems?.map((hasItem, index) => (
                      <View key={`${hasItem.name}-${hasItem.type}`} style={{ width: '19%', alignItems: 'center' }}>
                        <Image
                          source={{ uri: getImageUrl(hasItem) || GAME.defaultAvatar }}
                          style={{ width: 30, height: 30}}
                        />
                        {/* The F/R/M/N (Fly/Ride/Mega/Neon) badges that sat
                            here were Adopt Me pet variants. Fisch trade items
                            (serializeTradeItem) never carry those fields, so
                            they could not render and were removed. */}
                        {hasItem.count > 1 && (
                          <View style={{ position: 'absolute', top: 0, right: 0, backgroundColor: '#e74c3c', borderRadius: 8, paddingHorizontal: 1, paddingVertical: 1 }}>
                            <Text style={{ color: 'white', fontSize: SIZE.label}}>{hasItem.count}</Text>
                          </View>
                        )}
                      </View>
                    ))}
                  </View>
                  <View style={{ width: '2%', justifyContent: 'center', alignItems: 'center' }}>
                    <Image source={require('../../../assets/transfer.png')} style={{ width: 10, height: 10 }} />
                  </View>
                  <View style={{ width: '48%', flexWrap: 'wrap', flexDirection: 'row', gap: SPACE.xs }}>
                    {groupedWantsItems?.map((wantitem, index) => (
                      <View key={`${wantitem.name}-${wantitem.type}`} style={{ width: '19%', alignItems: 'center' }}>
                        <Image
                          source={{ uri: getImageUrl(wantitem) || GAME.defaultAvatar }}
                          style={{ width: 35, height: 35 }}
                        />
                        {wantitem.count > 1 && (
                          <View style={{ position: 'absolute', top: 0, right: 0, backgroundColor: '#e74c3c', borderRadius: 8, paddingHorizontal: 1, paddingVertical: 1 }}>
                            <Text style={{ color: 'white', fontSize: SIZE.label }}>{wantitem.count}</Text>
                          </View>
                        )}
                      </View>
                    ))}
                  </View>
                </View>
                </View>
              )}

              {/* Small reminder of the feed post this chat started from, in
                  place of the trade strip a post used to (wrongly) render as. */}
              {!trade && post && (
                <View style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: SPACE.sm,
                  paddingHorizontal: SPACE.md,
                  paddingVertical: SPACE.xs,
                  borderBottomWidth: 1,
                  borderBottomColor: themeColors.border,
                  backgroundColor: themeColors.card,
                }}>
                  {Array.isArray(post.imageUrl) && typeof post.imageUrl[0] === 'string' && (
                    <Image
                      source={{ uri: post.imageUrl[0] }}
                      style={{ width: 28, height: 28, borderRadius: 4 }}
                    />
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: SIZE.label, fontFamily: FONT.bold, color: themeColors.textMuted }}>
                      {t('feed.about_post', { defaultValue: 'About a post' })}
                    </Text>
                    {!!post.desc && (
                      <Text numberOfLines={1} style={{ fontSize: SIZE.small, color: themeColors.text, fontFamily: FONT.regular }}>
                        {post.desc}
                      </Text>
                    )}
                  </View>
                </View>
              )}

             {messages.length === 0 ? (
  // No messages yet
  loading ? (
    // Still checking / loading
    <ActivityIndicator
      size="large"
      color="#1E88E5"
      style={{ flex: 1, justifyContent: 'center' }}
    />
  ) : (
    // Finished loading, still empty
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyText}>{t('chat.no_messages_yet')}</Text>
    </View>
  )
) : (
  // We have messages → always render the list, no matter what `loading` is
  <PrivateMessageList
    messages={messages}
    userId={myUserId}
    handleLoadMore={handleLoadMore}
    refreshing={refreshing}
    onRefresh={handleRefresh}
    isBanned={isBanned}
    selectedUser={selectedUser}
    user={user}
    onReply={setReplyTo} // stable, so memo(PrivateMessageList) holds while typing
    canRate={canRate}
    hasRated={hasRated}
    setShowRatingModal={setShowRatingModal}
    otherLastRead={(localState?.showReadReceipts ?? true) ? otherLastRead : null}
    chatKey={chatKey}
  />
)}

              {/* Says why the input is dead for a banned or muted user, so a
                  disabled box never reads as the app being broken. */}
              {isMeBanned && !isChatUnavailable && (
                <View style={styles.chatUnavailableBanner}>
                  <Text style={styles.chatUnavailableIcon}>⛔</Text>
                  <Text style={styles.chatUnavailableText}>
                    {t('chat.banned_message', { defaultValue: 'You are banned from sending messages.' })}
                  </Text>
                </View>
              )}

              {isChatUnavailable && (
                <View style={styles.chatUnavailableBanner}>
                  <Text style={styles.chatUnavailableIcon}>🚫</Text>
                  <Text style={styles.chatUnavailableText}>
                    {chatBlockedBy === 'them'
                      ? (chatType === 'trade'
                        ? 'This user has disabled trade chat. You cannot message them from a trade.'
                        : 'This user has disabled chat. You cannot message them right now.')
                      : (chatType === 'trade'
                        ? 'You have disabled trade chat. Turn it back on in Settings.'
                        : 'You have disabled chat. Turn it back on in Settings.')}
                  </Text>
                </View>
              )}

              <PrivateMessageInput
                onSend={sendMessage}
                isBanned={isBanned || isChatUnavailable || isMeBanned}
                bannedUsers={bannedUsers}
                replyTo={replyTo}
                onCancelReply={() => setReplyTo(null)}
                input={input}
                setInput={setInput}
                selectedTheme={selectedTheme}
                petModalVisible={petModalVisible}
                setPetModalVisible={setPetModalVisible}
                selectedFruits={selectedFruits}
                setSelectedFruits={setSelectedFruits}
                isProUser={localState.isPro}
              />
               <PetModal
               fromChat={true}
      visible={petModalVisible}
      onClose={() => setPetModalVisible(false)}
        selectedFruits={selectedFruits}
        setSelectedFruits={setSelectedFruits}



      
    />
            {/* </View>  */}
            </ConditionalKeyboardWrapper>

          {/* Spacer. Full-screen (noTabBar) has no banner at all and only needs
              to clear the home indicator. In-tab, it clears the absolutely-
              positioned banner — but only while an ad is really on screen: with
              no fill (or on Pro) the banner occupies nothing and the tab bar is
              docked in the layout flow, so anything reserved here is dead space
              between the message input and the tab bar. */}
          {noTabBar ? (
            <View style={{ height: Math.max(insets.bottom, 8) }} />
          ) : (
            <View style={{ height: bannerHeight ? bannerBottomPos + bannerHeight : 0 }} />
          )}

        </View>
      </GestureHandlerRootView>
      {/* Rating dialog. A real Modal now: as a plain absolute overlay the
          Android keyboard (edge-to-edge no longer resizes the activity) slid
          over the review box and the Submit button, and nothing inside a
          sibling KeyboardAvoidingView could move it. ModalKeyboardView lets the
          modal window resize on Android and pads on iOS — see its comments.
          The card was also hardcoded white, so dark mode got a white card. */}
      <Modal
        visible={showRatingModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowRatingModal(false)}
      >
        <ModalKeyboardView
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.5)',
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <View
            style={{
              backgroundColor: themeColors.card,
              borderWidth: 1,
              borderColor: themeColors.border,
              padding: SPACE.xxxl,
              borderRadius: 10,
              width: '80%',
              alignItems: 'center',
              position: 'relative',
            }}
          >
            {/* ❌ Close Button */}
            <TouchableOpacity
              onPress={() => setShowRatingModal(false)}
              style={{
                position: 'absolute',
                top: -5,
                right: 1,
                zIndex: 100,
                padding: 5,
              }}
            >
              <Text style={{ fontSize: SIZE.subtitle, color: themeColors.textMuted }}>✖</Text>
            </TouchableOpacity>

            {/* Title */}
            <Text style={{ fontSize: SIZE.subtitle, marginBottom: SPACE.lg, textAlign: 'center', fontFamily: FONT.regular, color: themeColors.text }}>
              {t('private_chat.rate_trader')}
            </Text>

            {/* Stars */}
            <View style={{ flexDirection: 'row', justifyContent: 'center', marginBottom: 15 }}>
              {[1, 2, 3, 4, 5].map((num) => (
                <TouchableOpacity key={num} onPress={() => setRating(num)}>
                  <Text style={{ fontSize: SIZE.display, color: num <= rating ? '#FFD700' : themeColors.border, marginHorizontal: SPACE.xs }}>
                    ★
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Review input (optional) */}
            <TextInput
              style={{
                width: '100%',
                minHeight: 60,
                borderWidth: 1,
                borderColor: themeColors.inputBorder,
                backgroundColor: themeColors.inputBg,
                color: themeColors.text,
                borderRadius: 8,
                paddingHorizontal: SPACE.lg,
                paddingVertical: SPACE.md,
                marginBottom: SPACE.xl,
                textAlignVertical: 'top',
                fontSize: SIZE.body,
              }}
              placeholder={t('private_chat.write_review')}
              placeholderTextColor={themeColors.textMuted}
              multiline
              value={reviewText}
              onChangeText={setReviewText}
            />

            {/* Submit Button — disabled while saving so a double tap cannot
                count the same rating twice in the summary average. */}
            <TouchableOpacity
              style={{
                backgroundColor: config.colors.primary,
                paddingVertical: SPACE.lg,
                paddingHorizontal: SPACE.xxxl,
                borderRadius: 8,
                width: '100%',
                opacity: startRating ? 0.6 : 1,
              }}
              onPress={handleRating}
              disabled={startRating}
            >
              <Text style={{ color: 'white', fontSize: SIZE.body, textAlign: 'center' }}>
                {!startRating ? t('private_chat.submit_rating') : t('private_chat.submitting')}
              </Text>
            </TouchableOpacity>
          </View>
        </ModalKeyboardView>
      </Modal>
      {!localState.isPro && !noTabBar && (
        <View style={{ position: 'absolute', bottom: bannerBottomPos, left: 0, right: 0, alignItems: 'center', zIndex: 5 }}>
          <BannerAdComponent onHeightChange={setBannerHeight} />
        </View>
      )}
      <ProfileBottomDrawer
          isVisible={isDrawerVisible}
          toggleModal={closeProfileDrawer}  
          startChat={()=>{}}
          selectedUser={selectedUser}
          isOnline={isOnline}
          bannedUsers={bannedUsers}
          fromPvtChat={true}
        />
    </>
  );
};

export default PrivateChatScreen;
