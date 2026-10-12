import React, { useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { apiRequest } from '../api/client';
import { formatPaise } from '@family-milk/shared';
import { X, TrendingUp, AlertCircle, Check } from 'lucide-react';
import { getKolkataTodayDateString } from '../utils/dateFormatter';
import { notifyDataChanged } from '../hooks/useAutoSync';

interface UpdateRateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  currentRatePaise: number;
}

export const UpdateRateModal: React.FC<UpdateRateModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  currentRatePaise
}) => {
  const { t, language } = useLanguage();
  const todayStr = getKolkataTodayDateString();

  const [rateRupees, setRateRupees] = useState<string>((currentRatePaise / 100).toString());
  const [effectiveFrom, setEffectiveFrom] = useState<string>(todayStr);
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const numericRate = parseFloat(rateRupees);
    if (isNaN(numericRate) || numericRate <= 0) {
      setError(language === 'ta' ? 'சரியான பால் விலையை உள்ளிடவும்' : language === 'ml' ? 'ശരിയായ പാൽ വില നൽകുക' : 'Please enter a valid milk rate');
      return;
    }

    setIsSubmitting(true);
    try {
      await apiRequest('/api/milk/rates', {
        method: 'POST',
        body: JSON.stringify({
          rateRupees: numericRate,
          effectiveFrom,
          notes: notes.trim() || undefined
        })
      });

      notifyDataChanged();
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to update rate');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-card"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '440px' }}
      >
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: '10px',
                background: '#ecfdf5',
                color: '#059669',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <TrendingUp size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--slate-900)' }}>
                {t('editRateTitle')}
              </h3>
              <p style={{ fontSize: '0.8rem', color: '#64748b' }}>
                {t('currentRate')}: {formatPaise(currentRatePaise)}/L
              </p>
            </div>
          </div>
          <button className="modal-close-btn" onClick={onClose} aria-label="Close modal">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '1.25rem' }}>
          {error && (
            <div className="alert-box alert-error" style={{ marginBottom: '1rem' }}>
              <AlertCircle size={18} />
              <span>{error}</span>
            </div>
          )}

          {/* New Rate Input */}
          <div className="form-group" style={{ marginBottom: '1rem' }}>
            <label className="form-label">{t('newRateLabel')}</label>
            <div style={{ position: 'relative' }}>
              <span
                style={{
                  position: 'absolute',
                  left: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  fontWeight: 800,
                  color: '#64748b',
                  fontSize: '1.1rem'
                }}
              >
                ₹
              </span>
              <input
                type="number"
                step="0.5"
                min="1"
                max="500"
                className="form-input"
                style={{ paddingLeft: '2rem', fontSize: '1.1rem', fontWeight: 700 }}
                value={rateRupees}
                onChange={(e) => setRateRupees(e.target.value)}
                required
                autoFocus
              />
            </div>
          </div>

          {/* Effective From Date */}
          <div className="form-group" style={{ marginBottom: '1rem' }}>
            <label className="form-label">{t('effectiveFrom')}</label>
            <input
              type="date"
              className="form-input"
              value={effectiveFrom}
              onChange={(e) => setEffectiveFrom(e.target.value)}
              required
            />
          </div>

          {/* Notes */}
          <div className="form-group" style={{ marginBottom: '1.5rem' }}>
            <label className="form-label">{t('notes')}</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. Rate revision for October"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <button
              type="button"
              className="btn-secondary"
              onClick={onClose}
              disabled={isSubmitting}
            >
              {t('cancel')}
            </button>
            <button
              type="submit"
              className="btn-primary"
              style={{ background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)' }}
              disabled={isSubmitting}
            >
              {isSubmitting ? t('saving') : (
                <>
                  <Check size={18} />
                  <span>{t('saveRate')}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
