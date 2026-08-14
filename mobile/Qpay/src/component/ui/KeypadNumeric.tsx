import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { borderWidth, typography } from '../../theme/theme';
import { Icon } from '../icons/Icon';
import { PressableScale } from '../motion/PressableScale';
import { haptic } from '../motion/haptics';

type Props = {
  value: string;
  onChange: (value: string) => void;
  maxDecimals?: number;
};

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'back'] as const;

/**
 * GPay-style numeric keypad — 3x4 grid, square keys, no radius. Press state
 * inverts the key to filled ink rather than tinting it (§ "Press feedback"),
 * now paired with a `PressableScale` snap and a haptic tick per key — this
 * is a payments app, the keypad is touched more than anything else in it.
 */
export function KeypadNumeric({ value, onChange, maxDecimals = 2 }: Props) {
  const theme = useTheme();

  const handlePress = (key: (typeof KEYS)[number]) => {
    haptic('tap');
    if (key === 'back') {
      onChange(value.slice(0, -1));
      return;
    }
    if (key === '.') {
      if (value.includes('.')) return;
      onChange(value.length ? `${value}.` : '0.');
      return;
    }
    if (value.includes('.')) {
      const decimals = value.split('.')[1] ?? '';
      if (decimals.length >= maxDecimals) return;
    }
    onChange(value === '0' ? key : value + key);
  };

  return (
    <View style={[styles.grid, { borderColor: theme.border }]}>
      {KEYS.map((key) => (
        <PressableScale
          key={key}
          scaleTo={0.94}
          onPress={() => handlePress(key)}
          accessibilityRole="button"
          accessibilityLabel={key === 'back' ? 'Delete' : key === '.' ? 'Decimal point' : key}
          android_ripple={{ color: theme.border }}
          style={({ pressed }) => [
            styles.key,
            {
              borderColor: theme.border,
              backgroundColor: pressed ? theme.ink : theme.paper,
            },
          ]}
        >
          {({ pressed }) =>
            key === 'back' ? (
              <Icon name="backspace" size={22} color={pressed ? theme.paper : theme.ink} />
            ) : (
              <Text style={[typography.title, { color: pressed ? theme.paper : theme.ink }]}>
                {key}
              </Text>
            )
          }
        </PressableScale>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    borderTopWidth: borderWidth,
    borderLeftWidth: borderWidth,
  },
  key: {
    width: '33.333%',
    minHeight: 64,
    alignItems: 'center',
    justifyContent: 'center',
    borderRightWidth: borderWidth,
    borderBottomWidth: borderWidth,
  },
});
