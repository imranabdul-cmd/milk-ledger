import React, { useState, Suspense, lazy } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LanguageProvider } from './context/LanguageContext';
import { VoiceProvider } from './context/VoiceContext';
import { ToastProvider } from './context/ToastContext';
import { Header } from './components/Header';
import { MobileNav } from './components/MobileNav';
import { MilkGlassLoader } from './components/MilkGlassLoader';
import { SetupPinModal } from './components/SetupPinModal';
import { ErrorBoundary } from './components/ErrorBoundary';

// Lazy-loaded routes for ultra-fast initial bundle loading & snappy page loads
const LoginPage = lazy(() => import('./pages/LoginPage').then(m => ({ default: m.LoginPage })));
const DashboardPage = lazy(() => import('./pages/DashboardPage').then(m => ({ default: m.DashboardPage })));
const PurchasesPage = lazy(() => import('./pages/PurchasesPage').then(m => ({ default: m.PurchasesPage })));
const PaymentsPage = lazy(() => import('./pages/PaymentsPage').then(m => ({ default: m.PaymentsPage })));
const MonthlySettlementPage = lazy(() => import('./pages/MonthlySettlementPage').then(m => ({ default: m.MonthlySettlementPage })));
const MembersPage = lazy(() => import('./pages/MembersPage').then(m => ({ default: m.MembersPage })));
const MemberHomeScreen = lazy(() => import('./pages/MemberHomeScreen').then(m => ({ default: m.MemberHomeScreen })));

const AppContent: React.FC = () => {
  const { user, isLoading } = useAuth();
  const [currentTab, setCurrentTab] = useState<string>('dashboard');

  // Persistent Device View Mode:
  // Once user/admin is in Simple View, it is permanently stored in localStorage.
  // App close, phone switch off, or browser reload will NEVER exit Simple View.
  // It stays in Simple View until the user manually taps the switch button!
  const [adminViewMode, setAdminViewModeState] = useState<'admin' | 'simple'>(() => {
    const saved = localStorage.getItem('milk_preferred_view_mode');
    if (saved === 'admin' || saved === 'simple') {
      return saved;
    }
    // Default to 'simple' view permanently
    return 'simple';
  });

  const setAdminViewMode = (mode: 'admin' | 'simple') => {
    setAdminViewModeState(mode);
    localStorage.setItem('milk_preferred_view_mode', mode);
  };

  if (isLoading) {
    return <MilkGlassLoader fullscreen size="fullscreen" />;
  }

  if (!user) {
    return (
      <Suspense fallback={<MilkGlassLoader fullscreen size="fullscreen" />}>
        <LoginPage />
      </Suspense>
    );
  }

  // Force first-time PIN change if temporary PIN was used
  if (user.mustChangePin) {
    return (
      <div className="app-shell">
        <SetupPinModal />
        <Suspense fallback={<MilkGlassLoader size="lg" />}>
          <LoginPage />
        </Suspense>
      </div>
    );
  }

  // Ordinary members (e.g. mother) always stay in Simple View.
  // Admins stay in whichever view mode was last selected on this device permanently.
  const isOrdinaryMember = user.role === 'member';

  if (isOrdinaryMember || adminViewMode === 'simple') {
    return (
      <Suspense fallback={<MilkGlassLoader fullscreen size="fullscreen" />}>
        <MemberHomeScreen
          onSwitchToAdmin={!isOrdinaryMember ? () => setAdminViewMode('admin') : undefined}
        />
      </Suspense>
    );
  }

  // Owner / Admin View
  return (
    <div className="app-shell">
      <Header
        currentTab={currentTab}
        onTabChange={setCurrentTab}
        onSwitchToSimple={() => setAdminViewMode('simple')}
      />

      <main>
        <Suspense fallback={<MilkGlassLoader size="lg" />}>
          {currentTab === 'dashboard' && <DashboardPage onNavigateToTab={setCurrentTab} />}
          {currentTab === 'purchases' && <PurchasesPage />}
          {currentTab === 'payments' && <PaymentsPage />}
          {currentTab === 'settlement' && <MonthlySettlementPage />}
          {currentTab === 'members' && <MembersPage />}
        </Suspense>
      </main>

      <MobileNav currentTab={currentTab} onTabChange={setCurrentTab} />
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <LanguageProvider>
        <AuthProvider>
          <ToastProvider>
            <VoiceProvider>
              <AppContent />
            </VoiceProvider>
          </ToastProvider>
        </AuthProvider>
      </LanguageProvider>
    </ErrorBoundary>
  );
};

export default App;
