// Manual mock for `@reown/appkit-react-native`.
//
// The real package's `react-native` entry point is raw TypeScript/ESM
// source (see its package.json `"react-native": "src/index.tsx"`), which
// Jest's RN preset resolves in preference to the compiled `lib/commonjs`
// output. That source isn't covered by jest.config.js's
// transformIgnorePatterns (shared config — not edited here), so it fails to
// parse under Jest. This mock provides no-op stand-ins for the pieces
// src/web3/WalletProvider.tsx and src/web3/appKitInstance.ts import.
//
// __tests__/App.test.tsx renders <App/> with WALLETCONNECT_PROJECT_ID unset
// (src/config/network.ts default), so WalletProvider takes its headless
// fallback branch and never actually calls into any of these — they just
// need to exist and be require()-able.
const React = require('react');

module.exports = {
  AppKit: () => null,
  AppKitProvider: ({ children }) => children,
  createAppKit: () => ({
    open: () => {},
    close: () => {},
    back: () => {},
    connect: async () => {},
    disconnect: async () => {},
    switchNetwork: async () => {},
    switchAccountType: async () => {},
    getProvider: () => null,
    getNetworks: () => [],
  }),
  useAccount: () => ({
    allAccounts: [],
    address: undefined,
    isConnected: false,
    chainId: undefined,
    chain: undefined,
    namespace: undefined,
  }),
  useAppKitState: () => ({
    isOpen: false,
    isLoading: false,
    isConnected: false,
    chain: undefined,
  }),
  useAppKitEventSubscription: () => {},
  useAppKitEvents: () => ({ data: undefined, timestamp: 0 }),
  useAppKit: () => ({
    open: () => {},
    close: () => {},
    disconnect: () => {},
    switchNetwork: async () => {},
  }),
  useProvider: () => ({ provider: undefined, providerType: undefined }),
  useAppKitTheme: () => ({}),
  useWalletInfo: () => ({}),
  AppKitButton: () => null,
  AccountButton: () => null,
  ConnectButton: () => null,
  NetworkButton: () => null,
};
