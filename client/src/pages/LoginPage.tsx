import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import {
  Milk,
  Lock,
  Phone,
  Globe,
  AlertCircle,
  ShieldCheck,
  User,
  Home,
  DollarSign,
  LogIn
} from 'lucide-react';

type AuthMode = 'login' | 'create_family';

export const LoginPage: React.FC = () => {
  const { login, registerFamily } = useAuth();
  const { language, toggleLanguage, t } = useLanguage();

  const [mode, setMode] = useState<AuthMode>('login');

  // Common Fields
  const [phone, setPhone] = useState<string>('9952590815');
  const [pin, setPin] = useState<string>('');
  const [name, setName] = useState<string>('');

  // Create Family Fields
  const [familyName, setFamilyName] = useState<string>('');
  const [initialRateRupees, setInitialRateRupees] = useState<number>(56);

  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

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
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: '1.25rem', background: 'linear-gradient(135deg, #eff6ff 0%, #e0e7ff 100%)' }}>
      {/* Language Switcher in Corner */}
      <div style={{ position: 'absolute', top: '1.25rem', right: '1.25rem', zIndex: 10 }}>
        <button
          type="button"
          onClick={toggleLanguage}
          className="btn-secondary"
          style={{ background: 'white', border: '1px solid #cbd5e1', boxShadow: 'var(--shadow-sm)', padding: '0.5rem 0.85rem' }}
          title={t('language')}
        >
          <Globe size={18} color="#2563eb" />
          <span style={{ fontWeight: 700 }}>
            {language === 'ta' ? 'தமிழ்' : language === 'ml' ? 'മലയാളം' : 'English'}
          </span>
        </button>
      </div>

      <div style={{ width: '100%', maxWidth: '440px', background: 'white', borderRadius: 'var(--radius-xl)', padding: '2rem 1.75rem', boxShadow: 'var(--shadow-card)', border: '1px solid rgba(226, 232, 240, 0.8)', marginTop: '2rem', marginBottom: '2rem' }}>
        {/* Brand Header */}
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <div style={{ width: '60px', height: '60px', background: 'linear-gradient(135deg, #1e40af 0%, #2563eb 100%)', borderRadius: 'var(--radius-lg)', margin: '0 auto 0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 16px rgba(37, 99, 235, 0.25)' }}>
            <Milk size={32} color="white" />
          </div>
          <h1 style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--slate-900)', marginBottom: '0.2rem' }}>
            {t('appName')}
          </h1>
          <p style={{ fontSize: '0.85rem', color: 'var(--slate-500)' }}>
            {t('tagline')}
          </p>
        </div>

        {/* Multi-Tenant Auth Mode Segmented Control: 2 Public Actions */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.35rem', background: '#f1f5f9', padding: '0.35rem', borderRadius: '14px', marginBottom: '1.5rem' }}>
          <button
            type="button"
            onClick={() => { setMode('login'); setError(null); }}
            style={{
              padding: '0.65rem 0.5rem',
              border: 'none',
              borderRadius: '10px',
              fontSize: '0.85rem',
              fontWeight: 700,
              cursor: 'pointer',
              background: mode === 'login' ? 'white' : 'transparent',
              color: mode === 'login' ? '#1e40af' : '#64748b',
              boxShadow: mode === 'login' ? '0 2px 6px rgba(0,0,0,0.08)' : 'none',
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.35rem'
            }}
          >
            <LogIn size={16} />
            <span>{t('loginTab')}</span>
          </button>

          <button
            type="button"
            onClick={() => { setMode('create_family'); setError(null); }}
            style={{
              padding: '0.65rem 0.5rem',
              border: 'none',
              borderRadius: '10px',
              fontSize: '0.85rem',
              fontWeight: 700,
              cursor: 'pointer',
              background: mode === 'create_family' ? 'white' : 'transparent',
              color: mode === 'create_family' ? '#1e40af' : '#64748b',
              boxShadow: mode === 'create_family' ? '0 2px 6px rgba(0,0,0,0.08)' : 'none',
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.35rem'
            }}
          >
            <Home size={16} />
            <span>{t('createFamilyTab')}</span>
          </button>
        </div>

        {error && (
          <div style={{ background: '#fee2e2', color: '#b91c1c', padding: '0.75rem 1rem', borderRadius: '12px', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
            <AlertCircle size={18} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* MODE: CREATE FAMILY SPECIFIC FIELDS */}
          {mode === 'create_family' && (
            <>
              <div className="form-group">
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Home size={16} color="#64748b" />
                  <span>{t('familyNameLabel')}</span>
                </label>
                <input
                  type="text"
                  className="form-input"
                  placeholder={t('familyNamePlaceholder')}
                  value={familyName}
                  onChange={(e) => setFamilyName(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <User size={16} color="#64748b" />
                  <span>{t('ownerNameLabel')}</span>
                </label>
                <input
                  type="text"
                  className="form-input"
                  placeholder={t('ownerNamePlaceholder')}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <DollarSign size={16} color="#64748b" />
                  <span>{t('initialRateLabel')}</span>
                </label>
                <input
                  type="number"
                  step="0.5"
                  className="form-input"
                  value={initialRateRupees}
                  onChange={(e) => setInitialRateRupees(parseFloat(e.target.value) || 56)}
                  required
                  style={{ fontWeight: 700 }}
                />
              </div>
            </>
          )}

          {/* COMMON: PHONE INPUT */}
          <div className="form-group">
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Phone size={16} color="#64748b" />
              <span>{t('phoneNumber')}</span>
            </label>
            <input
              type="tel"
              className="form-input"
              placeholder={t('phonePlaceholder')}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
              style={{ fontSize: '1.15rem', letterSpacing: '0.02em', fontWeight: 600 }}
            />
          </div>

          {/* COMMON: PIN INPUT */}
          <div className="form-group" style={{ marginBottom: '1.75rem' }}>
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Lock size={16} color="#64748b" />
              <span>{t('pin')}</span>
            </label>
            <input
              type="password"
              inputMode="numeric"
              maxLength={10}
              className="form-input"
              placeholder="••••"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              required
              style={{ fontSize: '1.4rem', letterSpacing: '0.2em', textAlign: 'center', fontWeight: 700 }}
            />
          </div>

          {/* SUBMIT CTA */}
          <button
            type="submit"
            className="btn-primary-big"
            disabled={isLoading}
          >
            {isLoading
              ? (mode === 'create_family' ? t('creatingFamily') : t('loggingIn'))
              : (mode === 'create_family' ? t('createFamilyCTA') : t('loginBtn'))}
          </button>
        </form>

        {/* Permanent Login Reassurance Badge */}
        <div style={{ marginTop: '1.25rem', padding: '0.85rem 1rem', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '12px', fontSize: '0.82rem', color: '#166534', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
          <ShieldCheck size={20} color="#16a34a" style={{ flexShrink: 0 }} />
          <span style={{ fontWeight: 600 }}>{t('persistentLoginNote')}</span>
        </div>
      </div>
    </div>
  );
};
