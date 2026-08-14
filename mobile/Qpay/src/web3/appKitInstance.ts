import { createAppKit } from '@reown/appkit-react-native';
import { EthersAdapter } from '@reown/appkit-ethers-react-native';
import { WALLETCONNECT_PROJECT_ID, isWalletConnectConfigured } from '../config/network';
import { appKitStorage } from './storage';
import { coston2Network, supportedNetworks } from './chains';

export type QpayAppKit = ReturnType<typeof createAppKit>;

let instance: QpayAppKit | null = null;

/**
 * Lazily creates (once) and returns the Reown AppKit singleton, or `null` if
 * `WALLETCONNECT_PROJECT_ID` hasn't been set yet.
 *
 * This is intentionally lazy rather than created at module scope: AppKit's
 * constructor kicks off a background WalletConnect session restore that
 * talks to the WalletConnect relay, and we don't want that happening (or a
 * cryptic auth failure logging) with an empty/invalid project id — most
 * notably during `npx jest`, where the default (unconfigured) config must
 * not touch the network at all.
 */
export function getAppKit(): QpayAppKit | null {
  if (!isWalletConnectConfigured()) {
    return null;
  }

  if (!instance) {
    instance = createAppKit({
      projectId: WALLETCONNECT_PROJECT_ID,
      networks: supportedNetworks,
      defaultNetwork: coston2Network,
      adapters: [new EthersAdapter()],
      storage: appKitStorage,
      metadata: {
        name: 'Qpay',
        description: 'Qpay — pay and swap FXRP on Flare Coston2',
        url: 'https://qpay.app',
        icons: ['https://qpay.app/icon.png'],
        redirect: {
          // Requires a matching native URL scheme / universal link to be
          // registered in android/ios for wallets to deep-link back into
          // Qpay after approving a connection. Update alongside that native
          // setup; WalletConnect still works without it (user switches back
          // to Qpay manually).
          native: 'qpay://',
        },
      },
      // Keep the modal focused on connecting an external wallet (MetaMask
      // etc.) — Qpay doesn't use AppKit's embedded swap/onramp/social login.
      features: {
        swaps: false,
        onramp: false,
        socials: false,
      },
    });
  }

  return instance;
}
