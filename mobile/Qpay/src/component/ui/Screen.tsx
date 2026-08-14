import React from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeProvider';
import { borderWidth, spacing, typography } from '../../theme/theme';
import { Icon } from '../icons/Icon';
import { PressableScale } from '../motion/PressableScale';

type Props = {
  children: React.ReactNode;
  /** Rendered in the app bar. Omit for screens whose first element is their own title. */
  title?: string;
  onBack?: () => void;
  scroll?: boolean;
  /** Pinned to the bottom, outside the scroll area — for a screen's single primary action. */
  footer?: React.ReactNode;
  style?: ViewStyle;
};

export function Screen({ children, title, onBack, scroll = true, footer, style }: Props) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const Wrapper = scroll ? ScrollView : View;

  return (
    <View style={[styles.root, { backgroundColor: theme.paper, paddingTop: insets.top }]}>
      {(title || onBack) && (
        <View style={[styles.appBar, { borderBottomColor: theme.border }]}>
          {onBack ? (
            <PressableScale
              onPress={onBack}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Back"
            >
              <Icon name="back" size={22} color={theme.ink} />
            </PressableScale>
          ) : null}
          {title ? (
            <Text style={[typography.caption, { color: theme.ink }]}>{title.toUpperCase()}</Text>
          ) : null}
        </View>
      )}

      <KeyboardAvoidingView
        style={styles.body}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={insets.top}
      >
        <Wrapper
          style={[styles.body, style]}
          contentContainerStyle={scroll ? styles.scrollContent : undefined}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </Wrapper>

        {footer ? (
          <View
            style={[
              styles.footer,
              { borderTopColor: theme.border, paddingBottom: Math.max(insets.bottom, spacing.md) },
            ]}
          >
            {footer}
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  appBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: borderWidth,
  },
  body: { flex: 1 },
  scrollContent: { padding: spacing.lg, paddingBottom: spacing.xxl },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: borderWidth,
  },
});
