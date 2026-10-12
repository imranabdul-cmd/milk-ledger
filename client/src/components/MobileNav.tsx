import React from 'react';
import { useLanguage } from '../context/LanguageContext';
import { LayoutDashboard, Droplets, CreditCard, FileText, Users } from 'lucide-react';

interface MobileNavProps {
  currentTab: string;
  onTabChange: (tab: string) => void;
}

export const MobileNav: React.FC<MobileNavProps> = ({ currentTab, onTabChange }) => {
  const { t } = useLanguage();

  const navItems = [
    { id: 'dashboard', label: t('dashboard'), icon: LayoutDashboard },
    { id: 'purchases', label: t('purchases'), icon: Droplets },
    { id: 'payments', label: t('payments'), icon: CreditCard },
    { id: 'settlement', label: t('monthlySettlement'), icon: FileText },
    { id: 'members', label: t('members'), icon: Users },
  ];

  const handleTabClick = (id: string) => {
    try {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(8);
      }
    } catch {
      // Haptics optional
    }
    onTabChange(id);
  };

  return (
    <nav className="mobile-nav" role="navigation" aria-label="Bottom Navigation">
      <div className="mobile-nav-inner">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              className={`nav-item ${isActive ? 'active' : ''}`}
              onClick={() => handleTabClick(item.id)}
              aria-label={item.label}
              aria-current={isActive ? 'page' : undefined}
            >
              <div className="nav-item-icon-wrapper">
                <Icon size={22} className="nav-icon" />
                {isActive && <span className="active-dot-indicator" />}
              </div>
              <span className="nav-item-label">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
