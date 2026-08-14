import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { accent, radii, spacing, typography } from '../../theme/theme';
import { Button, EmptyState, Icon } from '../../component/ui';
import { FadeIn, PressableScale, haptic } from '../../component/motion';
import { useWallet } from '../../web3';
import { isWalletConnectConfigured, walletConnectSetupMessage } from '../../config/network';
import { NotConfiguredError } from '../../services/qpayService';

type Props = {
  /** The real screen content — rendered once a wallet is connected and Qpay is configured. */
  children: React.ReactNode;
  /**
   * Pass the data hook's `error` (e.g. `useQpayContext().error`). When it's a
   * setup problem this renders an honest "not configured" state instead of
   * letting the screen fall through to a blank/broken empty list.
   */
  error?: Error | null;
};

/**
 * `assertConfigured()` (src/config/network.ts) throws a plain `Error` that
 * names every missing field in one message — it predates/overlaps with the
 * dedicated `NotConfiguredError` class in services/errors.ts, which only
 * some call sites use. Matching on both the class *and* the message keeps
 * this gate correct against either shape without editing the service layer.
 */
function isSetupError(error: Error | null | undefined): boolean {
  if (!error) return false;
  if (error instanceof NotConfiguredError) return true;
  return /not (fully )?configured/i.test(error.message);
}

/**
 * Shared wallet/config gate for every data-driven screen. One import
 * instead of duplicating the same three checks in ten files:
 *
 *   1. Contracts/WalletConnect not configured — the most fundamental
 *      blocker (nothing will ever load, connected or not), so it takes
 *      priority and gets an explicit "setup isn't finished" state rather
 *      than being disguised as an empty wallet.
 *   2. No wallet connected — a designed prompt with a real "Connect
 *      wallet" action, not an error screen.
 *   3. Connected, but on the wrong chain — a non-blocking banner (reads
 *      already work off a fixed Coston2 RPC regardless of the connected
 *      wallet's chain; only sends need the switch) with a "Switch to
 *      Coston2" action, rendered above the screen's real content.
 */
export function ConnectionGate({ children, error }: Props) {
  const wallet = useWallet();

  if (isSetupError(error)) {
    return <NotConfiguredState error={error as Error} />;
  }

  // Contracts can be fully configured while the wallet layer isn't: reads work
  // off the read-only Coston2 provider, but there is no session to open without
  // a project id. Say that here rather than showing a "Connect wallet" button
  // whose only possible outcome is an error after the tap.
  if (!isWalletConnectConfigured()) {
    return <NotConfiguredState error={new Error(walletConnectSetupMessage())} />;
  }

  if (!wallet.isConnected) {
    return <NotConnectedState />;
  }

  return (
    <>
      {!wallet.isCorrectChain ? <WrongNetworkBanner /> : null}
      {children}
    </>
  );
}

function NotConfiguredState({ error }: { error: Error }) {
  const theme = useTheme();
  // The first line is the human summary ("Qpay is not fully configured
  // yet."); the rest is the per-field checklist — shown verbatim since it
  // already names exactly what's missing and where to fix it.
  const [summary, ...rest] = error.message.split('\n');
  const detail = rest.join('\n').trim();

  return (
    <FadeIn style={styles.fill}>
      <View style={styles.centered}>
        <View style={[styles.iconRing, { borderColor: theme.danger }]}>
          <Icon name="alert" size={30} color={theme.danger} />
        </View>
        <Text style={[typography.subtitle, styles.title, { color: theme.ink }]}>
          Setup isn't finished yet
        </Text>
        <Text style={[typography.body, styles.body, { color: theme.muted }]}>{summary}</Text>
        {detail ? (
          <View style={[styles.detailBlock, { borderColor: theme.border }]}>
            <Text style={[typography.label, styles.detailText, { color: theme.muted }]}>{detail}</Text>
          </View>
        ) : null}
      </View>
    </FadeIn>
  );
}

function NotConnectedState() {
  const theme = useTheme();
  const wallet = useWallet();
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConnect = async () => {
    setError(null);
    setConnecting(true);
    haptic('select');
    try {
      await wallet.connect();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not connect a wallet.');
    } finally {
      setConnecting(false);
    }
  };

  return (
    <FadeIn style={styles.fill}>
      <EmptyState
        icon="wallet"
        title="Connect your wallet"
        body="Qpay reads live balances and activity from Flare Coston2 — connect a wallet to continue."
        action={
          <Button
            label={connecting ? 'Connecting…' : 'Connect wallet'}
            onPress={handleConnect}
            loading={connecting}
          />
        }
      />
      {error ? (
        <View style={[styles.notice, { borderColor: theme.danger }]}>
          <Icon name="alert" size={16} color={theme.danger} />
          <Text style={[typography.label, styles.noticeText, { color: theme.ink }]}>{error}</Text>
        </View>
      ) : null}
    </FadeIn>
  );
}

function WrongNetworkBanner() {
  const theme = useTheme();
  const wallet = useWallet();
  const [switching, setSwitching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSwitch = async () => {
    setError(null);
    setSwitching(true);
    haptic('select');
    try {
      await wallet.switchToCoston2();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not switch networks.');
    } finally {
      setSwitching(false);
    }
  };

  return (
    <FadeIn style={[styles.banner, { borderColor: theme.ink, backgroundColor: theme.surface }]}>
      <View style={styles.bannerRow}>
        <Icon name="alert" size={18} color={theme.ink} />
        <Text style={[typography.label, styles.bannerText, { color: theme.ink }]}>
          Wrong network — switch to Flare Coston2 to send or redeem.
        </Text>
        <PressableScale onPress={handleSwitch} disabled={switching} hitSlop={8}>
          <Text style={[typography.label, styles.bannerAction, { color: accent }]}>
            {switching ? 'Switching…' : 'Switch'}
          </Text>
        </PressableScale>
      </View>
      {error ? (
        <Text style={[typography.micro, styles.bannerError, { color: theme.danger }]}>{error}</Text>
      ) : null}
    </FadeIn>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  centered: { alignItems: 'center', paddingVertical: spacing.xxl, paddingHorizontal: spacing.lg },
  iconRing: {
    width: 64,
    height: 64,
    borderRadius: radii.pill,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  title: { textAlign: 'center' },
  body: { textAlign: 'center', marginTop: spacing.xs, lineHeight: 21 },
  detailBlock: {
    marginTop: spacing.lg,
    borderWidth: 1,
    borderRadius: radii.md,
    padding: spacing.md,
    alignSelf: 'stretch',
  },
  detailText: { lineHeight: 18 },
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderRadius: radii.md,
    padding: spacing.md,
    marginHorizontal: spacing.lg,
  },
  noticeText: { flex: 1 },
  banner: {
    borderWidth: 1,
    borderRadius: radii.md,
    padding: spacing.md,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
  },
  bannerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  bannerText: { flex: 1, lineHeight: 17 },
  bannerAction: { fontWeight: '700' },
  bannerError: { marginTop: spacing.xs },
});
