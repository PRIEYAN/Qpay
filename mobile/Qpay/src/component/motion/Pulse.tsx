import React, { useEffect, useRef } from 'react';
import { Animated, StyleProp, ViewStyle } from 'react-native';
import { motion } from '../../theme/theme';

type Props = {
  children?: React.ReactNode;
  /** Loops while true; freezes at rest (scale 1, full opacity) when false. Default true. */
  active?: boolean;
  minScale?: number;
  maxScale?: number;
  style?: StyleProp<ViewStyle>;
};

/**
 * A gentle breathing loop — scale + opacity — for "waiting" states: a
 * scanning target, a pending-confirmation dot, a live indicator. Standalone
 * (no children) it's a pulsing dot; give it children to pulse existing
 * content, e.g. an icon while a scan is in progress.
 */
export function Pulse({ children, active = true, minScale = 1, maxScale = 1.08, style }: Props) {
  const value = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!active) return undefined;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(value, {
          toValue: 1,
          duration: motion.durations.slower,
          easing: motion.easing.standard,
          useNativeDriver: true,
        }),
        Animated.timing(value, {
          toValue: 0,
          duration: motion.durations.slower,
          easing: motion.easing.standard,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [active, value]);

  const scale = value.interpolate({ inputRange: [0, 1], outputRange: [minScale, maxScale] });
  const opacity = value.interpolate({ inputRange: [0, 1], outputRange: [1, 0.55] });

  return (
    <Animated.View style={[{ transform: [{ scale }], opacity }, style]}>{children}</Animated.View>
  );
}
