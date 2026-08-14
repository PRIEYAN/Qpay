import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { spacing, typography } from '../../theme/theme';
import { Icon, IconName } from '../icons/Icon';
import { SlideIn } from '../motion/SlideIn';

type Props = {
  icon?: IconName;
  title: string;
  body?: string;
  action?: React.ReactNode;
};

/** Centered placeholder for empty lists/screens — icon, title, body, optional action. Fades + rises in gently. */
export function EmptyState({ icon, title, body, action }: Props) {
  const theme = useTheme();

  return (
    <SlideIn duration={360} distance={10} style={styles.root}>
      {icon ? (
        <View style={styles.icon}>
          <Icon name={icon} size={32} color={theme.muted} />
        </View>
      ) : null}
      <Text style={[typography.subtitle, styles.title, { color: theme.ink }]}>{title}</Text>
      {body ? (
        <Text style={[typography.body, styles.body, { color: theme.muted }]}>{body}</Text>
      ) : null}
      {action ? <View style={styles.action}>{action}</View> : null}
    </SlideIn>
  );
}

const styles = StyleSheet.create({
  root: { alignItems: 'center', paddingVertical: spacing.xxl, paddingHorizontal: spacing.lg },
  icon: { marginBottom: spacing.md },
  title: { textAlign: 'center' },
  body: { textAlign: 'center', marginTop: spacing.xs },
  action: { marginTop: spacing.lg, alignSelf: 'stretch' },
});
