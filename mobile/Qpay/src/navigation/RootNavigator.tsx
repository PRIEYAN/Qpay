import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AuthNavigator from './AuthNavigator';
import DashboardTabs from './DashboardTabs';
import QrScannerScreen from '../screens/dashboard/qrScanner/QrScannerScreen';
import SendScreen from '../screens/SendScreen';
import RequestScreen from '../screens/RequestScreen';
import ContactPickerScreen from '../screens/ContactPickerScreen';
import TransactionDetailScreen from '../screens/TransactionDetailScreen';
import RedeemScreen from '../screens/RedeemScreen';
import DepositScreen from '../screens/DepositScreen';
import SettingsScreen from '../screens/SettingsScreen';
import { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Auth" component={AuthNavigator} />
        <Stack.Screen name="Main" component={DashboardTabs} />
        <Stack.Screen name="QrScanner" component={QrScannerScreen} options={{ presentation: 'modal' }} />
        <Stack.Screen name="Send" component={SendScreen} options={{ presentation: 'modal' }} />
        <Stack.Screen name="Request" component={RequestScreen} options={{ presentation: 'modal' }} />
        <Stack.Screen
          name="ContactPicker"
          component={ContactPickerScreen}
          options={{ presentation: 'modal' }}
        />
        <Stack.Screen name="TransactionDetail" component={TransactionDetailScreen} />
        <Stack.Screen name="Redeem" component={RedeemScreen} options={{ presentation: 'modal' }} />
        <Stack.Screen name="Deposit" component={DepositScreen} options={{ presentation: 'modal' }} />
        <Stack.Screen name="Settings" component={SettingsScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
