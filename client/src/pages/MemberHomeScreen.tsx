import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useVoice } from '../context/VoiceContext';
import { apiRequest } from '../api/client';
import { MilkEntry, MilkRateHistory, formatPaise } from '@family-milk/shared';
import {
  Volume2,
  VolumeX,
  CheckCircle2,
  Clock,
  Droplets,
  Calendar,
  AlertCircle,
  RotateCcw,
  Plus,
  Minus,
  ArrowLeft,
  Globe,
  LogOut,
  SlidersHorizontal,
  Wallet,
  FileSpreadsheet
} from 'lucide-react';
import { ExportBillModal } from '../components/ExportBillModal';

interface MemberHomeScreenProps {
  onSwitchToAdmin?: () => void;
}

export const MemberHomeScreen: React.FC<MemberHomeScreenProps> = ({ onSwitchToAdmin }) => {
  const { user, logout, updateUserLanguage } = useAuth();
  const { language, toggleLanguage, t } = useLanguage();
  const { voiceEnabled, toggleVoice, speakText } = useVoice();

  const isPrivileged = user?.role === 'owner' || user?.role === 'admin';

  // Rates & Recent Entries
  const [activeRatePaise, setActiveRatePaise] = useState<number>(5600); // Default ₹56/L
  const [todayEntries, setTodayEntries] = useState<MilkEntry[]>([]);
  const [recentEntries, setRecentEntries] = useState<MilkEntry[]>([]);
  const [closingBalancePaise, setClosingBalancePaise] = useState<number>(0);

  // Purchase Flow State
  // Step 1: select_quantity -> Step 2: choose_payment -> Step 3: success
  const [step, setStep] = useState<'select_quantity' | 'custom_quantity' | 'choose_payment' | 'success'>('select_quantity');
  const [selectedQuantityMl, setSelectedQuantityMl] = useState<number>(1000);
  const [customMl, setCustomMl] = useState<number>(750);
  const [paymentChoice, setPaymentChoice] = useState<'paid' | 'pending'>('paid');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [lastSavedEntry, setLastSavedEntry] = useState<MilkEntry | null>(null);
  const [isExportModalOpen, setIsExportModalOpen] = useState<boolean>(false);

  // Today's date in Asia/Kolkata
  const todayDateStr = useMemo(() => {
    try {
      return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(new Date());
    } catch {
      return new Date().toISOString().substring(0, 10);
    }
  }, []);

  // Calculated amount for selected quantity
  const calculatedPaise = useMemo(() => {
    return Math.round((selectedQuantityMl / 1000) * activeRatePaise);
  }, [selectedQuantityMl, activeRatePaise]);

  const calculatedRupees = useMemo(() => {
    return (calculatedPaise / 100).toFixed(0);
  }, [calculatedPaise]);

  // Fetch initial family data: rate, today's entries, recent entries, balance
  const fetchData = useCallback(async () => {
    try {
      const [ratesRes, entriesRes, summaryRes] = await Promise.all([
        apiRequest<{ rates: MilkRateHistory[] }>('/api/milk/rates'),
        apiRequest<{ entries: MilkEntry[] }>(`/api/milk/entries`),
        apiRequest<{ summary: any }>('/api/settlement/summary'),
      ]);

      if (ratesRes.rates && ratesRes.rates.length > 0) {
        setActiveRatePaise(ratesRes.rates[0].ratePaisePerLitre);
      }

      if (entriesRes.entries) {
        const todayItems = entriesRes.entries.filter((e) => e.date === todayDateStr);
        setTodayEntries(todayItems);
        setRecentEntries(entriesRes.entries.slice(0, 5));
      }

      if (summaryRes.summary) {
        setClosingBalancePaise(summaryRes.summary.closingBalancePaise || 0);
      }
    } catch (err) {
      console.error('Failed to load member screen data:', err);
    }
  }, [todayDateStr]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Voice greeting on initial screen entry (if enabled)
  const speakInstruction = useCallback(() => {
    if (language === 'ml') {
      speakText('ഇന്നത്തെ പാൽ രേഖപ്പെടുത്താൻ അര ലിറ്ററോ ഒരു ലിറ്ററോ തിരഞ്ഞെടുക്കുക', true);
    } else if (language === 'ta') {
      speakText('இன்றைய பாலை பதிவு செய்ய அரை லிட்டர் அல்லது ஒரு லிட்டர் தேர்ந்தெடுக்கவும்', true);
    } else {
      speakText("To record today's milk, choose half litre or one litre.", true);
    }
  }, [language, speakText]);

  // Handle Quantity Selection
  const handleSelectQuantity = (ml: number) => {
    setSelectedQuantityMl(ml);
    setSubmitError(null);
    setStep('choose_payment');

    const paise = Math.round((ml / 1000) * activeRatePaise);
    const rupees = (paise / 100).toFixed(0);
    const qtyLabel = ml === 500 ? (language === 'ml' ? 'അര ലിറ്റർ' : language === 'ta' ? 'அரை லிட்டர்' : 'Half litre') : (language === 'ml' ? 'ഒരു ലിറ്റർ' : language === 'ta' ? 'ஒரு லிட்டர்' : 'One litre');

    if (language === 'ml') {
      speakText(`${qtyLabel} പാൽ. തുക ${rupees} രൂപ. പണം നൽകിയോ അതോ പിന്നെ നൽകുമോ?`);
    } else if (language === 'ta') {
      speakText(`${qtyLabel} பால். தொகை ${rupees} ரூபாய். பணம் கொடுத்தாச்சா அல்லது அப்புறம் தரலாமா?`);
    } else {
      speakText(`${qtyLabel} milk. Amount ${rupees} rupees. Paid now or pay later?`);
    }
  };

  // Handle Payment Choice Click
  const handleChoosePayment = (choice: 'paid' | 'pending') => {
    setPaymentChoice(choice);
    if (choice === 'paid') {
      if (language === 'ml') speakText('പണം നൽകി എന്ന് തിരഞ്ഞെടുത്തു');
      else if (language === 'ta') speakText('பணம் கொடுத்தாச்சு என்று தேர்வு செய்யப்பட்டது');
      else speakText('Paid now selected');
    } else {
      if (language === 'ml') speakText('പിന്നെ നൽകാം എന്ന് തിരഞ്ഞെടുത്തു');
      else if (language === 'ta') speakText('அப்புறம் தரலாம் என்று தேர்வு செய்யப்பட்டது');
      else speakText('Pay later selected');
    }
  };

  // Submit Milk Purchase Entry
  const handleSubmitEntry = async () => {
    if (isSubmitting) return;

    setIsSubmitting(true);
    setSubmitError(null);

    const idempotencyKey = `milk_${user?.id}_${Date.now()}`;

    try {
      const res = await apiRequest<{ entry: MilkEntry }>('/api/milk/entries', {
        method: 'POST',
        body: JSON.stringify({
          date: todayDateStr,
          quantityMl: selectedQuantityMl,
          paymentChoice,
          idempotencyKey,
          notes: selectedQuantityMl === 500 ? '½ Litre' : selectedQuantityMl === 1000 ? '1 Litre' : `${selectedQuantityMl} ml`,
        }),
      });

      setLastSavedEntry(res.entry);
      setStep('success');

      if (language === 'ml') {
        speakText('പാൽ കണക്ക് വിജയകരമായി രേഖപ്പെടുത്തി. നന്ദി!');
      } else if (language === 'ta') {
        speakText('பால் கணக்கு வெற்றிகரமாக பதிவு செய்யப்பட்டது. நன்றி!');
      } else {
        speakText('Milk purchase recorded successfully. Thank you!');
      }

      fetchData();
    } catch (err: any) {
      setSubmitError(err.message || 'Failed to save entry');
      if (language === 'ml') {
        speakText('സേവ് ചെയ്യാൻ കഴിഞ്ഞില്ല. വീണ്ടും ശ്രമിക്കുക.');
      } else if (language === 'ta') {
        speakText('பதிவு செய்ய முடியவில்லை. மீண்டும் முயற்சிக்கவும்.');
      } else {
        speakText('Could not save. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Read Balance Aloud
  const handleReadBalance = () => {
    const rupees = Math.abs(closingBalancePaise / 100);
    if (closingBalancePaise > 0) {
      if (language === 'ml') {
        speakText(`കുടുംബത്തിന്റെ ബാക്കി കുടിശ്ശിക ${rupees} രൂപയാണ്`, true);
      } else if (language === 'ta') {
        speakText(`குடும்பத்தின் மீதி பாக்கி ${rupees} ரூபாய்`, true);
      } else {
        speakText(`Family outstanding due is ${rupees} rupees`, true);
      }
    } else {
      if (language === 'ml') {
        speakText('എല്ലാ കണക്കുകളും തീർത്തു. ബാക്കി തുകയില്ല.', true);
      } else if (language === 'ta') {
        speakText('எல்லா கணக்குகளும் முடிந்தது. மீதி தொகை இல்லை.', true);
      } else {
        speakText('All accounts settled. No pending balance.', true);
      }
    }
  };

  // Today's friendly display date
  const friendlyTodayDate = useMemo(() => {
    const dateObj = new Date();
    if (language === 'ml') {
      const day = dateObj.getDate();
      const months = ['ജനുവരി', 'ഫെബ്രുവരി', 'മാർച്ച്', 'ഏപ്രിൽ', 'മേയ്', 'ജൂൺ', 'ജൂലൈ', 'ഓഗസ്റ്റ്', 'സെപ്റ്റംബർ', 'ഒക്ടോബർ', 'നവംബർ', 'ഡിസംബർ'];
      return `ഇന്ന്, ${day} ${months[dateObj.getMonth()]}`;
    }
    if (language === 'ta') {
      const day = dateObj.getDate();
      const months = ['ஜனவரி', 'பிப்ரவரி', 'மார்ச்', 'ஏப்ரல்', 'மே', 'ஜூன்', 'ஜூலை', 'ஆகஸ்ட்', 'செப்டம்பர்', 'அக்டோபர்', 'நவம்பர்', 'டிசம்பர்'];
      return `இன்று, ${day} ${months[dateObj.getMonth()]}`;
    }
    return `Today, ${dateObj.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}`;
  }, [language]);

  const handleLanguageCycle = () => {
    const order = ['ml', 'ta', 'en'] as const;
    const nextIdx = (order.indexOf(language as any) + 1) % order.length;
    const next = order[nextIdx];
    toggleLanguage();
    updateUserLanguage(next);
  };

  return (
    <div style={{ maxWidth: '480px', margin: '0 auto', padding: '0.85rem', minHeight: '100vh', background: '#f8fafc' }}>
      {/* COMPACT & ACCESSIBLE TOP HEADER */}
      <header
        style={{
          background: 'white',
          borderRadius: 'var(--radius-xl, 24px)',
          padding: '0.9rem 1.15rem',
          marginBottom: '1rem',
          boxShadow: 'var(--shadow-sm)',
          border: '1.5px solid var(--slate-200)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div>
          <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>
            {user?.familyName || t('appName')}
          </div>
          <h1 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#1e3a8a', lineHeight: 1.2 }}>
            {language === 'ml' ? `നമസ്കാരം, ${user?.name || ''}` : language === 'ta' ? `வணக்கம், ${user?.name || ''}` : `Hello, ${user?.name || ''}`}
          </h1>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          {/* Voice Guidance Toggle */}
          <button
            type="button"
            onClick={toggleVoice}
            className="btn-secondary"
            style={{
              padding: '0.45rem 0.65rem',
              borderRadius: '12px',
              border: voiceEnabled ? '1.5px solid #2563eb' : '1.5px solid #cbd5e1',
              background: voiceEnabled ? '#eff6ff' : 'white',
              color: voiceEnabled ? '#1d4ed8' : '#64748b',
              display: 'flex',
              alignItems: 'center',
              gap: '0.25rem',
              cursor: 'pointer',
            }}
            title={voiceEnabled ? t('voiceOn') : t('voiceOff')}
          >
            {voiceEnabled ? <Volume2 size={18} color="#2563eb" /> : <VolumeX size={18} color="#94a3b8" />}
            <span style={{ fontSize: '0.75rem', fontWeight: 700 }}>
              {voiceEnabled ? t('voiceOn') : t('voiceOff')}
            </span>
          </button>

          {/* Language Switcher */}
          <button
            type="button"
            onClick={handleLanguageCycle}
            className="btn-secondary"
            style={{
              padding: '0.45rem 0.65rem',
              borderRadius: '12px',
              border: '1.5px solid #cbd5e1',
              background: 'white',
              display: 'flex',
              alignItems: 'center',
              gap: '0.25rem',
              cursor: 'pointer',
            }}
            title={t('language')}
          >
            <Globe size={16} color="#2563eb" />
            <span style={{ fontSize: '0.78rem', fontWeight: 700 }}>
              {language === 'ml' ? 'മലയാളം' : language === 'ta' ? 'தமிழ்' : 'Eng'}
            </span>
          </button>

          {/* Simple Logout */}
          <button
            type="button"
            onClick={() => {
              if (window.confirm(t('logoutConfirm'))) logout();
            }}
            style={{
              background: 'none',
              border: 'none',
              color: '#64748b',
              padding: '0.45rem',
              cursor: 'pointer',
              borderRadius: '10px',
            }}
            title={t('logout')}
          >
            <LogOut size={18} />
          </button>
        </div>
      </header>

      {/* ADMIN SWITCHER (Only visible for Owner/Admin to switch to full dashboard) */}
      {isPrivileged && onSwitchToAdmin && (
        <div style={{ marginBottom: '0.85rem', textAlign: 'right' }}>
          <button
            type="button"
            onClick={onSwitchToAdmin}
            style={{
              background: '#f1f5f9',
              border: '1px solid #cbd5e1',
              padding: '0.35rem 0.75rem',
              borderRadius: '10px',
              fontSize: '0.78rem',
              fontWeight: 700,
              color: '#1e40af',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              cursor: 'pointer',
            }}
          >
            <SlidersHorizontal size={14} />
            <span>{t('adminView')}</span>
          </button>
        </div>
      )}

      {/* ========================================================
          STEP 1: SELECT QUANTITY (PRIMARY FAMILY MEMBER EXPERIENCE)
          ======================================================== */}
      {step === 'select_quantity' && (
        <>
          {/* MAIN RECORD CARD */}
          <div
            style={{
              background: 'white',
              borderRadius: 'var(--radius-xl, 28px)',
              padding: '1.5rem 1.25rem',
              boxShadow: 'var(--shadow-card)',
              border: '2px solid #3b82f6',
              marginBottom: '1.25rem',
              textAlign: 'center',
              position: 'relative',
            }}
          >
            {/* Speaker Button to Hear Instructions */}
            <button
              type="button"
              onClick={speakInstruction}
              style={{
                position: 'absolute',
                top: '1rem',
                right: '1rem',
                background: '#eff6ff',
                border: '1.5px solid #bfdbfe',
                borderRadius: '50%',
                width: '42px',
                height: '42px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#2563eb',
                cursor: 'pointer',
                boxShadow: '0 2px 6px rgba(37,99,235,0.15)',
              }}
              title={t('listenInstructions')}
            >
              <Volume2 size={22} />
            </button>

            {/* AAVIN BLUE MILK PACKET IMAGE */}
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.85rem' }}>
              <div
                style={{
                  width: '150px',
                  height: '150px',
                  borderRadius: '20px',
                  background: '#f0f7ff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '8px',
                  boxShadow: '0 8px 20px rgba(37, 99, 235, 0.12)',
                  border: '1.5px solid #dbeafe',
                }}
              >
                <img
                  src="/images/aavin-blue-milk.png"
                  alt="Aavin Toned Milk Blue Pouch"
                  style={{
                    maxWidth: '100%',
                    maxHeight: '100%',
                    objectFit: 'contain',
                    filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.08))',
                  }}
                  onError={(e) => {
                    // Fallback to stylized milk icon if image is missing
                    e.currentTarget.style.display = 'none';
                  }}
                />
              </div>
            </div>

            {/* Title */}
            <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.35rem' }}>
              {t('recordTodayMilk')}
            </h2>
            <p style={{ fontSize: '0.88rem', color: '#64748b', marginBottom: '1.25rem' }}>
              {friendlyTodayDate}
            </p>

            {/* TWO HUGE PRIMARY QUANTITY BUTTONS */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem', marginBottom: '0.85rem' }}>
              {/* BUTTON 1: 1/2 LITRE (500 ML) */}
              <button
                type="button"
                onClick={() => handleSelectQuantity(500)}
                style={{
                  minHeight: '105px',
                  background: 'linear-gradient(145deg, #ffffff 0%, #eff6ff 100%)',
                  border: '2.5px solid #2563eb',
                  borderRadius: '22px',
                  padding: '0.9rem 0.5rem',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  boxShadow: '0 6px 14px rgba(37, 99, 235, 0.15)',
                  transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                }}
              >
                <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#1e40af', lineHeight: 1.1 }}>
                  {t('halfLitre')}
                </div>
                <div style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 700, marginTop: '2px' }}>
                  {t('halfLitreSub')}
                </div>
                <div
                  style={{
                    marginTop: '6px',
                    background: '#2563eb',
                    color: 'white',
                    padding: '0.2rem 0.65rem',
                    borderRadius: '12px',
                    fontSize: '0.95rem',
                    fontWeight: 800,
                  }}
                >
                  ₹{(Math.round(0.5 * activeRatePaise) / 100).toFixed(0)}
                </div>
              </button>

              {/* BUTTON 2: 1 LITRE (1000 ML) */}
              <button
                type="button"
                onClick={() => handleSelectQuantity(1000)}
                style={{
                  minHeight: '105px',
                  background: 'linear-gradient(145deg, #ffffff 0%, #eff6ff 100%)',
                  border: '2.5px solid #2563eb',
                  borderRadius: '22px',
                  padding: '0.9rem 0.5rem',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  boxShadow: '0 6px 14px rgba(37, 99, 235, 0.15)',
                  transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                }}
              >
                <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#1e40af', lineHeight: 1.1 }}>
                  {t('oneLitre')}
                </div>
                <div style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 700, marginTop: '2px' }}>
                  {t('oneLitreSub')}
                </div>
                <div
                  style={{
                    marginTop: '6px',
                    background: '#2563eb',
                    color: 'white',
                    padding: '0.2rem 0.65rem',
                    borderRadius: '12px',
                    fontSize: '0.95rem',
                    fontWeight: 800,
                  }}
                >
                  ₹{(activeRatePaise / 100).toFixed(0)}
                </div>
              </button>
            </div>

            {/* BUTTON 3: OTHER QUANTITY */}
            <button
              type="button"
              onClick={() => {
                setStep('custom_quantity');
                if (language === 'ml') speakText('മറ്റ് അളവ് എത്രയാണെന്ന് തിരഞ്ഞെടുക്കുക');
                else if (language === 'ta') speakText('வேறு அளவைத் தேர்ந்தெடுக்கவும்');
                else speakText('Choose other quantity');
              }}
              style={{
                width: '100%',
                background: '#f8fafc',
                border: '1.5px dashed #94a3b8',
                borderRadius: '16px',
                padding: '0.65rem',
                fontSize: '0.92rem',
                fontWeight: 700,
                color: '#475569',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.4rem',
                cursor: 'pointer',
              }}
            >
              <Droplets size={17} color="#2563eb" />
              <span>{t('otherQuantity')} ({t('otherQuantitySub')})</span>
            </button>
          </div>

          {/* TODAY'S RECORDED MILK STATUS CARD */}
          <div
            style={{
              background: 'white',
              borderRadius: 'var(--radius-lg, 20px)',
              padding: '1.1rem 1.25rem',
              boxShadow: 'var(--shadow-sm)',
              border: '1px solid var(--slate-200)',
              marginBottom: '1rem',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#0f172a', fontWeight: 800, fontSize: '0.95rem' }}>
                <Calendar size={18} color="#2563eb" />
                <span>{t('todayRecorded')}</span>
              </div>
              <span style={{ fontSize: '0.78rem', color: '#64748b' }}>{friendlyTodayDate}</span>
            </div>

            {todayEntries.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {todayEntries.map((entry) => (
                  <div
                    key={entry.id}
                    style={{
                      background: '#f0fdf4',
                      border: '1.5px solid #86efac',
                      borderRadius: '14px',
                      padding: '0.75rem 1rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 800, color: '#166534', fontSize: '1.05rem' }}>
                        {entry.quantityMl >= 1000 ? `${(entry.quantityMl / 1000).toFixed(1).replace('.0', '')} L` : `${entry.quantityMl} ml`}
                        <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#15803d', marginLeft: '0.4rem' }}>
                          ({formatPaise(entry.totalAmountPaise)})
                        </span>
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#166534' }}>
                        {entry.paymentStatus === 'paid' ? t('paid') : t('pending')} • {entry.createdByName || user?.name}
                      </div>
                    </div>

                    <div
                      style={{
                        background: entry.paymentStatus === 'paid' ? '#dcfce7' : '#fef3c7',
                        color: entry.paymentStatus === 'paid' ? '#15803d' : '#b45309',
                        padding: '0.3rem 0.65rem',
                        borderRadius: '10px',
                        fontSize: '0.8rem',
                        fontWeight: 800,
                      }}
                    >
                      {entry.paymentStatus === 'paid' ? '✓ ' + t('paid') : '⏱ ' + t('pending')}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ background: '#f8fafc', padding: '0.85rem', borderRadius: '12px', textAlign: 'center', color: '#64748b', fontSize: '0.88rem' }}>
                {t('noMilkRecordedYet')}
              </div>
            )}
          </div>

          {/* FAMILY BALANCE OVERVIEW CARD */}
          <div
            style={{
              background: 'white',
              borderRadius: 'var(--radius-lg, 20px)',
              padding: '1.1rem 1.25rem',
              boxShadow: 'var(--shadow-sm)',
              border: '1px solid var(--slate-200)',
              marginBottom: '1.5rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '12px',
                  background: closingBalancePaise > 0 ? '#fffbeb' : '#ecfdf5',
                  color: closingBalancePaise > 0 ? '#d97706' : '#059669',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Wallet size={22} />
              </div>
              <div>
                <div style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>
                  {closingBalancePaise > 0 ? t('due') : t('settled')}
                </div>
                <div style={{ fontSize: '1.2rem', fontWeight: 900, color: closingBalancePaise > 0 ? '#b45309' : '#047857' }}>
                  {formatPaise(Math.abs(closingBalancePaise))}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleReadBalance}
              style={{
                background: '#eff6ff',
                border: '1px solid #bfdbfe',
                borderRadius: '12px',
                padding: '0.5rem 0.75rem',
                color: '#2563eb',
                fontSize: '0.8rem',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: '0.3rem',
                cursor: 'pointer',
              }}
              title={t('listenInstructions')}
            >
              <Volume2 size={16} />
              <span>{t('listenInstructions')}</span>
            </button>
          </div>

          {/* APPA'S MONTHLY BILL EXPORT BANNER */}
          <div
            style={{
              background: 'linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%)',
              borderRadius: 'var(--radius-lg, 20px)',
              padding: '0.9rem 1.1rem',
              boxShadow: 'var(--shadow-sm)',
              border: '1.5px solid #a7f3d0',
              marginBottom: '1.5rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <div
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '10px',
                  background: '#059669',
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <FileSpreadsheet size={20} />
              </div>
              <div>
                <div style={{ fontSize: '0.88rem', fontWeight: 800, color: '#065f46' }}>
                  {language === 'ta'
                    ? 'அப்பாவுக்கு மாத பில் (Excel)'
                    : language === 'ml'
                    ? 'അച്ഛന് മാസ ബിൽ (Excel)'
                    : "Appa's Monthly Bill (Excel)"}
                </div>
                <div style={{ fontSize: '0.74rem', color: '#047857' }}>
                  {language === 'ta'
                    ? 'வாட்ஸ்அப்பில் அனுப்ப & எக்செல் டவுன்லோட்'
                    : language === 'ml'
                    ? 'വാട്സാപ്പിൽ അയക്കാനും എക്സൽ എടുക്കാനും'
                    : 'Download .xlsx & share on WhatsApp'}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsExportModalOpen(true)}
              style={{
                background: '#059669',
                border: 'none',
                borderRadius: '12px',
                padding: '0.55rem 0.85rem',
                color: 'white',
                fontSize: '0.82rem',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                cursor: 'pointer',
                boxShadow: '0 2px 6px rgba(5,150,105,0.25)',
              }}
            >
              <span>{t('exportBill')}</span>
            </button>
          </div>
        </>
      )}

      {/* ========================================================
          CUSTOM QUANTITY KEYPAD (FOR OTHER QUANTITIES)
          ======================================================== */}
      {step === 'custom_quantity' && (
        <div
          style={{
            background: 'white',
            borderRadius: 'var(--radius-xl, 28px)',
            padding: '1.5rem 1.25rem',
            boxShadow: 'var(--shadow-card)',
            border: '2px solid #2563eb',
            marginBottom: '1.25rem',
            textAlign: 'center',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <button
              type="button"
              onClick={() => setStep('select_quantity')}
              className="btn-secondary"
              style={{ padding: '0.4rem 0.65rem', borderRadius: '10px' }}
            >
              <ArrowLeft size={16} />
              <span>{t('cancel')}</span>
            </button>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#1e3a8a' }}>
              {t('otherQuantity')}
            </h3>
            <div style={{ width: '40px' }} />
          </div>

          {/* Big Quantity Display */}
          <div
            style={{
              background: '#eff6ff',
              borderRadius: '20px',
              padding: '1rem',
              marginBottom: '1rem',
              border: '1.5px solid #bfdbfe',
            }}
          >
            <div style={{ fontSize: '2.5rem', fontWeight: 900, color: '#1e40af' }}>
              {customMl >= 1000 ? `${(customMl / 1000).toFixed(2).replace('.00', '')} L` : `${customMl} ml`}
            </div>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#059669', marginTop: '0.2rem' }}>
              ₹{((Math.round((customMl / 1000) * activeRatePaise)) / 100).toFixed(0)}
            </div>
          </div>

          {/* Stepper Buttons (-250ml / +250ml) */}
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', marginBottom: '1rem' }}>
            <button
              type="button"
              onClick={() => setCustomMl((prev) => Math.max(100, prev - 250))}
              style={{
                flex: 1,
                minHeight: '56px',
                background: '#f1f5f9',
                border: '1.5px solid #cbd5e1',
                borderRadius: '16px',
                fontSize: '1.2rem',
                fontWeight: 800,
                color: '#334155',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.4rem',
              }}
            >
              <Minus size={22} />
              <span>- 250 ml</span>
            </button>

            <button
              type="button"
              onClick={() => setCustomMl((prev) => prev + 250)}
              style={{
                flex: 1,
                minHeight: '56px',
                background: '#f1f5f9',
                border: '1.5px solid #cbd5e1',
                borderRadius: '16px',
                fontSize: '1.2rem',
                fontWeight: 800,
                color: '#334155',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.4rem',
              }}
            >
              <Plus size={22} />
              <span>+ 250 ml</span>
            </button>
          </div>

          {/* Quick Preset Chips (250ml, 750ml, 1.5L, 2L) */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem', marginBottom: '1.25rem' }}>
            {[250, 750, 1500, 2000].map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setCustomMl(preset)}
                style={{
                  padding: '0.6rem 0.2rem',
                  borderRadius: '12px',
                  background: customMl === preset ? '#2563eb' : '#f8fafc',
                  color: customMl === preset ? 'white' : '#1e293b',
                  border: customMl === preset ? '1.5px solid #1d4ed8' : '1px solid #cbd5e1',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                }}
              >
                {preset >= 1000 ? `${preset / 1000} L` : `${preset} ml`}
              </button>
            ))}
          </div>

          {/* Proceed to Payment Button */}
          <button
            type="button"
            className="btn-primary-big"
            style={{ minHeight: '56px', width: '100%', fontSize: '1.15rem' }}
            onClick={() => handleSelectQuantity(customMl)}
          >
            {t('confirmAndSave')} (₹{((Math.round((customMl / 1000) * activeRatePaise)) / 100).toFixed(0)})
          </button>
        </div>
      )}

      {/* ========================================================
          STEP 2: PAYMENT CHOICE (ONLY 2 ULTRA-CLEAR CHOICES)
          ======================================================== */}
      {step === 'choose_payment' && (
        <div
          style={{
            background: 'white',
            borderRadius: 'var(--radius-xl, 28px)',
            padding: '1.5rem 1.25rem',
            boxShadow: 'var(--shadow-card)',
            border: '2.5px solid #2563eb',
            marginBottom: '1.25rem',
          }}
        >
          {/* Header & Back Button */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <button
              type="button"
              onClick={() => setStep('select_quantity')}
              className="btn-secondary"
              style={{ padding: '0.4rem 0.65rem', borderRadius: '10px' }}
            >
              <ArrowLeft size={16} />
              <span>{t('cancel')}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                const qty = selectedQuantityMl === 500 ? (language === 'ml' ? 'അര ലിറ്റർ' : 'Half litre') : (language === 'ml' ? 'ഒരു ലിറ്റർ' : 'One litre');
                if (language === 'ml') speakText(`${qty} പാൽ. തുക ${calculatedRupees} രൂപ. പണം നൽകിയോ അതോ പിന്നെ നൽകുമോ?`, true);
                else if (language === 'ta') speakText(`${qty} பால். தொகை ${calculatedRupees} ரூபாய். பணம் கொடுத்தாச்சா?`, true);
                else speakText(`${qty} milk. Amount ${calculatedRupees} rupees. Paid now or pay later?`, true);
              }}
              style={{
                background: '#eff6ff',
                border: '1px solid #bfdbfe',
                borderRadius: '50%',
                width: '38px',
                height: '38px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#2563eb',
                cursor: 'pointer',
              }}
              title={t('listenInstructions')}
            >
              <Volume2 size={20} />
            </button>
          </div>

          {/* Selected Summary Card */}
          <div
            style={{
              background: '#eff6ff',
              borderRadius: '20px',
              padding: '1.2rem',
              textAlign: 'center',
              marginBottom: '1.25rem',
              border: '1.5px solid #bfdbfe',
            }}
          >
            <div style={{ fontSize: '0.88rem', color: '#64748b', fontWeight: 600 }}>
              {friendlyTodayDate}
            </div>
            <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#1e40af', marginTop: '0.2rem' }}>
              {selectedQuantityMl === 500 ? t('halfLitre') : selectedQuantityMl === 1000 ? t('oneLitre') : `${selectedQuantityMl} ml`}
            </div>
            <div style={{ fontSize: '2.4rem', fontWeight: 900, color: '#059669', marginTop: '0.25rem' }}>
              ₹{calculatedRupees}
            </div>
          </div>

          {/* Prompt */}
          <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', textAlign: 'center', marginBottom: '1rem' }}>
            {language === 'ml' ? 'പണം നൽകിയോ അതോ പിന്നെ നൽകുമോ?' : language === 'ta' ? 'பணம் கொடுத்தாச்சா அல்லது அப்புறம் தரலாமா?' : 'Did you pay now or pay later?'}
          </h3>

          {submitError && (
            <div style={{ background: '#fee2e2', color: '#991b1b', padding: '0.65rem 0.85rem', borderRadius: '12px', fontSize: '0.85rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <AlertCircle size={17} style={{ flexShrink: 0 }} />
              <span>{submitError}</span>
            </div>
          )}

          {/* TWO LARGE PAYMENT CHOICE BUTTONS */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem', marginBottom: '1.25rem' }}>
            {/* CHOICE A: PAID NOW */}
            <button
              type="button"
              onClick={() => handleChoosePayment('paid')}
              style={{
                minHeight: '110px',
                borderRadius: '22px',
                padding: '1rem 0.6rem',
                border: paymentChoice === 'paid' ? '3px solid #16a34a' : '2px solid #e2e8f0',
                background: paymentChoice === 'paid' ? '#f0fdf4' : 'white',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                boxShadow: paymentChoice === 'paid' ? '0 6px 16px rgba(22, 163, 74, 0.2)' : 'var(--shadow-sm)',
                transition: 'all 0.15s ease',
              }}
            >
              <div
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '50%',
                  background: paymentChoice === 'paid' ? '#16a34a' : '#f1f5f9',
                  color: paymentChoice === 'paid' ? 'white' : '#64748b',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '0.4rem',
                }}
              >
                <CheckCircle2 size={26} />
              </div>
              <div style={{ fontSize: '1.15rem', fontWeight: 900, color: paymentChoice === 'paid' ? '#166534' : '#0f172a' }}>
                {t('paidNow')}
              </div>
              <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600, textAlign: 'center', marginTop: '2px' }}>
                {t('paidNowDesc')}
              </div>
            </button>

            {/* CHOICE B: PAY LATER */}
            <button
              type="button"
              onClick={() => handleChoosePayment('pending')}
              style={{
                minHeight: '110px',
                borderRadius: '22px',
                padding: '1rem 0.6rem',
                border: paymentChoice === 'pending' ? '3px solid #d97706' : '2px solid #e2e8f0',
                background: paymentChoice === 'pending' ? '#fffbeb' : 'white',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                boxShadow: paymentChoice === 'pending' ? '0 6px 16px rgba(217, 119, 6, 0.2)' : 'var(--shadow-sm)',
                transition: 'all 0.15s ease',
              }}
            >
              <div
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '50%',
                  background: paymentChoice === 'pending' ? '#d97706' : '#f1f5f9',
                  color: paymentChoice === 'pending' ? 'white' : '#64748b',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '0.4rem',
                }}
              >
                <Clock size={26} />
              </div>
              <div style={{ fontSize: '1.15rem', fontWeight: 900, color: paymentChoice === 'pending' ? '#b45309' : '#0f172a' }}>
                {t('payLater')}
              </div>
              <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600, textAlign: 'center', marginTop: '2px' }}>
                {t('payLaterDesc')}
              </div>
            </button>
          </div>

          {/* CONFIRM & SAVE CTA */}
          <button
            type="button"
            className="btn-primary-big"
            disabled={isSubmitting}
            onClick={handleSubmitEntry}
            style={{
              minHeight: '58px',
              width: '100%',
              fontSize: '1.25rem',
              fontWeight: 800,
              background: '#2563eb',
              boxShadow: '0 8px 20px rgba(37, 99, 235, 0.3)',
            }}
          >
            {isSubmitting ? t('saving') : `${t('confirmAndSave')} (₹${calculatedRupees})`}
          </button>
        </div>
      )}

      {/* ========================================================
          STEP 3: SAVE CONFIRMATION CELEBRATION SCREEN
          ======================================================== */}
      {step === 'success' && lastSavedEntry && (
        <div
          style={{
            background: 'white',
            borderRadius: 'var(--radius-xl, 28px)',
            padding: '2rem 1.5rem',
            boxShadow: 'var(--shadow-card)',
            border: '2.5px solid #16a34a',
            textAlign: 'center',
            marginBottom: '1.5rem',
          }}
        >
          {/* Animated Success Icon */}
          <div
            style={{
              width: '74px',
              height: '74px',
              borderRadius: '50%',
              background: '#dcfce7',
              color: '#16a34a',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1.25rem',
              boxShadow: '0 8px 20px rgba(22, 163, 74, 0.25)',
            }}
          >
            <CheckCircle2 size={44} />
          </div>

          <h2 style={{ fontSize: '1.5rem', fontWeight: 900, color: '#166534', marginBottom: '0.5rem' }}>
            {t('successRecorded')}
          </h2>

          <div
            style={{
              background: '#f0fdf4',
              borderRadius: '18px',
              padding: '1.1rem',
              border: '1.5px dashed #86efac',
              margin: '1rem 0 1.5rem',
            }}
          >
            <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#0f172a' }}>
              {lastSavedEntry.quantityMl >= 1000 ? `${(lastSavedEntry.quantityMl / 1000).toFixed(1).replace('.0', '')} Litre` : `${lastSavedEntry.quantityMl} ml`}
            </div>
            <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#15803d', marginTop: '0.2rem' }}>
              {formatPaise(lastSavedEntry.totalAmountPaise)}
            </div>
            <div
              style={{
                marginTop: '0.5rem',
                display: 'inline-block',
                background: lastSavedEntry.paymentStatus === 'paid' ? '#dcfce7' : '#fef3c7',
                color: lastSavedEntry.paymentStatus === 'paid' ? '#166534' : '#b45309',
                padding: '0.3rem 0.85rem',
                borderRadius: '12px',
                fontSize: '0.85rem',
                fontWeight: 800,
              }}
            >
              {lastSavedEntry.paymentStatus === 'paid' ? '✓ ' + t('paid') : '⏱ ' + t('pending')}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            <button
              type="button"
              className="btn-primary-big"
              style={{ minHeight: '52px', fontSize: '1.1rem' }}
              onClick={() => {
                setStep('select_quantity');
              }}
            >
              {t('goHome')}
            </button>

            <button
              type="button"
              className="btn-secondary"
              style={{ minHeight: '46px', fontSize: '0.95rem' }}
              onClick={() => {
                setStep('select_quantity');
              }}
            >
              <RotateCcw size={16} />
              <span>{t('recordAnother')}</span>
            </button>
          </div>
        </div>
      )}

      {/* RECENT ACTIVITY LIST (Only shown on home step) */}
      {step === 'select_quantity' && recentEntries.length > 0 && (
        <div
          style={{
            background: 'white',
            borderRadius: 'var(--radius-lg, 20px)',
            padding: '1.1rem 1.25rem',
            boxShadow: 'var(--shadow-sm)',
            border: '1px solid var(--slate-200)',
          }}
        >
          <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Clock size={16} color="#2563eb" />
            <span>{t('recentMilkHistory')}</span>
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {recentEntries.map((entry) => (
              <div
                key={entry.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.65rem 0',
                  borderBottom: '1px solid #f1f5f9',
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.92rem' }}>
                    {entry.quantityMl >= 1000 ? `${(entry.quantityMl / 1000).toFixed(1).replace('.0', '')} L` : `${entry.quantityMl} ml`} • {formatPaise(entry.totalAmountPaise)}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                    {entry.date} {entry.createdByName ? `• ${entry.createdByName}` : ''}
                  </div>
                </div>

                <span
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    padding: '0.2rem 0.55rem',
                    borderRadius: '8px',
                    background: entry.paymentStatus === 'paid' ? '#ecfdf5' : '#fffbeb',
                    color: entry.paymentStatus === 'paid' ? '#059669' : '#d97706',
                  }}
                >
                  {entry.paymentStatus === 'paid' ? t('paid') : t('pending')}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Export Monthly Bill Modal */}
      <ExportBillModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        yearMonth={todayDateStr.substring(0, 7)}
      />
    </div>
  );
};
