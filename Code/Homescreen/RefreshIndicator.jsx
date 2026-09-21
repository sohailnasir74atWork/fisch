import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, ActivityIndicator, Animated, Easing, Text, View } from 'react-native';

export default function RefreshIndicator({ colors, primary }) {
  const progress = useRef(new Animated.Value(0)).current;
  const [width, setWidth] = useState(0);
  useEffect(() => {
    let animation;
    let disposed = false;
    const update = reduce => {
      animation?.stop();
      progress.setValue(0);
      if (!reduce && !disposed) {
        animation = Animated.loop(Animated.timing(progress, {
          toValue: 1, duration: 1400, easing: Easing.inOut(Easing.ease), useNativeDriver: true,
        }));
        animation.start();
      }
    };
    AccessibilityInfo.isReduceMotionEnabled().then(update);
    const listener = AccessibilityInfo.addEventListener('reduceMotionChanged', update);
    return () => { disposed = true; animation?.stop(); listener.remove(); };
  }, [progress]);
  return <View accessibilityRole="progressbar" accessibilityLabel="Refreshing market values" accessibilityState={{ busy: true }}
    style={{ marginTop: 10, padding: 10, borderRadius: 10, backgroundColor: colors.bg }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <ActivityIndicator size="small" color={primary} />
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.text, fontSize: 12, fontWeight: '600' }}>Refreshing values</Text>
        <Text style={{ color: colors.textSecondary, fontSize: 10, marginTop: 2 }}>Checking the latest market data…</Text>
      </View>
    </View>
    <View onLayout={event => setWidth(event.nativeEvent.layout.width)} style={{ height: 3, marginTop: 8, borderRadius: 3, backgroundColor: colors.border, overflow: 'hidden' }}>
      <Animated.View style={{ height: 3, width: width * 0.35, borderRadius: 3, backgroundColor: primary,
        transform: [{ translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [-width * 0.35, width] }) }] }} />
    </View>
  </View>;
}
