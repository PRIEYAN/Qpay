import React, { useEffect, useRef } from 'react';
import { Animated, StyleProp, ViewStyle } from 'react-native';
import { motion } from '../../theme/theme';

type Direction = 'up' | 'down' | 'left' | 'right';

type Props = {
  children: React.ReactNode;
  /** Delay before the animation starts, ms. Used to stagger lists via `Stagger`. */
  delay?: number;
  duration?: number;
  /** Which edge the content travels in from. Default `up` (travels from below into place). */
  direction?: Direction;
  /** Distance travelled, in px. */
  distance?: number;
  style?: StyleProp<ViewStyle>;
};

/** Fade + a short directional travel — the default mount transition for cards, rows, sheets. */
export function SlideIn({
  children,
  delay = 0,
  duration = motion.durations.base,
  direction = 'up',
  distance = 16,
  style,
}: Props) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim = Animated.timing(progress, {
      toValue: 1,
      duration,
      delay,
      easing: motion.easing.standard,
      useNativeDriver: true,
    });
    anim.start();
    return () => anim.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sign = direction === 'down' || direction === 'right' ? -1 : 1;
  const offset = progress.interpolate({ inputRange: [0, 1], outputRange: [distance * sign, 0] });
  const transform =
    direction === 'left' || direction === 'right'
      ? [{ translateX: offset }]
      : [{ translateY: offset }];

  return (
    <Animated.View style={[{ opacity: progress, transform }, style]}>{children}</Animated.View>
  );
}
