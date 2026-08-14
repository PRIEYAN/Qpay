import React, { useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, Modal, Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeProvider';
import { borderWidthStrong, motion, radii, spacing, typography } from '../../theme/theme';
import { Icon } from '../icons/Icon';
import { PressableScale } from '../motion/PressableScale';

type Props = {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
  style?: ViewStyle;
};

const OFFSCREEN = Dimensions.get('window').height;

/**
 * Bottom sheet. Rounded top corners (`radii.lg`) replace the old hard
 * square edge, and the sheet now springs up from offscreen while the
 * backdrop fades in — both driven manually (`animationType="none"` on the
 * `Modal`) rather than relying on the OS's linear slide transition, so both
 * halves share this app's motion language and animate back out on close
 * instead of just vanishing. The sheet stays mounted through the exit
 * animation, same pattern as `Toast`.
 */
export function Sheet({ visible, onClose, children, title, style }: Props) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [mounted, setMounted] = useState(visible);
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  /** 0 = settled in place, 1 = fully offscreen below. */
  const offset = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.parallel([
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: motion.durations.base,
          easing: motion.easing.standard,
          useNativeDriver: true,
        }),
        Animated.spring(offset, { toValue: 0, ...motion.spring.gentle }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(backdropOpacity, {
          toValue: 0,
          duration: motion.durations.fast,
          easing: motion.easing.accelerate,
          useNativeDriver: true,
        }),
        Animated.timing(offset, {
          toValue: 1,
          duration: motion.durations.fast,
          easing: motion.easing.accelerate,
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (finished) setMounted(false);
      });
    }
  }, [visible, backdropOpacity, offset]);

  if (!mounted) return null;

  const translateY = offset.interpolate({ inputRange: [0, 1], outputRange: [0, OFFSCREEN] });

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose}>
      <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
        <Pressable
          style={[StyleSheet.absoluteFill, { backgroundColor: theme.overlay }]}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close"
        />
      </Animated.View>
      <Animated.View
        style={[
          styles.sheet,
          {
            backgroundColor: theme.paper,
            borderTopColor: theme.ink,
            paddingBottom: Math.max(insets.bottom, spacing.lg),
            transform: [{ translateY }],
          },
          style,
        ]}
      >
        {title ? (
          <View style={styles.header}>
            <Text style={[typography.caption, { color: theme.muted }]}>{title.toUpperCase()}</Text>
            <PressableScale onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close">
              <Icon name="close" size={20} color={theme.ink} />
            </PressableScale>
          </View>
        ) : null}
        {children}
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1 },
  sheet: {
    borderTopWidth: borderWidthStrong,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
});
