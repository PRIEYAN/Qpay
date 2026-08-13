import {
  Children,
  useEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { durations } from '../../theme/theme';
import './motion.css';

/**
 * Web ports of the mobile `src/component/motion/*` primitives. Same names,
 * same props where they still make sense — the RN `Animated` machinery is
 * replaced by CSS animations declared in `motion.css`, so these components
 * are thin wrappers that set a class plus a couple of custom properties.
 */

type MotionProps = {
  children: ReactNode;
  /** ms */
  delay?: number;
  /** ms */
  duration?: number;
  className?: string;
  style?: CSSProperties;
};

function motionVars(delay?: number, duration?: number): CSSProperties {
  const vars: Record<string, string> = {};
  if (delay) vars['--m-delay'] = `${delay}ms`;
  if (duration) vars['--m-duration'] = `${duration}ms`;
  return vars as CSSProperties;
}

export function FadeIn({ children, delay, duration, className, style }: MotionProps) {
  return (
    <div
      className={['m-fade-in', className].filter(Boolean).join(' ')}
      style={{ ...motionVars(delay, duration), ...style }}
    >
      {children}
    </div>
  );
}

export function SlideIn({
  children,
  delay,
  duration,
  distance = 12,
  direction = 'up',
  className,
  style,
}: MotionProps & { distance?: number; direction?: 'up' | 'right' }) {
  return (
    <div
      className={['m-slide-in', className].filter(Boolean).join(' ')}
      data-direction={direction}
      style={
        {
          ...motionVars(delay, duration),
          '--slide-distance': `${distance}px`,
          ...style,
        } as CSSProperties
      }
    >
      {children}
    </div>
  );
}

/**
 * Cascades its children in rather than popping them all at once. Mobile
 * cloned each child with a computed delay; the web version wraps each in a
 * `SlideIn` with the same staggered delay.
 */
export function Stagger({
  children,
  interval = 40,
  distance = 12,
  direction = 'up',
  className,
  style,
}: {
  children: ReactNode;
  interval?: number;
  distance?: number;
  direction?: 'up' | 'right';
  className?: string;
  style?: CSSProperties;
}) {
  const items = Children.toArray(children);
  return (
    <>
      {items.map((child, i) => (
        <SlideIn
          key={i}
          delay={i * interval}
          distance={distance}
          direction={direction}
          className={className}
          style={style}
        >
          {child}
        </SlideIn>
      ))}
    </>
  );
}

/**
 * The app's universal tap target: springs down on press. Everything
 * interactive that isn't a `<Button>` goes through this, so press feedback
 * is identical across cards, rows, chips and icon buttons.
 */
export function PressableScale({
  children,
  scaleTo = 0.96,
  inline = false,
  className,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  scaleTo?: number;
  inline?: boolean;
}) {
  return (
    <button
      type="button"
      className={['m-pressable', className].filter(Boolean).join(' ')}
      data-inline={inline || undefined}
      style={{ '--m-scale': String(scaleTo) } as CSSProperties}
      {...rest}
    >
      {children}
    </button>
  );
}

export function Skeleton({
  width,
  height = 16,
  className,
  style,
}: {
  width?: number | string;
  height?: number | string;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div
      className={['m-skeleton', className].filter(Boolean).join(' ')}
      style={{ width: width ?? '100%', height, ...style }}
      aria-hidden
    />
  );
}

export function Pulse({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={['m-pulse', className].filter(Boolean).join(' ')}>{children}</div>;
}

export function PopIn({ children, delay, className, style }: MotionProps) {
  return (
    <div
      className={['m-pop-in', className].filter(Boolean).join(' ')}
      style={{ ...motionVars(delay), ...style }}
    >
      {children}
    </div>
  );
}

/**
 * Rolls a number from its previous value to a new one, returning the
 * in-flight value each frame. Ported from `useAnimatedNumber` — the RN
 * `Animated.timing` + listener is a `requestAnimationFrame` loop here.
 */
export function useAnimatedNumber(
  value: number,
  options: { duration?: number; animateOnMount?: boolean } = {},
): number {
  const { duration = durations.slow, animateOnMount = false } = options;
  const [display, setDisplay] = useState(animateOnMount ? 0 : value);
  const previous = useRef(animateOnMount ? 0 : value);
  const frame = useRef<number | undefined>(undefined);

  useEffect(() => {
    const from = previous.current;
    if (from === value) return;
    previous.current = value;

    // Respect the OS-level reduced-motion setting: snap instead of rolling.
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setDisplay(value);
      return;
    }

    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      // Same curve family as `motion.easing.standard` — decelerating.
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(from + (value - from) * eased);
      if (t < 1) frame.current = requestAnimationFrame(step);
    };
    frame.current = requestAnimationFrame(step);

    return () => {
      if (frame.current !== undefined) cancelAnimationFrame(frame.current);
    };
  }, [value, duration]);

  return display;
}

/**
 * Mobile's `haptic()` used RN's Vibration API. The web equivalent is the
 * Vibration API, which real phones support in Chrome/Android; desktop and
 * iOS Safari ignore it silently, which is the correct degradation.
 */
const HAPTIC_PATTERNS = {
  tap: 10,
  select: 12,
  scan: 18,
  success: [0, 14, 60, 22],
  warning: [0, 20, 40, 20, 40, 20],
} as const;

export type HapticEvent = keyof typeof HAPTIC_PATTERNS;

export function haptic(event: HapticEvent): void {
  try {
    navigator.vibrate?.(HAPTIC_PATTERNS[event] as number | number[]);
  } catch {
    // A haptic failing is never a reason to interrupt a payment flow.
  }
}
