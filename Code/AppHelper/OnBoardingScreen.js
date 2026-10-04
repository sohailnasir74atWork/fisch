import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  StatusBar,
  Image,
  Modal,
  Animated,
  Easing,
} from 'react-native';
import Svg, {
  Defs, LinearGradient as SvgLinear, RadialGradient as SvgRadial, Stop, Rect, Circle,
} from 'react-native-svg';
import { useGlobalState } from '../GlobelStats';
import SignInDrawer from '../Firebase/SigninDrawer';
import SubscriptionScreen from '../SettingScreen/OfferWall';
import { useTranslation } from 'react-i18next';
import {  GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useLocalState } from '../LocalGlobelStats';
import { LIGHT, DARK, SIZE, SPACE, FONT, TYPE } from '../Design/tokens';

const { width, height } = Dimensions.get('window');

// This app's own mark. It was MM2's red wordmark until now, behind a
// config.isNoman ternary whose two branches loaded the same file (one via a
// `assets//` double slash) — so a new Fisch user's first screen showed
// another app's logo, and the flag that was supposed to switch it did nothing.
// Onboarding logo, per theme. NOTE the naming reads backwards: "-dark" means
// the logo drawn FOR a dark background (white/blue ink), so it is the one dark
// mode uses. Both are transparent PNGs; assets/logo.webp — the previous source
// here — is the same mark baked onto an opaque square tile, which is why it
// showed as a card rather than a logo.
// 512 px copies of assets/brand/bootsplash-logo*.png (1254 px, 1.4 MB for the
// pair, kept as the splash generator's source). Shown at most 116 pt, so 512 px
// is sharp on any screen and the pair costs 291 KB. (2026-10-04)
const iconForLightMode = require('../../assets/brand/app-logo.png');
const iconForDarkMode = require('../../assets/brand/app-logo-dark.png');

// The logo PNG is 1254px with its ink running to within 3% of the bottom edge
// ("FVC" sits on the frame), so the title used to butt straight against it.
// The logo now sits on a medallion and the gap is set by the medallion, not by
// whatever padding the artwork happens to carry.
//
// Colours are the SEA vocabulary from Design/tokens, and the background is
// SEA.foam — the same #F4F9FB as the bootsplash — so splash -> onboarding is
// one continuous surface instead of the old iOS-grey (#f2f2f7) jump. The
// previous CTA green was LIGHT.success, a status colour, not the brand.
const makePalette = (isDark) => (isDark
  ? {
    bg: DARK.bg,
    glow: DARK.primary, glowOp: '0.30',
    glowLow: LIGHT.primary, glowLowOp: '0.22',
    ring: 'rgba(58,175,196,0.18)',
    disc: DARK.card,
    discLine: DARK.border,
    text: DARK.text,
    textSub: DARK.textSecondary,
    dotOff: 'rgba(230,241,245,0.22)',
    cta: DARK.primary, ctaDeep: DARK.primaryPressed, onCta: DARK.onPrimary,
    outline: DARK.primary,
    statusBar: 'light-content',
  }
  : {
    bg: LIGHT.bg,
    glow: LIGHT.primary, glowOp: '0.16',
    glowLow: LIGHT.accent, glowLowOp: '0.08',
    ring: 'rgba(14,124,148,0.14)',
    disc: LIGHT.card,
    discLine: LIGHT.border,
    text: LIGHT.text,
    textSub: LIGHT.textSecondary,
    dotOff: 'rgba(11,42,54,0.16)',
    cta: LIGHT.primary, ctaDeep: LIGHT.primaryPressed, onCta: LIGHT.onPrimary,
    outline: LIGHT.primary,
    statusBar: 'dark-content',
  });

// Two soft glows drawn once in SVG — the same technique as the paywall this
// screen hands over to, so the two read as one flow.
const Backdrop = ({ P }) => (
  <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
    <Defs>
      <SvgRadial id="obGlowTop" cx="50%" cy="50%" r="50%">
        <Stop offset="0" stopColor={P.glow} stopOpacity={P.glowOp} />
        <Stop offset="1" stopColor={P.glow} stopOpacity="0" />
      </SvgRadial>
      <SvgRadial id="obGlowLow" cx="50%" cy="50%" r="50%">
        <Stop offset="0" stopColor={P.glowLow} stopOpacity={P.glowLowOp} />
        <Stop offset="1" stopColor={P.glowLow} stopOpacity="0" />
      </SvgRadial>
    </Defs>
    <Rect x="0" y="0" width="100%" height="100%" fill={P.bg} />
    <Circle cx={width * 0.5} cy={height * 0.3} r={width * 0.75} fill="url(#obGlowTop)" />
    <Circle cx={width * 0.95} cy={height * 0.9} r={width * 0.6} fill="url(#obGlowLow)" />
  </Svg>
);

const OnboardingScreen = ({ onFinish, selectedTheme }) => {
  const insets = useSafeAreaInsets();
  const [screenIndex, setScreenIndex] = useState(0);
  const [openSignin, setOpenSignin] = useState(false);
  const { theme, user, single_offer_wall } = useGlobalState();
  const isDarkMode = theme === 'dark' || selectedTheme === 'dark';
  const icon = isDarkMode ? iconForDarkMode : iconForLightMode;
  const P = useMemo(() => makePalette(isDarkMode), [isDarkMode]);
  const { t } = useTranslation();
  const [languageModalVisible, setLanguageModalVisible] = useState(false);
  // const platform = Platform.OS.toLowerCase();
  const { updateLocalState, localState } = useLocalState();

  // Medallion settles in once; the copy re-enters on every step so the change
  // from "Welcome" to "Sign in" reads as a step forward, not a text swap.
  const medallionIn = useRef(new Animated.Value(0)).current;
  const copyIn = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(medallionIn, {
      toValue: 1, duration: 520, easing: Easing.out(Easing.cubic), useNativeDriver: true,
    }).start();
  }, [medallionIn]);

  useEffect(() => {
    copyIn.setValue(0);
    Animated.timing(copyIn, {
      toValue: 1, duration: 420, delay: 80, easing: Easing.out(Easing.cubic), useNativeDriver: true,
    }).start();
  }, [screenIndex, copyIn]);


  // const languageOptions = [
  //   { code: "en", label: t("settings.languages.en"), flag: "🇺🇸" },
  //   { code: "fil", label: t("settings.languages.fil"), flag: "🇵🇭" },
  //   { code: "vi", label: t("settings.languages.vi"), flag: "🇻🇳" },
  //   { code: "pt", label: t("settings.languages.pt"), flag: "🇵🇹" },
  //   { code: "id", label: t("settings.languages.id"), flag: "🇮🇩" },
  //   { code: "es", label: t("settings.languages.es"), flag: "🇪🇸" },
  //   { code: "fr", label: t("settings.languages.fr"), flag: "🇫🇷" },
  //   { code: "de", label: t("settings.languages.de"), flag: "🇩🇪" },
  //   { code: "ru", label: t("settings.languages.ru"), flag: "🇷🇺" },
  //   { code: "ar", label: t("settings.languages.ar"), flag: "🇸🇦" }

  // ];


  const handleNext = () => {
    if (screenIndex === 0) {
      setScreenIndex(1);
    } else if (screenIndex === 1) {
      user?.id ? setScreenIndex(2) : setOpenSignin(true);
    } else {
      onFinish();
    }
  };

  const handleGuest = () => {
    // if (Platform.OS === 'ios') {
    //   onFinish();
    // } else {
      setScreenIndex(2);
    // }
  };

  const handleLoginSuccess = () => {
    setOpenSignin(false);
    // if (Platform.OS === 'ios') {
    //   onFinish();
    // } else {
      setScreenIndex(2);
    // }
  };

  const title = screenIndex === 0
    ? t('first.welcome_to')
    : user?.id
      ? `${t('first.welcome_user')} ${user?.displayName || 'Anonymous'}`
      : t('first.signin_or_guest');
  const subtitle = screenIndex === 0 ? t('first.track_pets') : t('first.get_notified_text');

  const medallionStyle = {
    opacity: medallionIn,
    transform: [{ scale: medallionIn.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }) }],
  };
  const copyStyle = {
    opacity: copyIn,
    transform: [{ translateY: copyIn.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
  };

  return (
    // Insets are read here because this screen renders outside
    // NavigationContainer. The backdrop sits OUTSIDE the padded area so the
    // status and navigation bars show the same surface as the screen.
    <GestureHandlerRootView style={[styles.root, { backgroundColor: P.bg }]}>
      <StatusBar barStyle={P.statusBar} />
      {screenIndex !== 2 && <Backdrop P={P} />}

      <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        {screenIndex === 2 ? (
          // if (Platform.OS === 'ios') { onFinish(); return null; }
          <SubscriptionScreen visible={true} onClose={onFinish} track="On Boarding" oneWallOnly={single_offer_wall} showoffer={!single_offer_wall}/>
        ) : (
          <>
            <View style={styles.hero}>
              <Animated.View style={[styles.ring, { borderColor: P.ring }, medallionStyle]}>
                <View style={[styles.disc, { backgroundColor: P.disc, borderColor: P.discLine }]}>
                  <Image source={icon} style={styles.logo} resizeMode="contain" />
                </View>
              </Animated.View>

              <Animated.View style={[styles.copy, copyStyle]}>
                <Text style={[styles.title, { color: P.text }]}>{title}</Text>
                <Text style={[styles.text, { color: P.textSub }]}>{subtitle}</Text>
              </Animated.View>
            </View>

            <View style={styles.footer}>
              <View style={styles.dots} accessibilityLabel={`Step ${screenIndex + 1} of 2`}>
                {[0, 1].map(i => (
                  <View
                    key={i}
                    style={[styles.dot, i === screenIndex
                      ? [styles.dotActive, { backgroundColor: P.cta }]
                      : { backgroundColor: P.dotOff }]}
                  />
                ))}
              </View>

              <TouchableOpacity style={[styles.button, { shadowColor: P.cta }]} onPress={handleNext} activeOpacity={0.88}>
                <Svg style={StyleSheet.absoluteFill}>
                  <Defs>
                    <SvgLinear id="obCta" x1="0" y1="0" x2="1" y2="1">
                      <Stop offset="0" stopColor={P.cta} />
                      <Stop offset="1" stopColor={P.ctaDeep} />
                    </SvgLinear>
                  </Defs>
                  <Rect x="0" y="0" width="100%" height="100%" fill="url(#obCta)" />
                </Svg>
                <Text style={[styles.buttonText, { color: P.onCta }]}>
                  {screenIndex === 1 && !user?.id ? t("first.signin") : t("first.continue")}
                </Text>
                <Ionicons name="arrow-forward" size={18} color={P.onCta} style={styles.buttonArrow} />
              </TouchableOpacity>

              {screenIndex === 1 && !user?.id && (
                <TouchableOpacity style={[styles.buttonOutline, { borderColor: P.outline }]} onPress={handleGuest} activeOpacity={0.7}>
                  <Text style={[styles.buttonTextOutline, { color: P.outline }]}>{t("first.guest_user")}</Text>
                </TouchableOpacity>
              )}
            </View>
          </>
        )}
      </View>

      <SignInDrawer visible={openSignin} onClose={handleLoginSuccess}  selectedTheme={selectedTheme} screen='On Boarding'/>
      <Modal visible={languageModalVisible} animationType="slide" transparent>
        <View style={[styles.modalContainer, { backgroundColor: P.bg }]}>
          {/* <Text style={[styles.modalTitle, { color: isDarkMode ? 'white' : '#666' }]}>{t("settings.select_language")}</Text>
          <FlatList
            data={languageOptions}
            keyExtractor={(item) => item.code}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.languageOption}
                onPress={() => {
                  changeLanguage(item.code);
                  setAppLanguage(item.code);
                  setLanguageModalVisible(false);

                }}
              >
                <Text style={[styles.languageText, { color: isDarkMode ? 'white' : '#666' }]}>{item.flag} {item.label}</Text>
              </TouchableOpacity>
            )}
          /> */}
        </View>
        <Ionicons name="close" size={34} color={P.textSub} style={styles.skipButton} onPress={() => { setLanguageModalVisible(false) }} />
      </Modal>
    </GestureHandlerRootView>
  );
};

const RING = 212;
const DISC = 168;

const styles = StyleSheet.create({
  root: { flex: 1 },
  container: { flex: 1 },
  hero: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACE.huge,
  },
  // A hairline orbit around a raised disc: the disc gives the transparent
  // hook a surface to sit on, the ring gives it presence without more ink.
  ring: {
    width: RING,
    height: RING,
    borderRadius: RING / 2,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disc: {
    width: DISC,
    height: DISC,
    borderRadius: DISC / 2,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: LIGHT.text,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 22,
    elevation: 10,
  },
  logo: { width: 116, height: 116 },
  copy: {
    alignItems: 'center',
    marginTop: SPACE.giant,
    maxWidth: 360,
  },
  title: {
    ...TYPE.display,
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  text: {
    fontFamily: FONT.regular,
    fontSize: SIZE.subtitle,
    lineHeight: 23,
    textAlign: 'center',
    marginTop: SPACE.xl,
    paddingHorizontal: SPACE.md,
  },
  footer: {
    paddingHorizontal: SPACE.huge,
    paddingBottom: SPACE.xl,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: SPACE.sm,
    marginBottom: SPACE.huge,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  dotActive: { width: 22 },
  button: {
    height: 54,
    borderRadius: 16,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  buttonText: { fontSize: SIZE.subtitle, fontFamily: FONT.bold, letterSpacing: 0.2 },
  buttonArrow: { marginLeft: SPACE.md },
  buttonOutline: {
    height: 54,
    borderRadius: 16,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: SPACE.xl,
  },
  buttonTextOutline: { fontSize: SIZE.subtitle, fontFamily: FONT.bold, letterSpacing: 0.2 },
  skipButton: { position: 'absolute', top: 40, right: 20, zIndex: 10 },
  modalContainer: {
    width: width,
    height: '100%',
    padding: SPACE.xxxl,
    paddingTop: 80,
  },
  modalTitle: {
    fontSize: SIZE.heading,
    fontFamily: FONT.bold,
    marginVertical: 15,
    alignSelf: 'center'
  },
  languageOption: {
    paddingVertical: SPACE.xxxl,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
    width: '100%',
    alignItems: 'left',
  },
  languageText: {
    fontSize: SIZE.subtitle,
    fontFamily: FONT.bold
  }

});

export default OnboardingScreen;
