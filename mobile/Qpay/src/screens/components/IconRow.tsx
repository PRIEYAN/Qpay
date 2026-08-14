import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { radii, spacing, typography } from '../../theme/theme';
import { Icon, IconName } from '../../component/ui';
import { PressableScale } from '../../component/motion';

type Props = {
  icon: IconName;
  label: string;
  value?: string;
  onPress?: () => void;
};

/**
 * Same label/value row as `component/ui/Row`, with a leading icon slot —
 * Row itself has no icon prop, and this stays in `src/screens/` (screens'
 * own territory) rather than reaching into `component/ui` to add one.
 * Shares Row's ink/paper press inversion so the two sit naturally in the
 * same list.
 */
export function IconRow({ icon, label, value, onPress }: Props) {
  const theme = useTheme();

  const renderContent = (pressed: boolean) => (
    <View style={[styles.row, { borderRadius: radii.sm }, pressed && { backgroundColor: theme.ink }]}>
      <Icon name={icon} size={18} color={pressed ? theme.paper : theme.muted} />
      <Text style={[typography.body, styles.label, { color: pressed ? theme.paper : theme.ink }]}>{label}</Text>
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
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  label: { flex: 1 },
  right: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
});
