import React from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import {
  X,
  LayoutDashboard,
  Droplets,
  CreditCard,
  FileText,
  Users,
  Sparkles,
  Globe,
  LogOut,
  Shield,
  Phone,
  Check
} from 'lucide-react';
import { AnimatedMilkGlass } from './Header';

interface MobileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  currentTab: string;
  onTabChange: (tab: string) => void;
  onSwitchToSimple?: () => void;
}

export const MobileDrawer: React.FC<MobileDrawerProps> = ({
  isOpen,
  onClose,
  currentTab,
  onTabChange,
  onSwitchToSimple,
}) => {
  const { language, setLanguage, t } = useLanguage();
  const { user, logout, updateUserLanguage } = useAuth();

  if (!isOpen) return null;

  const handleSelectLanguage = (lang: 'en' | 'ta' | 'ml') => {
    setLanguage(lang);
    updateUserLanguage(lang);
  };

  const handleLogout = () => {
    if (window.confirm(t('logoutConfirm'))) {
      onClose();
      logout();
    }
  };

  const handleNavClick = (tabId: string) => {
    onTabChange(tabId);
    onClose();
  };

  const handleSimpleViewClick = () => {
    if (onSwitchToSimple) {
      onClose();
      onSwitchToSimple();
    }
  };

  const navItems = [
    { id: 'dashboard', label: t('dashboard'), icon: LayoutDashboard },
    { id: 'purchases', label: t('purchases'), icon: Droplets },
    { id: 'payments', label: t('payments'), icon: CreditCard },
    { id: 'settlement', label: t('monthlySettlement'), icon: FileText },
    { id: 'members', label: t('members'), icon: Users },
  ];

  const userInitial = user?.name ? user.name.charAt(0).toUpperCase() : 'U';

  return (
    <div className="mobile-drawer-overlay" onClick={onClose}>
      <div className="mobile-drawer-panel" onClick={(e) => e.stopPropagation()}>
        {/* Drawer Header with Close Button */}
        <div className="drawer-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: 'rgba(37,99,235,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <AnimatedMilkGlass size={22} />
            </div>
            <div>
              <div style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--slate-900)' }}>
                Family Milk
              </div>
              <span className="brand-pro-badge" style={{ fontSize: '0.62rem', padding: '0.1rem 0.4rem' }}>
                PRO
              </span>
            </div>
          </div>

          <button className="drawer-close-btn" onClick={onClose} aria-label="Close menu">
            <X size={20} />
          </button>
        </div>

        {/* User Profile Card */}
        <div className="drawer-profile-card">
          <div className="drawer-avatar">
            {userInitial}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="drawer-user-name">
              {user?.name || 'User'}
            </div>
            <div className="drawer-user-phone">
              <Phone size={12} />
              <span>{user?.phone || ''}</span>
            </div>
            <div className="drawer-role-pill">
              <Shield size={11} />
              <span>{user?.role === 'owner' ? 'Family Owner' : user?.role === 'admin' ? 'Family Admin' : 'Member'}</span>
            </div>
          </div>
        </div>

        {/* Switch to Simple View Prominent Card */}
        {onSwitchToSimple && (
          <div className="drawer-simple-card" onClick={handleSimpleViewClick}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <div className="drawer-sparkle-icon">
                <Sparkles size={20} color="#0284c7" />
              </div>
              <div>
                <div style={{ fontSize: '0.92rem', fontWeight: 800, color: '#0369a1' }}>
                  {t('simpleView')}
                </div>
                <div style={{ fontSize: '0.72rem', color: '#0284c7', fontWeight: 600 }}>
                  {language === 'ta' ? 'பெரிய தொடுதிரை பயன்முறை' : language === 'ml' ? 'വലിയ ടച്ച് സ്‌ക്രീൻ മോഡ്' : 'Big touch mode for parents'}
                </div>
              </div>
            </div>
            <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#0284c7' }}>➔</span>
          </div>
        )}

        {/* Navigation Section */}
        <div className="drawer-section-title">
          {language === 'ta' ? 'பக்கங்கள் (Navigation)' : language === 'ml' ? 'പേജുകൾ (Navigation)' : 'Navigation'}
        </div>
        <div className="drawer-nav-list">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                className={`drawer-nav-item ${isActive ? 'active' : ''}`}
                onClick={() => handleNavClick(item.id)}
              >
                <div className="drawer-nav-icon">
                  <Icon size={18} />
                </div>
                <span className="drawer-nav-label">{item.label}</span>
                {isActive && <span className="drawer-nav-dot" />}
              </button>
            );
          })}
        </div>

        {/* Language Selection Section */}
        <div className="drawer-section-title" style={{ marginTop: '1.25rem' }}>
          <Globe size={14} style={{ display: 'inline', marginRight: '0.35rem' }} />
          <span>{t('language')}</span>
        </div>
        <div className="drawer-lang-grid">
          <button
            className={`drawer-lang-chip ${language === 'en' ? 'active' : ''}`}
            onClick={() => handleSelectLanguage('en')}
          >
            <span>English</span>
            {language === 'en' && <Check size={14} />}
          </button>
          <button
            className={`drawer-lang-chip ${language === 'ta' ? 'active' : ''}`}
            onClick={() => handleSelectLanguage('ta')}
          >
            <span>தமிழ்</span>
            {language === 'ta' && <Check size={14} />}
          </button>
          <button
            className={`drawer-lang-chip ${language === 'ml' ? 'active' : ''}`}
            onClick={() => handleSelectLanguage('ml')}
          >
            <span>മലയാളം</span>
            {language === 'ml' && <Check size={14} />}
          </button>
        </div>

        {/* Bottom Drawer Actions */}
        <div className="drawer-footer">
          <button className="drawer-logout-btn" onClick={handleLogout}>
            <LogOut size={16} />
            <span>{t('logout')}</span>
          </button>
          <div style={{ textAlign: 'center', fontSize: '0.7rem', color: '#94a3b8', marginTop: '0.75rem' }}>
            Family Milk Account v1.0 • PWA Ready
          </div>
        </div>
      </div>
    </div>
  );
};
