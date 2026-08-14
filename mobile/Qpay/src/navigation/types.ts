export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
  QrScanner: undefined;
  Send: { username?: string; qpayId?: string; amount?: number; note?: string } | undefined;
  Request: undefined;
  ContactPicker: { mode: 'send' | 'request' } | undefined;
  TransactionDetail: { id: string };
  Redeem: undefined;
  Deposit: undefined;
  Settings: undefined;
};

export type DashboardTabParamList = {
  Dashboard: undefined;
  Chains: undefined;
  Logs: undefined;
  Profile: undefined;
};

export type AuthStackParamList = {
  OnBoarding: undefined;
  WalletLogin: undefined;
  PrimaryChainPicker: undefined;
};
