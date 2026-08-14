import React, { useEffect, useRef, useState } from 'react';
import { Animated, LayoutChangeEvent, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { borderWidth, motion, radii, spacing, typography } from '../../theme/theme';
import { PressableScale } from '../motion/PressableScale';

type Option = { label: string; value: string };

type Props = {
  options: Option[];
  value: string;
  onChange: (value: string) => void;
};

/**
 * Ink-bordered row of options. A single filled pill now slides beneath the
 * active label (spring, via `motion.spring.gentle`) instead of the old
 * instant cell-to-cell color flip — segments are equal-width (`flex: 1`
 * each) so the pill's width/position can be derived from the measured
 * container width without per-segment `onLayout` calls.
 */
export function SegmentedControl({ options, value, onChange }: Props) {
  const theme = useTheme();
  const [containerWidth, setContainerWidth] = useState(0);
  const matchedIndex = options.findIndex((option) => option.value === value);
  const indicatorPosition = useRef(new Animated.Value(matchedIndex >= 0 ? matchedIndex : 0)).current;

  useEffect(() => {
    if (matchedIndex < 0) return;
    Animated.spring(indicatorPosition, {
      toValue: matchedIndex,
      ...motion.spring.gentle,
    }).start();
  }, [matchedIndex, indicatorPosition]);

  const handleLayout = (e: LayoutChangeEvent) => setContainerWidth(e.nativeEvent.layout.width);
  const segmentWidth = options.length > 0 ? containerWidth / options.length : 0;
  const translateX =
    options.length > 1
      ? indicatorPosition.interpolate({
          inputRange: options.map((_, i) => i),
          outputRange: options.map((_, i) => i * segmentWidth),
        })
      : 0;

  return (
    <View style={[styles.row, { borderColor: theme.ink }]} onLayout={handleLayout}>
      {containerWidth > 0 && matchedIndex >= 0 ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.indicator,
            { width: segmentWidth, backgroundColor: theme.ink, transform: [{ translateX }] },
          ]}
        />
      ) : null}

      {options.map((option, index) => {
        const selected = option.value === value;
        return (
          <PressableScale
            key={option.value}
            onPress={() => onChange(option.value)}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            style={[
              styles.segment,
              index > 0 && { borderLeftWidth: borderWidth, borderLeftColor: theme.ink },
            ]}
          >
            <Text style={[typography.bodyMedium, { color: selected ? theme.paper : theme.ink }]}>
              {option.label}
            </Text>
          </PressableScale>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    borderRadius: radii.sm,
    borderWidth,
    overflow: 'hidden',
  },
  indicator: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
  },
});
