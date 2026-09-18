import React from 'react';
import { getThemeColors } from '../../Helper/themeColors';
import { View, Text, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import config from '../../Helper/Environment';
import { SIZE } from '../../Design/tokens';
import { SPACE } from '../../Design/tokens';
import { FONT } from '../../Design/tokens';

/**
 * Trades section — modernised card design with icon header
 */
const ProfileTradesSection = ({
  isDarkMode,
  t,
  trades,
  loadingTrades,
  hasMoreTrades,
  handleLoadMoreTrades,
  renderTradeItem,
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
          backgroundColor: isDarkMode ? 'rgba(16,185,129,0.15)' : 'rgba(16,185,129,0.1)',
          alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon name="swap-horizontal" size={12} color="#10b981" />
        </View>
        <Text style={{
          fontSize: SIZE.caption, fontFamily: FONT.bold,
          color: c.text,
        }}>
          {t('profile.recent_trades')}
        </Text>
        <Text style={{
          fontSize: SIZE.label, fontFamily: FONT.regular,
          color: c.textMuted,
          marginLeft: 'auto',
        }}>
          {trades.length > 0 ? `${trades.length}+` : ''}
        </Text>
      </View>

      {loadingTrades && trades.length === 0 ? (
        <ActivityIndicator
          size="small"
          color={config.colors.primary}
          style={{ paddingVertical: SPACE.xl }}
        />
      ) : trades.length === 0 ? (
        <View style={{ alignItems: 'center', paddingVertical: SPACE.xxl, gap: SPACE.sm }}>
          <Icon name="repeat-outline" size={24} color={isDarkMode ? '#334155' : '#d1d5db'} />
          <Text style={{ fontSize: SIZE.small, color: isDarkMode ? '#64748b' : '#9ca3af' }}>
            {t('profile.no_trades_yet')}
          </Text>
        </View>
      ) : (
        <>
          {trades.map((trade) => renderTradeItem(trade))}

          {hasMoreTrades && !loadingTrades && (
            <TouchableOpacity
              onPress={handleLoadMoreTrades}
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
                {t('profile.load_more_trades')}
              </Text>
            </TouchableOpacity>
          )}

          {loadingTrades && hasMoreTrades && (
            <ActivityIndicator size="small" color={config.colors.primary} style={{ marginTop: SPACE.sm }} />
          )}
        </>
      )}
    </View>
  );
};

export default React.memo(ProfileTradesSection);
