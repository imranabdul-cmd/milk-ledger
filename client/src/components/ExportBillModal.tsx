import React, { useState, useEffect, useRef } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../api/client';
import {
  MilkEntry,
  DashboardSummary,
  formatPaise,
  Language
} from '@family-milk/shared';
import {
  generateMilkBillWorkbook,
  captureBillCardAsJpg,
  downloadBlob,
  shareExcelWithAppa,
  shareJpgWithAppa,
  formatKolkataDate
} from '../utils/excelExport';
import {
  X,
  FileSpreadsheet,
  Copy,
  Check,
  Calendar,
  Clock,
  CheckCircle2,
  Send,
  Image as ImageIcon,
  ChevronRight
} from 'lucide-react';

interface ExportBillModalProps {
  isOpen: boolean;
  onClose: () => void;
  yearMonth: string;
}

export const ExportBillModal: React.FC<ExportBillModalProps> = ({
  isOpen,
  onClose,
  yearMonth: initialYearMonth,
}) => {
  const { language, t } = useLanguage();
  const { user } = useAuth();

  const [selectedMonth, setSelectedMonth] = useState<string>(initialYearMonth);
  const [statementLang, setStatementLang] = useState<Language>(language);
  const [entries, setEntries] = useState<MilkEntry[]>([]);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [familyName, setFamilyName] = useState<string>('Family Milk Account');
  const [whatsappText, setWhatsappText] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isDownloading, setIsDownloading] = useState<boolean>(false);
  const [isSharing, setIsSharing] = useState<boolean>(false);
  const [isFormatChooserOpen, setIsFormatChooserOpen] = useState<boolean>(false);
  const [downloadSuccessMsg, setDownloadSuccessMsg] = useState<string | null>(null);
  const [copySuccess, setCopySuccess] = useState<boolean>(false);

  // Ref to the printable/shareable card element for html2canvas
  const billCardRef = useRef<HTMLDivElement>(null);

  // Sync statement language if global language changes
  useEffect(() => {
    setStatementLang(language);
  }, [language]);

  // Sync selectedMonth if prop changes
  useEffect(() => {
    if (initialYearMonth) {
      setSelectedMonth(initialYearMonth);
    }
  }, [initialYearMonth]);

  // Fetch month entries, summary, and family name
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    const loadData = async () => {
      setIsLoading(true);
      try {
        const [entriesRes, sumRes, textRes] = await Promise.all([
          apiRequest<{ entries: MilkEntry[] }>(`/api/milk/entries?month=${selectedMonth}`),
          apiRequest<{ summary: DashboardSummary }>(`/api/settlement/summary?month=${selectedMonth}`),
          apiRequest<{ text: string; shareUrl: string }>(
            `/api/settlement/whatsapp-text?month=${selectedMonth}&lang=${statementLang}`
          ),
        ]);

        if (isMounted) {
          setEntries(entriesRes.entries || []);
          setSummary(sumRes.summary || null);
          setWhatsappText(textRes.text || '');

          // Family name from summary or user
          const rawSum = sumRes.summary as any;
          if (rawSum?.familyName) {
            setFamilyName(rawSum.familyName);
          } else if (user?.familyId) {
            try {
              const fRes = await apiRequest<{ family: { name: string } }>(`/api/family`);
              if (fRes.family?.name && isMounted) {
                setFamilyName(fRes.family.name);
              }
            } catch {
              // fallback
            }
          }
        }
      } catch (err) {
        console.error('Failed to load export data for month:', selectedMonth, err);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadData();

    return () => {
      isMounted = false;
    };
  }, [isOpen, selectedMonth, statementLang, user?.familyId]);

  if (!isOpen) return null;

  const sanitizedFamily = familyName.replace(/[^a-zA-Z0-9]/g, '_');

  // Handle Download Excel
  const handleDownloadExcel = async () => {
    if (!summary) return;
    setIsDownloading(true);
    try {
      const bundle = await generateMilkBillWorkbook({
        familyName,
        yearMonth: selectedMonth,
        entries,
        summary,
        lang: statementLang
      });
      downloadBlob(bundle.blob, bundle.filename);
      setDownloadSuccessMsg(t('excelDownloaded'));
      setTimeout(() => setDownloadSuccessMsg(null), 3000);
    } catch (err: any) {
      console.error('Download failed:', err);
      alert('Failed to download Excel file: ' + (err?.message || 'Unknown error'));
    } finally {
      setIsDownloading(false);
    }
  };

  // Handle Download Photo (JPG)
  const handleDownloadPhoto = async () => {
    if (!billCardRef.current || !summary) return;
    setIsDownloading(true);
    try {
      const filename = `Milk_Bill_${selectedMonth}_${sanitizedFamily}.jpg`;
      const { blob } = await captureBillCardAsJpg(billCardRef.current, filename);
      downloadBlob(blob, filename);
      setDownloadSuccessMsg(t('photoDownloaded'));
      setTimeout(() => setDownloadSuccessMsg(null), 3000);
    } catch (err: any) {
      console.error('Image capture failed:', err);
      alert('Failed to capture photo: ' + (err?.message || 'Unknown error'));
    } finally {
      setIsDownloading(false);
    }
  };

  // Handle WhatsApp Share as Photo (JPG)
  const handleSharePhotoWhatsApp = async () => {
    if (!billCardRef.current || !summary) return;
    setIsSharing(true);
    setIsFormatChooserOpen(false);
    try {
      const filename = `Milk_Bill_${selectedMonth}_${sanitizedFamily}.jpg`;
      const { blob } = await captureBillCardAsJpg(billCardRef.current, filename);
      const result = await shareJpgWithAppa(blob, filename, whatsappText);
      if (result.mode === 'download_and_whatsapp') {
        setDownloadSuccessMsg(t('photoDownloaded'));
        setTimeout(() => setDownloadSuccessMsg(null), 3000);
      }
    } catch (err: any) {
      console.error('Photo share failed:', err);
      alert('Failed to share photo: ' + (err?.message || 'Unknown error'));
    } finally {
      setIsSharing(false);
    }
  };

  // Handle WhatsApp Share as Excel (.xlsx)
  const handleShareExcelWhatsApp = async () => {
    if (!summary) return;
    setIsSharing(true);
    setIsFormatChooserOpen(false);
    try {
      const bundle = await generateMilkBillWorkbook({
        familyName,
        yearMonth: selectedMonth,
        entries,
        summary,
        lang: statementLang
      });
      const result = await shareExcelWithAppa(
        bundle.blob,
        bundle.filename,
        whatsappText
      );
      if (result.mode === 'download_and_whatsapp') {
        setDownloadSuccessMsg(t('excelDownloaded'));
        setTimeout(() => setDownloadSuccessMsg(null), 3000);
      }
    } catch (err: any) {
      console.error('Excel share failed:', err);
      alert('Failed to share Excel: ' + (err?.message || 'Unknown error'));
    } finally {
      setIsSharing(false);
    }
  };

  // Handle Copy Statement Text
  const handleCopyText = () => {
    if (!whatsappText) return;
    navigator.clipboard.writeText(whatsappText);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  const isDue = (summary?.closingBalancePaise || 0) > 0;
  const isCredit = (summary?.closingBalancePaise || 0) < 0;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content"
        style={{
          maxWidth: '740px',
          width: '95%',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          padding: '1.25rem',
          position: 'relative',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="modal-header" style={{ paddingBottom: '0.75rem', marginBottom: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '12px',
                background: '#ecfdf5',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#059669',
                boxShadow: '0 2px 6px rgba(5,150,105,0.15)'
              }}
            >
              <FileSpreadsheet size={24} />
            </div>
            <div>
              <h2 className="modal-title" style={{ fontSize: '1.25rem', margin: 0, fontWeight: 800 }}>
                {t('exportBill')}
              </h2>
              <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}>
                {language === 'ta'
                  ? 'அப்பாவுக்கு அனுப்ப வேண்டிய மாதாந்திர பில் (Photo & Excel)'
                  : language === 'ml'
                  ? 'അച്ഛന് അയക്കാനുള്ള പ്രതിമാസ ബിൽ (Photo & Excel)'
                  : 'Monthly Bill Statement & Excel Sheet for Appa'}
              </p>
            </div>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>

        {/* Month Selector Bar & Language Switcher */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '0.5rem',
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '10px',
            padding: '0.6rem 0.85rem',
            marginBottom: '1rem'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Calendar size={16} color="#64748b" />
            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#334155' }}>
              {t('month')}:
            </span>
            <input
              type="month"
              className="form-input"
              style={{
                width: 'auto',
                padding: '0.3rem 0.6rem',
                fontSize: '0.85rem',
                border: '1px solid #cbd5e1'
              }}
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>
              {t('language')}:
            </span>
            <button
              type="button"
              className={`btn-secondary ${statementLang === 'ta' ? 'selected-paid' : ''}`}
              style={{
                padding: '0.25rem 0.55rem',
                fontSize: '0.75rem',
                minHeight: '28px',
                borderColor: statementLang === 'ta' ? '#2563eb' : undefined
              }}
              onClick={() => setStatementLang('ta')}
            >
              தமிழ்
            </button>
            <button
              type="button"
              className={`btn-secondary ${statementLang === 'ml' ? 'selected-paid' : ''}`}
              style={{
                padding: '0.25rem 0.55rem',
                fontSize: '0.75rem',
                minHeight: '28px',
                borderColor: statementLang === 'ml' ? '#2563eb' : undefined
              }}
              onClick={() => setStatementLang('ml')}
            >
              മലയാളം
            </button>
            <button
              type="button"
              className={`btn-secondary ${statementLang === 'en' ? 'selected-paid' : ''}`}
              style={{
                padding: '0.25rem 0.55rem',
                fontSize: '0.75rem',
                minHeight: '28px',
                borderColor: statementLang === 'en' ? '#2563eb' : undefined
              }}
              onClick={() => setStatementLang('en')}
            >
              EN
            </button>
          </div>
        </div>

        {/* Content Body */}
        {isLoading ? (
          <div style={{ padding: '2.5rem', textAlign: 'center', color: '#64748b' }}>
            <FileSpreadsheet
              size={32}
              style={{ margin: '0 auto 0.75rem auto', color: '#059669' }}
            />
            <p style={{ margin: 0, fontSize: '0.9rem' }}>
              {language === 'ta'
                ? 'அறிக்கை கணக்கிடப்படுகிறது...'
                : language === 'ml'
                ? 'സ്റ്റേറ്റ്മെന്റ് തയ്യാറാക്കുന്നു...'
                : 'Preparing monthly statement...'}
            </p>
          </div>
        ) : (
          <div style={{ overflowY: 'auto', flex: 1, paddingRight: '0.25rem' }}>
            {/* ==============================================================
                THE BILL CARD TEMPLATE CONTAINER (CAPTURED FOR PHOTO JPG & DISPLAY)
                ============================================================== */}
            <div
              ref={billCardRef}
              style={{
                background: '#ffffff',
                border: '1.5px solid #e2e8f0',
                borderRadius: '16px',
                padding: '1.1rem',
                marginBottom: '1rem',
                boxShadow: '0 4px 16px rgba(0,0,0,0.04)',
              }}
            >
              {/* Card Banner Header */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  borderBottom: '1.5px solid #f1f5f9',
                  paddingBottom: '0.75rem',
                  marginBottom: '1rem',
                }}
              >
                <div>
                  <div style={{ fontSize: '1.15rem', fontWeight: 900, color: '#0f172a' }}>
                    {familyName}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>
                    {selectedMonth} • {language === 'ta' ? 'மாதாந்திர பால் பில் அறிக்கை' : 'Monthly Milk Statement'}
                  </div>
                </div>
                <div
                  style={{
                    background: '#ecfdf5',
                    color: '#059669',
                    padding: '0.3rem 0.7rem',
                    borderRadius: '20px',
                    fontSize: '0.78rem',
                    fontWeight: 800,
                  }}
                >
                  {entries.length} {language === 'ta' ? 'நாட்கள் பதிவு' : 'Records'}
                </div>
              </div>

              {/* Top 4 Highlight Stat Cards for Appa */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                  gap: '0.6rem',
                  marginBottom: '1.1rem'
                }}
              >
                {/* Total Milk */}
                <div
                  style={{
                    background: '#eff6ff',
                    border: '1.5px solid #bfdbfe',
                    borderRadius: '12px',
                    padding: '0.75rem 0.85rem'
                  }}
                >
                  <div style={{ fontSize: '0.75rem', color: '#1e40af', fontWeight: 700 }}>
                    {language === 'ta' ? 'மொத்த பால்' : language === 'ml' ? 'ആകെ പാൽ' : 'Total Milk'}
                  </div>
                  <div style={{ fontSize: '1.35rem', fontWeight: 900, color: '#1e3a8a', marginTop: '2px' }}>
                    {summary?.totalLitres || 0} L
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#3b82f6', fontWeight: 600 }}>
                    {summary?.purchaseDays || 0} {t('days')}
                  </div>
                </div>

                {/* Total Milk Charges */}
                <div
                  style={{
                    background: '#fef2f2',
                    border: '1.5px solid #fecaca',
                    borderRadius: '12px',
                    padding: '0.75rem 0.85rem'
                  }}
                >
                  <div style={{ fontSize: '0.75rem', color: '#991b1b', fontWeight: 700 }}>
                    {language === 'ta' ? 'மொத்த கட்டணம்' : language === 'ml' ? 'ആകെ തുക' : 'Total Bill'}
                  </div>
                  <div style={{ fontSize: '1.35rem', fontWeight: 900, color: '#b91c1c', marginTop: '2px' }}>
                    {formatPaise(summary?.totalMilkChargesPaise || 0)}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#ef4444', fontWeight: 600 }}>
                    @ {formatPaise(summary?.currentRatePaisePerLitre || 5600)}/L
                  </div>
                </div>

                {/* Payments Paid */}
                <div
                  style={{
                    background: '#f0fdf4',
                    border: '1.5px solid #bbf7d0',
                    borderRadius: '12px',
                    padding: '0.75rem 0.85rem'
                  }}
                >
                  <div style={{ fontSize: '0.75rem', color: '#166534', fontWeight: 700 }}>
                    {language === 'ta' ? 'கொடுத்தது' : language === 'ml' ? 'നൽകിയത്' : 'Total Paid'}
                  </div>
                  <div style={{ fontSize: '1.35rem', fontWeight: 900, color: '#15803d', marginTop: '2px' }}>
                    {formatPaise(summary?.totalPaymentsPaise || 0)}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#22c55e', fontWeight: 600 }}>
                    {language === 'ta' ? 'செலுத்தியது' : 'Payments received'}
                  </div>
                </div>

                {/* Balance Due (Big Highlight for Appa) */}
                <div
                  style={{
                    background: isDue ? '#fff1f2' : isCredit ? '#f0fdf4' : '#f8fafc',
                    border: `2px solid ${isDue ? '#f43f5e' : isCredit ? '#22c55e' : '#cbd5e1'}`,
                    borderRadius: '12px',
                    padding: '0.75rem 0.85rem'
                  }}
                >
                  <div
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 800,
                      color: isDue ? '#be123c' : isCredit ? '#15803d' : '#475569'
                    }}
                  >
                    {isDue
                      ? (language === 'ta' ? '🔴 பாக்கி தொகை' : language === 'ml' ? '🔴 ബാക്കി കുടിശ്ശിക' : '🔴 Balance Due')
                      : isCredit
                      ? (language === 'ta' ? '🟢 முன்பணம் (Credit)' : '🟢 Advance Credit')
                      : (language === 'ta' ? '✅ பாக்கி இல்லை' : '✅ Nil Due')}
                  </div>
                  <div
                    style={{
                      fontSize: '1.4rem',
                      fontWeight: 900,
                      color: isDue ? '#e11d48' : isCredit ? '#16a34a' : '#0f172a',
                      marginTop: '2px'
                    }}
                  >
                    {formatPaise(Math.abs(summary?.closingBalancePaise || 0))}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: isDue ? '#f43f5e' : '#64748b', fontWeight: 700 }}>
                    {isDue ? (language === 'ta' ? 'அப்பா தர வேண்டியது' : 'To be settled') : 'All settled'}
                  </div>
                </div>
              </div>

              {/* Excel Sheet Style Preview Table Container */}
              <div
                style={{
                  background: 'white',
                  border: '1.5px solid #cbd5e1',
                  borderRadius: '12px',
                  overflow: 'hidden',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.03)'
                }}
              >
                {/* Excel Green Top Ribbon */}
                <div
                  style={{
                    background: '#107c41',
                    color: 'white',
                    padding: '0.55rem 0.85rem',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontSize: '0.85rem',
                    fontWeight: 700
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <FileSpreadsheet size={16} />
                    <span>
                      {familyName} — {selectedMonth}.xlsx
                    </span>
                  </div>
                  <span
                    style={{
                      background: 'rgba(255,255,255,0.2)',
                      padding: '0.15rem 0.55rem',
                      borderRadius: '6px',
                      fontSize: '0.72rem',
                    }}
                  >
                    {entries.length} records
                  </span>
                </div>

                {/* Table */}
                <div style={{ maxHeight: '280px', overflowY: 'auto' }}>
                  {entries.length === 0 ? (
                    <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
                      <p style={{ margin: 0, fontSize: '0.9rem' }}>
                        {language === 'ta'
                          ? 'இந்த மாதத்தில் எந்த பால் பதிவும் இல்லை'
                          : language === 'ml'
                          ? 'ഈ മാസത്തിൽ പാൽ ഇടപാടുകൾ ഒന്നും രേഖപ്പെടുത്തിയിട്ടില്ല'
                          : 'No milk records found for this month.'}
                      </p>
                    </div>
                  ) : (
                    <table
                      style={{
                        width: '100%',
                        borderCollapse: 'collapse',
                        fontSize: '0.82rem',
                        textAlign: 'left'
                      }}
                    >
                      <thead>
                        <tr
                          style={{
                            background: '#f1f5f9',
                            borderBottom: '2px solid #cbd5e1',
                            color: '#334155',
                            position: 'sticky',
                            top: 0,
                            zIndex: 1
                          }}
                        >
                          <th style={{ padding: '0.55rem 0.65rem', width: '45px' }}>#</th>
                          <th style={{ padding: '0.55rem 0.65rem' }}>
                            {language === 'ta' ? 'தேதி' : language === 'ml' ? 'തീയതി' : 'Date'}
                          </th>
                          <th style={{ padding: '0.55rem 0.65rem' }}>
                            {language === 'ta' ? 'அளவு' : language === 'ml' ? 'അളവ്' : 'Quantity'}
                          </th>
                          <th style={{ padding: '0.55rem 0.65rem' }}>
                            {language === 'ta' ? 'விலை/லி' : language === 'ml' ? 'വില/ലി' : 'Rate/L'}
                          </th>
                          <th style={{ padding: '0.55rem 0.65rem' }}>
                            {language === 'ta' ? 'தொகை' : language === 'ml' ? 'തുക' : 'Amount'}
                          </th>
                          <th style={{ padding: '0.55rem 0.65rem' }}>
                            {language === 'ta' ? 'நிலை' : language === 'ml' ? 'നില' : 'Status'}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {entries
                          .slice()
                          .sort((a, b) => a.date.localeCompare(b.date))
                          .map((entry, idx) => {
                            const isPaid = entry.paymentStatus === 'paid';
                            const displayDate = formatKolkataDate(entry.date);
                            return (
                              <tr
                                key={entry.id}
                                style={{
                                  borderBottom: '1px solid #e2e8f0',
                                  background: isPaid ? 'rgba(240, 253, 244, 0.45)' : 'rgba(254, 242, 242, 0.55)'
                                }}
                              >
                                <td style={{ padding: '0.5rem 0.65rem', color: '#64748b' }}>
                                  {idx + 1}
                                </td>
                                <td style={{ padding: '0.5rem 0.65rem', fontWeight: 700, color: '#0f172a' }}>
                                  {displayDate}
                                </td>
                                <td style={{ padding: '0.5rem 0.65rem', fontWeight: 600 }}>
                                  {(entry.quantityMl / 1000).toFixed(2)} L
                                </td>
                                <td style={{ padding: '0.5rem 0.65rem', color: '#475569' }}>
                                  {formatPaise(entry.ratePaisePerLitre)}
                                </td>
                                <td style={{ padding: '0.5rem 0.65rem', fontWeight: 800 }}>
                                  {formatPaise(entry.totalAmountPaise)}
                                </td>
                                <td style={{ padding: '0.5rem 0.65rem' }}>
                                  {isPaid ? (
                                    <span
                                      style={{
                                        background: '#dcfce7',
                                        color: '#15803d',
                                        padding: '0.2rem 0.55rem',
                                        borderRadius: '6px',
                                        fontSize: '0.75rem',
                                        fontWeight: 800,
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '3px'
                                      }}
                                    >
                                      <CheckCircle2 size={13} />
                                      {language === 'ta' ? 'Paid' : 'Paid'}
                                    </span>
                                  ) : (
                                    <span
                                      style={{
                                        background: '#fee2e2',
                                        color: '#b91c1c',
                                        padding: '0.2rem 0.55rem',
                                        borderRadius: '6px',
                                        fontSize: '0.75rem',
                                        fontWeight: 800,
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '3px'
                                      }}
                                    >
                                      <Clock size={13} />
                                      {language === 'ta' ? 'Pay Later' : 'Pay Later'}
                                    </span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  )}
                </div>

                {/* Sticky Total Row */}
                {entries.length > 0 && (
                  <div
                    style={{
                      background: '#f8fafc',
                      borderTop: '2px solid #cbd5e1',
                      padding: '0.65rem 0.85rem',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      fontSize: '0.85rem',
                      fontWeight: 800,
                      color: '#0f172a'
                    }}
                  >
                    <span>
                      {language === 'ta' ? 'மொத்தம்:' : 'Total:'} {summary?.totalLitres || 0} L
                    </span>
                    <span>
                      {language === 'ta' ? 'கட்டணம்:' : 'Charges:'} {formatPaise(summary?.totalMilkChargesPaise || 0)}
                    </span>
                    <span style={{ color: isDue ? '#dc2626' : '#16a34a' }}>
                      {language === 'ta' ? 'பாக்கி:' : 'Due:'} {formatPaise(Math.abs(summary?.closingBalancePaise || 0))}
                    </span>
                  </div>
                )}
              </div>

              {/* Watermark at bottom of captured card */}
              <div
                style={{
                  marginTop: '0.65rem',
                  textAlign: 'right',
                  fontSize: '0.7rem',
                  color: '#94a3b8',
                  fontStyle: 'italic',
                }}
              >
                Family Milk Account • {formatKolkataDate(new Date().toISOString())}
              </div>
            </div>

            {/* Notification alert on download */}
            {downloadSuccessMsg && (
              <div
                style={{
                  background: '#ecfdf5',
                  border: '1px solid #a7f3d0',
                  color: '#065f46',
                  borderRadius: '8px',
                  padding: '0.65rem 0.85rem',
                  marginBottom: '1rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  fontSize: '0.85rem',
                  fontWeight: 700
                }}
              >
                <Check size={18} />
                <span>{downloadSuccessMsg}</span>
              </div>
            )}
          </div>
        )}

        {/* Action Buttons Bar */}
        <div
          style={{
            borderTop: '1px solid #e2e8f0',
            paddingTop: '0.85rem',
            marginTop: '0.5rem',
            display: 'flex',
            flexWrap: 'wrap',
            gap: '0.6rem',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          {/* Download Buttons Group */}
          <div style={{ display: 'flex', gap: '0.45rem', flex: '1 1 auto' }}>
            {/* Download Excel */}
            <button
              type="button"
              className="btn-secondary"
              style={{
                flex: 1,
                minHeight: '44px',
                justifyContent: 'center',
                fontSize: '0.85rem',
                fontWeight: 700,
                gap: '0.4rem',
                borderColor: '#059669',
                color: '#059669'
              }}
              onClick={handleDownloadExcel}
              disabled={isLoading || isDownloading || !summary}
              title="Download Microsoft Excel Sheet"
            >
              <FileSpreadsheet size={16} />
              <span>{t('exportExcel')}</span>
            </button>

            {/* Download Photo (JPG) */}
            <button
              type="button"
              className="btn-secondary"
              style={{
                flex: 1,
                minHeight: '44px',
                justifyContent: 'center',
                fontSize: '0.85rem',
                fontWeight: 700,
                gap: '0.4rem',
                borderColor: '#2563eb',
                color: '#2563eb'
              }}
              onClick={handleDownloadPhoto}
              disabled={isLoading || isDownloading || !summary}
              title="Download High-Res JPG Photo"
            >
              <ImageIcon size={16} />
              <span>{t('downloadPhoto')}</span>
            </button>
          </div>

          {/* Big WhatsApp Share Button (Triggers Format Modal) */}
          <button
            type="button"
            className="whatsapp-btn"
            style={{
              flex: '1 1 230px',
              minHeight: '44px',
              justifyContent: 'center',
              fontSize: '0.92rem',
              fontWeight: 800,
              gap: '0.5rem',
              background: '#25d366',
              boxShadow: '0 4px 12px rgba(37,211,102,0.3)'
            }}
            onClick={() => setIsFormatChooserOpen(true)}
            disabled={isLoading || isSharing || !summary}
          >
            <Send size={18} />
            <span>
              {language === 'ta'
                ? 'அப்பாவுக்கு வாட்ஸ்அப்பில் அனுப்புக'
                : language === 'ml'
                ? 'അച്ഛന് വാട്സാപ്പിൽ അയക്കുക'
                : 'Send to Appa via WhatsApp'}
            </span>
          </button>

          {/* Copy Text Summary Button */}
          <button
            type="button"
            className="btn-secondary"
            style={{
              padding: '0.55rem 0.8rem',
              minHeight: '44px',
              justifyContent: 'center',
              fontSize: '0.82rem',
              fontWeight: 600
            }}
            onClick={handleCopyText}
            disabled={isLoading || !whatsappText}
          >
            {copySuccess ? <Check size={16} color="#059669" /> : <Copy size={16} />}
            <span>{copySuccess ? 'Copied!' : 'Copy Text'}</span>
          </button>
        </div>

        {/* ==============================================================
            FORMAT CHOOSER MODAL (ASK USER: PHOTO JPG OR EXCEL .XLSX)
            ============================================================== */}
        {isFormatChooserOpen && (
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(15, 23, 42, 0.65)',
              backdropFilter: 'blur(3px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '1.25rem',
              zIndex: 9999,
              borderRadius: 'inherit'
            }}
            onClick={() => setIsFormatChooserOpen(false)}
          >
            <div
              style={{
                background: 'white',
                borderRadius: '20px',
                padding: '1.5rem',
                maxWidth: '440px',
                width: '100%',
                boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
                border: '1.5px solid #e2e8f0',
                textAlign: 'center',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div
                style={{
                  width: '52px',
                  height: '52px',
                  borderRadius: '50%',
                  background: '#ecfdf5',
                  color: '#059669',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 0.85rem auto',
                }}
              >
                <Send size={26} />
              </div>

              <h3 style={{ fontSize: '1.2rem', fontWeight: 900, color: '#0f172a', margin: '0 0 0.35rem 0' }}>
                {t('sendFormatTitle')}
              </h3>
              <p style={{ fontSize: '0.85rem', color: '#64748b', margin: '0 0 1.25rem 0' }}>
                {language === 'ta'
                  ? 'அப்பாவுக்கு படமாக (Photo) அல்லது எக்செல் பைலாக (Excel) அனுப்பலாமா?'
                  : 'Send as attractive Photo (JPG) or Excel sheet (.xlsx)?'}
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {/* CHOICE 1: PHOTO (JPG) - RECOMMENDED FOR APPA */}
                <button
                  type="button"
                  onClick={handleSharePhotoWhatsApp}
                  disabled={isSharing}
                  style={{
                    background: 'linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%)',
                    border: '2px solid #059669',
                    borderRadius: '16px',
                    padding: '0.9rem 1rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    textAlign: 'left',
                    boxShadow: '0 4px 12px rgba(5, 150, 105, 0.12)',
                    transition: 'transform 0.15s ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div
                      style={{
                        width: '42px',
                        height: '42px',
                        borderRadius: '12px',
                        background: '#059669',
                        color: 'white',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <ImageIcon size={22} />
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <span style={{ fontWeight: 800, fontSize: '0.98rem', color: '#065f46' }}>
                          {t('sendAsPhoto')}
                        </span>
                        <span
                          style={{
                            background: '#059669',
                            color: 'white',
                            fontSize: '0.65rem',
                            fontWeight: 800,
                            padding: '0.15rem 0.45rem',
                            borderRadius: '10px',
                          }}
                        >
                          Best for Appa
                        </span>
                      </div>
                      <div style={{ fontSize: '0.78rem', color: '#047857', marginTop: '2px' }}>
                        {t('sendAsPhotoDesc')}
                      </div>
                    </div>
                  </div>
                  <ChevronRight size={20} color="#059669" />
                </button>

                {/* CHOICE 2: EXCEL (.XLSX) */}
                <button
                  type="button"
                  onClick={handleShareExcelWhatsApp}
                  disabled={isSharing}
                  style={{
                    background: '#f8fafc',
                    border: '1.5px solid #cbd5e1',
                    borderRadius: '16px',
                    padding: '0.9rem 1rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'transform 0.15s ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div
                      style={{
                        width: '42px',
                        height: '42px',
                        borderRadius: '12px',
                        background: '#2563eb',
                        color: 'white',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <FileSpreadsheet size={22} />
                    </div>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: '0.98rem', color: '#1e3a8a' }}>
                        {t('sendAsExcel')}
                      </div>
                      <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '2px' }}>
                        {t('sendAsExcelDesc')}
                      </div>
                    </div>
                  </div>
                  <ChevronRight size={20} color="#64748b" />
                </button>
              </div>

              {/* Cancel Button */}
              <button
                type="button"
                className="btn-secondary"
                style={{
                  marginTop: '1rem',
                  width: '100%',
                  justifyContent: 'center',
                  minHeight: '40px',
                  fontSize: '0.85rem',
                  fontWeight: 700,
                }}
                onClick={() => setIsFormatChooserOpen(false)}
              >
                {t('cancel')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
