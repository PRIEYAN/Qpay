import React, { useState } from 'react';
import { Clipboard, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Button, Card, Divider, Icon, Screen, SectionLabel, Sheet, Toast } from '../component/ui';
import { FadeIn, Stagger, haptic } from '../component/motion';
import { useTheme } from '../theme/ThemeProvider';
import { spacing, typography } from '../theme/theme';
import { RootStackParamList } from '../navigation/types';
import { useQpayContext } from '../context/QpayProvider';
import { CHAIN_ASSET_META, resetDemoData } from '../services/qpayService';
import { truncateAddress } from '../utils';
import { useWallet } from '../web3';
import { isConfigured, isWalletConnectConfigured } from '../config/network';
import { IconRow } from './components/IconRow';

type Props = NativeStackScreenProps<RootStackParamList, 'Settings'>;

/**
 * New screen (mobileAppWorkflow.md §2.10 folds settings into Profile; this
 * pulls the account-management detail out to its own screen per the nav
 * contract). Honest about setup state: Qpay now reads/writes real Flare
 * Coston2 data, but the contracts and WalletConnect project id may not be
 * configured yet — this screen says so plainly rather than pretending.
 */
export default function SettingsScreen({ navigation }: Props) {
  const theme = useTheme();
  const { snapshot } = useQpayContext();
  const wallet = useWallet();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [toast, setToast] = useState(false);
  const [walletBusy, setWalletBusy] = useState(false);

  const profile = snapshot?.profile;
  const contractsReady = isConfigured();
  const walletConnectReady = isWalletConnectConfigured();

  const copy = (value: string) => {
    haptic('select');
    Clipboard.setString(value);
    setToast(true);
    setTimeout(() => setToast(false), 1500);
  };

  const doReset = async () => {
    setResetting(true);
    await resetDemoData();
    haptic('select');
    setResetting(false);
    setConfirmOpen(false);
  };

  const runWalletAction = async (action: () => Promise<void>) => {
    setWalletBusy(true);
    haptic('select');
    try {
      await action();
    } catch {
      // Connect/switch/disconnect each surface their own error via
      // wallet.error or ConnectionGate elsewhere — Settings just needs to
      // stop spinning, not duplicate that message.
    } finally {
      setWalletBusy(false);
    }
  };

  const walletStatusLabel = wallet.isConnected
    ? wallet.isCorrectChain
      ? 'Connected · Coston2'
      : 'Connected · wrong network'
    : 'Not connected';

  return (
    <Screen title="Settings" onBack={() => navigation.goBack()}>
      <SectionLabel>Connection</SectionLabel>
      <FadeIn>
        <Card padded={false} style={styles.card}>
          <IconRow icon="wallet" label="Wallet" value={walletStatusLabel} />
          {wallet.isConnected && wallet.address ? (
            <>
              <Divider />
              <IconRow
                icon="copy"
                label="Address"
                value={truncateAddress(wallet.address)}
                onPress={() => copy(wallet.address as string)}
              />
            </>
          ) : null}
          {wallet.isConnected && !wallet.isCorrectChain ? (
            <>
              <Divider />
              <IconRow
                icon="refresh"
                label={walletBusy ? 'Switching…' : 'Switch to Coston2'}
                onPress={() => runWalletAction(wallet.switchToCoston2)}
              />
            </>
          ) : null}
          <Divider />
          {wallet.isConnected ? (
            <IconRow
              icon="logout"
              label={walletBusy ? 'Disconnecting…' : 'Disconnect'}
              onPress={() => runWalletAction(wallet.disconnect)}
            />
          ) : (
            <IconRow
              icon="chevronRight"
              label={walletBusy ? 'Connecting…' : 'Connect wallet'}
              onPress={() => runWalletAction(wallet.connect)}
            />
          )}
        </Card>
      </FadeIn>

      <SectionLabel>Appearance</SectionLabel>
      <Card padded={false} style={styles.card}>
        <IconRow icon="settings" label="Theme" value="Follows system" />
      </Card>

      <SectionLabel>Wallet</SectionLabel>
      <Card padded={false} style={styles.card}>
        <Stagger interval={35} direction="left" distance={8}>
          <IconRow
            icon="wallet"
            label="Primary asset"
            value={profile ? CHAIN_ASSET_META[profile.primaryAsset].label : '—'}
          />
          <Divider />
          <IconRow
            icon="bank"
            label="XRPL address"
            value={profile ? truncateAddress(profile.xrplAddress) : '—'}
            onPress={profile ? () => copy(profile.xrplAddress) : undefined}
          />
          <Divider />
          <IconRow
            icon="chains"
            label="Flare wallet address"
            value={profile ? truncateAddress(profile.walletAddress) : '—'}
            onPress={profile ? () => copy(profile.walletAddress) : undefined}
          />
        </Stagger>
      </Card>

      <SectionLabel>Local data</SectionLabel>
      <Card padded={false} style={styles.card}>
        <IconRow icon="refresh" label="Reset local data" onPress={() => setConfirmOpen(true)} />
      </Card>

      <SectionLabel>About</SectionLabel>
      <Card variant="flat" style={styles.aboutCard}>
        <View style={styles.statusRow}>
          <Icon
            name={contractsReady ? 'check' : 'alert'}
            size={16}
            color={contractsReady ? theme.success : theme.danger}
          />
          <Text style={[typography.body, styles.statusText, { color: theme.ink }]}>
            {contractsReady
              ? "Qpay's contracts are deployed and configured on Flare Coston2."
              : "Qpay's contracts aren't deployed yet — balances and activity can't load until they are."}
          </Text>
        </View>
        <View style={styles.statusRow}>
          <Icon
            name={walletConnectReady ? 'check' : 'alert'}
            size={16}
            color={walletConnectReady ? theme.success : theme.danger}
          />
          <Text style={[typography.body, styles.statusText, { color: theme.ink }]}>
            {walletConnectReady
              ? 'WalletConnect is configured — connecting a wallet opens a real session.'
              : 'WalletConnect has no project id yet — connecting a wallet will fail until one is set.'}
          </Text>
        </View>
        <Text style={[typography.body, styles.aboutText, { color: theme.muted }]}>
          Contacts, businesses, and payment requests are stored only on this device. No balance or
          transaction shown here is invented — once the contracts above are deployed, everything on
          this screen reads straight from Flare Coston2.
        </Text>
      </Card>

      <Sheet visible={confirmOpen} onClose={() => setConfirmOpen(false)} title="Reset local data">
        <Text style={[typography.body, styles.sheetBody, { color: theme.ink }]}>
          This clears every locally-saved contact, business, payment request, and cached activity on
          this device. It never touches the chain — nothing on Coston2 is affected. It cannot be
          undone.
        </Text>
        <View style={styles.sheetActions}>
          <Button label={resetting ? 'Resetting…' : 'Reset'} onPress={doReset} loading={resetting} />
          <Button
            label="Cancel"
            variant="ghost"
            onPress={() => setConfirmOpen(false)}
            disabled={resetting}
          />
        </View>
      </Sheet>

      <Toast message="Copied" visible={toast} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { paddingHorizontal: spacing.md, marginBottom: spacing.xl },
  aboutCard: { marginBottom: spacing.xl, gap: spacing.sm },
  statusRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  statusText: { flex: 1, lineHeight: 20 },
  aboutText: { lineHeight: 21, marginTop: spacing.xs },
  sheetBody: { lineHeight: 21, marginBottom: spacing.lg },
  sheetActions: { gap: spacing.sm, marginBottom: spacing.md },
});
