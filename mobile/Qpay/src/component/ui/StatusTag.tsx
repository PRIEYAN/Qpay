import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { borderWidth, radii, spacing, typography } from '../../theme/theme';

type Tone = 'neutral' | 'success' | 'danger';

type Props = {
  label: string;
  /** `solid` reads as "settled/final", `outline` as "in progress". */
  emphasis?: 'solid' | 'outline';
  /**
   * Optional semantic tone — `success`/`danger` reach for the theme's
   * money-direction colors instead of ink. Defaults to `neutral`, which
   * renders exactly as before (no color, just weight/shape). Only use
   * `success`/`danger` where the state genuinely is a completed payment or
   * a failure — never as a generic "make this tag pop" shortcut.
   */
  tone?: Tone;
};

/**
 * Status chip. `tone="neutral"` (the default) still has no color — fill vs.
 * outline and the word itself carry the state (§3.1). `success`/`danger`
 * are additive: the two places a payments app legitimately needs color to
 * mean something (settled/failed), not a decoration.
 */
export function StatusTag({ label, emphasis = 'outline', tone = 'neutral' }: Props) {
  const theme = useTheme();
  const solid = emphasis === 'solid';
  const tint = tone === 'success' ? theme.success : tone === 'danger' ? theme.danger : theme.ink;

  return (
    <View
      style={[
        styles.base,
        { backgroundColor: solid ? tint : 'transparent', borderColor: tint },
      ]}
    >
      <Text style={[typography.micro, { color: solid ? theme.paper : tint }]}>
        {label.toUpperCase()}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radii.pill,
    borderWidth,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    alignSelf: 'flex-start',
  },
});
