import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Screen } from '../../component/ui/Screen';
import { Card } from '../../component/ui/Card';
import { Button } from '../../component/ui/Button';
import { useTheme } from '../../theme/ThemeProvider';
import { spacing, typography } from '../../theme/theme';
import { AuthStackParamList } from '../../navigation/types';
import { PrimaryAsset, setPrimaryAsset } from '../../services/qpayService';
import { tokenFor } from '../../contracts';

type Props = NativeStackScreenProps<AuthStackParamList, 'PrimaryChainPicker'>;

// plan.md §3 — exactly three choices, equal weight, framed as "what do you want to hold?"
const CHOICES: { asset: PrimaryAsset; label: string; hint: string }[] = [
  { asset: 'FXRP', label: 'XRP', hint: 'Get paid in XRP. Cash out to a real XRP Ledger wallet anytime.' },
  { asset: 'FLR', label: 'Flare', hint: 'Get paid in FLR, native to Flare.' },
  { asset: 'USDT0', label: 'USDT', hint: 'Get paid in USDT0, an ERC-20 stable balance on Flare.' },
];

export default function PrimaryChainPickerScreen({ navigation }: Props) {
  const theme = useTheme();
  const [selected, setSelected] = useState<PrimaryAsset | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirm = async () => {
    if (!selected) return;
    setSaving(true);
    setError(null);
    try {
      await setPrimaryAsset(selected);
    } catch (e) {
      // Without this the button sticks on "Saving…" forever and the failure
      // is an unhandled rejection — the first screen of the app is the worst
      // possible place to swallow an error.
      setError(e instanceof Error ? e.message : 'Could not save your choice.');
      return;
    } finally {
      setSaving(false);
    }
    const parent = navigation.getParent();
    if (parent) {
      parent.navigate('Main' as never);
    } else {
      navigation.navigate('Main' as never);
    }
  };

  return (
    <Screen>
      <Text style={[typography.title, { color: theme.ink }]}>What do you want to hold?</Text>
      <Text style={[typography.body, { color: theme.muted, marginBottom: spacing.lg }]}>
        Every payment you receive converts into this automatically. You can change it later.
      </Text>

      <View style={styles.choices}>
        {CHOICES.map((c) => {
          // An asset with no token address isn't allowlisted on this
          // deployment — setPrimaryAsset would revert. Show it as
          // unavailable rather than letting the tap fail after the fact.
          const available = !!tokenFor(c.asset).address;
          const isSelected = selected === c.asset;
          const fg = isSelected ? theme.paper : available ? theme.ink : theme.muted;

          return (
            <Card
              key={c.asset}
              onPress={available ? () => setSelected(c.asset) : undefined}
              selected={isSelected}
            >
              <Text style={[typography.bodyMedium, { color: fg }]}>{c.label}</Text>
              <Text
                style={[
                  typography.body,
                  styles.hint,
                  { color: isSelected ? theme.paper : theme.muted },
                ]}
              >
                {available ? c.hint : 'Not enabled on this deployment yet.'}
              </Text>
            </Card>
          );
        })}
      </View>

      {error ? (
        <Text style={[typography.label, styles.error, { color: theme.danger }]}>{error}</Text>
      ) : null}

      <View style={styles.footer}>
        <Button label={saving ? 'Saving…' : 'Continue'} onPress={confirm} disabled={!selected || saving} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  choices: { gap: spacing.md },
  hint: { marginTop: spacing.xs },
  error: { marginTop: spacing.md },
  footer: { marginTop: spacing.xl },
});
