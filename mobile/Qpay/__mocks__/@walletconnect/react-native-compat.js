// Manual mock for `@walletconnect/react-native-compat`.
//
// The real package is side-effect-only: it polyfills crypto/URL/TextEncoder/
// Buffer and wires up globals like Linking/NetInfo, importing its native
// module bindings via raw `.ts` source. Jest's transformIgnorePatterns
// (jest.config.js, shared with other layers — not edited here) doesn't
// transform `@walletconnect/*`, so that raw source fails to parse under
// Jest. Nothing in Qpay's tests exercises WalletConnect's runtime behavior,
// so an empty mock is sufficient — see src/web3/WalletProvider.tsx and
// src/web3/appKitInstance.ts for where the real package is used at runtime.
module.exports = {};
