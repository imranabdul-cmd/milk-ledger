import React, { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { apiRequest } from '../api/client';
import { DashboardSummary, formatPaise, formatMilkQuantity } from '@family-milk/shared';
import { QuickPurchaseModal } from '../components/QuickPurchaseModal';
import { PaymentModal } from '../components/PaymentModal';
import { ExportBillModal } from '../components/ExportBillModal';
import {
  Droplets,
  Calendar,
  CreditCard,
  RefreshCw,
  Plus,
  FileSpreadsheet,
  CheckCircle2,
  Clock,
  ArrowRight
} from 'lucide-react';

interface DashboardPageProps {
  onNavigateToTab: (tab: string) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ onNavigateToTab }) => {
  const { t, language } = useLanguage();

  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // Modals
  const [isPurchaseModalOpen, setIsPurchaseModalOpen] = useState<boolean>(false);
  const [quickModalQuantity, setQuickModalQuantity] = useState<number>(500);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState<boolean>(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState<boolean>(false);

  const fetchSummary = useCallback(async (showRefreshing = false) => {
    if (showRefreshing) setIsRefreshing(true);
    try {
      const res = await apiRequest<{ summary: DashboardSummary }>('/api/settlement/summary');
      setSummary(res.summary);
    } catch (err) {
      console.error('Failed to load dashboard summary:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchSummary();
    // Safe auto-refresh polling every 20 seconds for multi-phone family sync
    const interval = setInterval(() => {
      fetchSummary(false);
    }, 20000);

    return () => clearInterval(interval);
  }, [fetchSummary]);

  const handleOpenQuickAdd = (ml: number) => {
    setQuickModalQuantity(ml);
    setIsPurchaseModalOpen(true);
  };

  if (isLoading && !summary) {
    return (
      <div style={{ padding: '3rem 1rem', textAlign: 'center', color: '#64748b' }}>
        <RefreshCw className="animate-spin" size={32} style={{ margin: '0 auto 1rem', color: '#2563eb' }} />
        <p>{language === 'ta' ? 'விவரங்களை ஏற்றுகிறது...' : language === 'ml' ? 'വിവരങ്ങൾ ശേഖരിക്കുന്നു...' : 'Loading dashboard...'}</p>
      </div>
    );
  }

  const netBalance = summary?.closingBalancePaise || 0;
  const isDue = netBalance > 0;
  const isCredit = netBalance < 0;

  return (
    <div className="main-content">
      {/* Top Header Row with Refresh and Share */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
        <div>
          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#64748b' }}>
            {t('thisMonthSummary')} ({summary?.currentMonth})
          </span>
          <div style={{ fontSize: '0.9rem', color: '#0f172a', fontWeight: 700 }}>
            {t('currentRate')}: {formatPaise(summary?.currentRatePaisePerLitre || 5600)}{t('perLitre')}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            className="btn-secondary"
            style={{ padding: '0.5rem 0.75rem' }}
            onClick={() => fetchSummary(true)}
            disabled={isRefreshing}
            title={t('refresh')}
          >
            <RefreshCw size={16} className={isRefreshing ? 'animate-spin' : ''} />
            <span style={{ fontSize: '0.85rem' }}>{t('refresh')}</span>
          </button>

          <button
            className="btn-secondary"
            style={{ padding: '0.5rem 0.85rem', fontSize: '0.85rem', gap: '0.4rem', borderColor: '#059669', color: '#059669', fontWeight: 700 }}
            onClick={() => setIsExportModalOpen(true)}
          >
            <FileSpreadsheet size={16} color="#059669" />
            <span>{t('exportBill')}</span>
          </button>
        </div>
      </div>

      {/* QUICK ACTIONS BAR - Large Touch Buttons for Parents */}
      <div className="quick-action-container">
        <div className="quick-title">
          <span>{t('quickAddTitle')}</span>
          <span style={{ fontSize: '0.8rem', color: '#2563eb', fontWeight: 600 }}>1-Tap Record</span>
        </div>

        <div className="quick-grid">
          {/* Half Litre Button */}
          <button
            type="button"
            className="quick-tap-btn"
            onClick={() => handleOpenQuickAdd(500)}
          >
            <span className="quick-qty-val">{language === 'ta' ? '½ லி' : language === 'ml' ? '½ ലി' : '½ L'}</span>
            <span className="quick-qty-sub">{t('halfLitreSub')}</span>
          </button>

          {/* One Litre Button */}
          <button
            type="button"
            className="quick-tap-btn"
            onClick={() => handleOpenQuickAdd(1000)}
          >
            <span className="quick-qty-val">{language === 'ta' ? '1 லி' : language === 'ml' ? '1 ലി' : '1 L'}</span>
            <span className="quick-qty-sub">{t('oneLitreSub')}</span>
          </button>

          {/* Custom Quantity Button */}
          <button
            type="button"
            className="quick-tap-btn custom-btn"
            onClick={() => handleOpenQuickAdd(1500)}
          >
            <span className="quick-qty-val" style={{ fontSize: '1.4rem' }}>+</span>
            <span className="quick-qty-sub">{t('customQty')}</span>
          </button>
        </div>

        {/* Action Button Row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
          <button
            type="button"
            className="btn-secondary"
            style={{ justifyContent: 'center', borderColor: '#2563eb', color: '#1d4ed8', fontWeight: 700 }}
            onClick={() => handleOpenQuickAdd(500)}
          >
            <Droplets size={18} />
            <span>{t('purchases')}</span>
          </button>

          <button
            type="button"
            className="btn-secondary"
            style={{ justifyContent: 'center', borderColor: '#059669', color: '#047857', fontWeight: 700 }}
            onClick={() => setIsPaymentModalOpen(true)}
          >
            <CreditCard size={18} />
            <span>{t('recordPaymentNow')}</span>
          </button>
        </div>
      </div>

      {/* TODAY'S PURCHASE STATUS BANNER */}
      <div style={{ background: summary?.todayPurchase ? '#f0fdf4' : '#fffbeb', border: `1.5px solid ${summary?.todayPurchase ? '#86efac' : '#fde68a'}`, borderRadius: 'var(--radius-lg)', padding: '1rem 1.25rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {summary?.todayPurchase ? (
            <CheckCircle2 size={28} color="#16a34a" />
          ) : (
            <Clock size={28} color="#d97706" />
          )}
          <div>
            <div style={{ fontWeight: 800, fontSize: '1rem', color: summary?.todayPurchase ? '#166534' : '#92400e' }}>
              {summary?.todayPurchase ? t('todayMilkPurchased') : t('noMilkToday')}
            </div>
            <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
              {summary?.todayPurchase ? (
                <>
                  {formatMilkQuantity(summary.todayPurchase.quantityMl, language)} • {formatPaise(summary.todayPurchase.totalAmountPaise)} (
                  <span style={{ fontWeight: 700, color: summary.todayPurchase.paymentStatus === 'paid' ? '#16a34a' : '#dc2626' }}>
                    {summary.todayPurchase.paymentStatus === 'paid' ? t('paid') : t('pending')}
                  </span>
                  )
                </>
              ) : (
                language === 'ml' ? 'ഇന്ന് വാങ്ങിയെങ്കിൽ മുകളിലെ ബട്ടൺ അമർത്തുക' : 'Tap the buttons above to record today’s milk'
              )}
            </div>
          </div>
        </div>

        {!summary?.todayPurchase && (
          <button
            className="btn-secondary"
            style={{ background: 'white', padding: '0.4rem 0.75rem', fontSize: '0.85rem', fontWeight: 700 }}
            onClick={() => handleOpenQuickAdd(500)}
          >
            <Plus size={16} />
            <span>{t('save')}</span>
          </button>
        )}
      </div>

      {/* OUTSTANDING DUE / BALANCE HERO CARD */}
      <div className={`balance-hero ${isDue ? 'due-border' : isCredit ? 'credit-border' : 'settled-border'}`}>
        <div className="balance-label">
          {isDue ? t('due') : isCredit ? t('advance') : t('closingBalance')}
        </div>

        <div className={`balance-amount ${isDue ? 'is-due' : isCredit ? 'is-credit' : 'is-settled'}`}>
          {formatPaise(Math.abs(netBalance))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <span className={`balance-badge ${isDue ? 'badge-due' : isCredit ? 'badge-credit' : 'badge-settled'}`}>
            {isDue ? `🔴 ${t('due')}` : isCredit ? `🟢 ${t('advance')}` : `✅ ${t('settled')}`}
          </span>

          <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
            {t('openingBalance')}: {formatPaise(summary?.openingBalancePaise || 0)}
          </span>
        </div>
      </div>

      {/* 4 CORE METRIC CARDS */}
      <div className="stats-grid">
        {/* Total Litres */}
        <div className="stat-card">
          <div className="stat-header">
            <span className="stat-title">{t('milkQuantity')}</span>
            <div className="stat-icon" style={{ background: '#eff6ff', color: '#2563eb' }}>
              <Droplets size={18} />
            </div>
          </div>
          <div className="stat-value">{summary?.totalLitres || 0} <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>{t('litres')}</span></div>
          <div className="stat-sub">{summary?.purchaseDays || 0} {t('days')}</div>
        </div>

        {/* Purchase Days */}
        <div className="stat-card">
          <div className="stat-header">
            <span className="stat-title">{t('purchaseDays')}</span>
            <div className="stat-icon" style={{ background: '#fdf2f8', color: '#db2777' }}>
              <Calendar size={18} />
            </div>
          </div>
          <div className="stat-value">{summary?.purchaseDays || 0}</div>
          <div className="stat-sub">{language === 'ml' ? 'ദിവസങ്ങൾ' : 'distinct days'}</div>
        </div>

        {/* Total Charges */}
        <div className="stat-card">
          <div className="stat-header">
            <span className="stat-title">{t('milkCharges')}</span>
            <div className="stat-icon" style={{ background: '#fef2f2', color: '#dc2626' }}>
              ₹
            </div>
          </div>
          <div className="stat-value">{formatPaise(summary?.totalMilkChargesPaise || 0)}</div>
          <div className="stat-sub">{t('thisMonthSummary')}</div>
        </div>

        {/* Payments Made */}
        <div className="stat-card">
          <div className="stat-header">
            <span className="stat-title">{t('paymentsMade')}</span>
            <div className="stat-icon" style={{ background: '#ecfdf5', color: '#059669' }}>
              <CreditCard size={18} />
            </div>
          </div>
          <div className="stat-value" style={{ color: '#059669' }}>
            {formatPaise(summary?.totalPaymentsPaise || 0)}
          </div>
          <div className="stat-sub">{t('paid')}</div>
        </div>
      </div>

      {/* RECENT ACTIVITY LIST */}
      <div style={{ marginTop: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--slate-900)' }}>
            {t('recentActivity')}
          </h3>
          <button
            className="btn-secondary"
            style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem', fontWeight: 700 }}
            onClick={() => onNavigateToTab('purchases')}
          >
            <span>{t('viewAll')}</span>
            <ArrowRight size={14} />
          </button>
        </div>

        {summary?.recentActivity && summary.recentActivity.length > 0 ? (
          <div>
            {summary.recentActivity.map((act) => (
              <div key={act.id} className="activity-card">
                <div className="activity-left">
                  <div className={`activity-icon-badge ${act.type === 'purchase' ? 'badge-milk' : 'badge-pay'}`}>
                    {act.type === 'purchase' ? <Droplets size={22} /> : <CreditCard size={22} />}
                  </div>
                  <div>
                    <div className="activity-title">
                      {act.type === 'purchase' ? (
                        formatMilkQuantity(act.quantityMl || 500, language)
                      ) : (
                        `${t('payments')} (${act.status?.toUpperCase() || 'CASH'})`
                      )}
                    </div>
                    <div className="activity-meta">
                      {act.date} • {act.memberName}
                    </div>
                  </div>
                </div>

                <div className="activity-right">
                  <div className={`activity-amount ${act.type === 'purchase' ? 'expense' : 'income'}`}>
                    {act.type === 'purchase' ? '' : '+'}{formatPaise(act.amountPaise)}
                  </div>
                  {act.type === 'purchase' && (
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: act.status === 'paid' ? '#059669' : '#dc2626' }}>
                      {act.status === 'paid' ? t('paid') : t('pending')}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ background: 'white', borderRadius: 'var(--radius-md)', padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>
            <p>{t('noRecentActivity')}</p>
          </div>
        )}
      </div>

      {/* QUICK PURCHASE MODAL */}
      <QuickPurchaseModal
        isOpen={isPurchaseModalOpen}
        onClose={() => setIsPurchaseModalOpen(false)}
        onSuccess={() => fetchSummary(true)}
        currentRatePaise={summary?.currentRatePaisePerLitre || 5600}
        initialQuantityMl={quickModalQuantity}
      />

      {/* RECORD PAYMENT MODAL */}
      <PaymentModal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        onSuccess={() => fetchSummary(true)}
        defaultAmountRupees={netBalance > 0 ? Math.floor(netBalance / 100) : 0}
      />

      {/* EXPORT MONTHLY BILL MODAL */}
      <ExportBillModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        yearMonth={summary?.currentMonth || new Date().toISOString().substring(0, 7)}
      />
    </div>
  );
};
