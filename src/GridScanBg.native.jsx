import React, { useEffect, useRef } from 'react';
import { Animated, View } from 'react-native';
import Svg, { Defs, Path, Pattern, Rect } from 'react-native-svg';

// Fallback nativo (iOS/Android): grade sutil + feixe de scan animado.
// No web, o Metro usa GridScanBg.web.jsx (three.js de verdade).
export default function GridScanBgNative({ style }) {
  const y = useRef(new Animated.Value(0)).current;
  const H = 900;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(y, { toValue: 1, duration: 2800, useNativeDriver: false }),
        Animated.timing(y, { toValue: 0, duration: 2800, useNativeDriver: false }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);
  const top = y.interpolate({ inputRange: [0, 1], outputRange: [-180, H] });
  const AnimRect = Animated.createAnimatedComponent(Rect);
  return (
    <View style={[{ backgroundColor: '#080808' }, style]} pointerEvents="none">
      <Svg width="100%" height="100%">
        <Defs>
          <Pattern id="gscan" width="30" height="30" patternUnits="userSpaceOnUse">
            <Path d="M 30 0 L 0 0 0 30" fill="none" stroke="rgba(168,85,247,0.13)" strokeWidth="1" />
          </Pattern>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#gscan)" />
        <AnimRect x="0" y={top} width="100%" height="150" fill="rgba(130,10,209,0.22)" />
        <AnimRect x="0" y={top} width="100%" height="3" fill="#A855F7" opacity={0.7} />
      </Svg>
    </View>
  );
}
