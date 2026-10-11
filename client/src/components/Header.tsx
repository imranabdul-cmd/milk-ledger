import React from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import {
  Globe,
  LogOut,
  Milk,
  LayoutDashboard,
  Droplets,
  CreditCard,
  FileText,
  Users,
  Sparkles
} from 'lucide-react';

interface HeaderProps {
  currentTab: string;
  onTabChange: (tab: string) => void;
  onSwitchToSimple?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ currentTab, onTabChange, onSwitchToSimple }) => {
  const { language, toggleLanguage, t } = useLanguage();
  const { user, logout, updateUserLanguage } = useAuth();

  const handleLanguageToggle = () => {
    const order = ['ml', 'ta', 'en'] as const;
    const nextIdx = (order.indexOf(language as any) + 1) % order.length;
    const next = order[nextIdx];
    toggleLanguage();
    updateUserLanguage(next);
  };

  const handleLogout = () => {
    if (window.confirm(t('logoutConfirm'))) {
      logout();
    }
  };

  const navItems = [
    { id: 'dashboard', label: t('dashboard'), icon: LayoutDashboard },
    { id: 'purchases', label: t('purchases'), icon: Droplets },
    { id: 'payments', label: t('payments'), icon: CreditCard },
    { id: 'settlement', label: t('monthlySettlement'), icon: FileText },
    { id: 'members', label: t('members'), icon: Users },
  ];

  return (
    <header className="app-header">
      <div className="header-container">
        <div className="brand-section">
          <div className="brand-icon">
            <Milk size={26} color="#ffffff" />
          </div>
          <div className="brand-text">
            <h1>{user?.familyName || t('appName')}</h1>
            <p>{user?.name ? `${user.name} (${user.role === 'owner' ? t('roleOwner') : user.role === 'admin' ? t('roleAdmin') : t('roleMember')})` : t('tagline')}</p>
          </div>
        </div>

        {/* Desktop Tabs */}
        <nav className="desktop-nav">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                className={`desktop-nav-link ${currentTab === item.id ? 'active' : ''}`}
                onClick={() => onTabChange(item.id)}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="header-actions">
          {/* Simple View Switcher for Admins */}
          {onSwitchToSimple && (
            <button
              className="lang-btn"
              onClick={onSwitchToSimple}
              title={t('simpleView')}
              style={{ background: 'rgba(255,255,255,0.2)' }}
            >
              <Sparkles size={16} />
              <span>{t('simpleView')}</span>
            </button>
          )}

          {/* Language Toggle Button */}
          <button
            className="lang-btn"
            onClick={handleLanguageToggle}
            title={t('language')}
          >
            <Globe size={16} />
            <span>{language === 'ml' ? 'മലയാളം' : language === 'ta' ? 'தமிழ்' : 'English'}</span>
          </button>

          {/* Protected Logout */}
          <button
            className="lang-btn"
            onClick={handleLogout}
            title={t('logout')}
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </header>
  );
};
