import 'react-native-gesture-handler/jestSetup';

// The mock Qpay data layer persists via AsyncStorage; use the package's own
// in-memory jest mock so tests don't hit a real native module.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest'),
);
