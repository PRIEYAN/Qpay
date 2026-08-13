import { useState, type ReactNode } from 'react';
import { Button, EmptyState, Icon, Notice } from '../../components/ui';
import { FadeIn, haptic } from '../../components/motion';
import { useWallet, METAMASK_DOWNLOAD_URL } from '../../web3';
import { NotConfiguredError } from '../../services/qpayService';

type Props = {
  /** The real screen content — rendered once a wallet is connected and Qpay is configured. */
  children: ReactNode;
  /**
   * Pass the data hook's `error` (e.g. `useQpayContext().error`). When it's a
   * setup problem this renders an honest "not configured" state instead of
   * letting the screen fall through to a blank/broken empty list.
   */
  error?: Error | null;
};

/**
 * `assertConfigured()` throws a plain `Error` that names every missing field
 * in one message — it overlaps with the dedicated `NotConfiguredError` class,
 * which only some call sites use. Matching on both the class *and* the
 * message keeps this gate correct against either shape.
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
 *   1. Contracts not configured — the most fundamental blocker (nothing
 *      will ever load, connected or not), so it takes priority and gets an
 *      explicit "setup isn't finished" state rather than being disguised as
 *      an empty wallet.
 *   2. No wallet connected — a designed prompt with a real "Connect wallet"
 *      action, not an error screen.
 *   3. Connected, but on the wrong chain — a non-blocking banner (reads
 *      already work off a fixed Coston2 RPC regardless of the connected
 *      wallet's chain; only sends need the switch) rendered above the
 *      screen's real content.
 */
export function ConnectionGate({ children, error }: Props) {
  const wallet = useWallet();

  if (isSetupError(error)) return <NotConfiguredState error={error as Error} />;
  if (!wallet.isConnected) return <NotConnectedState />;

  return (
    <>
      {!wallet.isCorrectChain ? <WrongNetworkBanner /> : null}
      {children}
    </>
  );
}

function NotConfiguredState({ error }: { error: Error }) {
  // The first line is the human summary ("Qpay is not fully configured
  // yet."); the rest is the per-field checklist — shown verbatim since it
  // already names exactly what's missing and where to fix it.
  const [summary, ...rest] = error.message.split('\n');
  const detail = rest.join('\n').trim();

  return (
    <FadeIn>
      <div className="empty-state">
        <div className="empty-state__icon c-danger">
          <Icon name="alert" size={26} />
        </div>
        <span className="t-subtitle">Setup isn't finished yet</span>
        <span className="t-body c-muted">{summary}</span>
        {detail ? (
          <pre
            className="t-label c-muted"
            style={{
              marginTop: 'var(--space-lg)',
              padding: 'var(--space-md)',
              border: 'var(--border-width) solid var(--border)',
              borderRadius: 'var(--radius-md)',
              textAlign: 'left',
              whiteSpace: 'pre-wrap',
              width: '100%',
              fontFamily: 'var(--font-mono)',
              lineHeight: 1.5,
            }}
          >
            {detail}
          </pre>
        ) : null}
      </div>
    </FadeIn>
  );
}

function NotConnectedState() {
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

  const hasWallets = wallet.available.length > 0;

  return (
    <FadeIn>
      <EmptyState
        icon="wallet"
        title="Connect your wallet"
        body={
          hasWallets
            ? 'Qpay reads live balances and activity from Flare Coston2 — connect a wallet to continue.'
            : 'No browser wallet was detected. Install MetaMask, then reload this page.'
        }
        action={
          hasWallets ? (
            <Button
              label={connecting ? 'Connecting…' : 'Connect wallet'}
              onClick={() => void handleConnect()}
              loading={connecting}
            />
          ) : (
            <a
              className="btn btn--primary"
              href={METAMASK_DOWNLOAD_URL}
              target="_blank"
              rel="noreferrer noopener"
            >
              Install MetaMask
            </a>
          )
        }
      />
      {error ? (
        <div style={{ marginTop: 'var(--space-md)' }}>
          <Notice message={error} tone="danger" />
        </div>
      ) : null}
    </FadeIn>
  );
}

function WrongNetworkBanner() {
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
    <FadeIn>
      <div
        className="stack stack--xs"
        style={{
          border: 'var(--border-width) solid var(--ink)',
          borderRadius: 'var(--radius-md)',
          padding: 'var(--space-md)',
          background: 'var(--surface)',
          marginBottom: 'var(--space-md)',
        }}
      >
        <div className="cluster">
          <Icon name="alert" size={18} />
          <span className="t-label grow">
            Wrong network — switch to Flare Coston2 to send or redeem.
          </span>
          <button
            type="button"
            className="t-label c-accent"
            style={{ fontWeight: 700 }}
            onClick={() => void handleSwitch()}
            disabled={switching}
          >
            {switching ? 'Switching…' : 'Switch'}
          </button>
        </div>
        {error ? <span className="t-micro c-danger">{error}</span> : null}
      </div>
    </FadeIn>
  );
}
