import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import QRCodeSvg from 'react-native-qrcode-svg';
import { borderWidth, radius } from '../../theme/theme';

type Props = {
  value: string;
  size?: number;
  /** Square quiet-zone border around the code. Default true. */
  quietZone?: boolean;
  style?: ViewStyle;
  testID?: string;
};

const DEFAULT_SIZE = 220;
const QUIET_ZONE = 16;

/**
 * Qpay QR generator (mobileAppWorkflow.md §3.4).
 *
 * Deliberately does NOT use `useTheme()` / the ink-paper tokens: a QR must
 * stay literally black-on-white to remain scannable, in both light and dark
 * mode, so the colors here are hardcoded rather than theme-driven. No
 * colored frame, no logo overlay.
 */
export function QpayQrCode({ value, size = DEFAULT_SIZE, quietZone = true, style, testID }: Props) {
  return (
    <View
      style={[styles.frame, quietZone && styles.quietZone, style]}
      testID={testID}
    >
      <QRCodeSvg value={value} size={size} color="#000000" backgroundColor="#FFFFFF" />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    backgroundColor: '#FFFFFF',
    alignSelf: 'flex-start',
    borderRadius: radius,
  },
  quietZone: {
    padding: QUIET_ZONE,
    borderWidth,
    borderColor: '#000000',
  },
});
