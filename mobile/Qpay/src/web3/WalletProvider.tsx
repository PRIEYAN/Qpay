import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { ethers } from 'ethers';
import {
  AppKit as AppKitModal,
  AppKitProvider,
  useAccount,
  useAppKitState,
  useAppKitEventSubscription,
  type EventsControllerState,
} from '@reown/appkit-react-native';
import { COSTON2, isWalletConnectConfigured } from '../config/network';
import { getAppKit } from './appKitInstance';
import { coston2Network, coston2ChainIdHex, addCoston2ChainParams } from './chains';
import { readOnlyProvider } from './provider';

export type WalletStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface WalletContextValue {
  address: string | null;
  isConnected: boolean;
  chainId: number | null;
  isCorrectChain: boolean;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  switchToCoston2: () => Promise<void>;
  getSigner: () => Promise<ethers.Signer | null>;
  getProvider: () => ethers.Provider;
  status: WalletStatus;
  error: Error | null;
}

const WALLETCONNECT_NOT_CONFIGURED_MESSAGE =
  'Set WALLETCONNECT_PROJECT_ID in src/config/network.ts — get one free at https://cloud.reown.com';

function walletConnectNotConfiguredError(): Error {
  return new Error(WALLETCONNECT_NOT_CONFIGURED_MESSAGE);
}

const WalletContext = createContext<WalletContextValue | null>(null);

/**
 * Read the connected wallet's state and act on it (connect / disconnect /
 * switch network / sign). Always available — even before a wallet connects
 * `getProvider()` returns a working read-only Coston2 provider.
 */
export function useWallet(): WalletContextValue {
  const ctx = useContext(WalletContext);
  if (!ctx) {
    throw new Error('useWallet() must be called from inside <WalletProvider>.');
  }
  return ctx;
}

function readOnlyWalletValue(error: Error | null = null): WalletContextValue {
  return {
    address: null,
    isConnected: false,
    chainId: null,
    isCorrectChain: false,
    connect: async () => {
      throw walletConnectNotConfiguredError();
    },
    disconnect: async () => {},
    switchToCoston2: async () => {
      throw walletConnectNotConfiguredError();
    },
    getSigner: async () => null,
    getProvider: () => readOnlyProvider,
    status: error ? 'error' : 'disconnected',
    error,
  };
}

type PendingConnect = { resolve: () => void; reject: (error: Error) => void };

/**
 * Lives *inside* `AppKitProvider` so it can use Reown's hooks, and bridges
 * their state into Qpay's `useWallet()` shape. Only mounted once
 * `WALLETCONNECT_PROJECT_ID` is set (see `WalletProvider` below).
 */
function ConfiguredWalletBridge({ children }: { children: ReactNode }) {
  const appKit = getAppKit();
  const { address, isConnected, chain, allAccounts } = useAccount();
  const { isLoading: isRestoringSession } = useAppKitState();


  const [isConnecting, setIsConnecting] = useState(false);
  const [connectError, setConnectError] = useState<Error | null>(null);
  const pendingConnectRef = useRef<PendingConnect | null>(null);

  const settlePendingConnect = useCallback((settle: (pending: PendingConnect) => void) => {
    const pending = pendingConnectRef.current;
    if (pending) {
      pendingConnectRef.current = null;
      settle(pending);
    }
  }, []);

  const handleConnectSuccess = useCallback(() => {
    setIsConnecting(false);
    setConnectError(null);
    settlePendingConnect(pending => pending.resolve());
  }, [settlePendingConnect]);

  const handleConnectFailure = useCallback(
    (message: string | undefined, fallback: string) => {
      const err = new Error(message || fallback);
      setIsConnecting(false);
      setConnectError(err);
      settlePendingConnect(pending => pending.reject(err));
    },
    [settlePendingConnect],
  );

  const handleConnectError = useCallback(
    (event: EventsControllerState) => {
      const props = (event.data as { properties?: { message?: string } }).properties;
      handleConnectFailure(props?.message, 'Failed to connect wallet.');
    },
    [handleConnectFailure],
  );

  const handleUserRejected = useCallback(
    (event: EventsControllerState) => {
      const props = (event.data as { properties?: { message?: string } }).properties;
      handleConnectFailure(props?.message, 'Connection request was rejected.');
    },
    [handleConnectFailure],
  );

  const handleModalClose = useCallback(
    (event: EventsControllerState) => {
      const props = (event.data as { properties?: { connected?: boolean } }).properties;
      if (!props?.connected) {
        // Dismissed (back button / backdrop tap) without completing a
        // connection — treat as a cancellation, not a crash.
        setIsConnecting(false);
        settlePendingConnect(pending =>
          pending.reject(new Error('Wallet connection was cancelled.')),
        );
      }
    },
    [settlePendingConnect],
  );

  useAppKitEventSubscription('CONNECT_SUCCESS', handleConnectSuccess);
  useAppKitEventSubscription('CONNECT_ERROR', handleConnectError);
  useAppKitEventSubscription('USER_REJECTED', handleUserRejected);
  useAppKitEventSubscription('MODAL_CLOSE', handleModalClose);

  const connect = useCallback(async (): Promise<void> => {
    if (!isWalletConnectConfigured() || !appKit) {
      const err = walletConnectNotConfiguredError();
      setConnectError(err);
      throw err;
    }

    setConnectError(null);
    setIsConnecting(true);

    return new Promise<void>((resolve, reject) => {
      pendingConnectRef.current = { resolve, reject };
      try {
        // Opens Reown's modal (wallet list -> QR / deep link to MetaMask
        // etc.). Resolution happens via the CONNECT_SUCCESS/CONNECT_ERROR/
        // USER_REJECTED/MODAL_CLOSE event subscriptions above.
        appKit.open({ view: 'Connect' });
      } catch (e) {
        pendingConnectRef.current = null;
        const err = e instanceof Error ? e : new Error(String(e));
        setIsConnecting(false);
        setConnectError(err);
        reject(err);
      }
    });
  }, [appKit]);

  const disconnect = useCallback(async (): Promise<void> => {
    setConnectError(null);
    if (!appKit) return;
    // AppKit.disconnect() already catches/logs internally and never throws.
    await appKit.disconnect();
  }, [appKit]);

  /**
   * Move the connected wallet onto Coston2.
   *
   * Order matters. `appKit.switchNetwork()` only calls `setDefaultChain()` on
   * the WalletConnect provider — it picks a chain *within the already-approved
   * session*, it does not ask the wallet to switch, and it dereferences
   * `this.provider` with no guard (so calling it with no live connector throws
   * "Cannot read property 'setDefaultChain' of undefined" rather than a usable
   * error). So we drive the wallet directly over EIP-3326/3085 first, and only
   * then tell AppKit which chain to treat as default.
   */
  const switchToCoston2 = useCallback(async (): Promise<void> => {
    if (!isWalletConnectConfigured() || !appKit) {
      throw walletConnectNotConfiguredError();
    }

    const rawProvider = appKit.getProvider('eip155');
    if (!rawProvider) {
      throw new Error('Connect a wallet before switching networks.');
    }

    try {
      await rawProvider.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: coston2ChainIdHex }],
      });
    } catch {
      // 4902 / "Unrecognized chain ID" — the wallet has never heard of
      // Coston2. Add it (EIP-3085), which on most wallets also switches.
      await rawProvider.request({
        method: 'wallet_addEthereumChain',
        params: addCoston2ChainParams,
      });
    }

    try {
      await appKit.switchNetwork(coston2Network);
    } catch {
      // The session's approved namespace is fixed at connect time, so a wallet
      // that only learned about Coston2 just now still has no eip155:114 in
      // it. Adding the network was still worth doing — it makes the next
      // handshake include the chain — but this session can't transact on it.
      throw new Error(
        'Coston2 has been added to your wallet, but this connection was approved before it existed. ' +
          'Disconnect and connect again to finish switching.',
      );
    }
  }, [appKit]);

  const addressRef = useRef<string | null>(null);
  addressRef.current = address ?? null;
  const isConnectedRef = useRef(isConnected);
  isConnectedRef.current = isConnected;

  const getSigner = useCallback(async (): Promise<ethers.Signer | null> => {
    if (!appKit || !isConnectedRef.current || !addressRef.current) {
      return null;
    }

    const rawProvider = appKit.getProvider('eip155');
    if (!rawProvider) {
      return null;
    }

    const browserProvider = new ethers.BrowserProvider(
      rawProvider as unknown as ethers.Eip1193Provider,
      { chainId: COSTON2.chainId, name: 'coston2' },
    );

    return browserProvider.getSigner(addressRef.current);
  }, [appKit]);

  const getProvider = useCallback((): ethers.Provider => readOnlyProvider, []);

  const chainId = useMemo(() => {
    if (!isConnected) return null;
    if (chain?.id !== undefined) return Number(chain.id);
    // Fall back to the raw CAIP-10 account chainId when the connected
    // wallet is on a chain Qpay didn't configure (i.e. the "wrong network"
    // case) — `chain` above only matches against configured networks.
    const eip155Account = allAccounts.find(account => account.namespace === 'eip155');
    return eip155Account ? Number(eip155Account.chainId) : null;
  }, [isConnected, chain, allAccounts]);

  const isCorrectChain = isConnected && chainId === COSTON2.chainId;

  const status: WalletStatus = connectError
    ? 'error'
    : isConnected
      ? 'connected'
      : isConnecting || isRestoringSession
        ? 'connecting'
        : 'disconnected';

  const value = useMemo<WalletContextValue>(
    () => ({
      address: address ?? null,
      isConnected,
      chainId,
      isCorrectChain,
      connect,
      disconnect,
      switchToCoston2,
      getSigner,
      getProvider,
      status,
      error: connectError,
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
      connectError,
    ],
  );

  return (
    <WalletContext.Provider value={value}>
      {children}
      <AppKitModal />
    </WalletContext.Provider>
  );
}

/**
 * Wraps the app with wallet state/actions (`useWallet()`) and mounts
 * Reown AppKit's connection modal.
 *
 * Until `WALLETCONNECT_PROJECT_ID` (src/config/network.ts) is set, this
 * renders a headless fallback instead of touching the WalletConnect SDK at
 * all: `getProvider()` still works (reads Coston2 over public RPC), but
 * `connect()` / `switchToCoston2()` reject immediately with a clear setup
 * error.
 */
export function WalletProvider({ children }: { children: ReactNode }) {
  const appKit = isWalletConnectConfigured() ? getAppKit() : null;

  if (!appKit) {
    return (
      <WalletContext.Provider value={readOnlyWalletValue()}>{children}</WalletContext.Provider>
    );
  }

  return (
    <AppKitProvider instance={appKit}>
      <ConfiguredWalletBridge>{children}</ConfiguredWalletBridge>
    </AppKitProvider>
  );
}
