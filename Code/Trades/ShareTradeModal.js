import CatalogueImage from '../Components/CatalogueImage';
import React, { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet, Image, Platform, ScrollView } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import ViewShot from 'react-native-view-shot';
import Share from 'react-native-share';
import { useGlobalState } from '../GlobelStats';
import { useLocalState } from '../LocalGlobelStats';
import config from '../Helper/Environment';
import { showErrorMessage } from '../Helper/MessageHelper';
import InterstitialAdManager from '../Ads/IntAd';
import AppOpenAdManager from '../Ads/openApp';
import { resolveItemImage, createTradeSnapshot, formatMarketValue, sourceLabel, catchDescription } from '../Helper/valueSources';
import { verdictLabel } from '../Helper/feedContract';
import { getThemeColors } from '../Helper/themeColors';
import { SIZE } from '../Design/tokens';
import { SPACE } from '../Design/tokens';
import { FONT } from '../Design/tokens';

const formatValue = formatMarketValue;

const ShareTradeModal = ({ visible, onClose, hasItems, wantsItems, hasTotal, wantsTotal, description, valueSource = 'value' }) => {
    const viewRef = useRef();
    const { theme } = useGlobalState();
    const { localState } = useLocalState();
    const isDarkMode = theme === 'dark';

    const [showSummary, setShowSummary] = useState(true);
    const [showProfitLoss, setShowProfitLoss] = useState(true);
    const [showLeftGrid, setShowLeftGrid] = useState(true);
    const [showRightGrid, setShowRightGrid] = useState(true);
    const [showBadges, setShowBadges] = useState(true);
    // const [showNotes, setShowNotes] = useState(true);

    const valuation = useMemo(() => createTradeSnapshot(hasItems, wantsItems, valueSource), [hasItems, wantsItems, valueSource]);
    const hasTotalValue = valuation.has.total;
    const wantsTotalValue = valuation.wants.total;
    const styles = useMemo(() => getStyles(isDarkMode), [isDarkMode]);
    const tradeStatus = valuation.evaluation.verdict;
    const profitLoss = wantsTotalValue - hasTotalValue;
    const isProfit = profitLoss >= 0;
    // See Code/Helper/valueSources.js. It checks Image before image, so the
    // extractMM2Values fallback this used to do last is covered first.
    const getImageUrl = resolveItemImage;
    
    
    const progressBarStyle = useMemo(() => {
        if (!hasTotalValue && !wantsTotalValue) return { left: '50%', right: '50%' };
        const total = hasTotalValue + wantsTotalValue;
        const hasPercentage = (hasTotalValue / total) * 100;
        const wantsPercentage = (wantsTotalValue / total) * 100;
        return {
            left: `${hasPercentage}%`,
            right: `${wantsPercentage}%`
        };
    }, [hasTotalValue, wantsTotalValue]);

    useEffect(() => {
        if ((!showLeftGrid && showRightGrid) || (showLeftGrid && !showRightGrid)) {
            setShowSummary(false);
        }
    }, [showLeftGrid, showRightGrid]);

    const handleShare = async () => {
        try {
            if (!viewRef.current) return;
            const uri = await viewRef.current.capture();
            const callbackfunction = async ()=>{
                // The Android share chooser backgrounds the app; coming back
                // from it is not a real return, so no App Open ad.
                AppOpenAdManager.skipNextForeground();
                await Share.open({
                    url: uri,
                    type: 'image/png',
                    failOnCancel: false,
                });
            }
           if(Platform.OS !== 'ios'){ setTimeout(() => {
                if (!localState.isPro) {
                  requestAnimationFrame(() => {
                    setTimeout(() => {
                      try {
                        InterstitialAdManager.showAd(callbackfunction);
                      } catch (err) {
                        console.warn('[AdManager] Failed to show ad:', err);
                        callbackfunction();
                      }
                    }, 100); 
                  });
                } else {
                  callbackfunction();
                }
              }, 10); }
          
            if(Platform.OS === 'ios'){
                 AppOpenAdManager.skipNextForeground();
                 await Share.open({
                    url: uri,
                    type: 'image/png',
                    failOnCancel: false,
                });
            }
            onClose();
         
        } catch (error) {
            console.error('Error sharing trade screenshot:', error);
            showErrorMessage('Error', 'Could not share the trade screenshot.');
        }
    };

    const renderToggleButton = (icon, label, state, setState, disabled = false) => (
        <TouchableOpacity
            style={[
                styles.toggleButton,
                state && styles.toggleButtonActive,
                disabled && styles.toggleButtonDisabled
            ]}
            onPress={() => !disabled && setState(!state)}
            disabled={disabled}
        >
            <Icon name={icon} size={16} color={state ? '#fff' : '#666'} />
            <Text style={[styles.toggleButtonText, state && styles.toggleButtonTextActive]}>
                {label}
            </Text>
        </TouchableOpacity>
    );

    // ✅ MM2: Removed renderBadge - MM2 doesn't use badges

    const renderGridItem = useCallback((item, index, totalItems) => {
        if (!item) {
            const isLastFilledIndex = index === totalItems.filter(Boolean).length;
            return (
                <View style={styles.gridItem}>
                    {isLastFilledIndex && (
                        <Icon 
                            name="add-circle" 
                            size={30} 
                            color={isDarkMode ? "#fdf7e5" : '#fdf7e5'} 
                        />
                    )}
                </View>
            );
        }
        
        return (
            <View style={styles.gridItem}>
                <CatalogueImage item={item}
                    source={{ uri: getImageUrl(item) }}
                    style={styles.gridItemImage}
                    onError={(e) => {
                        // Handle image load errors gracefully
                        console.warn('Image load error in ShareTradeModal:', item);
                    }}
                />
                {/* ✅ Display item name and deprecated names like main grid */}
                <View style={styles.itemNameContainer}>
                    <Text style={styles.itemName} numberOfLines={1}>
                        {(item.name || item.Name)?.length > 8 
                            ? (item.name || item.Name).slice(0, 7) + '...' 
                            : (item.name || item.Name)}
                    </Text>
                    {/* ✅ Display deprecated names if available */}
                    {item.deprecatedNames && Array.isArray(item.deprecatedNames) && item.deprecatedNames.length > 0 && (
                        <Text style={styles.deprecatedName} numberOfLines={1}>
                            {item.deprecatedNames[0]?.length > 8 
                                ? item.deprecatedNames[0].slice(0, 7) + '...' 
                                : item.deprecatedNames[0]}
                        </Text>
                    )}
                    {/* ✅ Also check for deprecatedName (singular) or deprecated_name */}
                    {!item.deprecatedNames && (item.deprecatedName || item.deprecated_name) && (
                        <Text style={styles.deprecatedName} numberOfLines={1}>
                            {(item.deprecatedName || item.deprecated_name)?.length > 8 
                                ? (item.deprecatedName || item.deprecated_name).slice(0, 7) + '...' 
                                : (item.deprecatedName || item.deprecated_name)}
                        </Text>
                    )}
                </View>
            </View>
        );
    }, [isDarkMode]);

    const ensureGridItems = useCallback((items) => {
        const result = [...(items || [])];
        while (result.length < 9) {
            result.push(null);
        }
        return result;
    }, []);

    const renderGrid = useCallback((items, isLeft) => {
        if (!(isLeft ? showLeftGrid : showRightGrid)) return null;
        return (
            <View style={styles.itemsContainer}>
                <View style={styles.gridContainer}>
                    {ensureGridItems(items).map((item, index) => (
                        <View key={index} style={[
                            styles.gridItemWrapper,
                            (index + 1) % 3 === 0 && { borderRightWidth: 0 },
                            index >= 6 && { borderBottomWidth: 0 }
                        ]}>
                            {renderGridItem(item, index, items)}
                        </View>
                    ))}
                </View>
            </View>
        );
    }, [showLeftGrid, showRightGrid, ensureGridItems, renderGridItem]);

    return (
        <Modal
            visible={visible}
            transparent={true}
            animationType="slide"
            onRequestClose={onClose}
        >
            {/* <ScrollView> */}
            <View style={styles.modalContainer}>
                <View style={styles.modalContent}>
                    <View style={styles.header}>
                        {/* <Text style={styles.title}>Share Trade</Text> */}
                        <TouchableOpacity onPress={onClose}>
                            {/* <Icon name="close" size={24} color={isDarkMode ? '#f2f2f7' : '#121212'} /> */}
                        </TouchableOpacity>
                    </View>

                    <ViewShot ref={viewRef} options={{ format: 'png', quality: 0.8 }} style={{ backgroundColor: isDarkMode ? config.colors.backgroundDark : '#f2f2f7' , padding: SPACE.md,}}>
                        <Text style={styles.offerLabel}>{sourceLabel(valueSource)} · {verdictLabel(valuation.evaluation)}</Text>
                        {valuation.evaluation.status === 'incomplete' && <Text style={styles.offerLabel}>Priced subtotals only. Unpriced or stale quotes are present.</Text>}
                        {[['You give', hasItems], ['You receive', wantsItems]].map(([label, items]) => items.filter(i => i?.catch || i?.quantity > 1).map((item, index) =>
                          <Text key={label + index} style={styles.offerLabel}>{label}: {item.name} · {catchDescription(item)}</Text>
                        ))}
                        {showSummary && showLeftGrid && showRightGrid && (
                            <View style={styles.summaryContainer}>
                                <View style={styles.summaryInner}>
                                    <View style={styles.topSection}>
                                        <Text style={styles.bigNumber}>{sourceLabel(valueSource)} {formatValue(hasTotalValue)}</Text>
                                        <View style={styles.statusContainer}>
                                            <Text style={[
                                                styles.statusText,
                                                tradeStatus === 'win' ? styles.statusActive : styles.statusInactive
                                            ]}>WIN</Text>
                                            <Text style={[
                                                styles.statusText,
                                                tradeStatus === 'fair' ? styles.statusActive : styles.statusInactive
                                            ]}>FAIR</Text>
                                            <Text style={[
                                                styles.statusText,
                                                tradeStatus === 'lose' ? styles.statusActive : styles.statusInactive
                                            ]}>LOSE</Text>
                                        </View>
                                        <Text style={styles.bigNumber}>{sourceLabel(valueSource)} {formatValue(wantsTotalValue)}</Text>
                                    </View>
                                    <View style={styles.progressContainer}>
                                        <View style={styles.progressBar}>
                                            <View style={[styles.progressLeft, { width: progressBarStyle.left }]} />
                                            <View style={[styles.progressRight, { width: progressBarStyle.right }]} />
                                        </View>
                                    </View>
                                    <View style={styles.labelContainer}>
                                        <Text style={styles.offerLabel}>YOUR OFFER</Text>
                                        <Text style={styles.dividerText}>|</Text>
                                        <Text style={styles.offerLabel}>THEIR OFFER</Text>
                                    </View>
                                </View>
                            </View>
                        )}

                        {showProfitLoss && tradeStatus && showLeftGrid && showRightGrid && (
                            <View style={styles.profitLossBox}>
                                <Text style={[
                                    styles.profitLossNumber,
                                    { color: isProfit ? config.colors.hasBlockGreen : config.colors.wantBlockRed }
                                ]}>
                                    {sourceLabel(valueSource)} {formatValue(Math.abs(profitLoss))}
                                </Text>
                            </View>
                        )}

                        <View style={styles.tradeContainer}>
                            {renderGrid(hasItems, true)}
                            {showLeftGrid && showRightGrid && (
                                <View style={styles.transferIcon} />
                            )}
                            {renderGrid(wantsItems, false)}
                        </View>

                        {/* {showNotes && description && (
                            <Text style={styles.description}>Note: {description}</Text>
                        )} */}
                    </ViewShot>

                    <View style={styles.toggleContainer}>
                        {renderToggleButton('stats-chart', 'Summary', showSummary, setShowSummary, (!showLeftGrid && showRightGrid) || (showLeftGrid && !showRightGrid))}
                        {renderToggleButton('trending-up', 'Profit/Loss', showProfitLoss, setShowProfitLoss)}
                        {/* {renderToggleButton('grid', 'Left Grid', showLeftGrid, setShowLeftGrid)} */}
                        {/* {renderToggleButton('grid', 'Right Grid', showRightGrid, setShowRightGrid)} */}
                        {/* {renderToggleButton('ribbon', 'Badges', showBadges, setShowBadges)} */}
                        {/* {renderToggleButton('document-text', 'Notes', showNotes, setShowNotes)} */}
                    </View>

                    <View style={styles.buttonContainer}>
                        <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
                            <Text style={styles.buttonText}>Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.shareButton} onPress={handleShare}>
                            <Text style={styles.buttonText}>Share</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
            {/* </ScrollView> */}
        </Modal>
    );
};

const getStyles = (isDarkMode, c = getThemeColors(isDarkMode)) => StyleSheet.create({
    modalContainer: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        justifyContent: 'center',
        alignItems: 'center',
       
        
    },
    modalContent: {
        backgroundColor: isDarkMode ? config.colors.backgroundDark : '#f2f2f7',
        borderRadius: 12,
        width: '98%',
        // maxHeight: '90%',
        // padding: SPACE.md,
        // alignItems:'center',
        // flex:1
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: SPACE.xxl,
    },
    title: {
        fontSize: SIZE.heading,
        fontFamily: FONT.bold,
        color: c.text,
         padding: SPACE.md,
    },
    summaryContainer: {
        width: '100%',
        marginBottom: SPACE.md,
    },
    summaryInner: {
        backgroundColor: isDarkMode ? config.colors.surfaceElevatedDark : 'rgba(255, 255, 255, 0.9)',
        borderRadius: 12,
        padding: SPACE.xl,
        shadowColor: 'rgba(255, 255, 255, 0.9)',
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 2,
    },
    topSection: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: SPACE.md,
    },
    bigNumber: {
        fontSize: SIZE.title,
        fontFamily: FONT.bold,
        color: isDarkMode ? 'white' : '#333',
        textAlign: 'center',
        minWidth: 100,
    },
    statusContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.05)',
        borderRadius: 16,
        padding: SPACE.xs,
        minWidth: 120,
    },
    statusText: {
        fontSize: SIZE.caption,
        fontFamily: FONT.regular,
        paddingHorizontal: SPACE.md,
    },
    statusActive: {
        color: isDarkMode ? 'white' : '#333',
    },
    statusInactive: {
        color: c.textSecondary,
    },
    progressContainer: {
        marginVertical: SPACE.xs,
    },
    progressBar: {
        height: 4,
        flexDirection: 'row',
        borderRadius: 2,
        overflow: 'hidden',
        backgroundColor: c.bgAlt,
    },
    progressLeft: {
        height: '100%',
        backgroundColor: config.colors.hasBlockGreen,
        transition: 'width 0.3s ease',
    },
    progressRight: {
        height: '100%',
        backgroundColor: '#f3d0c7',
        transition: 'width 0.3s ease',
    },
    labelContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: SPACE.xs,
    },
    offerLabel: {
        fontSize: SIZE.label,
        color: c.textSecondary,
        fontFamily: FONT.regular,
        paddingHorizontal: SPACE.md,
    },
    dividerText: {
        fontSize: SIZE.caption,
        color: c.textMuted,
        paddingHorizontal: SPACE.xs,
    },
    profitLossBox: {
        justifyContent: 'center',
        alignItems: 'center',
        flexDirection: 'row',
        marginBottom: SPACE.md,
    },
    profitLossNumber: {
        fontSize: SIZE.display,
        fontFamily: FONT.bold,
        textAlign: 'center',
    },
    tradeContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: SPACE.xxl,
    },
    itemsContainer: {
        flex: 1,
        width: '48%',
    },
    gridContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        backgroundColor: isDarkMode ? config.colors.surfaceElevatedDark : '#f3d0c7',
        borderRadius: 4,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgb(255, 102, 102)',
    },
    gridItemWrapper: {
        width: '33.33%',
        aspectRatio: 1,
        borderRightWidth: 1,
        borderBottomWidth: 1,
        borderColor: 'rgb(255, 102, 102)',
        position: 'relative',
    },
    gridItem: {
        flex: 1,
        backgroundColor: isDarkMode ? config.colors.surfaceElevatedDark : '#f3d0c7',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '10%',
    },
    gridItemImage: {
        width: '100%',
        height: '70%',
        resizeMode: 'contain',
        borderRadius: 5,
    },
    itemNameContainer: {
        alignItems: 'center',
        marginTop: SPACE.hair,
        width: '100%',
        paddingHorizontal: SPACE.hair,
    },
    itemName: {
        fontSize: SIZE.label,
        fontFamily: FONT.regular,
        color: c.text,
        textAlign: 'center',
    },
    deprecatedName: {
        fontSize: SIZE.label,
        fontFamily: FONT.regular,
        color: c.textSecondary,
        textAlign: 'center',
        fontStyle: 'italic',
        marginTop: 1,
    },
    transferIcon: {
        width: 5,
        alignItems: 'center',
    },
    description: {
        fontSize: SIZE.body,
        color: c.text,
        marginTop: SPACE.md,
        padding: SPACE.md,
        backgroundColor: isDarkMode ? config.colors.surfaceElevatedDark : '#f5f5f5',
        borderRadius: 8,
    },
    toggleContainer: {
        marginVertical: SPACE.md,
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'center',
        gap: SPACE.md,
        backgroundColor: isDarkMode ? config.colors.surfaceElevatedDark : '#f0f0f0',
        borderRadius: 12,
        padding: SPACE.md,

    },
    toggleButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: isDarkMode ? config.colors.surfaceElevatedDark : '#fff',
        paddingVertical: SPACE.xs,
        paddingHorizontal: SPACE.xl,
        borderRadius: 20,
        gap: SPACE.xs,
    },
    toggleButtonActive: {
        backgroundColor: config.colors.hasBlockGreen,
    },
    toggleButtonDisabled: {
        backgroundColor: isDarkMode ? config.colors.surfaceElevatedDark : '#f0f0f0',
    },
    toggleButtonText: {
        fontSize: SIZE.label,
        color: c.textSecondary,
        fontFamily: FONT.regular,
    },
    toggleButtonTextActive: {
        color: 'white',
        fontFamily: FONT.regular,
    },
    buttonContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: SPACE.xxl,
         padding: SPACE.md,
    },
    cancelButton: {
        backgroundColor: config.colors.wantBlockRed,
        borderRadius: 8,
        padding: SPACE.lg,
        width: '48%',
        alignItems: 'center',
    },
    shareButton: {
        backgroundColor: config.colors.hasBlockGreen,
        borderRadius: 8,
        padding: SPACE.lg,
        width: '48%',
        alignItems: 'center',
    },
    buttonText: {
        color: 'white',
        fontSize: SIZE.body,
        fontFamily: FONT.bold,
    },
    itemBadgesContainer: {
        position: 'absolute',
        bottom: '1%',
        right: '5%',
        flexDirection: 'row',
        gap: 0,
    },
    badge: {
        paddingHorizontal: SPACE.xs,
        paddingVertical: 1,
        borderRadius: '50%',
        marginHorizontal: 1,
    },
    badgeText: {
        color: 'white',
        fontSize: SIZE.label,
        fontFamily: FONT.bold,
        lineHeight: 10,
    },
});

export default ShareTradeModal; 