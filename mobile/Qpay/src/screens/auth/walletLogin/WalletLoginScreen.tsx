import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Card } from '../../../component/ui/Card';
import { Screen } from '../../../component/ui/Screen';
import { Button } from '../../../component/ui/Button';
import { useTheme } from '../../../theme/ThemeProvider';
import { spacing, typography } from '../../../theme/theme';
import { AuthStackParamList } from '../../../navigation/types';
import { useWallet } from '../../../web3';

type Props = NativeStackScreenProps<AuthStackParamList, 'WalletLogin'>;

/**
 * mobileAppWorkflow.md §2.2 — create (embedded) vs connect (external) get
 * equal visual weight: same card shape, same button size, ordered only by
 * which is more common for a first-time user.
 *
 * "Connect" opens the real WalletConnect session via `useWallet().connect()`.
 * It advances only once a wallet is actually connected — moving on without a
 * session is what made every screen downstream say "connect a wallet to
 * continue" with no way to satisfy it.
 *
 * "Create" is disabled: Qpay has no embedded-wallet provider wired up (AppKit
 * is configured connect-only, with socials/email off), and a button that
 * silently connects an external wallet instead would be lying about what it
 * did with your keys.
 */
export default function WalletLoginScreen({ navigation }: Props) {
  const theme = useTheme();
  const wallet = useWallet();
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Covers both a fresh connect and an AppKit session restored from storage on
  // a later launch — either way, once there's a wallet this screen is done.
  useEffect(() => {
    if (wallet.isConnected) {
      navigation.replace('PrimaryChainPicker');
    }
  }, [wallet.isConnected, navigation]);

  const handleConnect = async () => {
    setError(null);
    setConnecting(true);
    try {
      await wallet.connect();
      // Navigation is handled by the effect above, so a session restored while
      // the modal was open lands in exactly one place.
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not connect a wallet.');
    } finally {
      setConnecting(false);
    }
  };

  return (
    <Screen>
      <Text style={[typography.title, { color: theme.ink, marginBottom: spacing.xs }]}>Welcome to Qpay</Text>
      <Text style={[typography.body, { color: theme.muted, marginBottom: spacing.xl }]}>
        Create a wallet or connect one you already have. Either way, you're in control of it.
      </Text>

      <View style={styles.stack}>
        <Card variant="outlined" style={styles.optionCard}>
          <Text style={[typography.bodyMedium, { color: theme.ink }]}>Already have a wallet</Text>
          <Text style={[typography.label, styles.optionBody, { color: theme.muted }]}>
            Connect an existing wallet and keep using the keys you already control.
          </Text>
          <Button
            label={connecting ? 'Connecting…' : 'Connect wallet'}
            onPress={handleConnect}
            loading={connecting}
            disabled={connecting}
            style={styles.optionButton}
          />
        </Card>

        <Card variant="outlined" style={styles.optionCard}>
          <Text style={[typography.bodyMedium, { color: theme.muted }]}>New here</Text>
          <Text style={[typography.label, styles.optionBody, { color: theme.muted }]}>
            On-device wallet creation isn't wired up yet. Install a wallet app (MetaMask, Rainbow,
            Trust) and use Connect above — Qpay never holds your keys either way.
          </Text>
          <Button
            label="Create wallet"
            variant="secondary"
            onPress={() => {}}
            disabled
            style={styles.optionButton}
          />
        </Card>
      </View>

      {error ? (
        <Text style={[typography.label, styles.error, { color: theme.danger }]}>{error}</Text>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  stack: { gap: spacing.md },
  optionCard: {},
  optionBody: { marginTop: spacing.xs, marginBottom: spacing.md, lineHeight: 17 },
  optionButton: {},
  error: { marginTop: spacing.lg },
});
