import React, { useState, useCallback, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { apiRequest } from '../api/client';
import { Payment, formatPaise } from '@family-milk/shared';
import { PaymentModal } from '../components/PaymentModal';
import { MonthSettlementDetailModal } from '../components/MonthSettlementDetailModal';
import { DateTimeBadge } from '../components/DateTimeBadge';
import { CreditCard, Plus, Filter, FileText, Smartphone, Banknote } from 'lucide-react';
import { useAutoSync, notifyDataChanged } from '../hooks/useAutoSync';
import { formatDisplayMonthYear } from '../utils/dateFormatter';

export const PaymentsPage: React.FC = () => {
  const { t, language } = useLanguage();

  const currentMonthStr = new Date().toISOString().substring(0, 7);
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthStr);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  // Month Detail Modal State
  const [isDetailModalOpen, setIsDetailModalOpen] = useState<boolean>(false);
  const [detailMonth, setDetailMonth] = useState<string>(currentMonthStr);
  const [detailPayment, setDetailPayment] = useState<Payment | null>(null);

  const fetchPayments = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    try {
      const res = await apiRequest<{ payments: Payment[] }>(`/api/payments?month=${selectedMonth}`);
      setPayments(res.payments);
    } catch (err) {
      console.error('Failed to fetch payments:', err);
    } finally {
      setIsLoading(false);
    }
  }, [selectedMonth]);

  // Fetch immediately on mount & when month changes
  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

  // Silent background sync
  useAutoSync(fetchPayments, { intervalMs: 8000, immediate: false });

  const totalPaymentsAmount = payments.reduce((acc, p) => acc + p.amountPaise, 0);

  const handleOpenDetails = (p: Payment) => {
    const sMonth = p.settlementMonth || p.notes?.match(/\[Settlement:\s*(\d{4}-\d{2})\]/)?.[1] || p.date.substring(0, 7);
    setDetailMonth(sMonth);
    setDetailPayment(p);
    setIsDetailModalOpen(true);
  };

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

      {/* Filter Bar with Frosted Glassmorphism */}
      <div className="filter-glass-bar">
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
          <p>{language === 'ml' ? 'വിവരങ്ങൾ എടുക്കുന്നു...' : language === 'ta' ? 'பணப் பதிவுகளை ஏற்றுகிறது...' : 'Loading payments...'}</p>
        </div>
      ) : payments.length === 0 ? (
        <div style={{ background: 'white', borderRadius: 'var(--radius-lg)', padding: '3rem 1rem', textAlign: 'center', color: '#94a3b8' }}>
          <CreditCard size={44} style={{ margin: '0 auto 0.75rem', color: '#cbd5e1' }} />
          <p style={{ fontWeight: 600 }}>{language === 'ml' ? 'ഈ മാസത്തിൽ പണം നൽകിയത് രേഖപ്പെടുത്തിയിട്ടില്ല' : language === 'ta' ? 'இந்த மாதத்தில் பணப் பதிவுகள் எதுவும் இல்லை' : 'No payments found for this month.'}</p>
        </div>
      ) : (
        <div>
          {payments.map((p) => {
            const isSettlement = Boolean(p.isSettlement || (p.notes && p.notes.includes('[Settlement:')));
            const sMonth = p.settlementMonth || p.notes?.match(/\[Settlement:\s*(\d{4}-\d{2})\]/)?.[1];

            if (isSettlement && sMonth) {
              return (
                <div
                  key={p.id}
                  className="activity-card"
                  style={{
                    padding: '1.25rem',
                    background: 'linear-gradient(135deg, #ffffff 0%, #f0fdf4 100%)',
                    border: '1.5px solid #86efac',
                    boxShadow: '0 4px 16px rgba(5, 150, 105, 0.08)',
                    borderRadius: '18px',
                    marginBottom: '0.85rem'
                  }}
                >
                  <div className="activity-left">
                    <div
                      style={{
                        width: '46px',
                        height: '46px',
                        borderRadius: '14px',
                        background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
                        color: 'white',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 4px 12px rgba(5, 150, 105, 0.3)'
                      }}
                    >
                      {p.paymentMethod === 'upi' ? <Smartphone size={24} /> : <Banknote size={24} />}
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginBottom: '0.2rem' }}>
                        <span style={{ fontSize: '0.68rem', fontWeight: 800, background: '#dcfce7', color: '#166534', padding: '0.15rem 0.5rem', borderRadius: '999px', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                          🌟 {t('monthlySettlementBadge')}
                        </span>
                        <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#047857' }}>
                          • {formatDisplayMonthYear(sMonth, language)}
                        </span>
                      </div>
                      <div className="activity-title" style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a' }}>
                        {formatDisplayMonthYear(sMonth, language)} {t('settled')}
                      </div>
                      <div className="activity-meta" style={{ marginTop: '0.25rem' }}>
                        <DateTimeBadge date={p.date} createdAt={p.createdAt} />
                        <span style={{ fontSize: '0.74rem', background: '#e0f2fe', color: '#0369a1', padding: '0.1rem 0.45rem', borderRadius: '4px', fontWeight: 700 }}>
                          {p.paymentMethod.toUpperCase()}
                        </span>
                        {p.createdByName && (
                          <span className="activity-user-pill">
                            👤 {p.createdByName}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="activity-right" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.45rem' }}>
                    <div className="activity-amount income" style={{ fontSize: '1.35rem', fontWeight: 900, color: '#047857' }}>
                      +{formatPaise(p.amountPaise)}
                    </div>
                    <button
                      type="button"
                      className="btn-secondary"
                      style={{
                        padding: '0.4rem 0.75rem',
                        borderRadius: '10px',
                        fontSize: '0.78rem',
                        fontWeight: 700,
                        background: '#ffffff',
                        borderColor: '#059669',
                        color: '#047857',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        cursor: 'pointer',
                        boxShadow: '0 2px 6px rgba(5,150,105,0.12)'
                      }}
                      onClick={() => handleOpenDetails(p)}
                    >
                      <FileText size={14} />
                      <span>{t('viewFullDetails')}</span>
                    </button>
                  </div>
                </div>
              );
            }

            return (
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
                      <DateTimeBadge date={p.date} createdAt={p.createdAt} />
                      {p.createdByName && (
                        <span className="activity-user-pill">
                          👤 {p.createdByName}
                        </span>
                      )}
                    </div>
                    {p.notes && (
                      <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '0.25rem', fontStyle: 'italic' }}>
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
                    {language === 'ta' ? 'பதிவானது' : language === 'ml' ? 'രേഖപ്പെടുത്തി' : 'Recorded'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* General Payment Modal */}
      <PaymentModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={() => {
          fetchPayments(true);
          notifyDataChanged();
        }}
      />

      {/* Month Settlement Full Details Modal */}
      {isDetailModalOpen && (
        <MonthSettlementDetailModal
          isOpen={isDetailModalOpen}
          onClose={() => {
            setIsDetailModalOpen(false);
            setDetailPayment(null);
          }}
          month={detailMonth}
          payment={detailPayment}
        />
      )}
    </div>
  );
};
