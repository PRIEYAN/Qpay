import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { ethers } from 'ethers';
import { COSTON2 } from '../config/network';
import { addCoston2ChainParams, coston2ChainIdHex } from './chains';
import { readOnlyProvider } from './provider';
import {
  discoverWallets,
  isUserRejection,
  type DiscoveredWallet,
  type Eip1193Provider,
} from './eip1193';

export type WalletStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

/**
 * Identical in shape to the mobile `WalletContextValue`, so every consumer
 * (qpayService's wallet context, ConnectionGate, the screens) ports without
 * a single call-site change. The web-only additions are at the bottom:
 * wallet discovery + an explicit picker, which mobile delegated to Reown's
 * modal.
 */
export interface WalletContextValue {
  address: string | null;
  isConnected: boolean;
  chainId: number | null;
  isCorrectChain: boolean;
  connect: (wallet?: DiscoveredWallet) => Promise<void>;
  disconnect: () => Promise<void>;
  switchToCoston2: () => Promise<void>;
  getSigner: () => Promise<ethers.Signer | null>;
  getProvider: () => ethers.Provider;
  status: WalletStatus;
  error: Error | null;

  /** Injected wallets announced by the browser (EIP-6963). */
  available: DiscoveredWallet[];
  /** The wallet currently connected, when known. */
  activeWallet: DiscoveredWallet | null;
}

const WalletContext = createContext<WalletContextValue | null>(null);

/** Remembers which wallet was used so a reload can silently reconnect to it. */
const LAST_WALLET_KEY = '@qpay/lastWalletRdns';

export function useWallet(): WalletContextValue {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error('useWallet() must be called from inside <WalletProvider>.');
  return ctx;
}

function toError(e: unknown, fallback: string): Error {
  if (e instanceof Error) return e;
  if (typeof e === 'object' && e !== null && 'message' in e) {
    return new Error(String((e as { message: unknown }).message));
  }
  return new Error(fallback);
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const [available, setAvailable] = useState<DiscoveredWallet[]>([]);
  const [activeWallet, setActiveWallet] = useState<DiscoveredWallet | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  /**
   * True from first paint until wallet discovery + silent reconnect have
   * both had their chance to run.
   *
   * Without this the app reports `disconnected` for the first few frames of
   * every load, which is indistinguishable from "no wallet" — so a user who
   * refreshes or deep-links into the app gets bounced to the landing page
   * before their already-authorized session can be restored.
   */
  const [isRestoring, setIsRestoring] = useState(true);

  /** The live EIP-1193 provider, mirrored into a ref so `getSigner` can stay stable. */
  const providerRef = useRef<Eip1193Provider | null>(null);

  // ---- discovery -------------------------------------------------------
  useEffect(() => discoverWallets(setAvailable), []);

  /**
   * Discovery is event-driven and open-ended — no wallet ever reports "that
   * was the last of them" — so the restoring window is closed on a timer.
   * Extensions answer `eip6963:requestProvider` synchronously on the same
   * tick; this budget is generous enough to cover a slow one, and short
   * enough that a visitor with no wallet at all barely sees it.
   */
  useEffect(() => {
    const timer = window.setTimeout(() => setIsRestoring(false), 600);
    return () => window.clearTimeout(timer);
  }, []);

  // ---- silent reconnect ------------------------------------------------
  // A wallet already authorized for this origin answers `eth_accounts`
  // without prompting, so a reload restores the session invisibly — the web
  // equivalent of AppKit's session restore.
  const attemptedRestore = useRef(false);
  useEffect(() => {
    if (attemptedRestore.current || available.length === 0) return;
    attemptedRestore.current = true;

    let stored: string | null = null;
    try {
      stored = window.localStorage.getItem(LAST_WALLET_KEY);
    } catch {
      stored = null;
    }

    const candidate =
      available.find((w) => w.info.rdns === stored) ?? (stored ? undefined : available[0]);
    if (!candidate) {
      setIsRestoring(false);
      return;
    }

    void (async () => {
      try {
        const accounts = (await candidate.provider.request({ method: 'eth_accounts' })) as string[];
        if (!accounts?.length) return;
        const hexChain = (await candidate.provider.request({ method: 'eth_chainId' })) as string;
        providerRef.current = candidate.provider;
        setActiveWallet(candidate);
        setAddress(ethers.getAddress(accounts[0]));
        setChainId(Number.parseInt(hexChain, 16));
      } catch {
        // A failed silent restore is not an error worth surfacing — the
        // user simply stays disconnected and can press Connect.
      } finally {
        setIsRestoring(false);
      }
    })();
  }, [available]);

  // ---- live wallet events ----------------------------------------------
  useEffect(() => {
    const provider = activeWallet?.provider;
    if (!provider?.on) return;

    const handleAccounts = (...args: never[]) => {
      const accounts = args[0] as unknown as string[];
      if (!accounts?.length) {
        // The user disconnected this site from inside the wallet.
        setAddress(null);
        setChainId(null);
        setActiveWallet(null);
        providerRef.current = null;
        return;
      }
      setAddress(ethers.getAddress(accounts[0]));
    };

    const handleChain = (...args: never[]) => {
      const hexChain = args[0] as unknown as string;
      setChainId(Number.parseInt(hexChain, 16));
    };

    const handleDisconnect = () => {
      setAddress(null);
      setChainId(null);
      setActiveWallet(null);
      providerRef.current = null;
    };

    provider.on('accountsChanged', handleAccounts);
    provider.on('chainChanged', handleChain);
    provider.on('disconnect', handleDisconnect);

    return () => {
      provider.removeListener?.('accountsChanged', handleAccounts);
      provider.removeListener?.('chainChanged', handleChain);
      provider.removeListener?.('disconnect', handleDisconnect);
    };
  }, [activeWallet]);

  // ---- actions ---------------------------------------------------------

  const connect = useCallback(
    async (wallet?: DiscoveredWallet): Promise<void> => {
      const target = wallet ?? activeWallet ?? available[0];
      if (!target) {
        const err = new Error(
          'No Ethereum wallet found. Install MetaMask (or another browser wallet) to continue.',
        );
        setError(err);
        throw err;
      }

      setError(null);
      setIsConnecting(true);
      try {
        const accounts = (await target.provider.request({
          method: 'eth_requestAccounts',
        })) as string[];
        if (!accounts?.length) throw new Error('No accounts were returned by the wallet.');

        const hexChain = (await target.provider.request({ method: 'eth_chainId' })) as string;

        providerRef.current = target.provider;
        setActiveWallet(target);
        setAddress(ethers.getAddress(accounts[0]));
        setChainId(Number.parseInt(hexChain, 16));

        try {
          window.localStorage.setItem(LAST_WALLET_KEY, target.info.rdns);
        } catch {
          // Remembering the wallet is a convenience, never a requirement.
        }
      } catch (e) {
        const err = isUserRejection(e)
          ? new Error('Connection request was rejected.')
          : toError(e, 'Failed to connect wallet.');
        setError(err);
        throw err;
      } finally {
        setIsConnecting(false);
      }
    },
    [activeWallet, available],
  );

  const disconnect = useCallback(async (): Promise<void> => {
    // EIP-1193 has no "disconnect" a dapp can invoke — revoking access is
    // the wallet's own UI. Clearing local state is the honest equivalent:
    // the app forgets the account and stops reconnecting on reload.
    setError(null);
    setAddress(null);
    setChainId(null);
    setActiveWallet(null);
    providerRef.current = null;
    try {
      window.localStorage.removeItem(LAST_WALLET_KEY);
    } catch {
      // Nothing actionable.
    }
  }, []);

  const switchToCoston2 = useCallback(async (): Promise<void> => {
    const provider = providerRef.current;
    if (!provider) throw new Error('Connect a wallet first.');

    try {
      await provider.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: coston2ChainIdHex }],
      });
    } catch (switchErr) {
      // The wallet doesn't know Coston2 yet — offer to add it (EIP-3085)
      // then retry the switch. Mirrors the mobile fallback exactly.
      try {
        await provider.request({
          method: 'wallet_addEthereumChain',
          params: addCoston2ChainParams,
        });
        await provider.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: coston2ChainIdHex }],
        });
      } catch (addErr) {
        throw isUserRejection(addErr)
          ? new Error('Network switch was rejected.')
          : toError(addErr, 'Could not switch to Flare Coston2.');
      }
      void switchErr;
    }
  }, []);

  const addressRef = useRef<string | null>(null);
  addressRef.current = address;

  const getSigner = useCallback(async (): Promise<ethers.Signer | null> => {
    const provider = providerRef.current;
    if (!provider || !addressRef.current) return null;

    const browserProvider = new ethers.BrowserProvider(
      provider as unknown as ethers.Eip1193Provider,
      { chainId: COSTON2.chainId, name: 'coston2' },
    );
    return browserProvider.getSigner(addressRef.current);
  }, []);

  /**
   * Reads always go through the fixed Coston2 RPC, never the wallet's own
   * provider — so history and balances stay correct even while the wallet
   * sits on the wrong chain. Only signing needs the injected provider.
   */
  const getProvider = useCallback((): ethers.Provider => readOnlyProvider, []);

  const isConnected = address !== null;
  const isCorrectChain = isConnected && chainId === COSTON2.chainId;
  // `isRestoring` reports as 'connecting' so callers that already handle an
  // in-flight connection (route guards, gates) treat "we don't know yet"
  // the same way, rather than as a confirmed disconnection.
  const status: WalletStatus = error
    ? 'error'
    : isConnected
      ? 'connected'
      : isConnecting || isRestoring
        ? 'connecting'
        : 'disconnected';

  const value = useMemo<WalletContextValue>(
    () => ({
      address,
      isConnected,
      chainId,
      isCorrectChain,
      connect,
      disconnect,
      switchToCoston2,
      getSigner,
      getProvider,
      status,
      error,
      available,
      activeWallet,
    }),
    [
      address,
      isConnected,
      chainId,
      isCorrectChain,
      connect,
      disconnect,
      switchToCoston2,
      getSigner,
      getProvider,
      status,
      error,
      available,
      activeWallet,
    ],
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}
