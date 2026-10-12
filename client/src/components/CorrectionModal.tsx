import React, { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../api/client';
import { PaymentStatus } from '@family-milk/shared';
import { X, Edit3, Trash2, Calendar, Droplets, IndianRupee, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import { notifyDataChanged } from '../hooks/useAutoSync';
import { useToast } from '../context/ToastContext';

export interface EditableMilkRecord {
  id: string;
  date: string;
  quantityMl?: number;
  totalAmountPaise?: number;
  amountPaise?: number;
  ratePaisePerLitre?: number;
  paymentStatus?: PaymentStatus | string;
  status?: string;
  notes?: string | null;
  createdByName?: string;
  memberName?: string;
  createdAt?: string;
}

interface CorrectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  entry: EditableMilkRecord | null;
}

const QUICK_PRESETS = [
  { ml: 0, label: '🚫 0 L', sub: 'No Milk' },
  { ml: 250, label: '¼ L', sub: '250 ml' },
  { ml: 500, label: '½ L', sub: '500 ml' },
  { ml: 1000, label: '1 L', sub: '1000 ml' },
  { ml: 1500, label: '1½ L', sub: '1500 ml' },
  { ml: 2000, label: '2 L', sub: '2000 ml' },
];

export const CorrectionModal: React.FC<CorrectionModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  entry,
}) => {
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const { toast, confirm } = useToast();
  const isAdmin = user?.role === 'admin' || user?.role === 'owner';

  // Normalize initial values
  const initialQty = entry?.quantityMl ?? 500;
  const initialPaise = entry?.totalAmountPaise ?? entry?.amountPaise ?? 2400;
  const initialRupees = (initialPaise / 100).toString();
  const initialDate = entry?.date ? (entry.date.includes('T') ? entry.date.split('T')[0] : entry.date) : '';
  const initialStatus: PaymentStatus = (entry?.paymentStatus === 'paid' || entry?.status === 'paid') ? 'paid' : 'pending';

  const [date, setDate] = useState<string>(initialDate);
  const [quantityMl, setQuantityMl] = useState<number>(initialQty);
  const [amountRupees, setAmountRupees] = useState<string>(initialRupees);
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>(initialStatus);
  const [notes, setNotes] = useState<string>(entry?.notes || '');
  const [correctionNotes, setCorrectionNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Rate in paise (default to entry's rate or derive from initial)
  const [ratePaise, setRatePaise] = useState<number>(() => {
    if (entry?.ratePaisePerLitre) return entry.ratePaisePerLitre;
    if (initialQty > 0 && initialPaise > 0) {
      return Math.round((initialPaise / initialQty) * 1000);
    }
    return 4800; // default ₹48/L
  });

  // Sync state whenever entry changes
  useEffect(() => {
    if (entry) {
      const q = entry.quantityMl ?? 500;
      const p = entry.totalAmountPaise ?? entry.amountPaise ?? 2400;
      const d = entry.date ? (entry.date.includes('T') ? entry.date.split('T')[0] : entry.date) : '';
      const s: PaymentStatus = (entry.paymentStatus === 'paid' || entry.status === 'paid') ? 'paid' : 'pending';

      setDate(d);
      setQuantityMl(q);
      setAmountRupees((p / 100).toString());
      setPaymentStatus(s);
      setNotes(entry.notes || '');
      setCorrectionNotes('');
      setError(null);

      if (entry.ratePaisePerLitre) {
        setRatePaise(entry.ratePaisePerLitre);
      } else if (q > 0 && p > 0) {
        setRatePaise(Math.round((p / q) * 1000));
      }
    }
  }, [entry]);

  if (!isOpen || !entry) return null;

  // Handle Preset Click - auto-recomputes amount based on rate
  const handleSelectPreset = (ml: number) => {
    setQuantityMl(ml);
    const newPaise = Math.round((ml / 1000) * ratePaise);
    setAmountRupees((newPaise / 100).toFixed(0));
  };

  // Handle Quantity Change manually
  const handleQuantityChange = (val: number) => {
    setQuantityMl(val);
    if (val >= 0) {
      const newPaise = Math.round((val / 1000) * ratePaise);
      setAmountRupees((newPaise / 100).toFixed(0));
    }
  };

  // Recalculate amount from quantity & rate
  const handleRecalculateAmount = () => {
    const newPaise = Math.round((quantityMl / 1000) * ratePaise);
    setAmountRupees((newPaise / 100).toFixed(0));
  };

  // Set date to today
  const handleSetToday = () => {
    try {
      const todayStr = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(new Date());
      setDate(todayStr);
    } catch {
      setDate(new Date().toISOString().substring(0, 10));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!date) {
      setError(language === 'ta' ? 'தேதியை உள்ளிடவும்' : language === 'ml' ? 'ദിവസം നൽകുക' : 'Please select a date');
      return;
    }

    const numAmount = parseFloat(amountRupees);
    if (isNaN(numAmount) || numAmount < 0) {
      setError(language === 'ta' ? 'சரியான தொகையை உள்ளிடவும்' : language === 'ml' ? 'ശരിയായ തുക നൽകുക' : 'Please enter a valid amount');
      return;
    }

    setIsSubmitting(true);
    try {
      const totalAmountPaise = Math.round(numAmount * 100);

      await apiRequest(`/api/milk/entries/${entry.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          date,
          quantityMl,
          totalAmountPaise,
          paymentStatus,
          notes: notes.trim() || undefined,
          correctionNotes: correctionNotes.trim() || (language === 'ta' ? 'நிர்வாகியால் திருத்தப்பட்டது' : language === 'ml' ? 'അഡ്മിൻ തിരുത്തിയത്' : 'Updated by admin'),
        }),
      });

      toast.milk(
        language === 'ta' ? 'பால் பதிவு மாற்றப்பட்டது' : language === 'ml' ? 'പാൽ വിവരങ്ങൾ മാറ്റി' : 'Milk entry updated'
      );
      onSuccess();
      notifyDataChanged();
      onClose();
    } catch (err: any) {
      setError(err.message || t('errorSaving'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    const ok = await confirm({
      title: t('deleteConfirmTitle'),
      message: t('deleteConfirm'),
      confirmText: t('deleteAction'),
      cancelText: t('cancel'),
      type: 'danger',
    });
    if (!ok) return;

    setIsDeleting(true);
    setError(null);
    try {
      await apiRequest(`/api/milk/entries/${entry.id}`, {
        method: 'DELETE',
      });

      toast.milk(
        language === 'ta' ? 'பால் பதிவு நீக்கப்பட்டது' : language === 'ml' ? 'പാൽ രേഖ നീക്കം ചെയ്തു' : 'Milk record removed'
      );
      onSuccess();
      notifyDataChanged();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to delete record');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px', maxHeight: '90vh', overflowY: 'auto' }}>
        {/* Header */}
        <div className="modal-header" style={{ paddingBottom: '0.75rem', borderBottom: '1px solid #f1f5f9' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#d97706' }}>
              <Edit3 size={20} />
            </div>
            <div>
              <h2 className="modal-title" style={{ fontSize: '1.15rem', margin: 0 }}>
                {language === 'ta' ? 'பால் பதிவை திருத்து' : language === 'ml' ? 'പാൽ വിവരങ്ങൾ തിരുത്തുക' : 'Modify Milk Record'}
              </h2>
              <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                ID: {entry.id.substring(0, 8)}... {entry.memberName || entry.createdByName ? `• 👤 ${entry.memberName || entry.createdByName}` : ''}
              </span>
            </div>
          </div>
          <button className="modal-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {error && (
          <div style={{ background: '#fee2e2', color: '#b91c1c', padding: '0.75rem', borderRadius: '10px', margin: '0.85rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.88rem' }}>
            <AlertCircle size={18} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ marginTop: '0.75rem' }}>
          {/* 1. DATE PICKER */}
          <div className="form-group" style={{ marginBottom: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
              <label className="form-label" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <Calendar size={15} color="#2563eb" />
                <span>{t('date')}</span>
              </label>
              <button
                type="button"
                onClick={handleSetToday}
                style={{
                  background: '#eff6ff',
                  border: '1px solid #bfdbfe',
                  borderRadius: '6px',
                  padding: '0.2rem 0.5rem',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  color: '#2563eb',
                  cursor: 'pointer',
                }}
              >
                {language === 'ta' ? 'இன்று' : language === 'ml' ? 'ഇന്ന്' : 'Set Today'}
              </button>
            </div>
            <input
              type="date"
              className="form-input"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
              style={{ fontSize: '1rem', fontWeight: 600 }}
            />
          </div>

          {/* 2. QUANTITY SELECTION */}
          <div className="form-group" style={{ marginBottom: '1rem' }}>
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.35rem' }}>
              <Droplets size={15} color="#2563eb" />
              <span>{t('quantityInMl')}</span>
            </label>

            {/* Quick Presets */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '0.35rem', marginBottom: '0.5rem' }}>
              {QUICK_PRESETS.map((preset) => {
                const label = preset.ml === 0
                  ? '🚫 0 L'
                  : language === 'ml'
                  ? (preset.ml === 250 ? '¼ ലി' : preset.ml === 500 ? '½ ലി' : preset.ml === 1000 ? '1 ലി' : preset.ml === 1500 ? '1½ ലി' : '2 ലി')
                  : language === 'ta'
                  ? (preset.ml === 250 ? '¼ லி' : preset.ml === 500 ? '½ லி' : preset.ml === 1000 ? '1 லி' : preset.ml === 1500 ? '1½ லி' : '2 லி')
                  : preset.label;
                const sub = preset.ml === 0
                  ? (language === 'ta' ? 'வாங்கவில்லை' : language === 'ml' ? 'വാങ്ങിയില്ല' : 'No Milk')
                  : language === 'ml' ? `${preset.ml} മി.ലി` : language === 'ta' ? `${preset.ml} மி.லி` : preset.sub;

                const isSelected = quantityMl === preset.ml;
                return (
                  <button
                    key={preset.ml}
                    type="button"
                    onClick={() => handleSelectPreset(preset.ml)}
                    style={{
                      padding: '0.45rem 0.2rem',
                      borderRadius: '8px',
                      border: isSelected
                        ? (preset.ml === 0 ? '2px solid #ef4444' : '2px solid #2563eb')
                        : '1px solid #cbd5e1',
                      background: isSelected
                        ? (preset.ml === 0 ? '#fef2f2' : '#eff6ff')
                        : '#f8fafc',
                      color: isSelected
                        ? (preset.ml === 0 ? '#dc2626' : '#1d4ed8')
                        : '#334155',
                      fontWeight: isSelected ? 800 : 600,
                      fontSize: '0.8rem',
                      textAlign: 'center',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div>{label}</div>
                    <div style={{ fontSize: '0.62rem', color: isSelected && preset.ml === 0 ? '#b91c1c' : '#64748b' }}>{sub}</div>
                  </button>
                );
              })}
            </div>

            {/* Numeric ml input */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input
                type="number"
                step="50"
                min="0"
                max="50000"
                className="form-input"
                value={quantityMl}
                onChange={(e) => handleQuantityChange(parseInt(e.target.value, 10) || 0)}
                required
                style={{ fontWeight: 700 }}
              />
              <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600, whiteSpace: 'nowrap' }}>
                = {(quantityMl / 1000).toFixed(2).replace(/\.?0+$/, '')} {language === 'ml' ? 'ലിറ്റർ' : language === 'ta' ? 'லிட்டர்' : 'L'}
              </span>
            </div>
          </div>

          {/* 3. AMOUNT IN RUPEES (DIRECTLY EDITABLE) */}
          <div className="form-group" style={{ marginBottom: '1rem', background: '#f8fafc', padding: '0.75rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
              <label className="form-label" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <IndianRupee size={15} color="#059669" />
                <span>{language === 'ta' ? 'தொகை (₹)' : language === 'ml' ? 'തുക (₹)' : 'Total Amount (₹)'}</span>
              </label>
              <button
                type="button"
                onClick={handleRecalculateAmount}
                title="Recalculate using active rate"
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '0.75rem',
                  color: '#059669',
                  fontWeight: 700,
                  cursor: 'pointer',
                  textDecoration: 'underline',
                }}
              >
                {language === 'ta' ? 'விலைப்படி கணக்கிடு' : language === 'ml' ? 'നിരക്ക് അനുസരിച്ച്' : 'Calc from Rate'} (@ ₹{(ratePaise / 100).toFixed(0)}/L)
              </button>
            </div>

            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <span style={{ position: 'absolute', left: '0.85rem', fontWeight: 800, fontSize: '1.1rem', color: '#059669' }}>
                ₹
              </span>
              <input
                type="number"
                step="0.5"
                min="0"
                className="form-input"
                value={amountRupees}
                onChange={(e) => setAmountRupees(e.target.value)}
                required
                style={{
                  paddingLeft: '2.2rem',
                  fontSize: '1.15rem',
                  fontWeight: 800,
                  color: '#0f172a',
                  borderColor: '#86efac',
                }}
              />
            </div>
            <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '0.25rem' }}>
              {language === 'ta' ? '💡 தொகையை நேரடியாகவும் மாற்றலாம் அல்லது அளவுக்கேற்ப தானாகவும் மாறும்.' : language === 'ml' ? '💡 തുക നേരിട്ടും മാറ്റാം അല്ലെങ്കിൽ അളവിനനുസരിച്ച് സ്വയമേവ മാറും.' : '💡 You can type any custom amount or let it auto-calculate.'}
            </div>
          </div>

          {/* 4. PAYMENT STATUS TOGGLE */}
          <div className="form-group" style={{ marginBottom: '1rem' }}>
            <label className="form-label" style={{ marginBottom: '0.4rem' }}>
              {language === 'ta' ? 'பணம் செலுத்திய நிலை' : language === 'ml' ? 'പണം അടച്ച നില' : 'Payment Status'}
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              <button
                type="button"
                onClick={() => setPaymentStatus('paid')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.4rem',
                  padding: '0.6rem',
                  borderRadius: '10px',
                  border: paymentStatus === 'paid' ? '2px solid #059669' : '1px solid #cbd5e1',
                  background: paymentStatus === 'paid' ? '#ecfdf5' : '#f8fafc',
                  color: paymentStatus === 'paid' ? '#047857' : '#64748b',
                  fontWeight: 700,
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                <CheckCircle size={16} />
                <span>{t('paid')} ({language === 'ta' ? 'செலுத்தியது' : language === 'ml' ? 'അടച്ചു' : 'Cleared'})</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentStatus('pending')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.4rem',
                  padding: '0.6rem',
                  borderRadius: '10px',
                  border: paymentStatus === 'pending' ? '2px solid #d97706' : '1px solid #cbd5e1',
                  background: paymentStatus === 'pending' ? '#fffbeb' : '#f8fafc',
                  color: paymentStatus === 'pending' ? '#b45309' : '#64748b',
                  fontWeight: 700,
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                <Clock size={16} />
                <span>{t('pending')} ({language === 'ta' ? 'நிலுவை' : language === 'ml' ? 'ബാക്കി' : 'Due'})</span>
              </button>
            </div>
          </div>

          {/* 5. NOTES */}
          <div className="form-group" style={{ marginBottom: '1.25rem' }}>
            <label className="form-label">{t('notes')} / {language === 'ta' ? 'காரணம்' : language === 'ml' ? 'കാരണം' : 'Reason (Optional)'}</label>
            <input
              type="text"
              className="form-input"
              placeholder={language === 'ta' ? 'எ.கா: தேதி மாற்றம் அல்லது தொகை திருத்தம்' : language === 'ml' ? 'ഉദാ: തീയതി മാറ്റം അല്ലെങ്കിൽ തുക തിരുത്തൽ' : 'e.g. Changed date or adjusted amount'}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {/* ACTION BUTTONS: SAVE & DELETE */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            <button
              type="submit"
              className="btn-primary-big"
              style={{
                background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                color: 'white',
                minHeight: '46px',
                fontWeight: 800,
              }}
              disabled={isSubmitting || isDeleting}
            >
              {isSubmitting ? t('saving') : (language === 'ta' ? '✓ திருத்தத்தை சேமி' : language === 'ml' ? '✓ തിരുത്തൽ സംരക്ഷിക്കുക' : 'Save Changes')}
            </button>

            {/* ADMIN ONLY DELETE BUTTON */}
            {isAdmin && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={isSubmitting || isDeleting}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.45rem',
                  background: '#fef2f2',
                  border: '1.5px solid #fecaca',
                  borderRadius: '12px',
                  color: '#dc2626',
                  padding: '0.55rem',
                  fontSize: '0.9rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                <Trash2 size={16} />
                <span>{isDeleting ? 'Deleting...' : (language === 'ta' ? 'இந்த பதிவை நீக்கு (Delete Record)' : language === 'ml' ? 'ഈ രേഖ ഒഴിവാക്കുക' : 'Delete This Record')}</span>
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};
