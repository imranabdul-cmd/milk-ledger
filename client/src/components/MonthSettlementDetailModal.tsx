import React, { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { apiRequest } from '../api/client';
import { MilkEntry, DashboardSummary, formatPaise, formatMilkQuantity, Payment } from '@family-milk/shared';
import { formatDisplayMonthYear, formatDisplayDate } from '../utils/dateFormatter';
import { ExportBillModal } from './ExportBillModal';
import { X, Calendar, FileSpreadsheet, CheckCircle2 } from 'lucide-react';

interface MonthSettlementDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  month: string; // YYYY-MM
  payment?: Payment | null;
}

export const MonthSettlementDetailModal: React.FC<MonthSettlementDetailModalProps> = ({
  isOpen,
  onClose,
  month,
  payment,
}) => {
  const { t, language } = useLanguage();

  const [entries, setEntries] = useState<MilkEntry[]>([]);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isExportOpen, setIsExportOpen] = useState<boolean>(false);

  useEffect(() => {
    if (!isOpen || !month) return;

    let isMounted = true;
    setIsLoading(true);

    Promise.all([
      apiRequest<{ entries: MilkEntry[] }>(`/api/milk/entries?month=${month}`),
      apiRequest<{ summary: DashboardSummary }>(`/api/settlement/summary?month=${month}`)
    ])
      .then(([entriesRes, sumRes]) => {
        if (!isMounted) return;
        setEntries(entriesRes.entries || []);
        setSummary(sumRes.summary || null);
      })
      .catch((err) => {
        console.error('Failed to load month settlement details:', err);
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, month]);

  if (!isOpen) return null;

  // Calculate days count
  const milkTakenDays = entries.filter((e) => e.quantityMl > 0).length;
  const zeroMilkDays = entries.filter((e) => e.quantityMl === 0).length;
  const totalLitres = summary?.totalLitres || entries.reduce((acc, e) => acc + (e.quantityMl / 1000), 0);
  const totalChargesPaise = summary?.totalMilkChargesPaise || entries.reduce((acc, e) => acc + e.totalAmountPaise, 0);

  const paymentMethodLabel = payment?.paymentMethod?.toUpperCase() || 'PAID';
  const settledAmountPaise = payment?.amountPaise || summary?.closingBalancePaise || totalChargesPaise;

  return (
    <>
      <div className="modal-overlay" onClick={onClose}>
        <div
          className="modal-card"
          style={{ maxWidth: '640px', width: '94%', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.85rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '12px',
                  background: 'linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)',
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 4px 12px rgba(37,99,235,0.25)'
                }}
              >
                <Calendar size={20} />
              </div>
              <div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--slate-900)' }}>
                  {formatDisplayMonthYear(month, language)} • {t('billHistoryTitle')}
                </h3>
                <span style={{ fontSize: '0.78rem', color: '#059669', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                  <CheckCircle2 size={13} />
                  <span>{t('settledVia')} {paymentMethodLabel}</span>
                  {payment?.date && <span>• {formatDisplayDate(payment.date, language)}</span>}
                </span>
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

          {/* KPI Summary Tiles */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.65rem', marginBottom: '1.1rem' }}>
            <div style={{ background: '#eff6ff', borderRadius: '14px', padding: '0.75rem', border: '1px solid #bfdbfe', textAlign: 'center' }}>
              <span style={{ fontSize: '0.72rem', color: '#1e40af', fontWeight: 700, textTransform: 'uppercase' }}>
                {t('milkQuantity')}
              </span>
              <div style={{ fontSize: '1.35rem', fontWeight: 900, color: '#1e3a8a', marginTop: '0.1rem' }}>
                {totalLitres.toFixed(1)} <span style={{ fontSize: '0.85rem' }}>L</span>
              </div>
              <span style={{ fontSize: '0.7rem', color: '#3b82f6' }}>
                {milkTakenDays} {t('days')}
              </span>
            </div>

            <div style={{ background: '#f8fafc', borderRadius: '14px', padding: '0.75rem', border: '1px solid #e2e8f0', textAlign: 'center' }}>
              <span style={{ fontSize: '0.72rem', color: '#475569', fontWeight: 700, textTransform: 'uppercase' }}>
                {t('daysSkipped')}
              </span>
              <div style={{ fontSize: '1.35rem', fontWeight: 900, color: '#334155', marginTop: '0.1rem' }}>
                {zeroMilkDays}
              </div>
              <span style={{ fontSize: '0.7rem', color: '#64748b' }}>
                0 Litres
              </span>
            </div>

            <div style={{ background: '#ecfdf5', borderRadius: '14px', padding: '0.75rem', border: '1px solid #a7f3d0', textAlign: 'center' }}>
              <span style={{ fontSize: '0.72rem', color: '#065f46', fontWeight: 700, textTransform: 'uppercase' }}>
                {t('totalSettledAmount')}
              </span>
              <div style={{ fontSize: '1.35rem', fontWeight: 900, color: '#047857', marginTop: '0.1rem' }}>
                {formatPaise(settledAmountPaise)}
              </div>
              <span style={{ fontSize: '0.7rem', color: '#059669', fontWeight: 700 }}>
                100% {t('settled')}
              </span>
            </div>
          </div>

          {/* Daily History List with Scroll */}
          <div style={{ flex: 1, overflowY: 'auto', paddingRight: '4px', marginBottom: '1rem', maxHeight: '420px' }}>
            <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.5rem', display: 'flex', justifyContent: 'space-between' }}>
              <span>{t('dailyMilkHistory')}</span>
              <span>{entries.length} records</span>
            </div>

            {isLoading ? (
              <div style={{ padding: '2.5rem', textAlign: 'center', color: '#64748b' }}>
                <p>Loading full month statement...</p>
              </div>
            ) : entries.length === 0 ? (
              <div style={{ padding: '2.5rem', textAlign: 'center', color: '#94a3b8', background: '#f8fafc', borderRadius: '14px' }}>
                <p>No entries found for this month.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                {entries.map((entry) => {
                  const isZero = entry.quantityMl === 0;
                  return (
                    <div
                      key={entry.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0.65rem 0.85rem',
                        background: isZero ? '#f8fafc' : '#ffffff',
                        border: isZero ? '1px dashed #cbd5e1' : '1px solid #e2e8f0',
                        borderRadius: '12px',
                        transition: 'background 0.15s ease'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                        <div
                          style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '8px',
                            background: isZero ? '#f1f5f9' : '#eff6ff',
                            color: isZero ? '#94a3b8' : '#2563eb',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '0.75rem',
                            fontWeight: 800
                          }}
                        >
                          {entry.date ? entry.date.substring(8, 10) : '••'}
                        </div>
                        <div>
                          <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#1e293b' }}>
                            {formatDisplayDate(entry.date, language)}
                          </div>
                          {isZero ? (
                            <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>
                              🥛 {language === 'ta' ? 'பால் வாங்கவில்லை' : language === 'ml' ? 'പാൽ വാങ്ങിയില്ല' : 'No milk taken'} (0 L)
                            </span>
                          ) : (
                            <span style={{ fontSize: '0.72rem', color: '#059669', fontWeight: 600 }}>
                              {formatMilkQuantity(entry.quantityMl, language)} • @{formatPaise(entry.ratePaisePerLitre)}/L
                            </span>
                          )}
                        </div>
                      </div>

                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '0.95rem', fontWeight: 800, color: isZero ? '#94a3b8' : '#0f172a' }}>
                          {formatPaise(entry.totalAmountPaise)}
                        </div>
                        <span
                          style={{
                            fontSize: '0.65rem',
                            fontWeight: 700,
                            padding: '0.1rem 0.35rem',
                            borderRadius: '4px',
                            background: isZero ? '#f1f5f9' : '#ecfdf5',
                            color: isZero ? '#64748b' : '#059669'
                          }}
                        >
                          {isZero ? '0 Litres' : 'Purchased'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer Bar with Export Bill CTA */}
          <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '0.85rem', display: 'flex', gap: '0.65rem', alignItems: 'center' }}>
            <button
              type="button"
              className="btn-secondary"
              style={{ flex: 1, justifyContent: 'center' }}
              onClick={onClose}
            >
              {t('cancel')}
            </button>

            <button
              type="button"
              className="btn-primary-big"
              style={{
                flex: 2,
                justifyContent: 'center',
                background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
                borderColor: '#059669',
                minHeight: '46px'
              }}
              onClick={() => setIsExportOpen(true)}
            >
              <FileSpreadsheet size={18} />
              <span>{t('exportBill')}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Embedded Export Bill / Share Modal */}
      {isExportOpen && (
        <ExportBillModal
          isOpen={isExportOpen}
          onClose={() => setIsExportOpen(false)}
          yearMonth={month}
        />
      )}
    </>
  );
};
