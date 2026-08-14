import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, TextInput, TextInputProps, View, ViewStyle } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { accent, borderWidth, borderWidthStrong, motion, radii, spacing, typography } from '../../theme/theme';

type Props = TextInputProps & {
  label?: string;
  /** Renders the value at amount scale — for the one number that is the screen's subject. */
  amount?: boolean;
  suffix?: string;
  containerStyle?: ViewStyle;
};

/**
 * Bordered field, `radii.md` corners. Focus is still signalled by border
 * *weight* (1px → 2px) but the color now animates toward the app accent
 * too, matching `SearchBar` — the same field, the same feedback.
 */
export function Input({ label, amount, suffix, containerStyle, ...rest }: Props) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);
  const focusAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(focusAnim, {
      toValue: focused ? 1 : 0,
      duration: motion.durations.fast,
      easing: motion.easing.standard,
      useNativeDriver: false,
    }).start();
  }, [focused, focusAnim]);

  const borderColor = focusAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [theme.border, accent],
  });

  return (
    <View style={containerStyle}>
      {label ? (
        <Text style={[typography.caption, styles.label, { color: theme.muted }]}>
          {label.toUpperCase()}
        </Text>
      ) : null}

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
        <TextInput
          {...rest}
          onFocus={(e) => {
            setFocused(true);
            rest.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            rest.onBlur?.(e);
          }}
          placeholderTextColor={theme.muted}
          style={[
            amount ? typography.amount : typography.body,
            styles.input,
            { color: theme.ink },
          ]}
        />
        {suffix ? (
          <Text style={[amount ? typography.subtitle : typography.bodyMedium, { color: theme.muted }]}>
            {suffix}
          </Text>
        ) : null}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  label: { marginBottom: spacing.sm },
  field: {
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  input: { flex: 1, paddingVertical: spacing.md },
});
