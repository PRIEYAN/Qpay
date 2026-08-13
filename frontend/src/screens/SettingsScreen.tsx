import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Button,
  Card,
  Divider,
  Row,
  Screen,
  SectionLabel,
  SegmentedControl,
  Sheet,
  StatusTag,
  Toast,
  useCopy,
} from '../components/ui';
import { FadeIn, Stagger, haptic } from '../components/motion';
import { useQpayContext } from '../context/QpayProvider';
import { CHAIN_ASSET_META, resetDemoData } from '../services/qpayService';
import { truncateAddress } from '../utils';
import { useWallet } from '../web3';
import { COSTON2, isConfigured } from '../config/network';
import { useTheme } from '../theme/ThemeProvider';
import type { ThemeMode } from '../theme/theme';

/**
 * Account management, wallet connection, appearance, and local-data reset.
 * Honest about setup state: Qpay reads and writes real Flare Coston2 data,
 * but the contracts may not be configured on a given build — this screen
 * says so plainly rather than pretending.
 */
export default function SettingsScreen() {
  const navigate = useNavigate();
  const { snapshot } = useQpayContext();
  const wallet = useWallet();
  const { mode, setMode } = useTheme();
  const [copied, copy] = useCopy();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [walletBusy, setWalletBusy] = useState(false);

  const profile = snapshot?.profile;
  const contractsReady = isConfigured();

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
      // Connect/switch/disconnect each surface their own error through
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
    <Screen title="Settings" onBack={() => navigate(-1)}>
      <div className="stack stack--lg">
        <section>
          <SectionLabel>Connection</SectionLabel>
          <FadeIn>
            <Card padded={false} style={{ paddingInline: 'var(--space-md)' }}>
              <Row icon="wallet" label="Wallet" value={walletStatusLabel} />
              {wallet.isConnected && wallet.address ? (
                <>
                  <Divider />
                  <Row
                    icon="copy"
                    label="Address"
                    value={truncateAddress(wallet.address)}
                    onClick={() => copy(wallet.address as string)}
                  />
                </>
              ) : null}
              {wallet.isConnected && !wallet.isCorrectChain ? (
                <>
                  <Divider />
                  <Row
                    icon="refresh"
                    label={walletBusy ? 'Switching…' : 'Switch to Coston2'}
                    onClick={() => void runWalletAction(wallet.switchToCoston2)}
                  />
                </>
              ) : null}
              <Divider />
              {wallet.isConnected ? (
                <Row
                  icon="logout"
                  label={walletBusy ? 'Disconnecting…' : 'Disconnect'}
                  onClick={() => void runWalletAction(wallet.disconnect)}
                  danger
                />
              ) : (
                <Row
                  icon="chevronRight"
                  label={walletBusy ? 'Connecting…' : 'Connect wallet'}
                  onClick={() => void runWalletAction(() => wallet.connect())}
                />
              )}
            </Card>
          </FadeIn>
        </section>

        <section>
          <SectionLabel>Appearance</SectionLabel>
          <Card variant="flat">
            <div className="stack stack--sm">
              <span className="t-label c-muted">Theme</span>
              <SegmentedControl
                options={[
                  { label: 'Light', value: 'light' as ThemeMode },
                  { label: 'Dark', value: 'dark' as ThemeMode },
                ]}
                value={mode}
                onChange={setMode}
              />
            </div>
          </Card>
        </section>

        <section>
          <SectionLabel>Wallet</SectionLabel>
          <Card padded={false} style={{ paddingInline: 'var(--space-md)' }}>
            <Stagger interval={35} distance={8}>
              <Row
                icon="wallet"
                label="Primary asset"
                value={profile ? CHAIN_ASSET_META[profile.primaryAsset].label : '—'}
                onClick={() => navigate('/onboarding/asset')}
              />
              <Divider />
              <Row
                icon="bank"
                label="XRPL address"
                value={profile?.xrplAddress ? truncateAddress(profile.xrplAddress) : 'Not set'}
                onClick={profile?.xrplAddress ? () => copy(profile.xrplAddress) : undefined}
              />
              <Divider />
              <Row
                icon="chains"
                label="Flare wallet address"
                value={profile?.walletAddress ? truncateAddress(profile.walletAddress) : '—'}
                onClick={profile?.walletAddress ? () => copy(profile.walletAddress) : undefined}
              />
            </Stagger>
          </Card>
        </section>

        <section>
          <SectionLabel>Local data</SectionLabel>
          <Card padded={false} style={{ paddingInline: 'var(--space-md)' }}>
            <Row icon="refresh" label="Reset local data" onClick={() => setConfirmOpen(true)} />
          </Card>
          <p className="t-micro c-muted" style={{ marginTop: 'var(--space-sm)' }}>
            Clears contacts, saved businesses, payment requests and the transaction cache stored in
            this browser. Nothing on-chain is affected.
          </p>
        </section>

        <section>
          <SectionLabel>About</SectionLabel>
          <Card padded={false} style={{ paddingInline: 'var(--space-md)' }}>
            <Row label="Network" value={COSTON2.name} />
            <Divider />
            <Row label="Chain ID" value={String(COSTON2.chainId)} />
            <Divider />
            <div className="row">
              <span className="t-body grow">Contracts</span>
              <StatusTag
                label={contractsReady ? 'Configured' : 'Not configured'}
                tone={contractsReady ? 'success' : 'danger'}
                emphasis="outline"
              />
            </div>
          </Card>
        </section>

        <Toast message="Copied" visible={copied} />
      </div>

      <Sheet open={confirmOpen} onClose={() => setConfirmOpen(false)} title="Reset local data">
        <div className="stack stack--md">
          <p className="t-body">
            This clears contacts, saved businesses, payment requests and the cached transaction
            history from this browser. Your on-chain balances and history are untouched, and the
            history re-syncs from Coston2 on the next load.
          </p>
          <Button
            label={resetting ? 'Resetting…' : 'Reset local data'}
            onClick={() => void doReset()}
            loading={resetting}
          />
          <Button label="Cancel" variant="ghost" onClick={() => setConfirmOpen(false)} />
        </div>
      </Sheet>
    </Screen>
  );
}
