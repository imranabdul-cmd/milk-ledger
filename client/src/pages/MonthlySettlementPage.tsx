import React, { useState, useCallback, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../api/client';
import { DashboardSummary, formatPaise, MonthlyClosure } from '@family-milk/shared';
import { ExportBillModal } from '../components/ExportBillModal';
import { SettlementPaymentModal } from '../components/SettlementPaymentModal';
import { MonthSettlementDetailModal } from '../components/MonthSettlementDetailModal';
import { FileText, FileSpreadsheet, Lock, Calendar, CheckCircle2 } from 'lucide-react';
import { formatDisplayMonthYear } from '../utils/dateFormatter';
import { useAutoSync, notifyDataChanged } from '../hooks/useAutoSync';
import { useToast } from '../context/ToastContext';

export const MonthlySettlementPage: React.FC = () => {
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const { toast, confirm } = useToast();

  const currentMonthStr = new Date().toISOString().substring(0, 7);
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthStr);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [closures, setClosures] = useState<MonthlyClosure[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isExportOpen, setIsExportOpen] = useState<boolean>(false);
  const [isSettlementModalOpen, setIsSettlementModalOpen] = useState<boolean>(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState<boolean>(false);
  const [isClosing, setIsClosing] = useState<boolean>(false);

  const fetchSettlementData = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    try {
      const [sumRes, closureRes] = await Promise.all([
        apiRequest<{ summary: DashboardSummary }>(`/api/settlement/summary?month=${selectedMonth}`),
        apiRequest<{ closures: MonthlyClosure[] }>('/api/settlement/monthly')
      ]);
      setSummary(sumRes.summary);
      setClosures(closureRes.closures);
    } catch (err) {
      console.error('Failed to load settlement data:', err);
    } finally {
      setIsLoading(false);
    }
  }, [selectedMonth]);

  // Fetch immediately on mount & when month changes
  useEffect(() => {
    fetchSettlementData();
  }, [fetchSettlementData]);

  useAutoSync(fetchSettlementData, { intervalMs: 10000, immediate: false });

  const handleCloseMonth = async () => {
    const ok = await confirm({
      title: t('closeMonthConfirmTitle'),
      message: t('closeMonthConfirm'),
      confirmText: t('confirmAndSave'),
      cancelText: t('cancel'),
      type: 'warning',
    });
    if (!ok) return;

    setIsClosing(true);
    try {
      await apiRequest('/api/settlement/close-month', {
        method: 'POST',
        body: JSON.stringify({
          yearMonth: selectedMonth,
          notes: `Official month close by ${user?.name || 'Admin'}`
        }),
      });
      toast.success(
        language === 'ml' ? 'മാസത്തെ കണക്ക് ഫ്രീസ് ചെയ്തു!' : language === 'ta' ? 'மாத கணக்கு முடிக்கப்பட்டது!' : 'Month statement closed!'
      );
      fetchSettlementData(true);
      notifyDataChanged();
    } catch (err: any) {
      toast.error(
        err.message || (language === 'ta' ? 'முடிக்க முடியவில்லை' : language === 'ml' ? 'പരാജയപ്പെട്ടു' : 'Failed to close month')
      );
    } finally {
      setIsClosing(false);
    }
  };

  const isCurrentMonthClosed = closures.some(c => c.yearMonth === selectedMonth);
  const netDueOrCredit = summary?.closingBalancePaise || 0;
  const isDue = netDueOrCredit > 0;
  const isCredit = netDueOrCredit < 0;

  return (
    <div className="main-content">
      {/* Title & WhatsApp Share Button */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
        <div>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--slate-900)' }}>
            {t('monthlySettlement')}
          </h2>
          <p style={{ fontSize: '0.85rem', color: '#64748b' }}>
            {formatDisplayMonthYear(selectedMonth, language)} • {isCurrentMonthClosed ? (language === 'ta' ? '🔒 (முடிக்கப்பட்டது)' : language === 'ml' ? '🔒 (ഫ്രീസ് ചെയ്തു)' : '🔒 (Locked/Frozen)') : (language === 'ta' ? '🟢 (செயலில் உள்ளது)' : language === 'ml' ? '🟢 (സജീവം)' : '🟢 (Active)')}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn-secondary"
            style={{ minHeight: '42px', padding: '0.5rem 1rem', fontSize: '0.88rem', gap: '0.45rem', borderColor: '#2563eb', color: '#1d4ed8', background: '#eff6ff' }}
            onClick={() => setIsDetailModalOpen(true)}
          >
            <FileText size={17} />
            <span>{t('viewFullDetails')}</span>
          </button>

          <button
            className="btn-primary-big"
            style={{ width: 'auto', minHeight: '42px', padding: '0.5rem 1.1rem', fontSize: '0.9rem', gap: '0.5rem', background: '#059669', borderColor: '#059669' }}
            onClick={() => setIsExportOpen(true)}
          >
            <FileSpreadsheet size={18} />
            <span>{t('exportBill')}</span>
          </button>
        </div>
      </div>

      {/* Month Selector Bar */}
      <div style={{ background: 'white', borderRadius: 'var(--radius-md)', padding: '0.85rem 1rem', marginBottom: '1.25rem', display: 'flex', gap: '0.75rem', alignItems: 'center', border: '1px solid var(--slate-200)' }}>
        <Calendar size={18} color="#64748b" />
        <span style={{ fontSize: '0.9rem', fontWeight: 700 }}>{t('month')}:</span>
        <input
          type="month"
          className="form-input"
          style={{ width: 'auto', padding: '0.45rem 0.75rem', fontSize: '0.9rem' }}
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
        />
      </div>

      {isLoading ? (
        <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
          <p>{language === 'ml' ? 'കണക്കുകൾ തയ്യാറാക്കുന്നു...' : language === 'ta' ? 'கணக்குகளை கணக்கிடுகிறது...' : 'Calculating settlement...'}</p>
        </div>
      ) : (
        <div>
          {/* Detailed Statement Table Card */}
          <div style={{ background: 'white', borderRadius: 'var(--radius-xl)', padding: '1.5rem', boxShadow: 'var(--shadow-card)', border: '1px solid var(--slate-200)', marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--slate-200)', paddingBottom: '1rem', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <FileText size={22} color="#2563eb" />
                <h3 style={{ fontSize: '1.15rem', fontWeight: 800 }}>{t('statementSummary')}</h3>
              </div>
              <span style={{ fontSize: '0.8rem', background: isCurrentMonthClosed ? '#ecfdf5' : '#eff6ff', color: isCurrentMonthClosed ? '#059669' : '#1d4ed8', padding: '0.25rem 0.6rem', borderRadius: '9999px', fontWeight: 700 }}>
                {isCurrentMonthClosed ? 'Frozen / Closed' : 'Open / Unclosed'}
              </span>
            </div>

            {/* Accounting Breakdown List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              {/* Purchase Days */}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.95rem' }}>
                <span style={{ color: '#64748b' }}>{t('purchaseDays')}</span>
                <span style={{ fontWeight: 700 }}>{summary?.purchaseDays || 0} {t('days')}</span>
              </div>

              {/* Total Litres */}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.95rem' }}>
                <span style={{ color: '#64748b' }}>{t('milkQuantity')}</span>
                <span style={{ fontWeight: 700 }}>{summary?.totalLitres || 0} {t('litres')}</span>
              </div>

              {/* Rate per Litre */}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.95rem' }}>
                <span style={{ color: '#64748b' }}>{t('currentRate')}</span>
                <span style={{ fontWeight: 700 }}>{formatPaise(summary?.currentRatePaisePerLitre || 5600)}{t('perLitre')}</span>
              </div>

              <hr style={{ border: 'none', borderTop: '1px dashed #e2e8f0', margin: '0.25rem 0' }} />

              {/* Opening Balance */}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.95rem' }}>
                <span style={{ color: '#64748b' }}>{t('openingBalance')}</span>
                <span style={{ fontWeight: 700 }}>{formatPaise(summary?.openingBalancePaise || 0)}</span>
              </div>

              {/* Milk Charges */}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.95rem' }}>
                <span style={{ color: '#64748b' }}>{t('milkCharges')}</span>
                <span style={{ fontWeight: 700, color: '#dc2626' }}>+{formatPaise(summary?.totalMilkChargesPaise || 0)}</span>
              </div>

              {/* Payments Made */}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.95rem' }}>
                <span style={{ color: '#64748b' }}>{t('paymentsMade')}</span>
                <span style={{ fontWeight: 700, color: '#059669' }}>-{formatPaise(summary?.totalPaymentsPaise || 0)}</span>
              </div>

              <hr style={{ border: 'none', borderTop: '2px solid #cbd5e1', margin: '0.5rem 0' }} />

              {/* Net Closing Balance Formula Equation */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '1.25rem' }}>
                <span style={{ fontWeight: 800 }}>{t('closingBalance')}</span>
                <span style={{ fontWeight: 800, color: isDue ? '#dc2626' : isCredit ? '#059669' : '#1e3a8a' }}>
                  {formatPaise(Math.abs(netDueOrCredit))}
                </span>
              </div>

              <div style={{ textAlign: 'right' }}>
                <span className={`balance-badge ${isDue ? 'badge-due' : isCredit ? 'badge-credit' : 'badge-settled'}`}>
                  {isDue ? `🔴 ${t('due')}` : isCredit ? `🟢 ${t('advance')}` : `✅ ${t('settled')}`}
                </span>
              </div>

              {/* Paid / Not Paid Action Buttons */}
              {isDue && (
                <div
                  style={{
                    marginTop: '1.25rem',
                    paddingTop: '1rem',
                    borderTop: '1px dashed #cbd5e1',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '0.75rem'
                  }}
                >
                  <div>
                    <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#334155' }}>
                      {t('prevMonthSettlementQuestion')}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '0.65rem' }}>
                    <button
                      type="button"
                      className="btn-secondary"
                      style={{ padding: '0.5rem 0.95rem', borderRadius: '10px', fontSize: '0.85rem', fontWeight: 700 }}
                      onClick={() => toast.info(t('carriedForwardNote'))}
                    >
                      {t('notPaidBtn')}
                    </button>
                    <button
                      type="button"
                      className="btn-primary-big"
                      style={{
                        width: 'auto',
                        minHeight: '42px',
                        padding: '0.5rem 1.25rem',
                        fontSize: '0.9rem',
                        background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
                        borderColor: '#059669',
                        boxShadow: '0 4px 12px rgba(5,150,105,0.25)'
                      }}
                      onClick={() => setIsSettlementModalOpen(true)}
                    >
                      <CheckCircle2 size={17} />
                      <span>{t('paidBtn')}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Admin Freeze Action */}
            {user?.role === 'admin' && !isCurrentMonthClosed && (
              <div style={{ marginTop: '1.5rem', paddingTop: '1.25rem', borderTop: '1px solid #e2e8f0' }}>
                <button
                  className="btn-secondary"
                  style={{ width: '100%', justifyContent: 'center', borderColor: '#d97706', color: '#b45309', fontWeight: 700, minHeight: '48px' }}
                  onClick={handleCloseMonth}
                  disabled={isClosing}
                >
                  <Lock size={18} />
                  <span>{isClosing ? 'Freezing...' : t('closeMonthBtn')}</span>
                </button>
              </div>
            )}
          </div>

          {/* Historical Closed Statements List */}
          {closures.length > 0 && (
            <div style={{ marginTop: '2rem' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--slate-900)', marginBottom: '0.85rem' }}>
                {t('monthlyStatements')} ({closures.length})
              </h3>
              <div>
                {closures.map((c) => (
                  <div key={c.id} className="activity-card" style={{ cursor: 'pointer' }} onClick={() => setSelectedMonth(c.yearMonth)}>
                    <div className="activity-left">
                      <div className="activity-icon-badge" style={{ background: '#f8fafc', color: '#475569' }}>
                        <Lock size={20} />
                      </div>
                      <div>
                        <div className="activity-title">{formatDisplayMonthYear(c.yearMonth, language)}</div>
                        <div className="activity-meta">
                          {c.totalLitres} L • {c.purchaseDays} days
                        </div>
                      </div>
                    </div>

                    <div className="activity-right">
                      <div className="activity-amount" style={{ color: c.closingBalancePaise > 0 ? '#dc2626' : '#059669' }}>
                        {formatPaise(c.closingBalancePaise)}
                      </div>
                      <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                        {c.closingBalancePaise > 0 ? t('due') : t('advance')}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Export Monthly Bill Modal */}
      <ExportBillModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        yearMonth={selectedMonth}
      />

      {/* Settlement Payment Modal (Cash / UPI) */}
      <SettlementPaymentModal
        isOpen={isSettlementModalOpen}
        onClose={() => setIsSettlementModalOpen(false)}
        onSuccess={() => {
          fetchSettlementData(true);
          notifyDataChanged();
        }}
        month={selectedMonth}
        dueAmountPaise={Math.abs(netDueOrCredit)}
      />

      {/* Month Detailed History Modal */}
      {isDetailModalOpen && (
        <MonthSettlementDetailModal
          isOpen={isDetailModalOpen}
          onClose={() => setIsDetailModalOpen(false)}
          month={selectedMonth}
        />
      )}
    </div>
  );
};
