import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { spacing, typography } from '../../theme/theme';
import { Avatar } from './Avatar';
import { PressableScale } from '../motion/PressableScale';

type Props = {
  name: string;
  onPress: () => void;
  subtitle?: string;
};

/** Avatar above a name — used in the horizontal "people" row, now with a press spring. */
export function ContactChip({ name, onPress, subtitle }: Props) {
  const theme = useTheme();

  return (
    <PressableScale onPress={onPress} accessibilityRole="button" accessibilityLabel={name} style={styles.chip}>
      {({ pressed }) => (
        <View style={styles.inner}>
          <Avatar name={name} size={56} inverted={pressed} />
          <Text style={[typography.label, { color: theme.ink }]} numberOfLines={1}>
            {name}
          </Text>
          {subtitle ? (
            <Text style={[typography.micro, { color: theme.muted }]} numberOfLines={1}>
              {subtitle.toUpperCase()}
            </Text>
          ) : null}
        </View>
      )}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  chip: { width: 72 },
  inner: { alignItems: 'center', gap: spacing.xs },
});
