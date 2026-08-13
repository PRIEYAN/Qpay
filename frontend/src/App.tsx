import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { ThemeProvider } from './theme/ThemeProvider';
import { WalletProvider, useWallet } from './web3';
import { QpayProvider } from './context/QpayProvider';
import { BottomNav } from './screens/components/BottomNav';
import { Icon } from './components/icons';

import OnBoardingScreen from './screens/auth/OnBoardingScreen';
import PrimaryAssetScreen from './screens/auth/PrimaryAssetScreen';
import DashboardScreen from './screens/dashboard/DashboardScreen';
import LogsScreen from './screens/dashboard/LogsScreen';
import ChainsScreen from './screens/ChainsScreen';
import ProfileScreen from './screens/ProfileScreen';
import SettingsScreen from './screens/SettingsScreen';
import SendScreen from './screens/SendScreen';
import RequestScreen from './screens/RequestScreen';
import ContactPickerScreen from './screens/ContactPickerScreen';
import QrScannerScreen from './screens/QrScannerScreen';
import DepositScreen from './screens/DepositScreen';
import RedeemScreen from './screens/RedeemScreen';
import TransactionDetailScreen from './screens/TransactionDetailScreen';

/**
 * The app shell — the phone-shaped column every in-app screen renders
 * inside. The bottom nav only appears on the four tab routes, mirroring the
 * mobile build where it belonged to the tab navigator rather than the root
 * stack (a modal flow like Send covered it).
 */
const TAB_ROUTES = new Set(['/app', '/app/chains', '/app/activity', '/app/profile']);

function AppShell() {
  const location = useLocation();
  const showNav = TAB_ROUTES.has(location.pathname);

  return (
    <div className="app-shell">
      <Outlet />
      {showNav ? <BottomNav /> : null}
    </div>
  );
}

/**
 * Onboarding is the landing page for anyone without a connected wallet. Once
 * a wallet is connected the app is reachable; a visitor who hits an app
 * route directly while disconnected is sent back to it rather than shown a
 * grid of empty gates.
 *
 * Note this is a routing convenience, not a security boundary — every screen
 * still renders `ConnectionGate`, and the service layer independently
 * refuses to read or write without a connected wallet.
 */
function RequireWallet() {
  const wallet = useWallet();
  const location = useLocation();

  // `connecting` also covers the discovery + silent-reconnect window on a
  // fresh load. Redirecting during it would bounce an already-authorized
  // user to the landing page every time they refresh or deep-link, so we
  // hold on a neutral splash until the wallet state is actually known.
  if (!wallet.isConnected && wallet.status === 'connecting') {
    return (
      <div className="app-shell app-shell--splash">
        <Icon name="loader" size={28} className="m-spinner c-muted" />
      </div>
    );
  }

  if (!wallet.isConnected) {
    return <Navigate to="/" replace state={{ from: location.pathname }} />;
  }

  return <Outlet />;
}

export default function App() {
  return (
    <ThemeProvider>
      <WalletProvider>
        <QpayProvider>
          <Routes>
            <Route path="/" element={<OnBoardingScreen />} />

            <Route element={<RequireWallet />}>
              <Route
                path="/onboarding/asset"
                element={
                  <div className="app-shell">
                    <PrimaryAssetScreen />
                  </div>
                }
              />

              <Route path="/app" element={<AppShell />}>
                <Route index element={<DashboardScreen />} />
                <Route path="chains" element={<ChainsScreen />} />
                <Route path="activity" element={<LogsScreen />} />
                <Route path="profile" element={<ProfileScreen />} />
                <Route path="settings" element={<SettingsScreen />} />
                <Route path="send" element={<SendScreen />} />
                <Route path="request" element={<RequestScreen />} />
                <Route path="contacts" element={<ContactPickerScreen />} />
                <Route path="scan" element={<QrScannerScreen />} />
                <Route path="deposit" element={<DepositScreen />} />
                <Route path="redeem" element={<RedeemScreen />} />
                <Route path="tx/:id" element={<TransactionDetailScreen />} />
              </Route>
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </QpayProvider>
      </WalletProvider>
    </ThemeProvider>
  );
}
