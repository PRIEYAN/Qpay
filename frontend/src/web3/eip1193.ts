/**
 * Browser wallet discovery.
 *
 * The mobile app reached wallets over WalletConnect through Reown AppKit. In
 * a browser the equivalent transport is an injected EIP-1193 provider, and
 * the modern way to find one is EIP-6963 ("Multi Injected Provider
 * Discovery"): each installed extension announces itself on an event, so
 * multiple wallets can coexist instead of fighting over `window.ethereum`.
 *
 * We support both — EIP-6963 for the wallet picker, with a `window.ethereum`
 * fallback for wallets that haven't adopted it.
 */

export interface Eip1193Provider {
  request(args: { method: string; params?: unknown[] | object }): Promise<unknown>;
  on?(event: string, handler: (...args: never[]) => void): void;
  removeListener?(event: string, handler: (...args: never[]) => void): void;
}

export interface Eip6963ProviderInfo {
  uuid: string;
  name: string;
  icon: string;
  rdns: string;
}

export interface DiscoveredWallet {
  info: Eip6963ProviderInfo;
  provider: Eip1193Provider;
}

interface Eip6963AnnounceEvent extends CustomEvent {
  detail: DiscoveredWallet;
}

declare global {
  interface Window {
    ethereum?: Eip1193Provider & { isMetaMask?: boolean; providers?: Eip1193Provider[] };
  }
}

/**
 * Subscribes to EIP-6963 announcements and immediately requests a fresh
 * round of them. Returns an unsubscribe function.
 *
 * Wallets re-announce on request, so calling this at any time (not just at
 * page load) yields the full current set — no race with extension injection.
 */
export function discoverWallets(onChange: (wallets: DiscoveredWallet[]) => void): () => void {
  const found = new Map<string, DiscoveredWallet>();

  const handleAnnounce = (event: Event) => {
    const { detail } = event as Eip6963AnnounceEvent;
    if (!detail?.info?.uuid || found.has(detail.info.uuid)) return;
    found.set(detail.info.uuid, detail);
    onChange([...found.values()]);
  };

  window.addEventListener('eip6963:announceProvider', handleAnnounce);
  window.dispatchEvent(new Event('eip6963:requestProvider'));

  // Fallback for wallets that only expose the legacy global. Deferred a tick
  // so any EIP-6963 announcement (which is synchronous) wins the identity
  // and we don't list the same wallet twice.
  const timer = window.setTimeout(() => {
    if (found.size > 0 || !window.ethereum) return;
    found.set('injected', {
      info: {
        uuid: 'injected',
        name: window.ethereum.isMetaMask ? 'MetaMask' : 'Browser wallet',
        icon: '',
        rdns: 'injected',
      },
      provider: window.ethereum,
    });
    onChange([...found.values()]);
  }, 100);

  return () => {
    window.clearTimeout(timer);
    window.removeEventListener('eip6963:announceProvider', handleAnnounce);
  };
}

/** True when at least one injected wallet is reachable right now. */
export function hasInjectedWallet(): boolean {
  return typeof window !== 'undefined' && !!window.ethereum;
}

/** MetaMask's install page — the one link the empty state should offer. */
export const METAMASK_DOWNLOAD_URL = 'https://metamask.io/download/';

/**
 * EIP-1193 error codes we treat specially. 4001 is the user closing the
 * prompt, which is a cancellation and not a failure worth showing as red.
 */
export const RPC_ERROR = {
  userRejected: 4001,
  unrecognizedChain: 4902,
} as const;

export function errorCode(error: unknown): number | undefined {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = (error as { code: unknown }).code;
    if (typeof code === 'number') return code;
  }
  return undefined;
}

export function isUserRejection(error: unknown): boolean {
  return errorCode(error) === RPC_ERROR.userRejected;
}
