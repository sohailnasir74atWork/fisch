import React from 'react';
import { getThemeColors } from '../../Helper/themeColors';
import { View, Text, TouchableOpacity, ActivityIndicator, ScrollView } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import config from '../../Helper/Environment';
import { SIZE } from '../../Design/tokens';
import { SPACE } from '../../Design/tokens';
import { FONT } from '../../Design/tokens';

const STAR_OPTIONS = [null, 5, 4, 3, 2, 1]; // null = All

/**
 * Reviews section — modernised card design with icon header + star filter pills
 * Reviews are fetched server-side from Firestore (filtered by rating when a star is selected)
 */
const ProfileReviewsSection = ({
  isDarkMode,
  t,
  reviews,
  loadingReviews,
  hasMoreReviews,
  handleLoadMoreReviews,
  renderStars,
  getTimestampMs,
  formatCreatedAt,
  starFilter = null,
  setStarFilter,
}) => {
  const c = getThemeColors(isDarkMode);
  return (
    <View
      style={{
        borderRadius: 14,
        padding: SPACE.xl,
        backgroundColor: c.bgAlt,
        marginBottom: SPACE.md,
      }}
    >
      {/* Section Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.sm, marginBottom: SPACE.lg }}>
        <View style={{
          width: 24, height: 24, borderRadius: 8,
          backgroundColor: isDarkMode ? 'rgba(251,191,36,0.15)' : 'rgba(251,191,36,0.1)',
          alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon name="star" size={12} color="#fbbf24" />
        </View>
        <Text style={{
          fontSize: SIZE.caption, fontFamily: FONT.bold,
          color: c.text,
        }}>
          {t('private_chat.recent_reviews', { defaultValue: 'Recent Reviews' })}
        </Text>
        <Text style={{
          fontSize: SIZE.label, fontFamily: FONT.regular,
          color: c.textMuted,
          marginLeft: 'auto',
        }}>
          {reviews.length > 0 ? `${reviews.length}+` : ''}
        </Text>
      </View>

      {/* ⭐ Star Filter Pills — horizontal scroll */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ marginBottom: SPACE.lg }}
        contentContainerStyle={{ gap: SPACE.sm, paddingRight: SPACE.xs }}
      >
        {STAR_OPTIONS.map((star) => {
          const isActive = starFilter === star;
          const label = star === null ? t('private_chat.filter_all', { defaultValue: 'All' }) : `${star}★`;

          return (
            <TouchableOpacity
              key={star === null ? 'all' : star}
              onPress={() => setStarFilter?.(star)}
              activeOpacity={0.7}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: SPACE.xs,
                paddingHorizontal: SPACE.lg,
                paddingVertical: 5,
                borderRadius: 999,
                borderWidth: 1,
                backgroundColor: isActive
                  ? (isDarkMode ? 'rgba(251,191,36,0.2)' : 'rgba(251,191,36,0.15)')
                  : (c.bg),
                borderColor: isActive
                  ? '#fbbf24'
                  : (c.border),
              }}
            >
              {star !== null && (
                <Text style={{
                  fontSize: SIZE.label,
                  color: isActive ? '#fbbf24' : (c.textSecondary),
                }}>
                  ★
                </Text>
              )}
              <Text style={{
                fontSize: SIZE.small,
                fontFamily: isActive ? FONT.bold : FONT.regular,
                color: isActive
                  ? (isDarkMode ? '#fbbf24' : '#b45309')
                  : (c.textSecondary),
              }}>
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Reviews list — already filtered server-side by Firestore */}
      {loadingReviews && reviews.length === 0 ? (
        <ActivityIndicator
          size="small"
          color={config.colors.primary}
          style={{ paddingVertical: SPACE.xl }}
        />
      ) : reviews.length === 0 ? (
        <View style={{ alignItems: 'center', paddingVertical: SPACE.xxl, gap: SPACE.sm }}>
          <Icon
            name={starFilter ? 'filter-outline' : 'chatbubble-ellipses-outline'}
            size={24}
            color={isDarkMode ? '#334155' : '#d1d5db'}
          />
          <Text style={{ fontSize: SIZE.small, color: isDarkMode ? '#64748b' : '#9ca3af' }}>
            {starFilter
              ? t('private_chat.no_star_reviews', { defaultValue: `No ${starFilter}★ reviews found`, star: starFilter })
              : t('private_chat.no_reviews', { defaultValue: 'No reviews yet.' })}
          </Text>
        </View>
      ) : (
        <>
          {reviews.map((rev, idx) => {
            const tsMs = getTimestampMs(rev.updatedAt || rev.createdAt);
            const timeLabel = tsMs ? formatCreatedAt(tsMs) : null;

            return (
              <View
                key={rev.id}
                style={{
                  paddingVertical: SPACE.md, paddingHorizontal: SPACE.hair,
                  borderBottomWidth: idx < reviews.length - 1 ? 1 : 0,
                  borderBottomColor: isDarkMode ? 'rgba(51,65,85,0.5)' : 'rgba(226,232,240,0.8)',
                }}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACE.xs }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.sm, flex: 1 }}>
                    <View style={{
                      width: 22, height: 22, borderRadius: 11,
                      backgroundColor: c.border,
                      alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Text style={{ fontSize: SIZE.label, fontFamily: FONT.bold, color: c.textSecondary }}>
                        {(rev.userName || '?')[0].toUpperCase()}
                      </Text>
                    </View>
                    <Text style={{
                      fontSize: SIZE.caption, fontFamily: FONT.regular,
                      color: c.text,
                    }} numberOfLines={1}>
                      {rev.userName || t('private_chat.anonymous', { defaultValue: 'Anonymous' })}
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.sm }}>
                    {timeLabel && (
                      <Text style={{ fontSize: SIZE.label, color: c.textMuted }}>
                        {timeLabel}
                      </Text>
                    )}
                    {renderStars(rev?.rating || 0)}
                  </View>
                </View>
                {!!rev?.review && (
                  <Text style={{
                    fontSize: SIZE.small, color: isDarkMode ? '#cbd5e1' : '#475569',
                    lineHeight: 16, marginLeft: 28,
                  }}>
                    {rev.review}
                  </Text>
                )}
                {rev?.edited && (
                  <Text style={{ fontSize: SIZE.label, color: c.textMuted, marginTop: SPACE.hair, marginLeft: 28, fontStyle: 'italic' }}>
                    {t('private_chat.edited', { defaultValue: 'Edited' })}
                  </Text>
                )}
              </View>
            );
          })}

          {hasMoreReviews && !loadingReviews && (
            <TouchableOpacity
              onPress={handleLoadMoreReviews}
              style={{
                marginTop: SPACE.md, alignSelf: 'center',
                flexDirection: 'row', alignItems: 'center', gap: SPACE.xs,
                paddingHorizontal: 14, paddingVertical: SPACE.sm,
                borderRadius: 999, borderWidth: 1,
                borderColor: c.border,
                backgroundColor: c.bg,
              }}
            >
              <Icon name="chevron-down" size={12} color={c.textSecondary} />
              <Text style={{ fontSize: SIZE.small, fontFamily: FONT.regular, color: c.textSecondary }}>
                {t('private_chat.load_more_reviews', { defaultValue: 'Load more reviews' })}
              </Text>
            </TouchableOpacity>
          )}

          {loadingReviews && hasMoreReviews && (
            <ActivityIndicator size="small" color={config.colors.primary} style={{ marginTop: SPACE.sm }} />
          )}
        </>
      )}
    </View>
  );
};

export default React.memo(ProfileReviewsSection);
