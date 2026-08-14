import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeProvider';
import { borderWidth, radius, spacing, typography } from '../../theme/theme';
import { Icon, IconName } from '../icons/Icon';
import { RootStackParamList } from '../../navigation/types';

const LABELS: Record<string, string> = {
  Dashboard: 'Home',
  Chains: 'Chains',
  Logs: 'Activity',
  Profile: 'Profile',
};

const ICONS: Record<string, IconName> = {
  Dashboard: 'home',
  Chains: 'chains',
  Logs: 'activity',
  Profile: 'profile',
};

/**
 * Google-Pay-shaped bottom bar rendered in the monochrome system: white bar,
 * 1px top hairline, square hit targets. Active tab is shown by weight and
 * fill alone (bold ink icon/label) — never a colored dot or underline. A
 * square center "Scan" affordance sits between the two halves of the tab
 * set, mirroring GPay's prominent scan action, and pushes straight to the
 * root-level QrScanner route rather than being a tab of its own.
 */
export function BottomNav({ state, navigation }: BottomTabBarProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const rootNavigation = navigation.getParent<NativeStackNavigationProp<RootStackParamList>>();

  const routes = state.routes;
  const mid = Math.ceil(routes.length / 2);

  const renderTab = (route: (typeof routes)[number], index: number) => {
    const focused = state.index === index;
    const icon = ICONS[route.name] ?? 'home';

    return (
      <Pressable
        key={route.key}
        onPress={() => navigation.navigate(route.name)}
        accessibilityRole="button"
        accessibilityState={{ selected: focused }}
        style={styles.tab}
      >
        <Icon
          name={icon}
          size={24}
          color={focused ? theme.ink : theme.muted}
          strokeWidth={focused ? 2.25 : 1.75}
        />
        <Text
          style={[
            typography.micro,
            styles.label,
            { color: focused ? theme.ink : theme.muted },
          ]}
        >
          {(LABELS[route.name] ?? route.name).toUpperCase()}
        </Text>
      </Pressable>
    );
  };

  return (
    <View
      style={[
        styles.bar,
        {
          backgroundColor: theme.paper,
          borderTopColor: theme.border,
          paddingBottom: Math.max(insets.bottom, spacing.sm),
        },
      ]}
    >
      {routes.slice(0, mid).map(renderTab)}

      <Pressable
        onPress={() => rootNavigation?.navigate('QrScanner')}
        accessibilityRole="button"
        accessibilityLabel="Scan"
        style={({ pressed }) => [
          styles.scan,
          {
            backgroundColor: pressed ? theme.paper : theme.ink,
            borderColor: theme.ink,
          },
        ]}
      >
        {({ pressed }) => <Icon name="scan" size={22} color={pressed ? theme.ink : theme.paper} />}
      </Pressable>

      {routes.slice(mid).map(renderTab)}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderTopWidth: borderWidth,
    paddingTop: spacing.sm,
  },
  tab: { flex: 1, alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.xs },
  label: { letterSpacing: 1 },
  scan: {
    width: 48,
    height: 48,
    borderRadius: radius,
    borderWidth,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -10,
  },
});
