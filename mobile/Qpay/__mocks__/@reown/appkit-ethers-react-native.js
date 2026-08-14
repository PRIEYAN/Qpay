// Manual mock for `@reown/appkit-ethers-react-native` — see the sibling
// `__mocks__/@reown/appkit-react-native.js` for why this is needed under
// Jest. Only `EthersAdapter` (constructed once, never called into, in
// src/web3/appKitInstance.ts) is used.
class EthersAdapter {}

module.exports = { EthersAdapter };
