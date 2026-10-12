import React, { useRef, useEffect, useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import {
  Globe,
  LogOut,
  LayoutDashboard,
  Droplets,
  CreditCard,
  FileText,
  Users,
  Sparkles,
  Menu
} from 'lucide-react';
import { MobileDrawer } from './MobileDrawer';

interface HeaderProps {
  currentTab: string;
  onTabChange: (tab: string) => void;
  onSwitchToSimple?: () => void;
}

export const AnimatedMilkGlass: React.FC<{ size?: number }> = ({ size = 30 }) => {
  return (
    <div className="animated-milk-glass-wrapper" style={{ width: size, height: size * 1.15 }}>
      <svg
        viewBox="0 0 40 48"
        width={size}
        height={size * 1.2}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="animated-glass-svg"
      >
        <defs>
          {/* Clip path matching the interior of the glass tumbler */}
          <clipPath id="glassInsideClip">
            <path d="M9 10 L12 40 C12.5 43 14 44 20 44 C26 44 27.5 43 28 40 L31 10 Z" />
          </clipPath>

          {/* Milk Liquid Gradient */}
          <linearGradient id="milkFillGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="40%" stopColor="#f0f7ff" />
            <stop offset="100%" stopColor="#dbeafe" />
          </linearGradient>

          {/* Glass Reflection Highlight */}
          <linearGradient id="glassSheen" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="white" stopOpacity="0.75" />
            <stop offset="50%" stopColor="white" stopOpacity="0.15" />
            <stop offset="100%" stopColor="white" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Ambient Glass Tumbler Body */}
        <path
          d="M8 8 L11.5 40.5 C12.2 44.5 14.5 46 20 46 C25.5 46 27.8 44.5 28.5 40.5 L32 8 Z"
          fill="rgba(255, 255, 255, 0.12)"
          stroke="rgba(255, 255, 255, 0.45)"
          strokeWidth="1.2"
        />

        {/* Animated Milk Liquid Fill (Fills Up & Waves) */}
        <g clipPath="url(#glassInsideClip)">
          <g className="milk-liquid-fill">
            <path
              className="milk-wave-path"
              d="M0 0 C 10 -3, 20 3, 30 0 C 40 -3, 50 3, 60 0 C 70 -3, 80 3, 90 0 L 90 50 L 0 50 Z"
              fill="url(#milkFillGrad)"
            />
          </g>
          {/* Subtle micro bubbles */}
          <circle className="milk-bubble-1" cx="17" cy="30" r="1.2" fill="rgba(37,99,235,0.25)" />
          <circle className="milk-bubble-2" cx="23" cy="35" r="1.5" fill="rgba(37,99,235,0.25)" />
        </g>

        {/* Glass Rim */}
        <ellipse cx="20" cy="8.5" rx="12" ry="3" stroke="rgba(255, 255, 255, 0.9)" strokeWidth="1.8" fill="rgba(255,255,255,0.08)" />
        <path
          d="M8 8.5 L11.5 40.5 C12.2 44.5 14.5 46 20 46 C25.5 46 27.8 44.5 28.5 40.5 L32 8.5"
          stroke="rgba(255, 255, 255, 0.9)"
          strokeWidth="1.8"
          strokeLinecap="round"
        />

        {/* Glass Highlight Sheen */}
        <path d="M11 12 L13.5 39 C14 41 15 42 17 42.5" stroke="url(#glassSheen)" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    </div>
  );
};

export const Header: React.FC<HeaderProps> = ({ currentTab, onTabChange, onSwitchToSimple }) => {
  const { language, toggleLanguage, t } = useLanguage();
  const { user, logout, updateUserLanguage } = useAuth();
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.play().catch(() => {});
    }
  }, []);

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

  const userInitial = user?.name ? user.name.charAt(0).toUpperCase() : 'A';

  return (
    <header className="app-header">
      {/* 4K Crystal-Clear Header Video Background */}
      <video
        ref={videoRef}
        className="header-bg-video"
        autoPlay
        loop
        muted
        playsInline
        preload="auto"
        aria-hidden="true"
      >
        <source src="/videos/Header_video.mp4" type="video/mp4" />
      </video>

      {/* Crystal-Clear Ambient Gradient Overlay */}
      <div className="header-video-overlay" />

      {/* Full-Width Responsive Header Content */}
      <div className="header-container">
        {/* Brand Section on the Far Left */}
        <div className="brand-section" onClick={() => onTabChange('dashboard')}>
          <div className="brand-icon-wrapper">
            <AnimatedMilkGlass size={30} />
          </div>
          <div className="brand-title-group">
            <h1 className="brand-main-title">Family Milk</h1>
            <span className="brand-pro-badge">PRO</span>
          </div>
        </div>

        {/* Desktop Tabs Centered */}
        <nav className="desktop-nav">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                className={`desktop-nav-link ${currentTab === item.id ? 'active' : ''}`}
                onClick={() => onTabChange(item.id)}
              >
                <Icon size={17} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Desktop Action Controls on Far Right */}
        <div className="header-actions">
          {/* Simple View Switcher for Admins */}
          {onSwitchToSimple && (
            <button
              className="lang-btn"
              onClick={onSwitchToSimple}
              title={t('simpleView')}
            >
              <Sparkles size={15} color="#38bdf8" />
              <span>{t('simpleView')}</span>
            </button>
          )}

          {/* Language Toggle Button */}
          <button
            className="lang-btn"
            onClick={handleLanguageToggle}
            title={t('language')}
          >
            <Globe size={15} color="#60a5fa" />
            <span>{language === 'ml' ? 'മലയാളം' : language === 'ta' ? 'தமிழ்' : 'English'}</span>
          </button>

          {/* User Profile Badge matching reference image */}
          <div className="header-user-profile-badge" title={user?.name || 'Family Admin'}>
            <div className="header-user-avatar">
              {userInitial}
            </div>
            <span className="header-user-name">
              {user?.name || 'Family Admin'}
            </span>
          </div>

          {/* Protected Logout */}
          <button
            className="lang-btn logout-icon-btn"
            onClick={handleLogout}
            title={t('logout')}
          >
            <LogOut size={15} />
          </button>
        </div>

        {/* Mobile Header Right: Sleek Avatar & Menu Trigger */}
        <div className="mobile-header-actions">
          <button
            className="mobile-menu-trigger-btn"
            onClick={() => setIsDrawerOpen(true)}
            aria-label="Open menu drawer"
          >
            <div className="mobile-avatar-pill">
              {userInitial}
            </div>
            <Menu size={20} color="white" />
          </button>
        </div>
      </div>

      {/* Slide-in Mobile Drawer (Sidebar) */}
      <MobileDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        currentTab={currentTab}
        onTabChange={onTabChange}
        onSwitchToSimple={onSwitchToSimple}
      />
    </header>
  );
};
