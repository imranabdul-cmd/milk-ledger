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

  return (
    <nav className="mobile-nav">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = currentTab === item.id;
        return (
          <button
            key={item.id}
            className={`nav-item ${isActive ? 'active' : ''}`}
            onClick={() => onTabChange(item.id)}
          >
            <Icon />
            <span>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
};
