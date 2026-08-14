import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { borderWidth, elevation, motion, radii, spacing, typography } from '../../theme/theme';

type Props = {
  message: string;
  visible: boolean;
};

/** Inline, non-blocking message. Ink border, now slides up + fades rather than just fading. */
export function Toast({ message, visible }: Props) {
  const theme = useTheme();
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(8)).current;
  const [mounted, setMounted] = useState(visible);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: motion.duration,
          easing: motion.easing.decelerate,
          useNativeDriver: true,
        }),
        Animated.spring(translateY, { toValue: 0, ...motion.spring.gentle }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 0,
          duration: motion.duration,
          easing: motion.easing.accelerate,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: 8,
          duration: motion.duration,
          easing: motion.easing.accelerate,
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (finished) setMounted(false);
      });
    }
  }, [visible, opacity, translateY]);

  if (!mounted) return null;

  return (
    <Animated.View
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={[
        styles.base,
        !theme.isDark && elevation.md,
        {
          opacity,
          transform: [{ translateY }],
          borderColor: theme.ink,
          backgroundColor: theme.isDark ? theme.surfaceRaised : theme.paper,
        },
      ]}
    >
      <Text style={[typography.body, { color: theme.ink }]}>{message}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radii.md,
    borderWidth,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    alignSelf: 'flex-start',
  },
});
