// IosSettings.jsx — the Settings screen of the iOS limited build.
//
// The full Setting.jsx is ~3,700 lines of profile, sign-in, chat and social
// controls; none of those surfaces exist on the iOS limited build, so it gets
// this short screen instead. App.js swaps it in for the `Setting` route only
// when IOS_LIMITED is true — Android never renders it. See
// Code/config/iosLimited.js.
//
// It holds the one purchase the iOS build sells (Remove Ads = the Pro
// entitlement), Restore Purchases (App Review requires it next to any IAP),
// theme, support and the legal links. No language picker (owner's call,
// 2026-09-24): i18n.js starts in English unless a language was picked, so
// the iOS build runs in English.
import React, { useState, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet, Linking,
  ActivityIndicator, Platform, Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import DeviceInfo from 'react-native-device-info';
import { useTranslation } from 'react-i18next';
import { useLocalState } from '../LocalGlobelStats';
import { useThemeColors } from '../Helper/themeColors';
import { useHaptic } from '../Helper/HepticFeedBack';
import { showSuccessMessage, showInfoMessage, showErrorMessage } from '../Helper/MessageHelper';
import config from '../Helper/Environment';
import { GAME, termsUrlFor } from '../config/game';
import { FONT, SIZE, SPACE, RADIUS } from '../Design/tokens';
import { handleRateApp, handleShareApp } from './settinghelper';
import SubscriptionScreen from './OfferWall';
import { usePrivacyOptionsRequired, showPrivacyOptionsForm } from '../Ads/consentOptions';

const THEMES = ['system', 'light', 'dark'];
const MANAGE_SUBSCRIPTIONS_URL = 'https://apps.apple.com/account/subscriptions';

const openUrl = (url) => {
  if (!url) return;
  Linking.openURL(url).catch(() =>
    Alert.alert('Error', 'Unable to open the link. Please try again later.'),
  );
};

// One settings row. Outside the screen so React keeps it the same component
// type across renders; the screen passes its palette and styles in.
const Row = ({ C, $, icon, tint, label, sub, onPress, right, last }) => (
  <TouchableOpacity
    accessibilityRole="button"
    accessibilityLabel={label}
    onPress={onPress}
    disabled={!onPress}
    activeOpacity={0.7}
    style={[$.row, !last && $.rowDivider]}
  >
    <View style={[$.rowIcon, { backgroundColor: (tint || C.primary) + '22' }]}>
      <Icon name={icon} size={18} color={tint || C.primary} />
    </View>
    <View style={$.rowText}>
      <Text style={$.rowLabel}>{label}</Text>
      {!!sub && <Text style={$.rowSub}>{sub}</Text>}
    </View>
    {right !== undefined ? right : <Icon name="chevron-forward" size={18} color={C.textMuted} />}
  </TouchableOpacity>
);

const IosSettings = () => {
  const { t } = useTranslation();
  const C = useThemeColors();
  const $ = useMemo(() => makeStyles(C), [C]);
  const { localState, updateLocalState, restorePurchases } = useLocalState();
  const { triggerHapticFeedback } = useHaptic();

  const [showOfferWall, setShowOfferWall] = useState(false);
  const [restoring, setRestoring] = useState(false);
  // UMP "privacy options" entry point — only EEA/UK/CH users who saw the
  // consent form need it; everyone else never sees the row.
  const privacyOptionsRequired = usePrivacyOptionsRequired();

  const isPro = !!localState.isPro;
  const currentTheme = localState.theme || 'system';
  // Rate / Share need the App Store link, which is null until the listing
  // exists (GAME.store.ios). A row that opens nothing is worse than no row.
  const storeLink = config.IOsShareLink;
  const termsUrl = termsUrlFor(Platform.OS);
  const version = `${DeviceInfo.getVersion()} (${DeviceInfo.getBuildNumber()})`;

  const handleRestore = async () => {
    if (restoring) return;
    triggerHapticFeedback('impactLight');
    const restored = await restorePurchases(setRestoring);
    if (restored === true) showSuccessMessage(t('ios_settings.restore_done'), t('ios_settings.restore_done_desc'));
    else if (restored === false) showInfoMessage(t('ios_settings.restore_none'), t('ios_settings.restore_none_desc'));
    else showErrorMessage(t('ios_settings.restore_failed'), t('ios_settings.restore_failed_desc'));
  };

  const handleContact = () => {
    const subject = `${GAME.displayName} support (iOS ${version})`;
    openUrl(`mailto:${config.supportEmail}?subject=${encodeURIComponent(subject)}`);
  };

  return (
    <View style={$.root}>
      <ScrollView contentContainerStyle={$.content} showsVerticalScrollIndicator={false}>

        {/* ── Remove Ads ── */}
        <Text style={$.section}>{t('ios_settings.premium')}</Text>
        <View style={$.card}>
          {isPro ? (
            <>
              <Row C={C} $={$}
                icon="checkmark-circle"
                tint={C.success}
                label={t('ios_settings.ads_removed')}
                sub={t('ios_settings.ads_removed_desc')}
                right={null}
              />
              <Row C={C} $={$}
                icon="card-outline"
                label={t('ios_settings.manage_subscription')}
                onPress={() => openUrl(MANAGE_SUBSCRIPTIONS_URL)}
                last
              />
            </>
          ) : (
            <>
              <Row C={C} $={$}
                icon="ban-outline"
                tint={C.accent}
                label={t('ios_settings.remove_ads')}
                sub={t('ios_settings.remove_ads_desc')}
                onPress={() => { triggerHapticFeedback('impactLight'); setShowOfferWall(true); }}
              />
              <Row C={C} $={$}
                icon="refresh-outline"
                label={t('ios_settings.restore')}
                onPress={handleRestore}
                right={restoring ? <ActivityIndicator size="small" color={C.primary} /> : undefined}
                last
              />
            </>
          )}
        </View>

        {/* ── Appearance ── */}
        <Text style={$.section}>{t('ios_settings.appearance')}</Text>
        <View style={[$.card, $.cardPad]}>
          <Text style={$.fieldLabel}>{t('settings.theme')}</Text>
          <View style={$.segment}>
            {THEMES.map((mode) => {
              const on = currentTheme === mode;
              return (
                <TouchableOpacity
                  key={mode}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  style={[$.segmentItem, on && $.segmentItemOn]}
                  onPress={() => { triggerHapticFeedback('impactLight'); updateLocalState('theme', mode); }}
                  activeOpacity={0.8}
                >
                  <Text style={[$.segmentText, on && $.segmentTextOn]}>{t(`ios_settings.theme_${mode}`)}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* ── Support ── */}
        <Text style={$.section}>{t('ios_settings.support')}</Text>
        <View style={$.card}>
          <Row C={C} $={$} icon="mail-outline" label={t('ios_settings.contact')} onPress={handleContact} last={!storeLink} />
          {!!storeLink && (
            <>
              <Row C={C} $={$} icon="star-outline" tint={C.accent} label={t('ios_settings.rate')} onPress={handleRateApp} />
              <Row C={C} $={$} icon="share-outline" label={t('ios_settings.share')} onPress={handleShareApp} last />
            </>
          )}
        </View>

        {/* ── Legal ── */}
        <Text style={$.section}>{t('ios_settings.legal')}</Text>
        <View style={$.card}>
          <Row C={C} $={$}
            icon="shield-checkmark-outline"
            label={t('ios_settings.privacy')}
            onPress={() => openUrl(GAME.privacyPolicyUrl)}
            last={!privacyOptionsRequired && !termsUrl}
          />
          {privacyOptionsRequired && (
            <Row C={C} $={$}
              icon="options-outline"
              label={t('ios_settings.privacy_options', { defaultValue: 'Privacy options' })}
              onPress={showPrivacyOptionsForm}
              last={!termsUrl}
            />
          )}
          {!!termsUrl && (
            <Row C={C} $={$} icon="document-text-outline" label={t('ios_settings.terms')} onPress={() => openUrl(termsUrl)} last />
          )}
        </View>

        <Text style={$.footer}>{GAME.displayName} · {t('ios_settings.version', { version })}</Text>
      </ScrollView>

      <SubscriptionScreen
        visible={showOfferWall}
        onClose={() => setShowOfferWall(false)}
        track="IosSettings"
      />
    </View>
  );
};

const makeStyles = (C) => StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  content: { paddingHorizontal: SPACE.xxl, paddingTop: SPACE.md, paddingBottom: SPACE.giant },
  section: {
    fontFamily: FONT.bold, fontSize: SIZE.caption, color: C.textSecondary,
    letterSpacing: 0.6, textTransform: 'uppercase',
    marginTop: SPACE.huge, marginBottom: SPACE.md, marginLeft: SPACE.xs,
  },
  card: {
    backgroundColor: C.card, borderRadius: RADIUS.lg,
    borderWidth: StyleSheet.hairlineWidth, borderColor: C.cardBorder, overflow: 'hidden',
  },
  cardPad: { padding: SPACE.xxl },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACE.xxl, paddingVertical: SPACE.xl, minHeight: 56 },
  rowDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.divider },
  rowIcon: { width: 32, height: 32, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center', marginRight: SPACE.lg },
  rowText: { flex: 1, minWidth: 0 },
  rowLabel: { fontFamily: FONT.bold, fontSize: SIZE.body, color: C.text },
  rowSub: { fontFamily: FONT.regular, fontSize: SIZE.caption, color: C.textSecondary, marginTop: 2 },
  fieldLabel: { fontFamily: FONT.bold, fontSize: SIZE.body, color: C.text, marginBottom: SPACE.md },
  segment: { flexDirection: 'row', backgroundColor: C.bgAlt, borderRadius: RADIUS.md, padding: 3 },
  segmentItem: { flex: 1, alignItems: 'center', paddingVertical: SPACE.md, borderRadius: RADIUS.md - 2 },
  segmentItemOn: { backgroundColor: C.primary },
  segmentText: { fontFamily: FONT.bold, fontSize: SIZE.caption, color: C.textSecondary },
  segmentTextOn: { color: C.onPrimary },
  footer: { textAlign: 'center', fontFamily: FONT.regular, fontSize: SIZE.caption, color: C.textMuted, marginTop: SPACE.xxl },
});

export default IosSettings;
