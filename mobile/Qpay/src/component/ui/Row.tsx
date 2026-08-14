import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { radii, spacing, typography } from '../../theme/theme';
import { Icon } from '../icons/Icon';
import { PressableScale } from '../motion/PressableScale';

type Props = {
  label: string;
  value?: string;
  onPress?: () => void;
};

/** Generic label/value row — e.g. profile detail rows, settings entries. Same press treatment as ListRow. */
export function Row({ label, value, onPress }: Props) {
  const theme = useTheme();

  const renderContent = (pressed: boolean) => (
    <View style={[styles.row, { borderRadius: radii.sm }, pressed && { backgroundColor: theme.ink }]}>
      <Text style={[typography.body, { color: pressed ? theme.paper : theme.ink }]}>{label}</Text>
      <View style={styles.right}>
        {value ? (
          <Text
            style={[typography.bodyMedium, { color: pressed ? theme.paper : theme.muted }]}
            numberOfLines={1}
          >
            {value}
          </Text>
        ) : null}
        {onPress ? <Icon name="chevronRight" size={18} color={pressed ? theme.paper : theme.muted} /> : null}
      </View>
    </View>
  );

  if (!onPress) return renderContent(false);
  return (
    <PressableScale onPress={onPress} accessibilityRole="button">
      {({ pressed }) => renderContent(pressed)}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  right: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
});
