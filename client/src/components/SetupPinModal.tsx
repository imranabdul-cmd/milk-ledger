import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { KeyRound, ShieldAlert, CheckCircle2 } from 'lucide-react';

export const SetupPinModal: React.FC = () => {
  const { setupPin, logout } = useAuth();
  const { t, language } = useLanguage();

  const [newPin, setNewPin] = useState<string>('');
  const [confirmPin, setConfirmPin] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanNew = newPin.trim();
    const cleanConfirm = confirmPin.trim();

    if (cleanNew.length < 4) {
      setError(language === 'ml' ? 'കുറഞ്ഞത് 4 അക്ക പിൻ ആവശ്യമാണ്' : language === 'ta' ? 'குறைந்தது 4-இலக்க PIN தேவை' : 'PIN must be at least 4 digits');
      return;
    }

    if (cleanNew !== cleanConfirm) {
      setError(t('pinsDoNotMatch'));
      return;
    }

    setIsSubmitting(true);
    try {
      await setupPin(cleanNew);
    } catch (err: any) {
      setError(err.message || 'Failed to update PIN');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '1rem',
      }}
    >
      <div
        style={{
          background: 'white',
          borderRadius: 'var(--radius-xl, 20px)',
          padding: '2rem 1.75rem',
          maxWidth: '420px',
          width: '100%',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          border: '1.5px solid #3b82f6',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              background: '#eff6ff',
              color: '#2563eb',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1rem',
              boxShadow: '0 4px 12px rgba(37, 99, 235, 0.2)',
            }}
          >
            <KeyRound size={30} />
          </div>
          <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.5rem' }}>
            {t('setupPinTitle')}
          </h2>
          <p style={{ fontSize: '0.85rem', color: '#64748b', lineHeight: 1.5 }}>
            {t('setupPinSubtitle')}
          </p>
        </div>

        {error && (
          <div
            style={{
              background: '#fee2e2',
              color: '#991b1b',
              padding: '0.75rem 1rem',
              borderRadius: '10px',
              fontSize: '0.85rem',
              marginBottom: '1rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <ShieldAlert size={18} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group" style={{ marginBottom: '1rem' }}>
            <label className="form-label" style={{ fontWeight: 600 }}>
              {t('newPinLabel')}
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                className="form-input"
                placeholder="••••"
                value={newPin}
                onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
                required
                autoFocus
                style={{
                  fontSize: '1.25rem',
                  letterSpacing: '0.25em',
                  textAlign: 'center',
                  fontWeight: 700,
                }}
              />
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: '1.5rem' }}>
            <label className="form-label" style={{ fontWeight: 600 }}>
              {t('confirmPinLabel')}
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                className="form-input"
                placeholder="••••"
                value={confirmPin}
                onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
                required
                style={{
                  fontSize: '1.25rem',
                  letterSpacing: '0.25em',
                  textAlign: 'center',
                  fontWeight: 700,
                }}
              />
            </div>
          </div>

          <button
            type="submit"
            className="btn-primary-big"
            disabled={isSubmitting}
            style={{ minHeight: '48px', width: '100%', marginBottom: '0.75rem' }}
          >
            <CheckCircle2 size={18} />
            <span>{isSubmitting ? t('saving') : t('saveAndContinue')}</span>
          </button>

          <button
            type="button"
            onClick={logout}
            style={{
              width: '100%',
              background: 'none',
              border: 'none',
              color: '#64748b',
              fontSize: '0.85rem',
              cursor: 'pointer',
              padding: '0.5rem',
              textDecoration: 'underline',
            }}
          >
            {t('logout')}
          </button>
        </form>
      </div>
    </div>
  );
};
