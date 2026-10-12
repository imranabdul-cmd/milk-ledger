import React, { useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { apiRequest } from '../api/client';
import { formatPaise, PaymentMethod } from '@family-milk/shared';
import { formatDisplayMonthYear, getKolkataTodayDateString } from '../utils/dateFormatter';
import { useToast } from '../context/ToastContext';
import { X, CheckCircle, Wallet, Smartphone, Banknote } from 'lucide-react';

interface SettlementPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  month: string; // YYYY-MM
  dueAmountPaise: number;
}

export const SettlementPaymentModal: React.FC<SettlementPaymentModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  month,
  dueAmountPaise,
}) => {
  const { t, language } = useLanguage();
  const { toast } = useToast();

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('upi');
  const [date, setDate] = useState<string>(getKolkataTodayDateString());
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [notes, setNotes] = useState<string>('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (dueAmountPaise <= 0) {
      toast.warning('No due amount to settle.');
      onClose();
      return;
    }

    setIsSubmitting(true);
    try {
      await apiRequest('/api/settlement/pay-previous-month', {
        method: 'POST',
        body: JSON.stringify({
          previousMonth: month,
          amountPaise: dueAmountPaise,
          paymentMethod,
          date,
          notes: notes || undefined,
          freezeMonth: true
        })
      });

      toast.success(t('settlementRecordedSuccess'));
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Failed to record settlement payment');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-card"
        style={{ maxWidth: '460px', width: '92%' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(5, 150, 105, 0.3)'
              }}
            >
              <Wallet size={22} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--slate-900)' }}>
                {t('prevMonthSettlementTitle')}
              </h3>
              <p style={{ fontSize: '0.8rem', color: '#64748b' }}>
                {formatDisplayMonthYear(month, language)}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="drawer-close-btn"
            style={{ width: '36px', height: '36px' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Due Amount Highlight Card */}
        <div
          style={{
            background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
            border: '1.5px solid #86efac',
            borderRadius: '18px',
            padding: '1.25rem',
            textAlign: 'center',
            marginBottom: '1.4rem'
          }}
        >
          <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#166534', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            {t('totalSettledAmount')}
          </span>
          <div style={{ fontSize: '2.2rem', fontWeight: 900, color: '#14532d', margin: '0.2rem 0' }}>
            {formatPaise(dueAmountPaise)}
          </div>
          <span style={{ fontSize: '0.78rem', color: '#15803d', fontWeight: 600 }}>
            {formatDisplayMonthYear(month, language)} • 100% Full Settlement
          </span>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Payment Method Selector */}
          <div style={{ marginBottom: '1.25rem' }}>
            <label style={{ display: 'block', fontSize: '0.88rem', fontWeight: 700, color: '#334155', marginBottom: '0.65rem' }}>
              {t('selectPaymentMode')}
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              {/* Cash Button */}
              <button
                type="button"
                onClick={() => setPaymentMethod('cash')}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '1rem 0.75rem',
                  borderRadius: '16px',
                  border: paymentMethod === 'cash' ? '2px solid #059669' : '1.5px solid #cbd5e1',
                  background: paymentMethod === 'cash' ? '#f0fdf4' : '#ffffff',
                  color: paymentMethod === 'cash' ? '#065f46' : '#475569',
                  cursor: 'pointer',
                  fontWeight: 800,
                  transition: 'all 0.2s ease',
                  boxShadow: paymentMethod === 'cash' ? '0 4px 14px rgba(5,150,105,0.2)' : 'none'
                }}
              >
                <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: paymentMethod === 'cash' ? '#059669' : '#f1f5f9', color: paymentMethod === 'cash' ? 'white' : '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '0.4rem' }}>
                  <Banknote size={22} />
                </div>
                <span style={{ fontSize: '0.95rem' }}>{t('payViaCash')}</span>
              </button>

              {/* UPI Button */}
              <button
                type="button"
                onClick={() => setPaymentMethod('upi')}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '1rem 0.75rem',
                  borderRadius: '16px',
                  border: paymentMethod === 'upi' ? '2px solid #2563eb' : '1.5px solid #cbd5e1',
                  background: paymentMethod === 'upi' ? '#eff6ff' : '#ffffff',
                  color: paymentMethod === 'upi' ? '#1e40af' : '#475569',
                  cursor: 'pointer',
                  fontWeight: 800,
                  transition: 'all 0.2s ease',
                  boxShadow: paymentMethod === 'upi' ? '0 4px 14px rgba(37,99,235,0.2)' : 'none'
                }}
              >
                <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: paymentMethod === 'upi' ? '#2563eb' : '#f1f5f9', color: paymentMethod === 'upi' ? 'white' : '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '0.4rem' }}>
                  <Smartphone size={22} />
                </div>
                <span style={{ fontSize: '0.95rem' }}>{t('payViaUpi')}</span>
              </button>
            </div>
          </div>

          {/* Date Field */}
          <div style={{ marginBottom: '1.25rem' }}>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#475569', marginBottom: '0.35rem' }}>
              {t('paymentDate')}
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type="date"
                className="form-input"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>
          </div>

          {/* Optional Notes */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#475569', marginBottom: '0.35rem' }}>
              {t('notes')}
            </label>
            <input
              type="text"
              className="form-input"
              placeholder={`e.g. Paid by cash on 1st of month`}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              type="button"
              className="btn-secondary"
              style={{ flex: 1, justifyContent: 'center' }}
              onClick={onClose}
              disabled={isSubmitting}
            >
              {t('cancel')}
            </button>
            <button
              type="submit"
              className="btn-primary-big"
              style={{ flex: 2, justifyContent: 'center', background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)', borderColor: '#059669' }}
              disabled={isSubmitting}
            >
              <CheckCircle size={18} />
              <span>{isSubmitting ? 'Recording...' : t('confirmSettlementPayment')}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
