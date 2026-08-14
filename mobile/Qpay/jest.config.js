module.exports = {
  preset: '@react-native/jest-preset',
  transformIgnorePatterns: [
    'node_modules/(?!(react-native|@react-native|@react-navigation|react-native-gesture-handler|react-native-screens|react-native-safe-area-context|@react-native-async-storage|lucide-react-native)/)',
  ],
  // @react-native/jest-preset's own `transform` only matches
  // `.js`/`.ts`/`.tsx`. lucide-react-native ships its icons as ESM `.mjs`
  // files (`export { House as default }`), which Jest's CJS-mode runtime
  // can't execute unparsed. Re-declared here (rather than left to the
  // preset) because setting `transform` replaces the preset's value
  // instead of merging with it — so the original js/ts/tsx + asset
  // entries are carried forward unchanged, with a `.mjs` entry added.
  transform: {
    '^.+\\.(js|ts|tsx)$': 'babel-jest',
    '^.+\\.mjs$': 'babel-jest',
    '^.+\\.(bmp|gif|jpg|jpeg|mp4|png|psd|svg|webp)$': require.resolve(
      '@react-native/jest-preset/jest/assetFileTransformer.js',
    ),
  },
  setupFiles: ['./jest.setup.js'],
};
