import React, { useMemo, useState } from 'react';
import { getThemeColors } from '../../Helper/themeColors';
import {
    View,
    Text,
    Image,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    ActivityIndicator,
    LayoutAnimation,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import config from '../../Helper/Environment';
import { SIZE } from '../../Design/tokens';
import { SPACE } from '../../Design/tokens';
import { FONT } from '../../Design/tokens';


// ── Value Formatter ────────────────────────────────────
const formatValue = (value) => {
    if (!value || typeof value !== 'number') return '0';
    if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
    if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
    return value.toLocaleString();
};

// ── Category Colors (MM2 context) ──────────────────────
const CATEGORY_COLORS = {
    knives: '#FF6B6B', guns: '#339AF0', pets: '#51CF66',
    godlies: '#845EF7', ancients: '#FFA94D', vintages: '#20C997',
    classics: '#F06595', misc: '#868E96', other: '#868E96',
};
const getCategoryColor = (cat) =>
    cat ? CATEGORY_COLORS[cat.toLowerCase()] || '#868E96' : '#868E96';

// ════════════════════════════════════════════════════════
// ── CompactPortfolio ───────────────────────────────────
// Collapsed: summary row + mini category bar
// Expanded:  full item lists (owned + wishlist) + valuation
// ════════════════════════════════════════════════════════
const CompactPortfolio = ({
    ownedPets: ownedItems = [],
    wishlistPets: wishlistItems = [],
    isDarkMode,
    t,
    loadingPets: loadingItems,
    renderPetBubble: renderItemBubble,
    lookupPetValue: lookupItemValue,
}) => {
    const [expanded, setExpanded] = useState(false);
    const styles = useMemo(() => getStyles(isDarkMode), [isDarkMode]);

    const portfolio = useMemo(() => {
        if (!ownedItems || ownedItems.length === 0) return null;

        const getVal = (p) => lookupItemValue ? lookupItemValue(p) : (Number(p.value) || 0);
        const totalValue = ownedItems.reduce((s, p) => s + getVal(p), 0);
        const totalItems = ownedItems.length;
        const avgValue = totalItems > 0 ? totalValue / totalItems : 0;

        const catMap = {};
        ownedItems.forEach((p) => {
            const c = (p.category || p.type || 'Other').toLowerCase();
            if (!catMap[c]) catMap[c] = { value: 0, count: 0 };
            catMap[c].value += getVal(p);
            catMap[c].count += 1;
        });

        const categories = Object.entries(catMap)
            .map(([name, d]) => ({
                name, value: d.value, count: d.count,
                pct: totalValue > 0 ? (d.value / totalValue) * 100 : 0,
                color: getCategoryColor(name),
            }))
            .sort((a, b) => b.value - a.value);

        const wishVal = (wishlistItems || []).reduce(
            (s, p) => s + (lookupItemValue ? lookupItemValue(p) : (Number(p.value) || 0)), 0,
        );

        return { totalValue, totalItems, avgValue, categories, wishVal };
    }, [ownedItems, wishlistItems]);

    const toggleExpand = () => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setExpanded((prev) => !prev);
    };

    // ── Loading state ──────────────────────────────────
    if (loadingItems) {
        return (
            <View style={styles.wrap}>
                <ActivityIndicator size="small" color={config.colors.primary} />
            </View>
        );
    }

    // ── Empty state (no owned items) ────────────────────
    if (!portfolio) {
        return (
            <View style={styles.wrap}>
                {/* Header row */}
                <View style={styles.summaryLeft}>
                    <View style={{
                        width: 24, height: 24, borderRadius: 8,
                        backgroundColor: isDarkMode ? 'rgba(236,72,153,0.15)' : 'rgba(236,72,153,0.1)',
                        alignItems: 'center', justifyContent: 'center',
                    }}>
                        <Icon name="diamond" size={12} color="#ec4899" />
                    </View>
                    <Text style={styles.summaryTitle}>Portfolio</Text>
                </View>
                {/* Empty message */}
                <View style={styles.emptyBox}>
                    <Text style={styles.emptyIcon}>📦</Text>
                    <Text style={styles.emptyTitle}>No items listed yet</Text>
                    <Text style={styles.emptyHint}>
                        This trader hasn't added any items to their inventory. Items added in{' '}
                        <Text style={{ fontFamily: FONT.bold, color: '#ec4899' }}>My Stuff</Text>{' '}
                        will appear here.
                    </Text>
                </View>
            </View>
        );
    }

    return (
        <View style={styles.wrap}>
            {/* ═══════ COLLAPSED SUMMARY ═══════ */}
            <TouchableOpacity
                activeOpacity={0.7}
                onPress={toggleExpand}
                style={styles.summaryRow}
            >
                <View style={styles.summaryLeft}>
                    <View style={{
                        width: 24, height: 24, borderRadius: 8,
                        backgroundColor: isDarkMode ? 'rgba(236,72,153,0.15)' : 'rgba(236,72,153,0.1)',
                        alignItems: 'center', justifyContent: 'center',
                    }}>
                        <Icon name="diamond" size={12} color="#ec4899" />
                    </View>
                    <Text style={styles.summaryTitle}>
                        Portfolio
                    </Text>
                </View>
                <View style={styles.summaryRight}>
                    <Text style={styles.summaryValue}>
                        {formatValue(portfolio.totalValue)}
                    </Text>
                    <View style={styles.badge}>
                        <Text style={styles.badgeText}>
                            {portfolio.totalItems} items
                        </Text>
                    </View>
                    <Icon
                        name={expanded ? 'chevron-up' : 'chevron-down'}
                        size={14}
                        color={isDarkMode ? '#64748b' : '#9ca3af'}
                    />
                </View>
            </TouchableOpacity>

            {/* Mini category bar (always visible) */}
            {portfolio.categories.length > 0 && (
                <View style={styles.miniBar}>
                    {portfolio.categories.map((c, i) => (
                        <View
                            key={c.name}
                            style={{
                                flex: c.pct,
                                height: '100%',
                                backgroundColor: c.color,
                                borderTopLeftRadius: i === 0 ? 3 : 0,
                                borderBottomLeftRadius: i === 0 ? 3 : 0,
                                borderTopRightRadius: i === portfolio.categories.length - 1 ? 3 : 0,
                                borderBottomRightRadius: i === portfolio.categories.length - 1 ? 3 : 0,
                            }}
                        />
                    ))}
                </View>
            )}

            {/* ═══════ EXPANDED DETAILS ═══════ */}
            {expanded && (
                <View style={styles.expandedArea}>

                    {/* ── Owned Items (full list) ── */}
                    <View style={styles.petSection}>
                        <Text style={styles.petSectionLabel}>
                            Owned Items
                        </Text>
                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={{ paddingRight: SPACE.sm }}
                        >
                            <View style={{ flexDirection: 'row' }}>
                                {ownedItems.map((item, index) =>
                                    renderItemBubble(item, index),
                                )}
                            </View>
                        </ScrollView>
                    </View>

                    {/* ── Wishlist (full list) ── */}
                    <View style={styles.petSection}>
                        <Text style={styles.petSectionLabel}>
                            Wishlist
                        </Text>
                        {wishlistItems.length === 0 ? (
                            <Text style={styles.petEmpty}>
                                No wishlist items yet.
                            </Text>
                        ) : (
                            <ScrollView
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                contentContainerStyle={{ paddingRight: SPACE.sm }}
                            >
                                <View style={{ flexDirection: 'row' }}>
                                    {wishlistItems.map((item, index) =>
                                        renderItemBubble(item, index),
                                    )}
                                </View>
                            </ScrollView>
                        )}
                    </View>

                    {/* ── Valuation card ── */}
                    <View style={styles.valCard}>
                        <View>
                            <Text style={styles.valLabel}>
                                Total Value
                            </Text>
                            <Text style={styles.valNum}>
                                {formatValue(portfolio.totalValue)}
                            </Text>
                        </View>
                    </View>

                    {/* ── Category legends ── */}
                    {portfolio.categories.length > 0 && (
                        <View style={styles.catLegend}>
                            {portfolio.categories.map((c) => (
                                <View key={c.name} style={styles.legendItem}>
                                    <View style={[styles.legendDot, { backgroundColor: c.color }]} />
                                    <Text style={styles.legendLabel}>
                                        {c.name.charAt(0).toUpperCase() + c.name.slice(1)}
                                    </Text>
                                    <Text style={styles.legendPct}>
                                        {formatValue(c.value)} ({Math.round(c.pct)}%)
                                    </Text>
                                </View>
                            ))}
                        </View>
                    )}

                    {/* ── Wishlist comparison ── */}
                    {wishlistItems && wishlistItems.length > 0 && (
                        <View style={styles.wishRow}>
                            <View style={styles.wishItem}>
                                <Icon name="heart-outline" size={12} color="#FF6B6B" />
                                <Text style={styles.wishLabel}>Wishlist Value</Text>
                                <Text style={styles.wishVal}>{formatValue(portfolio.wishVal)}</Text>
                            </View>
                            <View style={styles.wishDivider} />
                            <View style={styles.wishItem}>
                                <Icon name="trending-up-outline" size={12} color="#51CF66" />
                                <Text style={styles.wishLabel}>Gap</Text>
                                <Text style={[styles.wishVal, {
                                    color: portfolio.wishVal > portfolio.totalValue ? '#FF6B6B' : '#51CF66',
                                }]}>
                                    {portfolio.wishVal > portfolio.totalValue
                                        ? `-${formatValue(portfolio.wishVal - portfolio.totalValue)}`
                                        : '✓'}
                                </Text>
                            </View>
                        </View>
                    )}
                </View>
            )}
        </View>
    );
};

// ── Styles ─────────────────────────────────────────────
const getStyles = (dark) =>
    StyleSheet.create({
        wrap: {
            backgroundColor: dark ? config.colors.surfaceDark : '#f8fafc',
            borderRadius: 14,
            padding: SPACE.xl,
            marginBottom: SPACE.md,
        },

        /* empty */
        emptyRow: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: SPACE.sm,
            paddingVertical: SPACE.xs,
        },
        emptyText: {
            fontSize: SIZE.small,
            color: dark ? '#9ca3af' : '#6b7280',
        },
        emptyBox: {
            alignItems: 'center',
            paddingVertical: 14,
            paddingHorizontal: SPACE.md,
            gap: SPACE.xs,
        },
        emptyIcon: {
            fontSize: SIZE.title,
            marginBottom: SPACE.xs,
        },
        emptyTitle: {
            fontSize: SIZE.caption,
            fontFamily: FONT.bold,
            color: dark ? '#e2e8f0' : config.colors.surfaceDark,
        },
        emptyHint: {
            fontSize: SIZE.small,
            color: dark ? '#94a3b8' : '#64748b',
            textAlign: 'center',
            lineHeight: 16,
            marginTop: SPACE.hair,
        },

        /* summary row */
        summaryRow: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
        },
        summaryLeft: { flexDirection: 'row', alignItems: 'center', gap: 5 },
        summaryTitle: {
            fontSize: SIZE.caption,
            fontFamily: FONT.bold,
            color: dark ? '#e5e7eb' : '#111827',
        },
        summaryRight: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm },
        summaryValue: {
            fontSize: SIZE.body,
            fontFamily: FONT.bold,
            color: config.colors.primary,
        },
        badge: {
            backgroundColor: dark ? config.colors.backgroundDark : '#e5e7eb',
            paddingHorizontal: SPACE.sm,
            paddingVertical: SPACE.hair,
            borderRadius: 6,
        },
        badgeText: {
            fontSize: SIZE.label,
            fontFamily: FONT.bold,
            color: dark ? '#94a3b8' : '#6b7280',
        },

        /* mini bar */
        miniBar: {
            flexDirection: 'row',
            height: 4,
            borderRadius: 3,
            overflow: 'hidden',
            marginTop: SPACE.md,
        },

        /* expanded */
        expandedArea: { marginTop: SPACE.xl },

        /* pet sections */
        petSection: { marginBottom: SPACE.lg },
        petSectionLabel: {
            fontSize: SIZE.small,
            fontFamily: FONT.regular,
            color: dark ? '#94a3b8' : '#6b7280',
            marginBottom: SPACE.sm,
            textTransform: 'uppercase',
            letterSpacing: 0.5,
        },
        petEmpty: {
            fontSize: SIZE.small,
            color: dark ? '#64748b' : '#9ca3af',
        },

        /* valuation card */
        valCard: {
            backgroundColor: dark ? '#111827' : '#ffffff',
            borderRadius: 10,
            padding: SPACE.lg,
            marginBottom: SPACE.md,
            borderWidth: 1,
            borderColor: dark ? '#334155' : '#f3f4f6',
        },
        valLabel: {
            fontSize: SIZE.label,
            fontFamily: FONT.bold,
            color: dark ? '#64748b' : '#9ca3af',
            textTransform: 'uppercase',
            letterSpacing: 0.6,
        },
        valNum: {
            fontSize: SIZE.heading,
            fontFamily: FONT.bold,
            color: config.colors.primary,
            letterSpacing: -0.5,
            marginTop: 1,
        },

        /* category legends */
        catLegend: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: SPACE.hair,
            marginBottom: SPACE.md,
        },
        legendItem: {
            flexDirection: 'row',
            alignItems: 'center',
            marginRight: SPACE.md,
            marginBottom: SPACE.hair,
        },
        legendDot: { width: 6, height: 6, borderRadius: 3, marginRight: 3 },
        legendLabel: {
            fontSize: SIZE.label,
            fontFamily: FONT.regular,
            color: dark ? '#94a3b8' : '#6b7280',
            marginRight: SPACE.hair,
        },
        legendPct: {
            fontSize: SIZE.label,
            fontFamily: FONT.bold,
            color: dark ? '#475569' : '#9ca3af',
        },

        /* wishlist row */
        wishRow: {
            flexDirection: 'row',
            backgroundColor: dark ? '#111827' : '#ffffff',
            borderRadius: 8,
            padding: SPACE.md,
            borderWidth: 1,
            borderColor: dark ? '#334155' : '#f3f4f6',
        },
        wishItem: { flex: 1, alignItems: 'center', gap: SPACE.hair },
        wishLabel: {
            fontSize: SIZE.label,
            fontFamily: FONT.bold,
            color: dark ? '#475569' : '#9ca3af',
            textTransform: 'uppercase',
        },
        wishVal: {
            fontSize: SIZE.caption,
            fontFamily: FONT.bold,
            color: dark ? '#e5e7eb' : '#111827',
        },
        wishDivider: {
            width: 1,
            backgroundColor: dark ? '#334155' : '#e5e7eb',
            marginHorizontal: SPACE.xs,
        },
    });

export default React.memo(CompactPortfolio);
