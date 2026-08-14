import React from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import { motion } from '../../theme/theme';
import { SlideIn } from './SlideIn';

type Direction = 'up' | 'down' | 'left' | 'right';

type Props = {
  /** Each direct child is animated in, in order. */
  children: React.ReactNode;
  /** Delay between each child's animation start, ms. */
  interval?: number;
  /** Delay before the first child starts, ms. */
  initialDelay?: number;
  direction?: Direction;
  distance?: number;
  duration?: number;
  itemStyle?: StyleProp<ViewStyle>;
};

/**
 * Wraps each direct child in a `SlideIn` with an incrementing delay, so a
 * list mounts as a cascade rather than popping in all at once. Use for the
 * home action row, a transaction list's first page, contact chips — any
 * short, bounded list. Not meant for long/virtualized lists (every item
 * pays for its own animation clock).
 */
export function Stagger({
  children,
  interval = 45,
  initialDelay = 0,
  direction = 'up',
  distance = 12,
  duration = motion.durations.base,
  itemStyle,
}: Props) {
  return (
    <>
      {React.Children.map(children, (child, index) => (
        <SlideIn
          key={index}
          delay={initialDelay + index * interval}
          direction={direction}
          distance={distance}
          duration={duration}
          style={itemStyle}
        >
          {child}
        </SlideIn>
      ))}
    </>
  );
}
