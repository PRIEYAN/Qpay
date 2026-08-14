import React from 'react';
import { View, ViewStyle } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { borderWidth } from '../../theme/theme';

/** 1px hairline rule — never a soft gray bar (§3.2). */
export function Divider({ style }: { style?: ViewStyle }) {
  const theme = useTheme();
  return <View style={[{ height: borderWidth, backgroundColor: theme.border }, style]} />;
}
