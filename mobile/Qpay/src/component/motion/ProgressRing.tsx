import React, { useEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';
import { Circle, Svg } from 'react-native-svg';
import { useTheme } from '../../theme/ThemeProvider';
import { accent, motion } from '../../theme/theme';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

type Props = {
  /** 0..1. Ignored when `indeterminate` is set. */
  progress?: number;
  /** Continuous spin with a fixed-length arc — for "working"/"scanning" states with no known duration. */
  indeterminate?: boolean;
  size?: number;
  strokeWidth?: number;
  /** Defaults to the app accent — this is one of its intended homes. */
  color?: string;
  trackColor?: string;
};

/**
 * SVG progress ring. Determinate mode animates `strokeDashoffset` toward
 * `progress`; indeterminate mode spins a fixed 75%-length arc, for use
 * around the QR scanner target or any async wait with no known length.
 */
export function ProgressRing({
  progress = 0,
  indeterminate = false,
  size = 40,
  strokeWidth = 4,
  color,
  trackColor,
}: Props) {
  const theme = useTheme();
  const tint = color ?? accent;
  const track = trackColor ?? theme.border;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  const progressValue = useRef(new Animated.Value(progress)).current;
  const rotation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (indeterminate) return;
    const anim = Animated.timing(progressValue, {
      toValue: progress,
      duration: motion.durations.base,
      easing: motion.easing.standard,
      useNativeDriver: false,
    });
    anim.start();
    return () => anim.stop();
  }, [progress, indeterminate, progressValue]);

  useEffect(() => {
    if (!indeterminate) return undefined;
    rotation.setValue(0);
    const loop = Animated.loop(
      Animated.timing(rotation, { toValue: 1, duration: 900, easing: Easing.linear, useNativeDriver: true }),
    );
    loop.start();
    return () => loop.stop();
  }, [indeterminate, rotation]);

  const dashOffset = progressValue.interpolate({
    inputRange: [0, 1],
    outputRange: [circumference, 0],
    extrapolate: 'clamp',
  });
  const spin = rotation.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <Animated.View
      style={{ width: size, height: size, transform: indeterminate ? [{ rotate: spin }] : [] }}
    >
      <Svg width={size} height={size}>
        <Circle cx={size / 2} cy={size / 2} r={radius} stroke={track} strokeWidth={strokeWidth} fill="none" />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={tint}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={indeterminate ? circumference * 0.75 : dashOffset}
          strokeLinecap="round"
          rotation="-90"
          origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>
    </Animated.View>
  );
}
