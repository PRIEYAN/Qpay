import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, TextInput } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { accent, borderWidth, borderWidthStrong, motion, radii, spacing, typography } from '../../theme/theme';
import { Icon } from '../icons/Icon';
import { PressableScale } from '../motion/PressableScale';

type Props = {
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  onFocus?: () => void;
};

/**
 * Square field, search glyph leading. Focus used to just thicken the
 * border; it now animates the border color toward the app accent too —
 * one of the accent's canonical uses (a focus ring).
 */
export function SearchBar({ value, onChangeText, placeholder, onFocus }: Props) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);
  const focusAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(focusAnim, {
      toValue: focused ? 1 : 0,
      duration: motion.durations.fast,
      easing: motion.easing.standard,
      useNativeDriver: false, // color isn't a native-driver-eligible property
    }).start();
  }, [focused, focusAnim]);

  const borderColor = focusAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [theme.border, accent],
  });
  const iconColor = focused ? accent : theme.muted;

  return (
    <Animated.View
      style={[
        styles.field,
        {
          borderColor,
          borderWidth: focused ? borderWidthStrong : borderWidth,
          backgroundColor: theme.paper,
        },
      ]}
    >
      <Icon name="search" size={18} color={iconColor} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.muted}
        onFocus={() => {
          setFocused(true);
          onFocus?.();
        }}
        onBlur={() => setFocused(false)}
        style={[typography.body, styles.input, { color: theme.ink }]}
        accessibilityRole="search"
        returnKeyType="search"
      />
      {value.length > 0 ? (
        <PressableScale
          onPress={() => onChangeText('')}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Clear search"
        >
          <Icon name="close" size={16} color={theme.muted} />
        </PressableScale>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  field: {
    borderRadius: radii.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    height: 48,
  },
  input: { flex: 1, paddingVertical: spacing.sm },
});
