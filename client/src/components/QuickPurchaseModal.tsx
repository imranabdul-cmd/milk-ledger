import React, { useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { apiRequest } from '../api/client';
import { calculateMilkCostPaise, formatPaise } from '@family-milk/shared';
import { X, Check, Clock, Droplets, AlertCircle } from 'lucide-react';
import { getKolkataTodayDateString } from '../utils/dateFormatter';
import { notifyDataChanged } from '../hooks/useAutoSync';

interface QuickPurchaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  currentRatePaise: number;
  initialQuantityMl?: number;
}

export const QuickPurchaseModal: React.FC<QuickPurchaseModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  currentRatePaise,
  initialQuantityMl = 500,
}) => {
  const { t, language } = useLanguage();

  // Today in Asia/Kolkata
  const todayStr = getKolkataTodayDateString();

  const [date, setDate] = useState<string>(todayStr);
  const [quantityMl, setQuantityMl] = useState<number>(initialQuantityMl);
  const [customMlInput, setCustomMlInput] = useState<string>('');
  const [isCustomMode, setIsCustomMode] = useState<boolean>(initialQuantityMl !== 500 && initialQuantityMl !== 1000);
  const [paymentChoice, setPaymentChoice] = useState<'paid' | 'pending'>('pending');
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const totalCostPaise = calculateMilkCostPaise(quantityMl, currentRatePaise);

  const handleSelectPreset = (ml: number) => {
    setIsCustomMode(false);
    setQuantityMl(ml);
  };

  const handleCustomMlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setCustomMlInput(val);
    const parsed = parseInt(val, 10);
    if (!isNaN(parsed) && parsed > 0) {
      setQuantityMl(parsed);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (quantityMl <= 0) {
      setError(t('invalidNumber'));
      return;
    }

    setIsSubmitting(true);
    const idempotencyKey = `entry-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    try {
      await apiRequest('/api/milk/entries', {
        method: 'POST',
        body: JSON.stringify({
          date,
          quantityMl,
          paymentChoice,
          notes: notes.trim() || undefined,
          idempotencyKey,
        }),
      });

      onSuccess();
      notifyDataChanged();
      onClose();
    } catch (err: any) {
      setError(err.message || t('errorSaving'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Droplets size={24} color="#1d4ed8" />
            <h2 className="modal-title">{t('recordMilkNow')}</h2>
          </div>
          <button className="modal-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {error && (
          <div style={{ background: '#fee2e2', color: '#b91c1c', padding: '0.75rem', borderRadius: '10px', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem' }}>
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Date Picker */}
          <div className="form-group">
            <label className="form-label">{t('date')}</label>
            <input
              type="date"
              className="form-input"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>

          {/* Quick Quantity Presets */}
          <div className="form-group">
            <label className="form-label">{t('quantity')}</label>
            <div className="quick-grid">
              <button
                type="button"
                className={`quick-tap-btn ${quantityMl === 500 && !isCustomMode ? 'selected-paid' : ''}`}
                style={{ borderColor: quantityMl === 500 && !isCustomMode ? '#2563eb' : undefined }}
                onClick={() => handleSelectPreset(500)}
              >
                <span className="quick-qty-val">{language === 'ml' ? '½ ലി' : language === 'ta' ? '½ லி' : '½ L'}</span>
                <span className="quick-qty-sub">{t('halfLitreSub')}</span>
              </button>

              <button
                type="button"
                className={`quick-tap-btn ${quantityMl === 1000 && !isCustomMode ? 'selected-paid' : ''}`}
                style={{ borderColor: quantityMl === 1000 && !isCustomMode ? '#2563eb' : undefined }}
                onClick={() => handleSelectPreset(1000)}
              >
                <span className="quick-qty-val">{language === 'ml' ? '1 ലി' : language === 'ta' ? '1 லி' : '1 L'}</span>
                <span className="quick-qty-sub">{t('oneLitreSub')}</span>
              </button>

              <button
                type="button"
                className={`quick-tap-btn custom-btn ${isCustomMode ? 'selected-paid' : ''}`}
                style={{ borderColor: isCustomMode ? '#2563eb' : undefined }}
                onClick={() => setIsCustomMode(true)}
              >
                <span className="quick-qty-val" style={{ fontSize: '1.2rem' }}>⚙️</span>
                <span className="quick-qty-sub">{t('customQty')}</span>
              </button>
            </div>

            {isCustomMode && (
              <div style={{ marginTop: '0.5rem' }}>
                <input
                  type="number"
                  step="50"
                  min="50"
                  max="50000"
                  className="form-input"
                  placeholder="e.g. 750 (for 750 ml) or 1500 (for 1.5 L)"
                  value={customMlInput}
                  onChange={handleCustomMlChange}
                  autoFocus
                />
                <small style={{ color: '#64748b', display: 'block', marginTop: '0.25rem' }}>
                  {language === 'ml'
                    ? 'മില്ലിലിറ്ററിൽ നൽകുക (1 ലിറ്റർ = 1000 ml)'
                    : language === 'ta'
                    ? 'மில்லிலிட்டரில் உள்ளிடவும் (1 லிட்டர் = 1000 ml)'
                    : 'Enter in millilitres (1 Litre = 1000 ml)'}
                </small>
              </div>
            )}
          </div>

          {/* Amount Preview Card */}
          <div style={{ background: '#eff6ff', borderRadius: '12px', padding: '0.85rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <div>
              <span style={{ fontSize: '0.8rem', color: '#1e40af', fontWeight: 600 }}>{t('totalAmount')}</span>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#1e3a8a' }}>
                {formatPaise(totalCostPaise)}
              </div>
            </div>
            <div style={{ textAlign: 'right', fontSize: '0.8rem', color: '#64748b' }}>
              <div>{quantityMl / 1000} {t('litres')}</div>
              <div>@ {formatPaise(currentRatePaise)}/L</div>
            </div>
          </div>

          {/* Large Paid vs Pending Selection */}
          <div className="form-group">
            <label className="form-label">{t('paymentChoice')}</label>
            <div className="payment-toggle-group">
              <div
                className={`toggle-option ${paymentChoice === 'pending' ? 'selected-pending' : ''}`}
                onClick={() => setPaymentChoice('pending')}
              >
                <div className="toggle-title" style={{ color: '#dc2626' }}>
                  <Clock size={20} />
                  <span>{t('pending')}</span>
                </div>
                <div className="toggle-desc">{t('pendingDesc')}</div>
              </div>

              <div
                className={`toggle-option ${paymentChoice === 'paid' ? 'selected-paid' : ''}`}
                onClick={() => setPaymentChoice('paid')}
              >
                <div className="toggle-title" style={{ color: '#059669' }}>
                  <Check size={20} />
                  <span>{t('paid')}</span>
                </div>
                <div className="toggle-desc">{t('paidDesc')}</div>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="form-group">
            <label className="form-label">{t('notes')}</label>
            <input
              type="text"
              className="form-input"
              placeholder={t('notesPlaceholder')}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {/* Big Action Button */}
          <button
            type="submit"
            className="btn-primary-big"
            disabled={isSubmitting}
          >
            {isSubmitting ? t('saving') : t('save')}
          </button>
        </form>
      </div>
    </div>
  );
};
