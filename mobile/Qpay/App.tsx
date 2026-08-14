/**
 * Qpay
 * @format
 */

import 'react-native-gesture-handler';
import React from 'react';
import { StatusBar, useColorScheme } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from './src/theme/ThemeProvider';
import { QpayProvider } from './src/context/QpayProvider';
import RootNavigator from './src/navigation/RootNavigator';
import { WalletProvider } from './src/web3/WalletProvider';

function App() {
  const isDarkMode = useColorScheme() === 'dark';

  return (
    <SafeAreaProvider>
      <WalletProvider>
        <ThemeProvider>
          <QpayProvider>
            <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
            <RootNavigator />
          </QpayProvider>
        </ThemeProvider>
      </WalletProvider>
    </SafeAreaProvider>
  );
}

export default App;
