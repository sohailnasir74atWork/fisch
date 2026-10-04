import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  View,
  StatusBar,

  TouchableOpacity,
  Appearance,
  Platform,
} from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { navigationRef } from './Code/Helper/navigationService';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import SettingsScreen from './Code/SettingScreen/Setting';
import IosSettings from './Code/SettingScreen/IosSettings';
import { GAME } from './Code/config/game';
import MyStuffScreen from './Code/MyStuff/MyStuffScreen';
import { SIZE } from './Code/Design/tokens';
import ValueScreen from './Code/ValuesScreen/ValueScreen';
import RodsScreen from './Code/Rods/RodsScreen';
import TimerScreen from './Code/Timers/TimerScreen';
import FishValueScreen from './Code/FishValue/FishValueScreen';
import { useGlobalState } from './Code/GlobelStats';
import { useLocalState } from './Code/LocalGlobelStats';
import { AdsConsent, AdsConsentStatus } from 'react-native-google-mobile-ads';
import MainTabs from './Code/AppHelper/MainTabs';
import SocialDashboard from './Code/AppHelper/SocialDashboard';
import { getTrackingStatus, requestTrackingPermission } from 'react-native-tracking-transparency';
import {
  MyDarkTheme,
  MyLightTheme,
  requestReview,
} from './Code/AppHelper/AppHelperFunction';
import getAdUnitId from './Code/Ads/ads';
import OnboardingScreen from './Code/AppHelper/OnBoardingScreen';
import CalculatorScreen from './Code/Homescreen/HomeScreen';
import { IOS_LIMITED } from './Code/config/iosLimited';
import { useTranslation } from 'react-i18next';
import InterstitialAdManager from './Code/Ads/IntAd';
import AppOpenAdManager from './Code/Ads/openApp';
import { ensureAdsInitialized } from './Code/Ads/init';
import { markAdsReady, whenAdsReady } from './Code/Ads/adsGate';
import RNBootSplash from "react-native-bootsplash";
import SystemNavigationBar from 'react-native-system-navigation-bar';
import { checkForUpdate } from './Code/AppHelper/InAppUpdateChecker';
import PrivateChatScreen from './Code/ChatScreen/PrivateChat/PrivateChat';
import PrivateChatHeader from './Code/ChatScreen/PrivateChat/PrivateChatHeader';
import { FONT } from './Code/Design/tokens';

const Stack = createNativeStackNavigator();
// The splash waits for login (isAppReady) but never longer than this from JS
// start, so a slow or unreachable profile read can't hold it on screen.
const SPLASH_LOGIN_CAP_MS = 3000;
const JS_STARTED_AT = Date.now();

// Wrapper for PrivateChat used from root stack (SocialDashboard → Chat)
// Manages its own drawer state since it's outside ChatNavigator
const PrivateChatRootWrapper = (props) => {
  const [isDrawerVisible, setIsDrawerVisible] = useState(false);
  return (
    <PrivateChatScreen
      {...props}
      bannedUsers={[]}
      isDrawerVisible={isDrawerVisible}
      setIsDrawerVisible={setIsDrawerVisible}
      noTabBar={true}
    />
  );
};

function App() {
  const { theme } = useGlobalState();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const isDark = theme === 'dark';

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    SystemNavigationBar.setNavigationColor(isDark ? '#000000' : '#F4F9FB', isDark ? 'light' : 'dark', 'navigation');
  }, [isDark]);

  const selectedTheme = useMemo(() => {
    return isDark ? MyDarkTheme : MyLightTheme;
  }, [isDark]);

  const { localState, updateLocalState } = useLocalState();
  const [chatFocused, setChatFocused] = useState(true);
  const [modalVisibleChatinfo, setModalVisibleChatinfo] = useState(false);

  // ✅ Moved before conditional return to satisfy Rules of Hooks
  useEffect(() => {
    const { reviewCount } = localState;
    if (reviewCount % 6 === 0 && reviewCount > 0) {
      requestReview();
    }
    updateLocalState('reviewCount', Number(reviewCount) + 1);
  }, []);



  // ✅ Check for app updates on mount
  useEffect(() => {
    checkForUpdate();
  }, []);

  // ✅ Sequential: ATT (iOS) → UMP Consent → Ads Init
  useEffect(() => {
    const initConsentAndAds = async () => {
      try {
        // Step 1: ATT prompt (iOS only)
        if (Platform.OS === 'ios') {
          const status = await getTrackingStatus();
          if (status === 'not-determined') {
            await requestTrackingPermission();
          }
        }

        // Step 2: UMP / GDPR consent
        await handleUserConsent();

        // Step 3: Apply the AdMob request configuration (maxAdContentRating 'T',
        // child-treatment flag) BEFORE the first ad request, then init ads.
        // ensureAdsInitialized() is a shared one-shot promise; every ad manager
        // also awaits it, so ordering (config-before-load) is guaranteed.
        await ensureAdsInitialized();
        // iOS limited build: Home-only, no sign-in, so no interstitial trigger
        // is reachable — the preload was pure auction waste there.
        if (!IOS_LIMITED) InterstitialAdManager.init();
      } catch (error) {
        // Still init ads even if consent fails, to avoid no ads at all
        if (!IOS_LIMITED) InterstitialAdManager.init();
      } finally {
        // Banners, rewarded, native and the App Open manager wait for this
        // (Code/Ads/adsGate.js), so nothing requests an ad before ATT +
        // consent have run. In `finally` so a consent failure still opens it.
        markAdsReady();
      }
    };

    initConsentAndAds();
  }, []);

  const saveConsentStatus = (status) => {
    updateLocalState('consentStatus', status);
  };

  const handleUserConsent = async () => {
    try {
      const consentInfo = await AdsConsent.requestInfoUpdate();

      if (
        consentInfo.status === AdsConsentStatus.OBTAINED ||
        consentInfo.status === AdsConsentStatus.NOT_REQUIRED
      ) {
        saveConsentStatus(consentInfo.status);
        return;
      }

      if (consentInfo.isConsentFormAvailable) {
        const formResult = await AdsConsent.showForm();
        saveConsentStatus(formResult.status);
      }
    } catch (error) {
      // One line, not the whole error object. In Fisch this is usually
      // "no form(s) configured for the input app ID": the consent form is not
      // set up for this app in the AdMob console (owner action, not code).
      console.warn('Consent form unavailable:', error?.code || error?.message);
    }
  };



  const navRef = useRef();



  return (
    <View style={{ flex: 1, backgroundColor: selectedTheme.colors.background }}>
      <View style={{ flex: 1 }}>
        <NavigationContainer ref={navigationRef} theme={selectedTheme}>
          <StatusBar
            barStyle={isDark ? 'light-content' : 'dark-content'}
          />

          <Stack.Navigator
              screenOptions={({ route }) => ({
                animation: 'fade',
                animationDuration: 300,
                // iOS only (Android draws no back label): the native back
                // button would otherwise print the previous ROUTE NAME —
                // "MainTabs" — on every screen pushed from Home.
                headerBackButtonDisplayMode: 'minimal',
                contentStyle: {
                  backgroundColor: selectedTheme.colors.background,
                  // Android 15+ (targetSdk 36) forces edge-to-edge, so every
                  // screen draws under the navigation bar. MainTabs is exempt
                  // because its tab bar already pads itself
                  // (height: 56 + insets.bottom in MainTabs.js) — padding here
                  // too would double the gap. Every OTHER stack screen had no
                  // bottom handling at all, which is why Settings, Rods,
                  // Timers and the rest ran under the system bar.
                  //
                  // iOS limited build: MainTabs draws no tab bar, so nothing
                  // pads its bottom either — treat it like every other screen.
                  paddingBottom: route.name === 'MainTabs' && !IOS_LIMITED ? 0 : insets.bottom,
                },
              })}
            >
            {/* iOS limited build: Home uses the standard native header (just
                the app name — no buttons, owner's call 2026-09-24) instead of
                its custom lagoon band, which HomeTabScreen skips there.
                Settings is reached from a Home tile. See Code/config/iosLimited.js. */}
            <Stack.Screen
              name="MainTabs"
              options={IOS_LIMITED ? {
                headerShown: true,
                title: GAME.displayName,
                headerStyle: { backgroundColor: selectedTheme.colors.background },
                headerTintColor: selectedTheme.colors.text,
                headerTitleStyle: { fontFamily: FONT.bold, fontSize: SIZE.heading },
                headerShadowVisible: false,
              } : { headerShown: false }}
            >
              {() => <MainTabs selectedTheme={selectedTheme} setChatFocused={setChatFocused} chatFocused={chatFocused} setModalVisibleChatinfo={setModalVisibleChatinfo} modalVisibleChatinfo={modalVisibleChatinfo} />}
            </Stack.Screen>

            {/* Move this outside of <Stack.Navigator> */}


            <Stack.Screen
              name="Setting"
              options={{
                title: t('tabs.settings'),
                headerStyle: { backgroundColor: selectedTheme.colors.background },
                headerTintColor: selectedTheme.colors.text,
              }}
            >
              {/* iOS limited build: the short IosSettings, not the full social
                  Settings. See Code/config/iosLimited.js. */}
              {() => (IOS_LIMITED
                ? <IosSettings />
                : <SettingsScreen selectedTheme={selectedTheme} />)}
            </Stack.Screen>

            <Stack.Screen
              name="MyStuff"
              options={{
                title: 'My Stuff',
                headerStyle: { backgroundColor: selectedTheme.colors.background },
                headerTintColor: selectedTheme.colors.text,
                headerTitleStyle: { fontFamily: FONT.bold, fontSize: SIZE.heading },
              }}
            >
              {() => <MyStuffScreen selectedTheme={selectedTheme} />}
            </Stack.Screen>

            <Stack.Screen name="MysteryEggScreen" options={{ headerShown: false }} getComponent={() => require('./Code/Engagement/MysteryEgg').default} />
            {/* Draws its own header, so the native one stays off. */}
            <Stack.Screen name="ModsScreen" options={{ headerShown: false }} getComponent={() => require('./Code/Engagement/ModsScreen').default} />
            {/* Moderation console. Draws its own tab bar; the native header
                carries the title and back button. Lazily required so the
                bundle cost lands only on staff who actually open it. */}
            <Stack.Screen
              name="Admin"
              options={{
                title: 'Moderation',
                headerStyle: { backgroundColor: selectedTheme.colors.background },
                headerTintColor: selectedTheme.colors.text,
              }}
              getComponent={() => require('./Code/AppHelper/AdminDashboard').default}
            />
            <Stack.Screen name="MyCosmeticsScreen" options={{ headerShown: false }} getComponent={() => require('./Code/Engagement/MyCosmeticsScreen').default} />

            <Stack.Screen
              name="SocialDashboard"
              options={{
                title: 'Social Dashboard',
                headerStyle: { backgroundColor: selectedTheme.colors.background },
                headerTintColor: selectedTheme.colors.text,
                headerTitleStyle: { fontFamily: FONT.bold, fontSize: SIZE.heading },
              }}
            >
              {() => <SocialDashboard selectedTheme={selectedTheme} />}
            </Stack.Screen>

            <Stack.Screen
              name="Values"
              options={{
                title: 'Values',
                headerStyle: { backgroundColor: selectedTheme.colors.background },
                headerTintColor: selectedTheme.colors.text,
                headerTitleStyle: { fontFamily: FONT.bold, fontSize: SIZE.heading },
              }}
            >
              {(props) => <ValueScreen {...props} selectedTheme={selectedTheme} />}
            </Stack.Screen>

            {/* The three screens the data supported long before the app did.
                Registered here rather than as tabs: five tabs is already the
                practical limit of a phone tab bar, and these are destinations
                you arrive at from Home, not places you live. */}
            <Stack.Screen
              name="Rods"
              options={{
                title: 'Rod Comparison',
                headerStyle: { backgroundColor: selectedTheme.colors.background },
                headerTintColor: selectedTheme.colors.text,
                headerTitleStyle: { fontFamily: FONT.bold, fontSize: SIZE.heading },
              }}
            >
              {() => <RodsScreen />}
            </Stack.Screen>

            <Stack.Screen
              name="Timers"
              options={{
                title: 'Timers',
                headerStyle: { backgroundColor: selectedTheme.colors.background },
                headerTintColor: selectedTheme.colors.text,
                headerTitleStyle: { fontFamily: FONT.bold, fontSize: SIZE.heading },
              }}
            >
              {() => <TimerScreen />}
            </Stack.Screen>

            <Stack.Screen
              name="FishValue"
              options={{
                title: 'Fish Value',
                headerStyle: { backgroundColor: selectedTheme.colors.background },
                headerTintColor: selectedTheme.colors.text,
                headerTitleStyle: { fontFamily: FONT.bold, fontSize: SIZE.heading },
              }}
            >
              {() => <FishValueScreen />}
            </Stack.Screen>

            {/* iOS limited build only. The trade calculator is a TAB
                everywhere else (MainTabs.js); with the tab bar hidden it has
                to be a stack destination the Home card can reach. Same
                component, same prop. Not registered on Android so there is
                one route per name. See Code/config/iosLimited.js. */}
            {IOS_LIMITED && (
              <Stack.Screen
                name="Calculator"
                options={{
                  title: t('tabs.calculator'),
                  headerStyle: { backgroundColor: selectedTheme.colors.background },
                  headerTintColor: selectedTheme.colors.text,
                  headerTitleStyle: { fontFamily: FONT.bold, fontSize: SIZE.heading },
                }}
              >
                {() => <CalculatorScreen selectedTheme={selectedTheme} />}
              </Stack.Screen>
            )}

            <Stack.Screen
              name="PrivateChatRoot"
              options={({ route }) => ({
                headerTitle: () => (
                  <PrivateChatHeader
                    selectedUser={route.params?.selectedUser}
                    selectedTheme={selectedTheme}
                    bannedUsers={[]}
                    isDrawerVisible={false}
                    setIsDrawerVisible={() => {}}
                  />
                ),
                headerStyle: { backgroundColor: selectedTheme.colors.background },
                headerTintColor: selectedTheme.colors.text,
              })}
            >
              {(props) => <PrivateChatRootWrapper {...props} />}
            </Stack.Screen>
          </Stack.Navigator>
        </NavigationContainer>
      </View>
    </View>
  );
}

export default function AppWrapper() {
  const { localState, updateLocalState } = useLocalState();
  const { theme } = useGlobalState();

  // iOS limited build: no walkthrough at all — after the splash the app opens
  // straight into Home. The stored flag is left untouched, so the walkthrough
  // shows itself the day the full app ships on iOS. See Code/config/iosLimited.js.
  const showOnboarding = localState.showOnBoardingScreen && !IOS_LIMITED;

  // App Open ad: start the manager once, after onboarding, for non-Pro users.
  // It registers its OWN AppState listener and shows on every genuine
  // background→foreground return (both iOS and Android) — frequency-capped,
  // Pro-gated, and de-duped against interstitial/rewarded ads via the shared
  // full-screen flag. Pro state is re-read from MMKV on every show, so a
  // purchase mid-session immediately stops App Open ads.
  //
  // The manager itself starts only once consent has run (whenAdsReady), so
  // its cold-start ad is never requested ahead of the ATT / UMP prompts.
  useEffect(() => {
    if (showOnboarding || localState.isPro) return;
    let cancelled = false;
    whenAdsReady().then(() => { if (!cancelled) AppOpenAdManager.start(); });
    return () => { cancelled = true; };
  }, [localState.isPro, showOnboarding]);

  const [splashCapReached, setSplashCapReached] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setSplashCapReached(true),
      Math.max(0, JS_STARTED_AT + SPLASH_LOGIN_CAP_MS - Date.now()));
    return () => clearTimeout(id);
  }, []);

  // ✅ Hide splash once login is done (or the cap passed)
  useEffect(() => {
    if (localState.isAppReady || splashCapReached) {
      // RN 0.87 removed InteractionManager from core; requestIdleCallback is
      // the replacement it points to. The timeout matters: without it a busy
      // JS thread can starve the idle callback and the splash never hides.
      requestIdleCallback(
        () => {
          RNBootSplash.hide({ fade: true });
        },
        { timeout: 1000 },
      );
    }
  }, [localState.isAppReady, splashCapReached]);

  const selectedTheme = useMemo(() => {
    return theme === 'dark' ? MyDarkTheme : MyLightTheme;
  }, [theme]);

  const handleSplashFinish = () => {
    updateLocalState('showOnBoardingScreen', false);
  };

  if (showOnboarding) {
    return <OnboardingScreen onFinish={handleSplashFinish} selectedTheme={selectedTheme} />;
  }

  return <App />;
}