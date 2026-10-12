import React, { useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { apiRequest } from '../api/client';
import { PaymentMethod, rupeesToPaise } from '@family-milk/shared';
import { X, CreditCard, AlertCircle } from 'lucide-react';
import { getKolkataTodayDateString } from '../utils/dateFormatter';
import { notifyDataChanged } from '../hooks/useAutoSync';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  defaultAmountRupees?: number;
}

export const PaymentModal: React.FC<PaymentModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  defaultAmountRupees = 0,
}) => {
  const { t } = useLanguage();

  const todayStr = getKolkataTodayDateString();
  const [date, setDate] = useState<string>(todayStr);
  const [amountRupees, setAmountRupees] = useState<string>(
    defaultAmountRupees > 0 ? defaultAmountRupees.toString() : ''
  );
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const parsedRupees = parseFloat(amountRupees);
    if (isNaN(parsedRupees) || parsedRupees <= 0) {
      setError(t('invalidNumber'));
      return;
    }

    setIsSubmitting(true);
    const amountPaise = rupeesToPaise(parsedRupees);
    const idempotencyKey = `pay-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    try {
      await apiRequest('/api/payments', {
        method: 'POST',
        body: JSON.stringify({
          date,
          amountPaise,
          paymentMethod,
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

  const quickAmounts = [100, 200, 500, 1000];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <CreditCard size={24} color="#059669" />
            <h2 className="modal-title">{t('recordPaymentNow')}</h2>
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
            <label className="form-label">{t('paymentDate')}</label>
            <input
              type="date"
              className="form-input"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>

          {/* Amount Input */}
          <div className="form-group">
            <label className="form-label">{t('paymentAmount')}</label>
            <input
              type="number"
              step="1"
              min="1"
              max="100000"
              className="form-input"
              placeholder="₹ 0"
              value={amountRupees}
              onChange={(e) => setAmountRupees(e.target.value)}
              required
              autoFocus
              style={{ fontSize: '1.4rem', fontWeight: 700 }}
            />
            {/* Quick Amount Chips */}
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
              {quickAmounts.map((amt) => (
                <button
                  key={amt}
                  type="button"
                  className="btn-secondary"
                  style={{ padding: '0.35rem 0.75rem', fontSize: '0.85rem' }}
                  onClick={() => setAmountRupees(amt.toString())}
                >
                  ₹{amt}
                </button>
              ))}
            </div>
          </div>

          {/* Payment Method */}
          <div className="form-group">
            <label className="form-label">{t('paymentMethod')}</label>
            <select
              className="form-select"
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
            >
              <option value="cash">{t('cash')}</option>
              <option value="upi">{t('upi')}</option>
              <option value="bank_transfer">{t('bankTransfer')}</option>
              <option value="other">{t('other')}</option>
            </select>
          </div>

          {/* Notes */}
          <div className="form-group">
            <label className="form-label">{t('notes')}</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. Paid to milkman via GPay"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {/* Big Action Button */}
          <button
            type="submit"
            className="btn-primary-big"
            style={{ background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)' }}
            disabled={isSubmitting}
          >
            {isSubmitting ? t('saving') : t('savePayment')}
          </button>
        </form>
      </div>
    </div>
  );
};
