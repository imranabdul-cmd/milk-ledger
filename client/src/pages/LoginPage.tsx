import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import {
  Lock,
  Phone,
  Globe,
  AlertCircle,
  ShieldCheck,
  User,
  Home,
  DollarSign,
  LogIn,
  Eye,
  EyeOff,
  Sparkles,
  Loader2
} from 'lucide-react';

type AuthMode = 'login' | 'create_family';

export const LoginPage: React.FC = () => {
  const { login, registerFamily } = useAuth();
  const { language, setLanguage, t } = useLanguage();

  const [mode, setMode] = useState<AuthMode>('login');

  // Common Fields
  const [phone, setPhone] = useState<string>('');
  const [pin, setPin] = useState<string>('');
  const [showPin, setShowPin] = useState<boolean>(false);
  const [name, setName] = useState<string>('');

  // Create Family Fields
  const [familyName, setFamilyName] = useState<string>('');
  const [initialRateRupees, setInitialRateRupees] = useState<number>(56);

  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Video reference with guaranteed continuous seamless 4K autoplay
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const playVideo = () => {
      if (videoRef.current) {
        videoRef.current.play().catch(() => {});
      }
    };
    playVideo();

    // Ensure video never pauses even if tab is switched or minimized
    document.addEventListener('visibilitychange', playVideo);
    window.addEventListener('focus', playVideo);
    return () => {
      document.removeEventListener('visibilitychange', playVideo);
      window.removeEventListener('focus', playVideo);
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      if (mode === 'login') {
        await login(phone.trim(), pin.trim());
      } else if (mode === 'create_family') {
        if (!familyName.trim() || !name.trim()) {
          throw new Error(t('requiredField'));
        }
        await registerFamily({
          familyName: familyName.trim(),
          ownerName: name.trim(),
          phone: phone.trim(),
          pin: pin.trim(),
          initialRateRupees: Number(initialRateRupees) || 56,
          languagePreference: language
        });
      }
    } catch (err: any) {
      setError(err.message || t('invalidCredentials'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-video-wrapper">
      {/* ==============================================================
          CINEMATIC BACKGROUND MILK VIDEO
          ============================================================== */}
      <video
        ref={videoRef}
        className="login-bg-video"
        autoPlay
        loop
        muted
        playsInline
        preload="auto"
        poster="/videos/milk_thumb.jpg"
        aria-hidden="true"
      >
        <source src="/videos/Milk_video.mp4" type="video/mp4" />
      </video>

      {/* Atmospheric dark gradient overlay for crystal-clear foreground readability */}
      <div className="login-video-overlay" />

      {/* ==============================================================
          TOP FLOATING NAVIGATION BAR (fixed above scroll area)
          ============================================================== */}
      <header className="login-top-nav">
        {/* Brand Pill */}
        <div className="login-brand-pill">
          <img
            src="/branding/apple-touch-icon.png"
            alt="Family Milk Account Logo"
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '8px',
              objectFit: 'contain',
              boxShadow: '0 2px 8px rgba(37,99,235,0.4)',
              display: 'block'
            }}
          />
          <span style={{ fontWeight: 800, fontSize: '0.9rem', letterSpacing: '-0.01em' }}>
            Family Milk
          </span>
          <span
            style={{
              fontSize: '0.65rem',
              fontWeight: 800,
              background: 'rgba(56, 189, 248, 0.2)',
              color: '#38bdf8',
              padding: '0.1rem 0.45rem',
              borderRadius: '999px',
              border: '1px solid rgba(56, 189, 248, 0.3)'
            }}
          >
            PRO
          </span>
        </div>

        {/* Right Action Controls: Language Selector */}
        <div className="login-lang-switcher-wrap">
          <div className="login-lang-switcher">
            <Globe size={12} color="#94a3b8" />
            <button
              type="button"
              onClick={() => setLanguage('ta')}
              className={`login-lang-pill ${language === 'ta' ? 'active' : ''}`}
            >
              த
            </button>
            <button
              type="button"
              onClick={() => setLanguage('ml')}
              className={`login-lang-pill ${language === 'ml' ? 'active' : ''}`}
            >
              മ
            </button>
            <button
              type="button"
              onClick={() => setLanguage('en')}
              className={`login-lang-pill ${language === 'en' ? 'active' : ''}`}
            >
              EN
            </button>
          </div>
        </div>
      </header>

      {/* ==============================================================
          SCROLLABLE CONTENT AREA: Card + Footer
          Sits above the fixed video/overlay layers, scrolls inside the
          fixed viewport container so the page itself never scrolls.
          ============================================================== */}
      <div className="login-scroll-area">
        <main className="login-glass-card">
        {/* Brand Logo & Headline */}
        <div className="login-brand-section">
          {/* Logo with Soft Gradient Glow */}
          <div
            className="login-logo-glow"
            style={{
              overflow: 'hidden',
              padding: '2px',
              background: 'transparent',
              boxShadow: '0 10px 24px rgba(37, 99, 235, 0.35), 0 0 0 2px rgba(255, 255, 255, 0.85)'
            }}
          >
            <img
              src="/branding/icon-192.png"
              alt="Family Milk Account Logo"
              style={{
                width: '100%',
                height: '100%',
                borderRadius: '18px',
                objectFit: 'contain',
                display: 'block'
              }}
            />
          </div>

          {/* Micro Tagline Pill */}
          <div className="login-tagline-pill">
            <Sparkles size={11} color="#2563eb" />
            <span>Smart Dairy Ledger</span>
          </div>

          <h1 className="login-heading">
            {t('appName')}
          </h1>

          <p className="login-subtitle">
            {language === 'ta'
              ? 'தினசரி பால் கணக்கு & மாதாந்திர தீர்வு'
              : language === 'ml'
              ? 'പ്രതിദിന പാൽ കണക്കും പ്രതിമാസ തീർപ്പും'
              : t('tagline')}
          </p>
        </div>

        {/* Multi-Tenant Segmented Control: Login vs Create Family */}
        <div className="login-segmented-control" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'login'}
            onClick={() => { setMode('login'); setError(null); }}
            className={`login-segmented-btn ${mode === 'login' ? 'active' : ''}`}
          >
            <LogIn size={16} />
            <span>{t('loginTab')}</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={mode === 'create_family'}
            onClick={() => { setMode('create_family'); setError(null); }}
            className={`login-segmented-btn ${mode === 'create_family' ? 'active' : ''}`}
          >
            <Home size={16} />
            <span>{t('createFamilyTab')}</span>
          </button>
        </div>

        {/* Error Notification Alert */}
        {error && (
          <div
            style={{
              background: 'rgba(239, 68, 68, 0.2)',
              color: '#fecaca',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              padding: '0.75rem 1rem',
              borderRadius: '14px',
              marginBottom: '1rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.55rem',
              fontSize: '0.85rem',
              fontWeight: 600,
              animation: 'fadeIn 0.2s ease'
            }}
          >
            <AlertCircle size={18} color="#fca5a5" style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit}>
          {/* MODE: CREATE FAMILY SPECIFIC FIELDS */}
          {mode === 'create_family' && (
            <>
              <div className="login-input-group">
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.35rem' }}>
                  <Home size={15} color="#2563eb" />
                  <span>{t('familyNameLabel')}</span>
                </label>
                <div className="login-input-wrapper">
                  <span className="login-input-icon">
                    <Home size={17} />
                  </span>
                  <input
                    type="text"
                    className="login-input-field"
                    placeholder={t('familyNamePlaceholder')}
                    value={familyName}
                    onChange={(e) => setFamilyName(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="login-input-group">
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.35rem' }}>
                  <User size={15} color="#2563eb" />
                  <span>{t('ownerNameLabel')}</span>
                </label>
                <div className="login-input-wrapper">
                  <span className="login-input-icon">
                    <User size={17} />
                  </span>
                  <input
                    type="text"
                    className="login-input-field"
                    placeholder={t('ownerNamePlaceholder')}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="login-input-group">
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.35rem' }}>
                  <DollarSign size={15} color="#2563eb" />
                  <span>{t('initialRateLabel')}</span>
                </label>
                <div className="login-input-wrapper">
                  <span className="login-input-icon">
                    <DollarSign size={17} />
                  </span>
                  <input
                    type="number"
                    step="0.5"
                    className="login-input-field"
                    value={initialRateRupees}
                    onChange={(e) => setInitialRateRupees(parseFloat(e.target.value) || 56)}
                    required
                    style={{ fontWeight: 800, fontSize: '1.05rem', color: '#1e3a8a' }}
                  />
                </div>
              </div>
            </>
          )}

          {/* COMMON: PHONE NUMBER INPUT */}
          <div className="login-input-group">
            <label
              className="form-label"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                fontSize: '0.85rem',
                fontWeight: 700,
                color: '#1e293b',
                marginBottom: '0.35rem'
              }}
            >
              <Phone size={15} color="#2563eb" />
              <span>{t('phoneNumber')}</span>
            </label>
            <div className="login-input-wrapper">
              <span className="login-input-icon">
                <Phone size={17} />
              </span>
              <input
                type="tel"
                className="login-input-field"
                placeholder={t('phonePlaceholder')}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                style={{
                  fontSize: '1.08rem',
                  letterSpacing: '0.03em',
                  fontWeight: 700,
                  color: '#0f172a'
                }}
              />
            </div>
          </div>

          {/* COMMON: SECURITY PIN INPUT WITH SHOW/HIDE TOGGLE */}
          <div className="login-input-group login-pin-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
              <label
                className="form-label"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  color: '#1e293b',
                  margin: 0
                }}
              >
                <Lock size={15} color="#2563eb" />
                <span>{t('pin')}</span>
              </label>

              <button
                type="button"
                onClick={() => setShowPin(!showPin)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#64748b',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                  padding: '0.1rem 0.35rem',
                  borderRadius: '6px'
                }}
              >
                {showPin ? <EyeOff size={14} /> : <Eye size={14} />}
                <span>{showPin ? (language === 'ta' ? 'மறை' : language === 'ml' ? 'മറയ്ക്കുക' : 'Hide') : (language === 'ta' ? 'காட்டு' : language === 'ml' ? 'காണിക്കുക' : 'Show')}</span>
              </button>
            </div>

            <div className="login-input-wrapper">
              <span className="login-input-icon">
                <Lock size={17} />
              </span>
              <input
                type={showPin ? 'text' : 'password'}
                inputMode="numeric"
                maxLength={10}
                className="login-input-field"
                placeholder="••••"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                required
                style={{
                  fontSize: showPin ? '1.15rem' : '1.5rem',
                  letterSpacing: showPin ? '0.08em' : '0.25em',
                  textAlign: 'center',
                  fontWeight: 800,
                  color: '#1e3a8a'
                }}
              />
            </div>
          </div>

          {/* HIGH-END SUBMIT BUTTON */}
          <button
            type="submit"
            className="login-submit-btn"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 size={20} className="spinner" style={{ animation: 'spin 1s linear infinite' }} />
                <span>{mode === 'create_family' ? t('creatingFamily') : t('loggingIn')}</span>
              </>
            ) : (
              <>
                <LogIn size={18} />
                <span>{mode === 'create_family' ? t('createFamilyCTA') : t('loginBtn')}</span>
              </>
            )}
          </button>
        </form>

        {/* Security Reassurance Trust Badge */}
        <div className="login-trust-badge">
          <ShieldCheck size={16} color="#16a34a" style={{ flexShrink: 0 }} />
          <span style={{ fontWeight: 700 }}>
            {t('persistentLoginNote')}
          </span>
        </div>
      </main>

      {/* Floating Bottom Footer */}
      <footer className="login-footer">
        Family Milk Account &bull; Pure &amp; Simple Milk Tracking
      </footer>
      </div>
    </div>
  );
};

