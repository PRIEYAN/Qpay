import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { spacing, typography } from '../../theme/theme';

type Props = {
  children: string;
  /** Optional right-aligned affordance, e.g. a "See all" text action. */
  action?: React.ReactNode;
};

/** All-caps, widely tracked, muted — the most direct GPay reference (§3.3). */
export function SectionLabel({ children, action }: Props) {
  const theme = useTheme();
  return (
    <View style={styles.row}>
      <Text style={[typography.caption, { color: theme.muted }]}>{children.toUpperCase()}</Text>
      {action}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
});
