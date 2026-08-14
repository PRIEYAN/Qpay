import React, { useRef, useState } from 'react';
import {
  Animated,
  GestureResponderEvent,
  Pressable,
  PressableProps,
  PressableStateCallbackType,
} from 'react-native';
import { motion } from '../../theme/theme';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type Props = Omit<PressableProps, 'style' | 'children'> & {
  style?: PressableProps['style'];
  children?: React.ReactNode | ((state: PressableStateCallbackType) => React.ReactNode);
  /** Target scale while pressed. Defaults to the app-wide `motion.scalePressed`. */
  scaleTo?: number;
};

/**
 * The single highest-impact tactile primitive in this system: a `Pressable`
 * that springs down to `scaleTo` on press and springs back on release,
 * using `motion.spring.press` so every pressable in the app shares the same
 * feel. Everything else (Button, Card, ListRow, ActionTile, ContactChip) is
 * built on top of this rather than re-implementing the spring.
 *
 * Built on `Animated.createAnimatedComponent(Pressable)` rather than a
 * separate inner `Animated.View` wrapper — a wrapper would break any
 * percentage/flex sizing passed via `style` (e.g. KeypadNumeric's
 * `width: '33.333%'` keys, which must resolve against the *grid*, not an
 * inner box), since percentages only resolve against the styled node's
 * actual parent. Press state is tracked locally (not read off Pressable's
 * own render-prop) so the resolved style can be merged with the transform
 * in a single, non-function `style` array — mixing Pressable's
 * function-style overload with Animated values doesn't type-check cleanly.
 */
export function PressableScale({
  children,
  style,
  scaleTo = motion.scalePressed,
  disabled,
  onPressIn,
  onPressOut,
  ...rest
}: Props) {
  const scale = useRef(new Animated.Value(1)).current;
  const [pressed, setPressed] = useState(false);

  const animateTo = (toValue: number) => {
    Animated.spring(scale, { toValue, ...motion.spring.press }).start();
  };

  const handlePressIn = (e: GestureResponderEvent) => {
    setPressed(true);
    animateTo(scaleTo);
    onPressIn?.(e);
  };

  const handlePressOut = (e: GestureResponderEvent) => {
    setPressed(false);
    animateTo(1);
    onPressOut?.(e);
  };

  const state: PressableStateCallbackType = { pressed };
  const resolvedStyle = typeof style === 'function' ? style(state) : style;

  return (
    <AnimatedPressable
      {...rest}
      disabled={disabled}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[resolvedStyle, { transform: [{ scale }] }]}
    >
      {typeof children === 'function' ? children(state) : children}
    </AnimatedPressable>
  );
}
