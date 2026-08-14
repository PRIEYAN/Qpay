import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import DashboardScreen from '../screens/dashboard/DashboardScreen';
import ChainsScreen from '../screens/Chains/ChainsScreen';
import LogsScreen from '../screens/dashboard/logs/LogsScreen';
import ProfileScreen from '../screens/profile/ProfileScreen';
import { BottomNav } from '../component/bottomNav/BottomNav';
import { DashboardTabParamList } from './types';

const Tab = createBottomTabNavigator<DashboardTabParamList>();

export default function DashboardTabs() {
  return (
    <Tab.Navigator
      tabBar={(props) => <BottomNav {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tab.Screen name="Dashboard" component={DashboardScreen} />
      <Tab.Screen name="Chains" component={ChainsScreen} />
      <Tab.Screen name="Logs" component={LogsScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}
