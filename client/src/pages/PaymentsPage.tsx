import React, { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { apiRequest } from '../api/client';
import { Payment, formatPaise } from '@family-milk/shared';
import { PaymentModal } from '../components/PaymentModal';
import { CreditCard, Plus, Filter } from 'lucide-react';

export const PaymentsPage: React.FC = () => {
  const { t, language } = useLanguage();

  const currentMonthStr = new Date().toISOString().substring(0, 7);
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthStr);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  const fetchPayments = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await apiRequest<{ payments: Payment[] }>(`/api/payments?month=${selectedMonth}`);
      setPayments(res.payments);
    } catch (err) {
      console.error('Failed to fetch payments:', err);
    } finally {
      setIsLoading(false);
    }
  }, [selectedMonth]);

  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

  const totalPaymentsAmount = payments.reduce((acc, p) => acc + p.amountPaise, 0);

  return (
    <div className="main-content">
      {/* Header & Add Button */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
        <div>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--slate-900)' }}>
            {t('payments')}
          </h2>
          <p style={{ fontSize: '0.85rem', color: '#059669', fontWeight: 700 }}>
            {t('paymentsMade')}: {formatPaise(totalPaymentsAmount)}
          </p>
        </div>

        <button
          className="btn-primary-big"
          style={{ width: 'auto', minHeight: '44px', padding: '0.6rem 1.25rem', fontSize: '0.95rem', background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)' }}
          onClick={() => setIsModalOpen(true)}
        >
          <Plus size={18} />
          <span>{t('recordPaymentNow')}</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div style={{ background: 'white', borderRadius: 'var(--radius-md)', padding: '0.85rem 1rem', marginBottom: '1.25rem', display: 'flex', gap: '0.75rem', alignItems: 'center', border: '1px solid var(--slate-200)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#64748b', fontSize: '0.85rem', fontWeight: 700 }}>
          <Filter size={16} />
          <span>{t('month')}:</span>
        </div>
        <input
          type="month"
          className="form-input"
          style={{ width: 'auto', padding: '0.45rem 0.75rem', fontSize: '0.9rem' }}
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
        />
      </div>

      {/* Payment List */}
      {isLoading ? (
        <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
          <p>{language === 'ml' ? 'വിവരങ്ങൾ എടുക്കുന്നു...' : 'Loading payments...'}</p>
        </div>
      ) : payments.length === 0 ? (
        <div style={{ background: 'white', borderRadius: 'var(--radius-lg)', padding: '3rem 1rem', textAlign: 'center', color: '#94a3b8' }}>
          <CreditCard size={44} style={{ margin: '0 auto 0.75rem', color: '#cbd5e1' }} />
          <p style={{ fontWeight: 600 }}>{language === 'ml' ? 'ഈ മാസത്തിൽ പണം നൽകിയത് രേഖപ്പെടുത്തിയിട്ടില്ല' : 'No payments found for this month.'}</p>
        </div>
      ) : (
        <div>
          {payments.map((p) => (
            <div key={p.id} className="activity-card" style={{ padding: '1.15rem 1rem' }}>
              <div className="activity-left">
                <div className="activity-icon-badge badge-pay">
                  <CreditCard size={24} />
                </div>
                <div>
                  <div className="activity-title">
                    {p.paymentMethod.toUpperCase()} {t('payments')}
                  </div>
                  <div className="activity-meta">
                    📅 {p.date} {p.createdByName ? `• ${p.createdByName}` : ''}
                  </div>
                  {p.notes && (
                    <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.2rem' }}>
                      "{p.notes}"
                    </div>
                  )}
                </div>
              </div>

              <div className="activity-right">
                <div className="activity-amount income" style={{ fontSize: '1.25rem' }}>
                  +{formatPaise(p.amountPaise)}
                </div>
                <span style={{ fontSize: '0.75rem', background: '#ecfdf5', color: '#047857', padding: '0.2rem 0.5rem', borderRadius: '4px', fontWeight: 700 }}>
                  Recorded
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      <PaymentModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={fetchPayments}
      />
    </div>
  );
};
