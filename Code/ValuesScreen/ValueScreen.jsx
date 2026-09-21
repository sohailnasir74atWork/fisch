import CatalogueImage from '../Components/CatalogueImage';
import { resolveItem } from '../Helper/valueSources';
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Image,
  FlatList,
  Modal,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { debounce } from '../Helper/debounce';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import config from '../Helper/Environment';
import { useGlobalState } from '../GlobelStats';
import { useHaptic } from '../Helper/HepticFeedBack';
import { useLocalState } from '../LocalGlobelStats';
import { useTranslation } from 'react-i18next';
import { ref, update } from '@react-native-firebase/database';
import { mixpanel } from '../AppHelper/MixPenel';
import { Menu, MenuOption, MenuOptions, MenuTrigger } from 'react-native-popup-menu';
import InterstitialAdManager from '../Ads/IntAd';
import BannerAdComponent from '../Ads/bannerAds';
import { openOtherApp } from '../SettingScreen/settinghelper';
import { STATUS } from '../Design/tokens';
import { SIZE } from '../Design/tokens';
import { SPACE } from '../Design/tokens';
import { ITEM_FILTERS, GAME } from '../config/game';
import { FONT } from '../Design/tokens';
import {
  resolveItemImage, buildItemPool, unwrapFeed, priceOf, displayValueText,
  DEFAULT_VALUE_SOURCE,
  // aliased: a local `matchesFilter` boolean already holds that name below.
  matchesFilter as itemMatchesFilter, itemKey, supplyNote,
} from '../Helper/valueSources';


// ✅ MM2: Removed VALUE_TYPES and MODIFIERS - MM2 doesn't use these
// ✅ MM2: Removed ItemBadge and BadgeButton components - MM2 doesn't use badges

// ✅ MM2: Removed ItemImage component - MM2 doesn't use badges



// ✅ Helper function to get stability color
const getStabilityColor = (stability) => {
  if (!stability || stability === 'N/A') return '#888';
  const s = stability.toLowerCase();
  if (s === 'stable') return STATUS.success;
  if (s === 'doing well' || s === 'recovering') return '#30D158';
  if (s === 'overpaid for' || s === 'peaking') return '#007AFF';
  if (s === 'fluctuating') return '#FF9500';
  if (s === 'underpaid for') return '#FF6B35';
  if (s === 'decreasing') return STATUS.danger;
  return '#888';
};

const ValueScreen = React.memo(({ selectedTheme, fromChat, selectedFruits, setSelectedFruits, onRequestClose, fromSetting, ownedPets, setOwnedPets, wishlistPets, setWishlistPets, owned, route }) => {
  // Seeded from route params so Home's search bar lands the user on results
  // rather than on an empty list they have to retype into. The screen is also
  // embedded (chat picker, settings) where there is no route at all.
  const [searchText, setSearchText] = useState(() => route?.params?.q || '');
  // What the BOX shows, updated on every keystroke. `searchText` (what filters
  // the list) is debounced 300ms behind it, so binding the input straight to
  // `searchText` would make typing visibly lag and the cursor jump.
  const [inputText, setInputText] = useState(() => route?.params?.q || '');
  const [selectedFilter, setSelectedFilter] = useState('ALL'); // ✅ MM2: Default to ALL

  // The initial state above only runs on FIRST mount, and React Navigation
  // reuses a screen already in the stack rather than remounting it — so a
  // second search from Home would have arrived with new params and a stale
  // query box. Track the param itself.
  const routeQuery = route?.params?.q;
  useEffect(() => {
    if (typeof routeQuery === 'string') {
      setSearchText(routeQuery);
      setInputText(routeQuery);
    }
  }, [routeQuery]);

  // The codes drawer moved to the Home tab (Code/HomeTab/HomeTabScreen.jsx).
  // It lived here only because the Home chip navigated in to open it, which
  // meant a tab switch to reach a modal; Home now owns both the chip and the
  // drawer, and reads the same localState.codes this screen did.
  // ✅ MM2: Removed selectedValueType, isFlySelected, isRideSelected - MM2 doesn't use modifiers
  const [filterDropdownVisible, setFilterDropdownVisible] = useState(false);
  const { analytics, appdatabase, isAdmin, reload, theme } = useGlobalState()
  const isDarkMode = theme === 'dark'
  const insets = useSafeAreaInsets();
  const bannerBottomPos = Math.max(insets.bottom, 8) + 6;
  const styles = useMemo(() => getStyles(isDarkMode), [isDarkMode]);
  const { localState } = useLocalState()
  const [valuesData, setValuesData] = useState([]);
  // Chat item picker: default to the user's own My Stuff items with a toggle
  // to the full catalog (adoptme pattern) — the list users attach in chat is
  // their OWN items. Falls back to 'all' when My Stuff is empty.
  const [chatPetSource, setChatPetSource] = useState(() =>
    (Array.isArray(localState?.ownedPets) && localState.ownedPets.length ? 'mine' : 'all'));
  const { t } = useTranslation();
  // ✅ Removed filters state - use availableFilters directly to prevent infinite loop
  const displayedFilter = selectedFilter === 'PREMIUM' ? 'GAME PASS' : selectedFilter;
  const formatName = (name) => name.replace(/^\+/, '').replace(/\s+/g, '-');
  const [hasAdBeenShown, setHasAdBeenShown] = useState(false);
  const [isAdLoaded, setIsAdLoaded] = useState(false);
  const [isShowingAd, setIsShowingAd] = useState(false);
  const { triggerHapticFeedback } = useHaptic();

  const [isModalVisible, setIsModalVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [itemSelections, setItemSelections] = useState({});
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [sortOrder, setSortOrder] = useState('none'); // 'asc', 'desc', or 'none'


  // ✅ MM2 Categories - matching HomeScreen (without INVENTORY for ValueScreen)
  // ✅ Use useMemo to prevent new array reference on every render
  const CATEGORIES = ITEM_FILTERS;
  const hideBadge = []; // MM2 doesn't use badges for hiding

  // console.log(selectedFruits)

  // ✅ MM2: Enhanced ListItem showing all scraped data
  const ListItem = React.memo(({ item, getItemValue, styles, onPress }) => {
    const currentValue = getItemValue(item);
    const stabilityColor = getStabilityColor(item.trade?.trend);

    return (
      <TouchableOpacity style={[styles.itemContainer]} onPress={onPress} disabled={!fromChat && !fromSetting}>
        <View style={styles.imageContainer}>
          <View style={styles.imageWrapper}>
            <CatalogueImage item={item} source={{ uri: getImageUrl(item) }} style={styles.icon} resizeMode="cover" />
          </View>
          <View style={styles.itemInfo}>
            <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
            <Text style={styles.value}>{t('value.value')}: {currentValue}</Text>
            {/* Where nobody has priced an item, show what it originally COST.
                That is the one thing we hold and no value site publishes, and it
                turns a dead "no value listed" into something a trader can reason
                from. It is explicitly not a trade value — a model built from
                exactly this data misses real values by a median 3x. Only 136 of
                740 unpriced cosmetics have one, so this is usually absent.
                See _research/FISCH-VALUE-RATIONALISATION.md. */}
            {(() => {
              const note = priceOf(item, valueSource).missing ? supplyNote(item) : null;
              return note ? <Text style={styles.supplyNote}>{note}</Text> : null;
            })()}
            {item.tier && <Text style={styles.tierLabel}>{item.tier}</Text>}
          </View>
        </View>

        {/* Demand & Rarity pills */}
        <View style={styles.pillsRow}>
          {item.trade?.demand && item.trade?.demand !== 'N/A' && (
            <View style={[styles.pill, styles.demandPill]}>
              <Text style={styles.pillText}>Demand: {item.trade?.demand}</Text>
            </View>
          )}
          {item.itemRarity && item.itemRarity !== 'N/A' && (
            <View style={[styles.pill, styles.rarityPill]}>
              <Text style={styles.pillText}>Rarity: {item.itemRarity}</Text>
            </View>
          )}
        </View>

        {/* Stability tag */}
        {item.trade?.trend && item.trade?.trend !== 'N/A' && (
          <View style={[styles.stabilityTag, { backgroundColor: stabilityColor + '20' }]}>
            <View style={[styles.stabilityDot, { backgroundColor: stabilityColor }]} />
            <Text style={[styles.stabilityText, { color: stabilityColor }]}>{item.trade?.trend}</Text>
          </View>
        )}

        {/* Range */}
        {item.range && item.range !== 'N/A' && (
          <Text style={styles.rangeText}>Range: {item.range}</Text>
        )}
      </TouchableOpacity>
    );
  });

  const editValuesRef = useRef({
    Value: '',
    Permanent: '',
    Biliprice: '',
    Robuxprice: '',
  });
  // House ad for one of our other apps. Built from GAME.otherApps so the
  // artwork, the name and the store link are one record — the two components
  // this replaces disagreed on all three: MM2's logo under the text "Fisch
  // Values", opening the Blox Fruits listing, inside Fisch Values itself.
  //
  // NOTE: the render site below is commented out, so this is not currently
  // shown. It is kept correct rather than deleted because Settings promotes
  // the same three apps and the two must not drift apart again.
  const promoApp = useMemo(
    () => GAME.otherApps[Math.floor(Math.random() * GAME.otherApps.length)],
    [],
  );

  const PromoAd = () => (
    <View style={styles.adContainer}>
      <View style={styles.adContent}>
        <Image source={promoApp.icon} style={styles.adIcon} />
        <View>
          <Text style={styles.adTitle}>{promoApp.name}</Text>
          <Text style={styles.tryNowText}>{t('value.try_other_app')}</Text>
        </View>
      </View>
      <TouchableOpacity style={styles.downloadButton} onPress={() => {
        openOtherApp(promoApp); triggerHapticFeedback('impactLight');
      }}>
        <Text style={styles.downloadButtonText}>{t('value.download')}</Text>
      </TouchableOpacity>
    </View>
  );

  // Which catalogue prices this screen. See Code/Helper/valueSources.js.
  const valueSource = localState?.valueSource || DEFAULT_VALUE_SOURCE;

  // Memoize the parsed data to prevent unnecessary re-parsing
  const parsedValuesData = useMemo(() => {
    const parse = (raw) => {
      try {
        if (!raw) return null;
        const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
        return parsed && typeof parsed === 'object' ? unwrapFeed(parsed) : null;
      } catch (error) {
        console.error("❌ Error parsing data:", error);
        return null;
      }
    };
    // One deduped pool from both catalogues, same as the calculator.
    // This screen is also the chat item picker (PetsModel embeds it), so what
    // it lists and what it prices is what gets sent into a conversation.
    return buildItemPool(parse(localState.data), parse(localState.suprime));
  }, [localState.data, localState.suprime]);

  // See Code/Helper/valueSources.js.
  const getImageUrl = resolveItemImage;
  // Memoize the filters - only show categories like HomeScreen (no tier values to keep menu short)
  const availableFilters = useMemo(() => {
    // ✅ Only return CATEGORIES to match HomeScreen - don't include all tier values
    return CATEGORIES;
  }, [CATEGORIES]);

  // Optimize the search and filter logic

  // useEffect(() => {
  //   if (localState.isGG) {
  //     const types = new Set(parsedValuesData.map(i => (i.type || '').toUpperCase()));
  //     // console.log("🧪 GG Types:", Array.from(types));
  //   }
  // }, [parsedValuesData]);


  // ✅ MM2: Simplified getItemValue (no modifiers needed)
  const getItemValue = useCallback((item) => {
    if (!item) return '0';
    // The source's own words when it has no real price — "Priceless",
    // "Award only", "x3 T1 Legendaries". See Code/Helper/valueSources.js.
    const label = displayValueText(item, valueSource);
    if (label) return label;
    const numericValue = priceOf(item, valueSource).value || 0;
    // For values >= 1, use toLocaleString for commas (250,000,000)
    // For values < 1 (like .44, .33), show as-is without extra zeros
    if (numericValue >= 1) {
      return Math.floor(numericValue) === numericValue
        ? numericValue.toLocaleString()
        : numericValue.toLocaleString();
    }
    // Small decimals: show cleanly (e.g., 0.44 not 0.440000)
    return numericValue.toString();
  }, [valueSource]);
  const filteredData = useMemo(() => {
    if (!Array.isArray(parsedValuesData) || parsedValuesData.length === 0) return [];

    const searchLower = searchText.trim().toLowerCase();
    const filterUpper = selectedFilter.toUpperCase();

    let filtered = parsedValuesData.filter((item) => {
      if (!item?.name) return false;

      // ✅ Search match: if search text is empty, show all items
      const matchesSearch = !searchLower || item.name.toLowerCase().includes(searchLower);
      
      // ✅ Filter match logic
      let matchesFilter = false;
      
      if (filterUpper === 'ALL') {
        matchesFilter = true;
      } else if (CATEGORIES.includes(filterUpper)) {
        // Shared with the calculator so the two can never disagree about what
        // "RODS" means. See Code/Helper/valueSources.js.
        matchesFilter = itemMatchesFilter(item, filterUpper);
      } else {
        // Check if it's a tier filter (numeric value like "1", "1.5", "2", "3.5", "4", "5")
        const itemTier = item.tier || item.Tier || '';
        const tierValue = itemTier.toString().match(/(\d+\.?\d*)/);
        if (tierValue) {
          const itemTierNum = tierValue[1];
          matchesFilter = itemTierNum === selectedFilter || 
                         itemTierNum === filterUpper;
        }
        
        // Also check rarity if not matched by tier
        if (!matchesFilter) {
          matchesFilter = item.rarity?.toUpperCase() === filterUpper;
        }
      }

      return matchesSearch && matchesFilter;
    });

    // Sort on the NUMBER, computed once per item.
    //
    // This used to parse `getItemValue()` — the DISPLAY string — inside the
    // comparator, which was wrong twice over:
    //
    //  1. It was broken. `parseFloat("S$ 15K")` is NaN, so every priced item
    //     collapsed to 0 and the list came back in essentially arbitrary order.
    //  2. It froze the app. getItemValue -> displayValueText -> priceOf, with
    //     string formatting, ran TWICE PER COMPARISON: ~2·n·log2(n) ≈ 125,000
    //     calls for 5,061 items, synchronously on the JS thread, every time a
    //     filter was pressed. That is the "phone hangs on filter" report.
    //
    // Decorate-sort-undecorate drops it to one priceOf per item.
    if (sortOrder !== 'none') {
      const dir = sortOrder === 'asc' ? 1 : -1;
      filtered = filtered
        .map((item) => ({ item, v: Number(priceOf(item, valueSource).value) || 0 }))
        .sort((a, b) => dir * (a.v - b.v))
        .map((d) => d.item);
    }

    return filtered;
  }, [parsedValuesData, searchText, selectedFilter, sortOrder, valueSource, CATEGORIES]);

  // Chat "My Items" mode: the user's My Stuff list matched against the live
  // catalog (fresh values, renderItem works unchanged), deduped, searchable.
  const myPetsView = useMemo(() => {
    if (!(fromChat && chatPetSource === 'mine')) return [];
    const q = searchText.trim().toLowerCase();
    const seen = new Set();
    return (localState?.ownedPets || [])
      .map(p => resolveItem(parsedValuesData, p))
      .filter(Boolean)
      .filter((it) => {
        const k = itemKey(it);
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      })
      .filter((it) => !q || (it.name || '').toLowerCase().includes(q));
  }, [fromChat, chatPetSource, localState?.ownedPets, parsedValuesData, searchText]);

  // ✅ MM2: Removed handleItemBadgePress - MM2 doesn't use badges/modifiers

  // 👇 Add these inside ValueScreen, after your other hooks/useState
  const selectedList = useMemo(() => {
    if (fromChat) {
      return selectedFruits || [];
    }
    if (fromSetting) {
      return owned ? (ownedPets || []) : (wishlistPets || []);
    }
    return [];
  }, [fromChat, fromSetting, owned, selectedFruits, ownedPets, wishlistPets]);

  const handleRemoveSelected = useCallback(
    (index) => {
      if (fromChat) {
        setSelectedFruits?.((prev = []) => prev.filter((_, i) => i !== index));
      } else if (fromSetting) {
        if (owned) {
          setOwnedPets?.((prev = []) => prev.filter((_, i) => i !== index));
        } else {
          setWishlistPets?.((prev = []) => prev.filter((_, i) => i !== index));
        }
      }
    },
    [fromChat, fromSetting, owned, setSelectedFruits, setOwnedPets, setWishlistPets]
  );


  // ✅ MM2: Simplified renderItem
  const renderItem = useCallback(
    ({ item }) => {

      // image url for this item
      const imageUrl = getImageUrl(item);

      const handlePress = () => {
        const priced = priceOf(item, valueSource);
        // EVERY field here must be defined. This object is written straight to
        // Firestore, which rejects `undefined` with "Unsupported field value"
        // and fails the whole document write. No Fisch row has an `id` and none
        // has `type`/`category`, so `id: item.id` alone was enough to make
        // adding ANY item to My Stuff fail silently — which is why the
        // inventory and its worth figure were always empty.
        const fruitObj = {
          itemId: itemKey(item),
          quantity: item.quantity || 1,
          catch: item.catch || null,
          npcEstimate: item.npcEstimate || null,
          Name: item.name,
          name: item.name,
          // currentValue may be a label ("Priceless"), so take the number from
          // priceOf rather than parsing the display string back.
          value: priced.value,
          quote: priced,
          trade: item.trade || null,
          tradeability: item.tradeability || null,
          imageUrl: imageUrl || null,
          // `collection` is what this catalogue actually tags rows with, and it
          // is what decides tradeability downstream. See Code/config/game.js.
          collection: item.collection || null,
          category: item.type || item.category || item.collection || null,
          id: item.id != null ? item.id : itemKey(item),
          // Provenance travels with the item. Without it a chat message or a
          // saved inventory row cannot say which catalogue priced it, and a
          // bundle-tier rank would later be summed as currency.
          // Null on anything older, which readers treat as MM2 — see isSummable().
          valueSource,
          valueConfidence: priced.valueConfidence || null,
          valueText: priced.valueText || null,
        };

        // 👉 From chat: always add another copy
        if (fromChat) {
          setSelectedFruits(prev => [...(prev || []), fruitObj]);
        }

        // 👉 From settings: always add another copy
        if (fromSetting) {
          if (owned) {
            setOwnedPets(prev => [...(prev || []), fruitObj]);
          } else {
            setWishlistPets(prev => [...(prev || []), fruitObj]);
          }
        }
      };

      return (
        <ListItem
          item={item}
          getItemValue={getItemValue}
          styles={styles}
          onPress={handlePress}
        />
      );
    },
    [
      fromChat, fromSetting, getImageUrl, owned, setOwnedPets, setSelectedFruits, setWishlistPets,
      getItemValue,
      styles,
      selectedFruits,
      ownedPets,
      wishlistPets,
      // Without this the callback keeps whichever source was active when it
      // was created, so an item added after toggling would be priced from the
      // old catalogue.
      valueSource,
    ]
  );


  // Update the useEffect for values data
  useEffect(() => {
    setValuesData(parsedValuesData);
  }, [parsedValuesData]);


  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await reload(); // Re-fetch stock data
      // Show success feedback (silent — no toast dependency needed)
    } catch (error) {
      console.error('Error refreshing data:', error);
    } finally {
      setRefreshing(false);
    }
  };



  const applyFilter = (filter) => {
    setSelectedFilter(filter);
  };

  // Memoised, because a debounced function rebuilt on every render is not
  // debounced at all: each keystroke got a brand-new timer, so every character
  // fired its own setSearchText 300ms later — n filter passes over 3,950 items
  // instead of one.
  const handleSearchChange = useMemo(
    () => debounce((text) => setSearchText(text), 300),
    [],
  );
  const closeDrawer = () => {
    setFilterDropdownVisible(false);
  };



  // ✅ MM2: Removed handleBadgePress - MM2 doesn't use badges/modifiers

  return (
    <>
      <GestureHandlerRootView>
        <View style={styles.container}>
          {(fromChat || fromSetting) && selectedList?.length > 0 && (
            <View style={styles.selectedPetsSection}>
              <View style={styles.selectedPetsHeader}>
                <Text style={styles.selectedPetsTitle}>
                  {fromChat
                    ? t('value.selected_pets')
                    : owned
                      ? t('value.owned_pets')
                      : t('value.wishlist')}
                </Text>

                <Text style={styles.selectedPetsCount}>
                  {selectedList.length}
                </Text>
              </View>

              <FlatList
                horizontal
                data={selectedList}
                keyExtractor={itemKey}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.selectedPetsList}
                renderItem={({ item, index }) => (
                  <TouchableOpacity style={styles.selectedPetCard} onPress={() => handleRemoveSelected(index)}>
                    <Image
                      source={{ uri: item.imageUrl }}
                      style={styles.selectedPetImage}
                    />
                    <Text
                      style={styles.selectedPetName}
                      numberOfLines={1}
                    >
                      {item.name}
                    </Text>

                    <View
                      style={styles.removePetButton}

                    >
                      <Icon name="close" size={8} color="#fff" />
                    </View>
                  </TouchableOpacity>
                )}
              />
            </View>
          )}
          {/* {(!fromChat && !fromSetting) && (
  <PromoAd />
)} */}

          <View style={styles.searchFilterContainer}>

            <TextInput
              style={styles.searchInput}
              placeholder={t('value.search_placeholder')}
              placeholderTextColor={isDarkMode ? config.colors.placeholderDark : config.colors.placeholderLight}
              // Was uncontrolled, so a query arriving from Home filtered the
              // list while the box still showed its placeholder — nothing to
              // see or clear.
              value={inputText}
              onChangeText={(text) => { setInputText(text); handleSearchChange(text); }}
            />
            {/* Selected / owned pets strip (chat/settings only) */}


            {!fromChat && !fromSetting && <Menu>
              <MenuTrigger onPress={() => { }}>
                <View style={styles.filterButton}>
                  <Text style={styles.filterText}>{displayedFilter}</Text>
                  <Icon name="chevron-down-outline" size={18} color="white" />
                </View>
              </MenuTrigger>
              <MenuOptions customStyles={{ optionsContainer: styles.menuOptions }}>
                {availableFilters.map((filter) => (
                  <MenuOption
                    key={filter}
                    onSelect={() => applyFilter(filter)}
                  >
                    <Text style={[styles.filterOptionText, selectedFilter === filter && styles.selectedOption]}>
                      {filter}
                    </Text>
                  </MenuOption>
                ))}
              </MenuOptions>

            </Menu>}
            <TouchableOpacity
              style={styles.filterButton}
              onPress={() => {
                setSortOrder(prev =>
                  prev === 'asc' ? 'desc' : prev === 'desc' ? 'none' : 'asc'
                );
              }}
            >
              <Text style={styles.filterText}>
                {sortOrder === 'asc' ? t('value.low') : sortOrder === 'desc' ? t('value.high') : t('value.filter')}
              </Text>
            </TouchableOpacity>
            {!fromChat && !fromSetting && (
              <TouchableOpacity
                style={styles.filterButton}
                onPress={() => {
                  triggerHapticFeedback('impactLight');
                  handleRefresh();
                }}
                disabled={refreshing}
              >
                {refreshing ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Icon name="refresh" size={18} color="white" />
                )}
              </TouchableOpacity>
            )}
            {selectedFruits?.length > 0 && <TouchableOpacity
              style={[styles.filterButton, { backgroundColor: 'purple' }]}
              onPress={onRequestClose}
            >
              <Text style={styles.filterText}>
                {t('value.done')}
              </Text>
            </TouchableOpacity>}
          </View>

          {fromChat && (
            <View style={{ flexDirection: 'row', gap: SPACE.md, marginBottom: SPACE.lg }}>
              {[
                { key: 'mine', label: `${t('value.my_items', 'My Items')} (${(localState?.ownedPets || []).length})` },
                { key: 'all', label: t('value.all_items', 'All Items') },
              ].map((opt) => {
                const active = chatPetSource === opt.key;
                return (
                  <TouchableOpacity
                    key={opt.key}
                    onPress={() => setChatPetSource(opt.key)}
                    style={{
                      flex: 1,
                      paddingVertical: SPACE.md,
                      borderRadius: 10,
                      alignItems: 'center',
                      backgroundColor: active ? config.colors.primary : 'transparent',
                      borderWidth: 1,
                      borderColor: active ? config.colors.primary : (isDarkMode ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)'),
                    }}
                  >
                    <Text style={{ fontSize: SIZE.caption, fontFamily: FONT.bold, color: active ? '#fff' : (isDarkMode ? '#E2E8F0' : '#334155') }}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
          {(fromChat && chatPetSource === 'mine' ? myPetsView : filteredData).length > 0 ? (
            <FlatList
              data={fromChat && chatPetSource === 'mine' ? myPetsView : filteredData}
              keyExtractor={itemKey}
              renderItem={renderItem}
              showsVerticalScrollIndicator={false}
              removeClippedSubviews={true}
              numColumns={2}
              columnWrapperStyle={styles.columnWrapper}
              contentContainerStyle={{ paddingBottom: 180 }}
              refreshing={refreshing}
              onRefresh={handleRefresh}
              maxToRenderPerBatch={10}
              windowSize={5}
              initialNumToRender={10}
            />
          ) : (fromChat && chatPetSource === 'mine') ? (
            <View style={{ alignItems: 'center', marginTop: SPACE.huge, paddingHorizontal: SPACE.huge }}>
              <Text style={[styles.description, { textAlign: 'center', color: 'gray' }]}>
                {t('value.no_my_items', 'No items in your My Stuff yet. Add them from the Home tab, or browse all items.')}
              </Text>
              <TouchableOpacity
                onPress={() => setChatPetSource('all')}
                style={{ marginTop: SPACE.xl, paddingVertical: SPACE.md, paddingHorizontal: 18, borderRadius: 10, backgroundColor: config.colors.primary }}
              >
                <Text style={{ color: '#fff', fontFamily: FONT.bold, fontSize: SIZE.caption }}>{t('value.browse_all', 'Browse All Items')}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <Text style={[styles.description, { textAlign: 'center', marginTop: SPACE.xxxl, color: 'gray' }]}>
              {t("value.no_results")}
            </Text>
          )}
        </View>
      </GestureHandlerRootView>
      {!localState.isPro && !fromChat && (
        <View style={{ position: 'absolute', bottom: bannerBottomPos, left: 0, right: 0, alignItems: 'center', zIndex: 5 }}>
          <BannerAdComponent collapsible />
        </View>
      )}
    </>
  );
});
export const getStyles = (isDarkMode) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: isDarkMode ? config.colors.backgroundDark : config.colors.backgroundLight,
    // paddingTop: SPACE.xxl,
  },
  columnWrapper: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: SPACE.xs,
    // marginBottom: SPACE.xs,
  },
  searchFilterContainer: {
    flexDirection: 'row',
    marginVertical: SPACE.md,
    paddingHorizontal: SPACE.md,
    gap: SPACE.xs,
    alignItems: 'center',
  },
  searchInput: {
    height: 40,
    backgroundColor: isDarkMode ? config.colors.surfaceDark : config.colors.surfaceLight,
    borderRadius: 8,
    paddingHorizontal: SPACE.xxxl,
    color: isDarkMode ? config.colors.textDark : config.colors.textLight,
    flex: 1,
    fontSize: SIZE.caption,
    shadowColor: config.colors.shadowDark,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },

  itemContainer: {
    backgroundColor: isDarkMode ? config.colors.surfaceDark : config.colors.surfaceLight,
    borderRadius: 10,
    marginBottom: SPACE.md,
    padding: SPACE.lg,
    width: '49%', // 2 per row with spacing
    alignSelf: 'flex-start',
    shadowColor: config.colors.shadowDark,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  imageContainer: {
    flexDirection: 'row',
    gap: SPACE.md,
    marginBottom: SPACE.md,
  },
  imageWrapper: {
    position: 'relative',
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: isDarkMode ? config.colors.surfaceElevatedDark : config.colors.backgroundLight,
  },
  icon: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
  },
  itemInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  name: {
    fontSize: SIZE.body,
    fontFamily: FONT.bold,
    color: isDarkMode ? config.colors.textDark : config.colors.textLight,
    marginBottom: SPACE.hair,
    letterSpacing: -0.5,
  },
  deprecatedName: {
    fontSize: SIZE.small,
    fontStyle: 'italic',
    color: isDarkMode ? config.colors.textTertiaryDark : config.colors.textTertiaryLight,
    marginBottom: SPACE.hair,
  },
  value: {
    fontSize: SIZE.caption,
    color: isDarkMode ? config.colors.textSecondaryDark : config.colors.textSecondaryLight,
    marginBottom: SPACE.hair,
    fontFamily: FONT.regular,
  },
  rarity: {
    fontSize: SIZE.label,
    color: config.colors.primary,
    fontFamily: FONT.regular,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tierLabel: {
    fontSize: SIZE.label,
    color: config.colors.primary,
    fontFamily: FONT.regular,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  pillsRow: {
    flexDirection: 'row',
    gap: SPACE.xs,
    marginBottom: SPACE.xs,
    flexWrap: 'wrap',
  },
  pill: {
    paddingHorizontal: SPACE.sm,
    paddingVertical: SPACE.hair,
    borderRadius: 8,
  },
  demandPill: {
    backgroundColor: isDarkMode ? 'rgba(106, 90, 205, 0.2)' : 'rgba(106, 90, 205, 0.12)',
  },
  rarityPill: {
    backgroundColor: isDarkMode ? 'rgba(255, 149, 0, 0.2)' : 'rgba(255, 149, 0, 0.12)',
  },
  pillText: {
    fontSize: SIZE.label,
    fontFamily: FONT.regular,
    color: isDarkMode ? config.colors.textSecondaryDark : config.colors.textSecondaryLight,
  },
  stabilityTag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACE.sm,
    paddingVertical: 3,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginBottom: SPACE.xs,
  },
  stabilityDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    marginRight: SPACE.xs,
  },
  stabilityText: {
    fontSize: SIZE.label,
    fontFamily: FONT.bold,
  },
  supplyNote: {
    fontSize: SIZE.label,
    fontFamily: FONT.regular,
    color: config.colors.textSecondaryLight,
    marginTop: 1,
  },
  rangeText: {
    fontSize: SIZE.label,
    color: isDarkMode ? config.colors.textTertiaryDark : config.colors.textTertiaryLight,
    fontFamily: FONT.regular,
  },
  itemBadgesContainer: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    flexDirection: 'row',
    gap: 1,
    padding: 1,
  },
  itemBadge: {
    color: 'white',
    padding: 1,
    borderRadius: 5,
    fontSize: SIZE.label,
    minWidth: 10,
    textAlign: 'center',
    overflow: 'hidden',
    fontFamily: FONT.bold,
  },
  itemBadgeFly: {
    backgroundColor: STATUS.primary,
  },
  itemBadgeRide: {
    backgroundColor: STATUS.danger,
  },
  itemBadgeMega: {
    backgroundColor: '#9b59b6',
  },
  itemBadgeNeon: {
    backgroundColor: STATUS.success,
  },
  badgesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 3,
    backgroundColor: isDarkMode ? config.colors.surfaceElevatedDark : config.colors.dividerLight,
    // padding: SPACE.xxl,
    borderRadius: 16,
    marginTop: SPACE.md,
  },
  badgeButton: {
    paddingVertical: 7,
    paddingHorizontal: 15,
    borderRadius: 15,
    backgroundColor: isDarkMode ? config.colors.surfaceElevatedDark : config.colors.surfaceLight,
    shadowColor: config.colors.shadowDark,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  badgeButtonActive: {
    backgroundColor: config.colors.primary,
  },
  badgeButtonText: {
    fontSize: SIZE.label,
    fontFamily: FONT.regular,
    color: isDarkMode ? config.colors.textDark : config.colors.textSecondaryLight,
    textAlign: 'center',
  },
  badgeButtonTextActive: {
    color: config.colors.white,
  },
  filterText: {
    color: config.colors.white,
    fontSize: SIZE.body,
    fontFamily: FONT.regular,
    marginRight: SPACE.md,

  },
  filterOptionText: {
    fontSize: SIZE.body,
    padding: SPACE.lg,
    color: isDarkMode ? config.colors.textDark : config.colors.textSecondaryLight,
  },
  selectedOption: {
    fontFamily: FONT.bold,
    color: config.colors.primary,
  },
  menuOptions: {
    backgroundColor: isDarkMode ? config.colors.surfaceElevatedDark : config.colors.surfaceLight,
    borderRadius: 16,
    padding: SPACE.md,
    shadowColor: config.colors.shadowDark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  description: {
    fontSize: SIZE.subtitle,
    textAlign: 'center',
    marginTop: SPACE.huge,
    color: isDarkMode ? config.colors.textTertiaryDark : config.colors.textSecondaryLight,
    fontFamily: FONT.regular,
  },
  modalContainer: {
    backgroundColor: isDarkMode ? config.colors.surfaceDark : config.colors.surfaceLight,
    padding: SPACE.xxxl,
    borderRadius: 10,
    width: '80%',
    alignSelf: 'center', // Centers the modal horizontally
    position: 'absolute',
    top: '50%', // Moves modal halfway down the screen
    left: '10%', // Centers horizontally considering width: '80%'
    transform: [{ translateY: -150 }], // Adjusts for perfect vertical centering
    justifyContent: 'center',
    elevation: 5, // Adds a shadow on Android
    shadowColor: config.colors.shadowDark,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  modalTitle: {
    fontSize: SIZE.subtitle,
    fontFamily: FONT.bold,
    marginBottom: SPACE.lg,
    color: isDarkMode ? config.colors.textDark : config.colors.textLight,
  },
  input: {
    borderWidth: 1,
    borderColor: isDarkMode ? config.colors.borderDark : config.colors.borderLight,
    backgroundColor: isDarkMode ? config.colors.surfaceDark : config.colors.surfaceLight,
    color: isDarkMode ? config.colors.textDark : config.colors.textLight,
    padding: SPACE.md,
    marginVertical: 5,
    borderRadius: 5,
  },
  saveButton: {
    backgroundColor: config.colors.success,
    paddingVertical: SPACE.lg,
    borderRadius: 5,
    marginTop: SPACE.lg,
  },
  cencelButton: {
    backgroundColor: config.colors.error,
    paddingVertical: SPACE.lg,
    borderRadius: 5,
    marginTop: SPACE.lg,
  },
  headertext: {
    backgroundColor: config.colors.primary,
    paddingVertical: 1,
    paddingHorizontal: 5,
    borderRadius: 5,
    color: config.colors.white,
    fontSize: SIZE.label,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: "flex-start",
    marginRight: SPACE.lg

  },
  pointsBox: {
    width: '49%', // Ensures even spacing
    backgroundColor: isDarkMode ? config.colors.surfaceElevatedDark : config.colors.surfaceLight,
    borderRadius: 8,
    padding: SPACE.lg,
  },
  rowcenter: {
    flexDirection: 'row',
    alignItems: 'center',
    fontSize: SIZE.caption,
    marginTop: 5,

  },
  menuContainer: {
    alignSelf: "center",
  },
  filterButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: config.colors.primary,
    paddingVertical: SPACE.lg,
    paddingHorizontal: SPACE.lg,
    borderRadius: 8,
    // paddingHorizontal: SPACE.lg,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  filterText: {
    color: "white",
    fontSize: SIZE.body,
    fontFamily: FONT.bold,
    marginRight: 5,
  },
  // filterOptionText: {
  //   fontSize: SIZE.body,
  //   padding: SPACE.lg,
  //   color: "#333",
  // },
  // A second `selectedOption` used to sit here, left behind among the commented
  // MM2 leftovers above. Being later in the same object it silently overrode the
  // real one, painting the selected filter green instead of the app's primary.
  badgesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACE.md,
    marginTop: SPACE.md,
  },
  badge: {
    color: 'white',
    paddingHorizontal: SPACE.md,
    paddingVertical: SPACE.hair,
    borderRadius: 12,
    fontSize: SIZE.caption,
    fontFamily: FONT.bold,
    overflow: 'hidden',
    marginRight: SPACE.xs,
  },
  badgeFly: {
    backgroundColor: STATUS.primary,
  },
  badgeRide: {
    backgroundColor: STATUS.danger,
  },
  badgeMega: {
    backgroundColor: '#9b59b6',
  },
  badgeNeon: {
    backgroundColor: STATUS.success,
  },
  badgeContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingVertical: SPACE.xl,
    borderTopWidth: 1,
    borderTopColor: isDarkMode ? config.colors.dividerDark : config.colors.dividerLight,
    marginTop: SPACE.md,
  },
  badgeButton: {
    // marginHorizontal: 1,
    paddingVertical: 5,
    paddingHorizontal: SPACE.md,
    borderRadius: 12,
    backgroundColor: isDarkMode ? config.colors.surfaceElevatedDark : config.colors.dividerLight,
  },
  badgeButtonActive: {
    backgroundColor: config.colors.primary,
  },
  badgeButtonText: {
    fontSize: SIZE.label,
    fontFamily: FONT.regular,
    color: isDarkMode ? config.colors.textDark : config.colors.textSecondaryLight,
  },
  badgeButtonTextActive: {
    color: config.colors.white,
  },
  itemInfo: {
    flex: 1,
  },
  imageWrapper: {
    position: 'relative',
    width: 60,
    height: 60,
  },
  icon: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
  },
  itemBadgesContainer: {
    position: 'absolute',
    bottom: -10,
    left: 2,
    flexDirection: 'row',
    gap: SPACE.hair,
  },
  itemBadge: {
    color: 'white',
    backgroundColor: '#FF6666',
    padding: SPACE.hair,
    borderRadius: 6,
    fontSize: SIZE.label,
    minWidth: 12,
    textAlign: 'center',
    overflow: 'hidden',
    fontFamily: FONT.bold,
  },
  itemBadgeFly: {
    backgroundColor: STATUS.primary,
  },
  itemBadgeRide: {
    backgroundColor: STATUS.danger,
  },
  itemBadgeMega: {
    backgroundColor: '#9b59b6',
  },
  itemBadgeNeon: {
    backgroundColor: STATUS.success,
  },
  categoryBar: {
    marginBottom: SPACE.md,
    paddingVertical: SPACE.xs,
    backgroundColor: isDarkMode ? config.colors.backgroundDark : config.colors.backgroundLight,
  },
  categoryBarContent: {
    paddingHorizontal: SPACE.md,
    alignItems: 'center',
  },
  categoryButton: {
    paddingVertical: SPACE.md,
    paddingHorizontal: SPACE.xxl,
    borderRadius: 16,
    backgroundColor: isDarkMode ? config.colors.surfaceElevatedDark : config.colors.dividerLight,
    marginRight: SPACE.md,
  },
  categoryButtonActive: {
    backgroundColor: config.colors.primary,
  },
  categoryButtonText: {
    fontSize: SIZE.caption,
    color: isDarkMode ? config.colors.textSecondaryDark : config.colors.textSecondaryLight,
    fontFamily: FONT.bold,
  },
  categoryButtonTextActive: {
    color: config.colors.white,
  },
  adContainer: {
    backgroundColor: isDarkMode ? config.colors.surfaceDark : config.colors.surfaceLight,
    padding: 15,
    borderRadius: 10,
    marginBottom: 15,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: isDarkMode ? config.colors.borderDark : config.colors.borderLight,
    marginHorizontal: SPACE.lg

  },
  adContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start', // Aligns text and image in a row
  },
  adIcon: {
    width: 50,
    height: 50,
    borderRadius: 5,
    marginRight: 15,
  },
  adTitle: {
    fontSize: SIZE.subtitle,
    fontFamily: FONT.bold,
    color: isDarkMode ? config.colors.textSecondaryDark : config.colors.textSecondaryLight,
    // marginBottom: 5, // Adds space below the title
  },
  tryNowText: {
    fontSize: SIZE.body,
    fontFamily: FONT.regular,
    color: config.colors.primary, // Adds a distinct color for the "Try Now" text
    // marginTop: 5, // Adds space between the title and the "Try Now" text
  },
  downloadButton: {
    backgroundColor: config.colors.success,
    paddingVertical: SPACE.md,
    paddingHorizontal: 15,
    borderRadius: 5,
    marginTop: SPACE.lg, // Adds spacing between the text and the button
  },
  downloadButtonText: {
    color: config.colors.white,
    fontSize: SIZE.body,
    fontFamily: FONT.bold,
  },
  selectedPetsSection: {
    paddingHorizontal: SPACE.md,
    paddingTop: SPACE.xs,
    paddingBottom: SPACE.hair,
  },
  selectedPetsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACE.xs,
  },
  selectedPetsTitle: {
    fontSize: SIZE.caption,
    fontFamily: FONT.bold,
    color: isDarkMode ? config.colors.textDark : config.colors.textLight,
  },
  selectedPetsCount: {
    fontSize: SIZE.small,
    fontFamily: FONT.regular,
    color: isDarkMode ? config.colors.textTertiaryDark : config.colors.textTertiaryLight,
  },
  selectedPetsList: {
    paddingVertical: SPACE.xs,
  },
  selectedPetCard: {
    width: 40,
    marginRight: SPACE.md,
    borderRadius: 10,
    padding: SPACE.sm,
    backgroundColor: isDarkMode ? config.colors.surfaceDark : config.colors.surfaceLight,
    shadowColor: config.colors.shadowDark,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  selectedPetImage: {
    width: '100%',
    height: 15,
    borderRadius: 8,
    marginBottom: 1,
    backgroundColor: isDarkMode ? config.colors.backgroundDark : config.colors.backgroundLight,
  },
  selectedPetName: {
    fontSize: SIZE.label,
    fontFamily: FONT.regular,
    color: isDarkMode ? config.colors.textSecondaryDark : config.colors.textLight,
  },
  removePetButton: {
    position: 'absolute',
    top: 1,
    right: 1,
    width: 10,
    height: 10,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: config.colors.overlayDark,
  },

});

export default ValueScreen;
