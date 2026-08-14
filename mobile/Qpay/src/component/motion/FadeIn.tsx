import React, { useEffect, useRef } from 'react';
import { Animated, StyleProp, ViewStyle } from 'react-native';
import { motion } from '../../theme/theme';

type Props = {
  children: React.ReactNode;
  /** Delay before the fade starts, ms. Used to stagger lists via `Stagger`. */
  delay?: number;
  duration?: number;
  style?: StyleProp<ViewStyle>;
};

/** Opacity-only mount transition. Cheap, native-driven, safe to nest anywhere. */
export function FadeIn({ children, delay = 0, duration = motion.durations.base, style }: Props) {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim = Animated.timing(opacity, {
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

  return <Animated.View style={[{ opacity }, style]}>{children}</Animated.View>;
}
