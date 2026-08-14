import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { borderWidth, radii, spacing, typography } from '../../theme/theme';
import { Icon, IconName } from '../icons/Icon';
import { PressableScale } from '../motion/PressableScale';

type Props = {
  icon: IconName;
  label: string;
  onPress: () => void;
};

/** Icon-above-label tile for the home action row (Send / Request / Scan / …), now with a press spring. */
export function ActionTile({ icon, label, onPress }: Props) {
  const theme = useTheme();

  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.tile,
        {
          borderColor: theme.ink,
          backgroundColor: pressed ? theme.ink : theme.paper,
        },
      ]}
    >
      {({ pressed }) => (
        <View style={styles.inner}>
          <Icon name={icon} size={24} color={pressed ? theme.paper : theme.ink} />
          <Text
            style={[typography.label, styles.label, { color: pressed ? theme.paper : theme.ink }]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.85}
          >
            {label}
          </Text>
        </View>
      )}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  tile: {
    borderRadius: radii.md,
    borderWidth,
    flex: 1,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  inner: { alignItems: 'center', gap: spacing.sm },
  label: { letterSpacing: 0.1 },
});
