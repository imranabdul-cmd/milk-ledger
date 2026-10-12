import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../api/client';
import { DashboardSummary, MilkEntry, formatPaise, formatMilkQuantity } from '@family-milk/shared';
import { QuickPurchaseModal } from '../components/QuickPurchaseModal';
import { PaymentModal } from '../components/PaymentModal';
import { ExportBillModal } from '../components/ExportBillModal';
import { UpdateRateModal } from '../components/UpdateRateModal';
import { CorrectionModal, EditableMilkRecord } from '../components/CorrectionModal';
import { formatDisplayMonthYear, formatDisplayDate, getKolkataTodayDateString } from '../utils/dateFormatter';
import { useAutoSync, notifyDataChanged } from '../hooks/useAutoSync';
import { useToast } from '../context/ToastContext';
import {
  Droplets,
  Calendar,
  CreditCard,
  RefreshCw,
  Plus,
  FileSpreadsheet,
  CheckCircle2,
  Clock,
  ArrowRight,
  Edit3,
  Trash2,
  ChevronRight,
  Wallet,
  TrendingUp,
  Zap,
  BarChart3,
  Users,
  MoreVertical,
  FileText,
  IndianRupee
} from 'lucide-react';

interface DashboardPageProps {
  onNavigateToTab: (tab: string) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ onNavigateToTab }) => {
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const { toast } = useToast();
  const isAdmin = user?.role === 'admin' || user?.role === 'owner';

  // Current Kolkata date and month
  const todayDateStr = useMemo(() => getKolkataTodayDateString(), []);
  const defaultMonthStr = useMemo(() => todayDateStr.substring(0, 7), [todayDateStr]);

  const [selectedMonth, setSelectedMonth] = useState<string>(defaultMonthStr);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [monthEntries, setMonthEntries] = useState<MilkEntry[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // Modals state
  const [isPurchaseModalOpen, setIsPurchaseModalOpen] = useState<boolean>(false);
  const [quickModalQuantity, setQuickModalQuantity] = useState<number>(500);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState<boolean>(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState<boolean>(false);
  const [isUpdateRateModalOpen, setIsUpdateRateModalOpen] = useState<boolean>(false);
  const [editingRecord, setEditingRecord] = useState<EditableMilkRecord | null>(null);
  const [openActionId, setOpenActionId] = useState<string | null>(null);

  const monthInputRef = useRef<HTMLInputElement>(null);

  // Time-of-day greeting
  const greetingKey = useMemo(() => {
    try {
      const kolkataHour = parseInt(
        new Intl.DateTimeFormat('en-US', {
          timeZone: 'Asia/Kolkata',
          hour: 'numeric',
          hourCycle: 'h23'
        }).format(new Date()),
        10
      );
      if (kolkataHour < 12) return 'goodMorning';
      if (kolkataHour < 17) return 'goodAfternoon';
      return 'goodEvening';
    } catch {
      const h = new Date().getHours();
      if (h < 12) return 'goodMorning';
      if (h < 17) return 'goodAfternoon';
      return 'goodEvening';
    }
  }, []);

  const fetchSummary = useCallback(async (showRefreshing = false) => {
    if (showRefreshing) setIsRefreshing(true);
    try {
      const [sumRes, entriesRes] = await Promise.all([
        apiRequest<{ summary: DashboardSummary }>(`/api/settlement/summary?month=${selectedMonth}`),
        apiRequest<{ entries: MilkEntry[] }>(`/api/milk/entries?month=${selectedMonth}`)
      ]);
      setSummary(sumRes.summary);
      setMonthEntries(entriesRes.entries || []);
    } catch (err) {
      console.error('Failed to load dashboard summary:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [selectedMonth]);

  // Fetch immediately on mount & when selectedMonth changes
  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  // Silent real-time auto-sync like Instagram
  useAutoSync(fetchSummary, { intervalMs: 8000, immediate: false });

  // Close row actions popup when clicking anywhere outside
  useEffect(() => {
    const handleOutsideClick = () => setOpenActionId(null);
    window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
  }, []);

  const handleOpenQuickAdd = (ml: number) => {
    setQuickModalQuantity(ml);
    setIsPurchaseModalOpen(true);
  };

  const handleDeleteActivity = async (act: any) => {
    if (!isAdmin) {
      toast.warning(
        language === 'ta' ? 'அட்மின்களுக்கு மட்டுமே அனுமதி உண்டு' : language === 'ml' ? 'അഡ്മിന് മാത്രമേ അനുവാദമുള്ളൂ' : 'Admin privilege required'
      );
      return;
    }

    const confirmMsg = act.type === 'purchase'
      ? (language === 'ta' ? `இந்த பால் பதிவை நீக்க விரும்புகிறீர்களா? (${act.title || formatMilkQuantity(act.quantityMl || 500, language)})` : language === 'ml' ? `ഈ രേഖ ഒഴിവാക്കണോ?` : `Delete this milk entry?`)
      : (language === 'ta' ? `இந்த பணப் பதிவை நீக்க விரும்புகிறீர்களா? (${formatPaise(act.amountPaise)})` : language === 'ml' ? `ഈ രേഖ ഒഴിവാക്കണോ?` : `Delete this payment?`);

    if (!window.confirm(confirmMsg)) return;

    try {
      const url = act.type === 'purchase' ? `/api/milk/entries/${act.id}` : `/api/payments/${act.id}`;
      await apiRequest(url, { method: 'DELETE' });
      fetchSummary(true);
      notifyDataChanged();
      if (act.type === 'purchase') {
        toast.milk(
          language === 'ta' ? 'பால் பதிவு நீக்கப்பட்டது' : language === 'ml' ? 'പാൽ രേഖ നീക്കം ചെയ്തു' : 'Milk record removed'
        );
      } else {
        toast.success(
          language === 'ta' ? 'பணப் பதிவு நீக்கப்பட்டது' : language === 'ml' ? 'പേയ്മെന്റ് നീക്കം ചെയ്തു' : 'Payment record removed'
        );
      }
    } catch (err: any) {
      toast.error(
        err.message || (language === 'ta' ? 'நீக்க முடியவில்லை' : language === 'ml' ? 'നീക്കം ചെയ്യാൻ കഴിഞ്ഞില്ല' : 'Failed to delete record')
      );
    }
  };

  // Calculations
  const currentRatePaise = summary?.currentRatePaisePerLitre || 4800; // Default ₹48/L
  const netBalance = summary?.closingBalancePaise || 0;
  const isDue = netBalance > 0;
  const isCredit = netBalance < 0;

  // Real-time calculated amounts for quick buttons based on applicable rate
  const halfLitreAmountPaise = Math.round(0.5 * currentRatePaise);
  const oneLitreAmountPaise = currentRatePaise;

  // Monthly target calculation (default 30L for a standard family)
  const totalLitres = summary?.totalLitres || 0;
  const targetLitres = 30;
  const progressPercent = Math.min(100, Math.round((totalLitres / targetLitres) * 100));

  // Compute day-by-day distribution for the Monthly Overview chart
  const daysInSelectedMonth = useMemo(() => {
    try {
      const [y, m] = selectedMonth.split('-').map(Number);
      return new Date(y, m, 0).getDate();
    } catch {
      return 31;
    }
  }, [selectedMonth]);

  const dailyLitresMap = useMemo(() => {
    const map = new Map<number, number>();
    monthEntries.forEach((entry) => {
      try {
        const day = parseInt(entry.date.split('-')[2], 10);
        const litres = (entry.quantityMl || 0) / 1000;
        map.set(day, (map.get(day) || 0) + litres);
      } catch {}
    });
    return map;
  }, [monthEntries]);

  if (isLoading && !summary) {
    return (
      <div className="dashboard-loading-container">
        <RefreshCw className="animate-spin" size={36} style={{ color: '#2378FF', margin: '0 auto 1rem' }} />
        <p style={{ fontWeight: 600, color: '#647C9F' }}>
          {language === 'ta' ? 'விவரங்களை ஏற்றுகிறது...' : language === 'ml' ? 'വിവരങ്ങൾ ശേഖരിക്കുന്നു...' : 'Loading dashboard...'}
        </p>
      </div>
    );
  }

  return (
    <div className="dashboard-page-wrapper">
      {/* Decorative Photographic Ambient Graphic on Top Right */}
      <div className="dashboard-ambient-graphic" aria-hidden="true" />

      <div className="dashboard-container">
        {/* ====================================================
            1. GREETING & TOOLBAR ROW
            ==================================================== */}
        <div className="dashboard-header-row">
          {/* Left Greeting */}
          <div className="greeting-group">
            <span className="greeting-label">
              {t(greetingKey as any)}
            </span>
            <h1 className="greeting-user-title">
              {user?.name || 'Family Admin'} <span className="greeting-wave">👋</span>
            </h1>
            <p className="greeting-subtitle">
              {t('accountSummarySubtitle')} {formatDisplayMonthYear(selectedMonth, language)}
            </p>
          </div>

          {/* Right Toolbar Controls */}
          <div className="dashboard-toolbar">
            {/* Current Milk Rate Badge */}
            <div className="rate-badge-card" title={t('currentRate')}>
              <div className="rate-badge-icon">
                <FileText size={16} />
              </div>
              <div className="rate-badge-content">
                <span className="rate-badge-label">{t('currentRate')}</span>
                <span className="rate-badge-value">
                  {formatPaise(currentRatePaise)} <span className="rate-badge-unit">{t('perLitre')}</span>
                </span>
              </div>
              {isAdmin && (
                <button
                  type="button"
                  className="rate-edit-pencil-btn"
                  onClick={() => setIsUpdateRateModalOpen(true)}
                  title={t('editRateTitle')}
                  aria-label="Edit milk rate"
                >
                  <Edit3 size={13} />
                </button>
              )}
            </div>

            {/* Month/Year Selector */}
            <div
              className="toolbar-pill-btn month-selector-pill"
              onClick={() => monthInputRef.current?.showPicker?.() || monthInputRef.current?.focus()}
              title={t('selectMonth')}
            >
              <Calendar size={15} color="#2378FF" />
              <span className="month-selector-text">
                {formatDisplayMonthYear(selectedMonth, language)}
              </span>
              <input
                ref={monthInputRef}
                type="month"
                className="hidden-month-input"
                value={selectedMonth}
                onChange={(e) => e.target.value && setSelectedMonth(e.target.value)}
              />
            </div>

            {/* Refresh Action */}
            <button
              type="button"
              className="toolbar-pill-btn refresh-pill-btn"
              onClick={() => fetchSummary(true)}
              disabled={isRefreshing}
              title={t('refresh')}
            >
              <RefreshCw size={15} className={isRefreshing ? 'animate-spin' : ''} color="#142747" />
              <span>{t('refresh')}</span>
            </button>

            {/* Export Monthly Bill Action */}
            <button
              type="button"
              className="toolbar-pill-btn export-pill-btn"
              onClick={() => setIsExportModalOpen(true)}
              title={t('exportBill')}
            >
              <FileSpreadsheet size={16} color="#059669" />
              <span>{t('exportBill')}</span>
            </button>
          </div>
        </div>

        {/* ====================================================
            2. FINANCIAL KPI ROW (5 CARDS)
            ==================================================== */}
        <div className="kpi-grid">
          {/* Card 1: Outstanding Due */}
          <div
            className="kpi-card kpi-card-due"
            onClick={() => setIsPaymentModalOpen(true)}
            role="button"
            tabIndex={0}
          >
            <div className="kpi-card-top">
              <div className="kpi-icon-bubble bubble-red">
                <Wallet size={19} />
              </div>
              <span className="kpi-label">{t('due')}</span>
              <ChevronRight size={16} className="kpi-chevron" />
            </div>
            <div className={`kpi-value ${isDue ? 'val-due' : isCredit ? 'val-credit' : 'val-neutral'}`}>
              {formatPaise(Math.abs(netBalance))}
            </div>
            <div className="kpi-subtitle">
              {t('openingBalance')}: {formatPaise(summary?.openingBalancePaise || 0)}
            </div>
          </div>

          {/* Card 2: Milk Quantity */}
          <div
            className="kpi-card kpi-card-quantity"
            onClick={() => onNavigateToTab('purchases')}
            role="button"
            tabIndex={0}
          >
            <div className="kpi-card-top">
              <div className="kpi-icon-bubble bubble-blue">
                <Droplets size={19} />
              </div>
              <span className="kpi-label">{t('milkQuantity')}</span>
              <ChevronRight size={16} className="kpi-chevron" />
            </div>
            <div className="kpi-value">
              {summary?.totalLitres || 0} <span className="kpi-unit">{t('litres')}</span>
            </div>
            <div className="kpi-subtitle">{t('thisMonthSummary')}</div>
          </div>

          {/* Card 3: Purchase Days */}
          <div
            className="kpi-card kpi-card-days"
            onClick={() => onNavigateToTab('purchases')}
            role="button"
            tabIndex={0}
          >
            <div className="kpi-card-top">
              <div className="kpi-icon-bubble bubble-green">
                <Calendar size={19} />
              </div>
              <span className="kpi-label">{t('purchaseDays')}</span>
              <ChevronRight size={16} className="kpi-chevron" />
            </div>
            <div className="kpi-value">
              {summary?.purchaseDays || 0}
            </div>
            <div className="kpi-subtitle">
              {language === 'ml' ? 'ദിവസങ്ങൾ' : language === 'ta' ? 'நாட்கள்' : 'Distinct days'}
            </div>
          </div>

          {/* Card 4: Milk Charges */}
          <div className="kpi-card kpi-card-charges">
            <div className="kpi-card-top">
              <div className="kpi-icon-bubble bubble-amber">
                <span className="kpi-rupee-glyph">₹</span>
              </div>
              <span className="kpi-label">{t('milkCharges')}</span>
              <ChevronRight size={16} className="kpi-chevron" />
            </div>
            <div className="kpi-value">
              {formatPaise(summary?.totalMilkChargesPaise || 0)}
            </div>
            <div className="kpi-subtitle">{t('thisMonthSummary')}</div>
          </div>

          {/* Card 5: Payments Made */}
          <div
            className="kpi-card kpi-card-payments"
            onClick={() => onNavigateToTab('payments')}
            role="button"
            tabIndex={0}
          >
            <div className="kpi-card-top">
              <div className="kpi-icon-bubble bubble-purple">
                <CreditCard size={19} />
              </div>
              <span className="kpi-label">{t('paymentsMade')}</span>
              <ChevronRight size={16} className="kpi-chevron" />
            </div>
            <div className="kpi-value val-payments">
              {formatPaise(summary?.totalPaymentsPaise || 0)}
            </div>
            <div className="kpi-subtitle">{t('paid')}</div>
          </div>
        </div>

        {/* ====================================================
            3. MAIN CONTENT GRID (3 COLUMNS ON DESKTOP)
            ==================================================== */}
        <div className="dashboard-main-grid">
          {/* --------------------------------------------------
              LEFT COLUMN: RECORD TODAY'S MILK
              -------------------------------------------------- */}
          <div className="milk-entry-card">
            <div className="entry-card-header">
              <div className="entry-header-left">
                <div className="entry-icon-bubble">
                  <Droplets size={22} color="#2378FF" />
                </div>
                <div>
                  <h2 className="entry-title">{t('recordTodayMilk')}</h2>
                  <p className="entry-subtitle">
                    {language === 'ta' ? 'இன்றைய பால் அளவை தேர்ந்தெடுக்கவும்' : language === 'ml' ? 'ഇന്നത്തെ പാൽ അളവ് തിരഞ്ഞെടുക്കുക' : 'Select quantity to record today’s milk purchase'}
                  </p>
                </div>
              </div>
              <span className="tap-record-badge">{t('oneTapRecord')}</span>
            </div>

            {/* 3 Quick Tap Quantity Cards */}
            <div className="quick-qty-grid">
              {/* Half Litre Button */}
              <button
                type="button"
                className="quick-qty-card"
                onClick={() => handleOpenQuickAdd(500)}
              >
                <span className="qty-heading">
                  {language === 'ta' ? '½ லிட்டர்' : language === 'ml' ? '½ ലിറ്റർ' : '½ Litre'}
                </span>
                <span className="qty-sub">{t('halfLitreSub')}</span>
                <span className="qty-price-pill">
                  {formatPaise(halfLitreAmountPaise)}
                </span>
              </button>

              {/* One Litre Button */}
              <button
                type="button"
                className="quick-qty-card"
                onClick={() => handleOpenQuickAdd(1000)}
              >
                <span className="qty-heading">
                  {language === 'ta' ? '1 லிட்டர்' : language === 'ml' ? '1 ലിറ്റർ' : '1 Litre'}
                </span>
                <span className="qty-sub">{t('oneLitreSub')}</span>
                <span className="qty-price-pill">
                  {formatPaise(oneLitreAmountPaise)}
                </span>
              </button>

              {/* Custom Quantity Button */}
              <button
                type="button"
                className="quick-qty-card custom-qty-card"
                onClick={() => handleOpenQuickAdd(1500)}
              >
                <span className="qty-heading-plus">+</span>
                <span className="qty-heading-custom">{t('customQty')}</span>
                <span className="qty-sub-custom">{t('otherQuantitySub')}</span>
              </button>
            </div>

            {/* Bottom 2 Action Buttons */}
            <div className="quick-actions-row">
              <button
                type="button"
                className="entry-action-btn daily-milk-btn"
                onClick={() => onNavigateToTab('purchases')}
              >
                <Droplets size={18} color="#2378FF" />
                <span>{t('purchases')}</span>
              </button>

              <button
                type="button"
                className="entry-action-btn record-pay-btn"
                onClick={() => setIsPaymentModalOpen(true)}
              >
                <CreditCard size={18} color="#059669" />
                <span>{t('recordPaymentNow')}</span>
              </button>
            </div>
          </div>

          {/* --------------------------------------------------
              CENTER COLUMN: FRESH MILK HAPPY FAMILY CARD
              -------------------------------------------------- */}
          <div className="dairy-visual-card">
            <div className="dairy-visual-overlay">
              <h3 className="dairy-visual-heading">
                Fresh Milk<br />Happy Family
              </h3>
            </div>
            <img
              src="/images/milk_scene_backdrop.jpg"
              alt="Fresh Milk Happy Family"
              className="dairy-visual-img"
              loading="lazy"
            />
          </div>

          {/* --------------------------------------------------
              RIGHT COLUMN: INFORMATION STACK
              -------------------------------------------------- */}
          <div className="info-stack">
            {/* Card 1: This Month Progress */}
            <div className="info-card progress-card">
              <div className="info-card-header">
                <div className="info-header-title">
                  <TrendingUp size={16} color="#2378FF" />
                  <span>{t('thisMonthProgress')}</span>
                </div>
                <span className="progress-metric-text">
                  {totalLitres} L / {targetLitres} L
                </span>
              </div>
              <div className="progress-bar-wrapper">
                <div className="progress-bar-track">
                  <div
                    className="progress-bar-fill"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                <span className="progress-percentage-label">{progressPercent}%</span>
              </div>
            </div>

            {/* Card 2: Quick Actions */}
            <div className="info-card quick-actions-card">
              <div className="info-card-header" style={{ marginBottom: '0.65rem' }}>
                <div className="info-header-title">
                  <Zap size={16} color="#f59e0b" />
                  <span>{t('quickActions')}</span>
                </div>
              </div>

              <div className="quick-actions-tiles-grid">
                {/* Manage Members */}
                <button
                  type="button"
                  className="quick-tile"
                  onClick={() => onNavigateToTab('members')}
                >
                  <div className="quick-tile-icon-bubble tile-blue">
                    <Users size={18} />
                  </div>
                  <span className="quick-tile-title">{t('manageMembers')}</span>
                  <ChevronRight size={13} className="quick-tile-chevron" />
                </button>

                {/* Update Milk Rate */}
                <button
                  type="button"
                  className="quick-tile"
                  onClick={() => setIsUpdateRateModalOpen(true)}
                >
                  <div className="quick-tile-icon-bubble tile-green">
                    <IndianRupee size={18} />
                  </div>
                  <span className="quick-tile-title">{t('updateMilkRate')}</span>
                  <ChevronRight size={13} className="quick-tile-chevron" />
                </button>

                {/* View Payments */}
                <button
                  type="button"
                  className="quick-tile"
                  onClick={() => onNavigateToTab('payments')}
                >
                  <div className="quick-tile-icon-bubble tile-blue-light">
                    <CreditCard size={18} />
                  </div>
                  <span className="quick-tile-title">{t('viewPayments')}</span>
                  <ChevronRight size={13} className="quick-tile-chevron" />
                </button>

                {/* Monthly Settlement */}
                <button
                  type="button"
                  className="quick-tile"
                  onClick={() => onNavigateToTab('settlement')}
                >
                  <div className="quick-tile-icon-bubble tile-purple">
                    <Calendar size={18} />
                  </div>
                  <span className="quick-tile-title">{t('monthlySettlement')}</span>
                  <ChevronRight size={13} className="quick-tile-chevron" />
                </button>
              </div>
            </div>

            {/* Card 3: Monthly Overview SVG Timeline Chart */}
            <div className="info-card monthly-chart-card">
              <div className="info-card-header" style={{ marginBottom: '0.5rem' }}>
                <div className="info-header-title">
                  <BarChart3 size={16} color="#059669" />
                  <span>{t('monthlyOverview')}</span>
                </div>
                <span className="chart-month-tag">
                  {formatDisplayMonthYear(selectedMonth, language)}
                </span>
              </div>

              {/* Minimalist SVG Bar Chart matching the reference image */}
              <div className="chart-canvas-container">
                <svg
                  viewBox="0 0 320 85"
                  className="monthly-overview-svg"
                  preserveAspectRatio="none"
                >
                  {/* Subtle Grid Guidelines: 3L, 2L, 1L, 0 */}
                  <line x1="28" y1="12" x2="310" y2="12" stroke="#e2e8f0" strokeDasharray="3 3" strokeWidth="0.8" />
                  <text x="8" y="15" fill="#94a3b8" fontSize="8" fontWeight="600">3L</text>

                  <line x1="28" y1="32" x2="310" y2="32" stroke="#e2e8f0" strokeDasharray="3 3" strokeWidth="0.8" />
                  <text x="8" y="35" fill="#94a3b8" fontSize="8" fontWeight="600">2L</text>

                  <line x1="28" y1="52" x2="310" y2="52" stroke="#e2e8f0" strokeDasharray="3 3" strokeWidth="0.8" />
                  <text x="8" y="55" fill="#94a3b8" fontSize="8" fontWeight="600">1L</text>

                  <line x1="28" y1="68" x2="310" y2="68" stroke="#cbd5e1" strokeWidth="1" />
                  <text x="14" y="71" fill="#94a3b8" fontSize="8" fontWeight="600">0</text>

                  {/* Day Axis markers: 1, 5, 10, 15, 20, 25, 30 */}
                  {[1, 5, 10, 15, 20, 25, 30].map((d) => {
                    const x = 32 + ((d - 1) / (daysInSelectedMonth - 1)) * 270;
                    return (
                      <text
                        key={d}
                        x={x}
                        y="80"
                        fill="#64748b"
                        fontSize="8"
                        textAnchor="middle"
                        fontWeight="600"
                      >
                        {d}
                      </text>
                    );
                  })}

                  {/* Dynamic Purchase Bars for each recorded day */}
                  {Array.from(dailyLitresMap.entries()).map(([day, litres]) => {
                    const x = 32 + ((day - 1) / (daysInSelectedMonth - 1)) * 270;
                    // Max scale is 3 Litres => height = 56px
                    const barHeight = Math.min(56, Math.max(6, (litres / 3) * 56));
                    const y = 68 - barHeight;

                    return (
                      <g key={day} className="chart-bar-group">
                        {/* Bar */}
                        <rect
                          x={x - 2.5}
                          y={y}
                          width="5"
                          height={barHeight}
                          rx="2.5"
                          fill="#2378FF"
                        />
                        {/* Litre Pill Indicator on top */}
                        <g transform={`translate(${x}, ${y - 8})`}>
                          <rect
                            x="-11"
                            y="-6"
                            width="22"
                            height="11"
                            rx="4"
                            fill="#0756C9"
                          />
                          <text
                            x="0"
                            y="2"
                            fill="#ffffff"
                            fontSize="7.5"
                            fontWeight="800"
                            textAnchor="middle"
                          >
                            {litres}L
                          </text>
                        </g>
                      </g>
                    );
                  })}
                </svg>

                {/* Bottom Chart Legend */}
                <div className="chart-legend-row">
                  <div className="legend-item">
                    <span className="legend-dot dot-purchased" />
                    <span>{t('purchased')}</span>
                  </div>
                  <div className="legend-item">
                    <span className="legend-dot dot-paid" />
                    <span>{t('paid')}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ====================================================
            4. PENDING PURCHASE NOTIFICATION BANNER
            ==================================================== */}
        <div className={`pending-status-banner ${summary?.todayPurchase ? 'banner-recorded' : 'banner-pending'}`}>
          <div className="banner-left">
            <div className={`banner-icon-bubble ${summary?.todayPurchase ? 'bubble-green' : 'bubble-amber'}`}>
              {summary?.todayPurchase ? (
                <CheckCircle2 size={24} color="#16a34a" />
              ) : (
                <Clock size={24} color="#d97706" />
              )}
            </div>
            <div>
              <div className="banner-title">
                {summary?.todayPurchase ? t('todayMilkPurchased') : t('noMilkToday')}
              </div>
              <div className="banner-desc">
                {summary?.todayPurchase ? (
                  <>
                    {formatMilkQuantity(summary.todayPurchase.quantityMl, language)} • {formatPaise(summary.todayPurchase.totalAmountPaise)} (
                    <span style={{ fontWeight: 700, color: summary.todayPurchase.paymentStatus === 'paid' ? '#16a34a' : '#d97706' }}>
                      {summary.todayPurchase.paymentStatus === 'paid' ? t('paid') : t('pending')}
                    </span>
                    )
                  </>
                ) : (
                  language === 'ml' ? 'ഇന്ന് വാങ്ങിയെങ്കിൽ മുകളിലെ ബട്ടൺ അമർത്തുക' : language === 'ta' ? 'இன்றைய பாலை பதிவு செய்ய மேலே உள்ள பட்டனை அழுத்தவும்' : 'Tap the buttons above to record today’s milk'
                )}
              </div>
            </div>
          </div>

          {!summary?.todayPurchase && (
            <button
              type="button"
              className="banner-save-btn"
              onClick={() => handleOpenQuickAdd(500)}
            >
              <Plus size={16} />
              <span>{t('save')}</span>
            </button>
          )}
        </div>

        {/* ====================================================
            5. RECENT TRANSACTIONS TABLE & CARDS
            ==================================================== */}
        <div className="transactions-card">
          <div className="transactions-header">
            <div className="tx-header-left">
              <FileText size={20} color="#2378FF" />
              <h3 className="tx-title">{t('recentActivity')}</h3>
            </div>
            <button
              type="button"
              className="tx-view-all-btn"
              onClick={() => onNavigateToTab('purchases')}
            >
              <span>{t('viewAll')}</span>
              <ArrowRight size={14} />
            </button>
          </div>

          {summary?.recentActivity && summary.recentActivity.length > 0 ? (
            <>
              {/* Desktop Table View */}
              <div className="desktop-tx-table-container">
                <table className="tx-table">
                  <thead>
                    <tr>
                      <th>{t('date')}</th>
                      <th>{t('type')}</th>
                      <th>{t('quantity')}</th>
                      <th>{t('amount')}</th>
                      <th>{t('paymentChoice')}</th>
                      <th>{t('addedBy')}</th>
                      <th style={{ textAlign: 'right' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.recentActivity.map((act) => {
                      const isPurchase = act.type === 'purchase';
                      const isPaid = act.status === 'paid' || !isPurchase;
                      const formattedDate = formatDisplayDate(act.date, language);

                      return (
                        <tr key={act.id} className="tx-table-row">
                          <td className="tx-date-cell">{formattedDate}</td>
                          <td>
                            <span className={`tx-type-pill ${isPurchase ? 'pill-purchase' : 'pill-payment'}`}>
                              {isPurchase ? t('milkPurchase') : t('payments')}
                            </span>
                          </td>
                          <td className="tx-qty-cell">
                            {isPurchase && act.quantityMl ? formatMilkQuantity(act.quantityMl, language) : '—'}
                          </td>
                          <td className={`tx-amount-cell ${isPurchase ? 'amt-purchase' : 'amt-payment'}`}>
                            {isPurchase ? '' : '+'}{formatPaise(act.amountPaise)}
                          </td>
                          <td>
                            <span className={`tx-status-pill ${isPaid ? 'status-paid' : 'status-pending'}`}>
                              {isPaid ? t('paid') : t('pending')}
                            </span>
                          </td>
                          <td className="tx-user-cell">
                            {act.memberName || 'Family Admin'}
                          </td>
                          <td className="tx-actions-cell" style={{ textAlign: 'right' }}>
                            <div className="row-action-wrapper" onClick={(e) => e.stopPropagation()}>
                              <button
                                type="button"
                                className="row-more-btn"
                                onClick={() => setOpenActionId(openActionId === act.id ? null : act.id)}
                                aria-label="Actions"
                              >
                                <MoreVertical size={16} />
                              </button>

                              {openActionId === act.id && (
                                <div className="row-actions-dropdown">
                                  {isPurchase && (
                                    <button
                                      type="button"
                                      className="dropdown-item"
                                      onClick={() => {
                                        setOpenActionId(null);
                                        setEditingRecord({
                                          id: act.id,
                                          date: act.date,
                                          quantityMl: act.quantityMl,
                                          totalAmountPaise: act.amountPaise,
                                          amountPaise: act.amountPaise,
                                          paymentStatus: act.status,
                                          memberName: act.memberName,
                                          createdAt: act.createdAt
                                        });
                                      }}
                                    >
                                      <Edit3 size={14} color="#2563eb" />
                                      <span>{language === 'ta' ? 'திருத்து' : language === 'ml' ? 'തിരുത്തുക' : 'Edit'}</span>
                                    </button>
                                  )}

                                  {isAdmin && (
                                    <button
                                      type="button"
                                      className="dropdown-item item-delete"
                                      onClick={() => {
                                        setOpenActionId(null);
                                        handleDeleteActivity(act);
                                      }}
                                    >
                                      <Trash2 size={14} color="#dc2626" />
                                      <span>{language === 'ta' ? 'நீக்கு' : language === 'ml' ? 'ഒഴിவாക്കുക' : 'Delete'}</span>
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile Transaction Cards View */}
              <div className="mobile-tx-cards-container">
                {summary.recentActivity.map((act) => {
                  const isPurchase = act.type === 'purchase';
                  const isPaid = act.status === 'paid' || !isPurchase;

                  return (
                    <div key={act.id} className="mobile-tx-item-card">
                      <div className="mobile-tx-top">
                        <div className="mobile-tx-type-group">
                          <span className={`tx-type-pill ${isPurchase ? 'pill-purchase' : 'pill-payment'}`}>
                            {isPurchase ? t('milkPurchase') : t('payments')}
                          </span>
                          <span className="mobile-tx-date">{formatDisplayDate(act.date, language)}</span>
                        </div>
                        <div className={`tx-amount-cell ${isPurchase ? 'amt-purchase' : 'amt-payment'}`}>
                          {isPurchase ? '' : '+'}{formatPaise(act.amountPaise)}
                        </div>
                      </div>

                      <div className="mobile-tx-bottom">
                        <div className="mobile-tx-meta">
                          {isPurchase && act.quantityMl && (
                            <span className="mobile-tx-qty">
                              {formatMilkQuantity(act.quantityMl, language)}
                            </span>
                          )}
                          <span className={`tx-status-pill ${isPaid ? 'status-paid' : 'status-pending'}`}>
                            {isPaid ? t('paid') : t('pending')}
                          </span>
                          <span className="mobile-tx-author">👤 {act.memberName || 'Family Admin'}</span>
                        </div>

                        {/* Edit and Delete Actions */}
                        <div className="mobile-tx-btns">
                          {isPurchase && (
                            <button
                              type="button"
                              className="mobile-action-icon-btn"
                              onClick={() => setEditingRecord({
                                id: act.id,
                                date: act.date,
                                quantityMl: act.quantityMl,
                                totalAmountPaise: act.amountPaise,
                                amountPaise: act.amountPaise,
                                paymentStatus: act.status,
                                memberName: act.memberName,
                                createdAt: act.createdAt
                              })}
                              title="Edit"
                            >
                              <Edit3 size={14} color="#2563eb" />
                            </button>
                          )}
                          {isAdmin && (
                            <button
                              type="button"
                              className="mobile-action-icon-btn btn-danger"
                              onClick={() => handleDeleteActivity(act)}
                              title="Delete"
                            >
                              <Trash2 size={14} color="#dc2626" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="tx-empty-state">
              <Droplets size={36} color="#cbd5e1" style={{ margin: '0 auto 0.5rem' }} />
              <p>{t('noRecentActivity')}</p>
            </div>
          )}
        </div>
      </div>

      {/* ====================================================
          6. MODALS
          ==================================================== */}
      {/* QUICK PURCHASE MODAL */}
      <QuickPurchaseModal
        isOpen={isPurchaseModalOpen}
        onClose={() => setIsPurchaseModalOpen(false)}
        onSuccess={() => fetchSummary(true)}
        currentRatePaise={currentRatePaise}
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
        yearMonth={selectedMonth}
      />

      {/* UPDATE RATE MODAL */}
      <UpdateRateModal
        isOpen={isUpdateRateModalOpen}
        onClose={() => setIsUpdateRateModalOpen(false)}
        onSuccess={() => fetchSummary(true)}
        currentRatePaise={currentRatePaise}
      />

      {/* CORRECTION / EDIT RECORD MODAL */}
      <CorrectionModal
        isOpen={Boolean(editingRecord)}
        onClose={() => setEditingRecord(null)}
        onSuccess={() => {
          fetchSummary(true);
          notifyDataChanged();
        }}
        entry={editingRecord}
      />
    </div>
  );
};
