// 🏆 Optimize performance by enabling screens before any imports
import { enableScreens, enableFreeze } from 'react-native-screens';
enableScreens(); 
enableFreeze(true);

import React, { lazy, Suspense } from 'react';
import { AppRegistry, Text } from 'react-native';
import AppWrapper from './App';
import { name as appName } from './app.json';
import { GlobalStateProvider } from './Code/GlobelStats';
import { LocalStateProvider } from './Code/LocalGlobelStats';
import { MenuProvider } from 'react-native-popup-menu';
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';
import { LanguageProvider } from './Code/Translation/LanguageProvider';
import { getMessaging, setBackgroundMessageHandler } from '@react-native-firebase/messaging';
import FlashMessage from 'react-native-flash-message';

// Removed deleted dynamic imports

// ✅ Background Notification Handler
// Every push carries a notification payload that Android shows itself; this
// only silences RNFB's "no background handler" warning. (Modular API: the
// namespaced messaging() calls are deprecated in RNFB 22+.)
setBackgroundMessageHandler(getMessaging(), async () => {});

// ✅ Foreground display for value-change alerts — background/killed pushes
// auto-display, but foreground ones are dropped unless shown manually.
import { initValueAlertForegroundHandler } from './Code/Helper/valueAlerts';
initValueAlertForegroundHandler();
class ErrorBoundary extends React.Component {
  state = { hasError: false };
  static getDerivedStateFromError(error) {
    return { hasError: true };
  }
  componentDidCatch(error, info) {
    console.error('Caught in ErrorBoundary:', error, info);
    // The component stack alone does not say which call threw — keep the JS
    // stack, it is what identified StatusBar.setBackgroundColor on RN 0.87.
    console.error('ErrorBoundary stack:', error && error.stack);
  }
  render() {
    return this.state.hasError ? <Text>Something went wrong.</Text> : this.props.children;
  }
}

// ✅ Memoized App component to prevent unnecessary re-renders
// SafeAreaProvider must sit ABOVE everything, including the onboarding screen,
// which AppWrapper returns OUTSIDE NavigationContainer. React Navigation mounts
// its own SafeAreaProviderCompat inside NativeStackView, which is why
// useSafeAreaInsets() worked in navigator screens and would have thrown in
// onboarding — so onboarding used a hardcoded paddingBottom: 50 instead of the
// real inset. initialWindowMetrics gives correct insets on the very first frame
// rather than a zero-inset flash.
const App = React.memo(() => (
  <SafeAreaProvider initialMetrics={initialWindowMetrics}>
  {/* backHandler: Android Back closes an open popup menu before it leaves the screen. */}
  <MenuProvider skipInstanceCheck backHandler>
  <LanguageProvider>
    <LocalStateProvider>
      <GlobalStateProvider > 
        <ErrorBoundary>
          <AppWrapper />
        </ErrorBoundary>
        <FlashMessage position="top" />
        <Suspense fallback={null}>
        </Suspense>
      </GlobalStateProvider>
    </LocalStateProvider>                
  </LanguageProvider>
</MenuProvider>
  </SafeAreaProvider>
));

AppRegistry.registerComponent(appName, () => App);
