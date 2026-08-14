import { useEffect, useRef, useState } from 'react';
import { Animated } from 'react-native';
import { motion } from '../../theme/theme';

type Options = {
  duration?: number;
  /** If true, counts up from 0 on first mount instead of appearing instantly. Default false. */
  animateOnMount?: boolean;
};

/**
 * Rolls a plain numeric value from its previous number to a new one and
 * returns the in-flight number on every frame (JS-driven — there's no way
 * to read an Animated.Value back out on the native thread, so this can't
 * use `useNativeDriver: true`). Shared by `AnimatedNumber` (renders it
 * directly) and `AmountDisplay` (splits it into whole/fraction with
 * different styling), so a balance counts the same way everywhere.
 */
export function useAnimatedNumber(value: number, options: Options = {}): number {
  const { duration = motion.durations.slow, animateOnMount = false } = options;
  const animated = useRef(new Animated.Value(animateOnMount ? 0 : value)).current;
  const [display, setDisplay] = useState(animateOnMount ? 0 : value);
  const previous = useRef(animateOnMount ? Number.NaN : value);

  useEffect(() => {
    if (previous.current === value) return;
    previous.current = value;

    const listenerId = animated.addListener(({ value: v }) => setDisplay(v));
    const anim = Animated.timing(animated, {
      toValue: value,
      duration,
      easing: motion.easing.standard,
      useNativeDriver: false,
    });
    anim.start();

    return () => {
      anim.stop();
      animated.removeListener(listenerId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return display;
}
