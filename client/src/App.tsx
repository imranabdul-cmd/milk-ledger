import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LanguageProvider } from './context/LanguageContext';
import { VoiceProvider } from './context/VoiceContext';
import { Header } from './components/Header';
import { MobileNav } from './components/MobileNav';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { PurchasesPage } from './pages/PurchasesPage';
import { PaymentsPage } from './pages/PaymentsPage';
import { MonthlySettlementPage } from './pages/MonthlySettlementPage';
import { MembersPage } from './pages/MembersPage';
import { MemberHomeScreen } from './pages/MemberHomeScreen';
import { SetupPinModal } from './components/SetupPinModal';
import { ErrorBoundary } from './components/ErrorBoundary';

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
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', color: '#64748b', fontSize: '1.1rem', fontWeight: 600 }}>
        Loading Family Milk Account...
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  // Force first-time PIN change if temporary PIN was used
  if (user.mustChangePin) {
    return (
      <div className="app-shell">
        <SetupPinModal />
        <LoginPage />
      </div>
    );
  }

  // Ordinary members (e.g. mother) always stay in Simple View.
  // Admins stay in whichever view mode was last selected on this device permanently.
  const isOrdinaryMember = user.role === 'member';

  if (isOrdinaryMember || adminViewMode === 'simple') {
    return (
      <div className="app-shell" style={{ background: '#f8fafc', minHeight: '100vh', paddingBottom: '20px' }}>
        <MemberHomeScreen
          onSwitchToAdmin={!isOrdinaryMember ? () => setAdminViewMode('admin') : undefined}
        />
      </div>
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
        {currentTab === 'dashboard' && <DashboardPage onNavigateToTab={setCurrentTab} />}
        {currentTab === 'purchases' && <PurchasesPage />}
        {currentTab === 'payments' && <PaymentsPage />}
        {currentTab === 'settlement' && <MonthlySettlementPage />}
        {currentTab === 'members' && <MembersPage />}
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
          <VoiceProvider>
            <AppContent />
          </VoiceProvider>
        </AuthProvider>
      </LanguageProvider>
    </ErrorBoundary>
  );
};

export default App;
