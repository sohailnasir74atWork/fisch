import React from 'react';
import { getThemeColors } from '../../Helper/themeColors';
import { View, Text, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import config from '../../Helper/Environment';
import { SIZE } from '../../Design/tokens';
import { SPACE } from '../../Design/tokens';
import { FONT } from '../../Design/tokens';

/**
 * Posts section — modernised card design with icon header
 */
const ProfilePostsSection = ({
  isDarkMode,
  t,
  posts,
  loadingPosts,
  hasMorePosts,
  handleLoadMorePosts,
  renderPostItem,
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
          backgroundColor: isDarkMode ? 'rgba(139,92,246,0.15)' : 'rgba(139,92,246,0.1)',
          alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon name="document-text" size={12} color="#8b5cf6" />
        </View>
        <Text style={{
          fontSize: SIZE.caption, fontFamily: FONT.bold,
          color: c.text,
        }}>
          {t('profile.recent_posts')}
        </Text>
        <Text style={{
          fontSize: SIZE.label, fontFamily: FONT.regular,
          color: c.textMuted,
          marginLeft: 'auto',
        }}>
          {posts.length > 0 ? `${posts.length}+` : ''}
        </Text>
      </View>

      {loadingPosts && posts.length === 0 ? (
        <ActivityIndicator
          size="small"
          color={config.colors.primary}
          style={{ paddingVertical: SPACE.xl }}
        />
      ) : posts.length === 0 ? (
        <View style={{ alignItems: 'center', paddingVertical: SPACE.xxl, gap: SPACE.sm }}>
          <Icon name="document-outline" size={24} color={isDarkMode ? '#334155' : '#d1d5db'} />
          <Text style={{ fontSize: SIZE.small, color: isDarkMode ? '#64748b' : '#9ca3af' }}>
            {t('profile.no_posts_yet')}
          </Text>
        </View>
      ) : (
        <>
          {posts.map((post) => renderPostItem(post))}

          {hasMorePosts && !loadingPosts && (
            <TouchableOpacity
              onPress={handleLoadMorePosts}
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
                {t('profile.load_more_posts')}
              </Text>
            </TouchableOpacity>
          )}

          {loadingPosts && hasMorePosts && (
            <ActivityIndicator size="small" color={config.colors.primary} style={{ marginTop: SPACE.sm }} />
          )}
        </>
      )}
    </View>
  );
};

export default React.memo(ProfilePostsSection);
