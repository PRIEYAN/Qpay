import React, { useEffect, useRef, useState } from 'react';
import { Animated, LayoutChangeEvent, StyleSheet, View, ViewStyle } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { useTheme } from '../../theme/ThemeProvider';

type Props = {
  style?: ViewStyle;
};

/**
 * A soft highlight band that sweeps left-to-right, looping — the moving
 * part of a skeleton loader. Purely monochrome (an `ink`-tinted gradient at
 * low opacity): loading chrome doesn't spend the app's one accent color.
 *
 * Sized via `onLayout` against its parent, so drop it inside a
 * `position: relative, overflow: hidden` block (that's exactly what
 * `Skeleton` does) rather than sizing it explicitly.
 */
export function Shimmer({ style }: Props) {
  const theme = useTheme();
  const [width, setWidth] = useState(0);
  const translateX = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!width) return undefined;
    translateX.setValue(-width);
    const loop = Animated.loop(
      Animated.timing(translateX, {
        toValue: width,
        duration: 1100,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [width, translateX]);

  const handleLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);
  const bandWidth = Math.max(width * 0.6, 60);
  const sweepOpacity = theme.isDark ? 0.14 : 0.07;

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.clip, style]} onLayout={handleLayout}>
      {width > 0 ? (
        <Animated.View style={[styles.band, { width: bandWidth, transform: [{ translateX }] }]}>
          <Svg width="100%" height="100%">
            <Defs>
              <LinearGradient id="shimmerSweep" x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0" stopColor={theme.ink} stopOpacity={0} />
                <Stop offset="0.5" stopColor={theme.ink} stopOpacity={sweepOpacity} />
                <Stop offset="1" stopColor={theme.ink} stopOpacity={0} />
              </LinearGradient>
            </Defs>
            <Rect x="0" y="0" width="100%" height="100%" fill="url(#shimmerSweep)" />
          </Svg>
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  clip: { overflow: 'hidden' },
  band: { position: 'absolute', top: 0, bottom: 0 },
});
