/**
 * @format
 */

// Wallet/WalletConnect polyfills — must be imported before anything else in
// the app touches crypto/URL/WalletConnect. `react-native-compat` already
// pulls in `react-native-get-random-values` itself, but it's imported again
// explicitly here per the wallet layer's requirements.
import '@walletconnect/react-native-compat';
import 'react-native-get-random-values';

import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';

AppRegistry.registerComponent(appName, () => App);
