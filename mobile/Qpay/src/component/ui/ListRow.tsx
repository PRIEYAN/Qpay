import React, { useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { radii, spacing, typography } from '../../theme/theme';
import { Avatar } from './Avatar';
import { PressableScale } from '../motion/PressableScale';
import { SlideIn } from '../motion/SlideIn';

type Props = {
  title: string;
  subtitle?: string;
  /** Signed amount string, e.g. "-18.46". Sign carries the direction, not color. */
  value?: string;
  valueSuffix?: string;
  meta?: React.ReactNode;
  onPress?: () => void;
  showAvatar?: boolean;
  /**
   * Stagger this row's mount by `index` — pass the row's position in its
   * list (e.g. from `.map`) to have a list cascade in rather than pop.
   * Omit for rows that shouldn't animate on mount (e.g. inside a virtualized
   * list, or when the list itself already staggers via `Stagger`).
   */
  index?: number;
};

/**
 * Transaction / directory row. Direction is expressed by the +/- sign and the
 * subtitle word, never by red/green — the palette has no room for either (§3.1).
 *
 * Press feedback is a full ink/paper inversion of the row (not an opacity
 * tint), matching Card/Button, now with a `PressableScale` spring on top —
 * the avatar flips to its `inverted` treatment so it still reads against
 * the filled background.
 */
export function ListRow({
  title,
  subtitle,
  value,
  valueSuffix,
  meta,
  onPress,
  showAvatar = true,
  index,
}: Props) {
  const theme = useTheme();
  const mountOnce = useRef(index).current;

  const renderContent = (pressed: boolean) => {
    const fg = pressed ? theme.paper : theme.ink;
    const mutedFg = pressed ? theme.paper : theme.muted;

    return (
      <View
        style={[
          styles.row,
          { borderRadius: radii.sm },
          pressed && { backgroundColor: theme.ink },
        ]}
      >
        {showAvatar ? <Avatar name={title} size={40} inverted={pressed} /> : null}

        <View style={styles.text}>
          <Text style={[typography.bodyMedium, { color: fg }]} numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={[typography.label, { color: mutedFg }]} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
          {meta}
        </View>

        {value ? (
          <View style={styles.valueBlock}>
            <Text style={[typography.bodyMedium, { color: fg }]}>{value}</Text>
            {valueSuffix ? <Text style={[typography.micro, { color: mutedFg }]}>{valueSuffix}</Text> : null}
          </View>
        ) : null}
      </View>
    );
  };

  const content = !onPress ? (
    renderContent(false)
  ) : (
    <PressableScale onPress={onPress} accessibilityRole="button">
      {({ pressed }) => renderContent(pressed)}
    </PressableScale>
  );

  if (mountOnce === undefined) return content;
  return (
    <SlideIn delay={mountOnce * 40} distance={10}>
      {content}
    </SlideIn>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  text: { flex: 1, gap: 2 },
  valueBlock: { alignItems: 'flex-end', gap: 2 },
});
