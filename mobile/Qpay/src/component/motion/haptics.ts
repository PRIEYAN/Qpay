import { Platform, Vibration } from 'react-native';

/**
 * Thin wrapper around RN's built-in `Vibration` API — the only haptics
 * primitive available without adding a native dependency (no
 * react-native-haptic-feedback / Reanimated here, per the brief). Android
 * respects the millisecond pattern; iOS collapses any call to a single
 * system "tick" regardless of the numbers given, so patterns are tuned for
 * Android and degrade gracefully (but harmlessly) on iOS.
 *
 * Kept deliberately tiny and named by *event*, not by raw pattern, so every
 * call site reads as intent ("this is what a successful payment feels
 * like") rather than a magic array of milliseconds.
 */
const PATTERNS = {
  /** Keypad digit press. */
  tap: 10,
  /** Selection change — segmented control, tab switch, choosing a contact. */
  select: 12,
  /** A QR/scan target was captured. */
  scan: 18,
  /** Payment/transaction completed successfully. */
  success: [0, 14, 60, 22],
  /** Validation failure / blocking error. */
  warning: [0, 20, 40, 20, 40, 20],
} as const;

export type HapticEvent = keyof typeof PATTERNS;

/** Fire a short vibration for `event`. Best-effort — never throws. */
export function haptic(event: HapticEvent): void {
  if (Platform.OS !== 'android' && Platform.OS !== 'ios') return;
  try {
    Vibration.vibrate(PATTERNS[event] as number | number[]);
  } catch {
    // A haptic failing is never a reason to interrupt a payment flow.
  }
}
