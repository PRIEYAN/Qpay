import React, { useState } from 'react';
import { Dimensions, FlatList, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Screen } from '../../../component/ui/Screen';
import { Button } from '../../../component/ui/Button';
import { useTheme } from '../../../theme/ThemeProvider';
import { spacing, typography } from '../../../theme/theme';
import { AuthStackParamList } from '../../../navigation/types';

type Props = NativeStackScreenProps<AuthStackParamList, 'OnBoarding'>;

const { width } = Dimensions.get('window');

// mobileAppWorkflow.md §2.1 — sell the outcome, never say "bridge"/"gas"/"relayer" here.
const PANELS = [
  { title: 'Pay in what you hold', body: 'Send from the balance you already have — no swap screen, no chain to pick.' },
  { title: 'Get paid in what you want', body: 'Every payment you receive lands as the asset you chose, automatically.' },
  { title: 'Instant, always', body: 'Payments settle in about two seconds. Cashing out is the only slow step, and it is optional.' },
];

export default function OnBoardingScreen({ navigation }: Props) {
  const theme = useTheme();
  const [index, setIndex] = useState(0);

  return (
    <Screen scroll={false} style={styles.screen}>
      <FlatList
        data={PANELS}
        keyExtractor={(item) => item.title}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
        renderItem={({ item }) => (
          <View style={[styles.panel, { width }]}>
            <Text style={[typography.title, { color: theme.ink, marginBottom: spacing.sm }]}>{item.title}</Text>
            <Text style={[typography.body, { color: theme.muted }]}>{item.body}</Text>
          </View>
        )}
      />
      <View style={styles.dots}>
        {PANELS.map((p, i) => (
          <View
            key={p.title}
            style={[styles.dot, { backgroundColor: i === index ? theme.ink : theme.border }]}
          />
        ))}
      </View>
      <View style={styles.footer}>
        <Button
          label={index === PANELS.length - 1 ? 'Get started' : 'Skip'}
          onPress={() => navigation.replace('WalletLogin')}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { paddingTop: spacing.xxl },
  panel: { padding: spacing.lg, justifyContent: 'center', flex: 1 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: spacing.xs, marginBottom: spacing.lg },
  dot: { width: 8, height: 8 },
  footer: { padding: spacing.lg },
});
