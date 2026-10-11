import React, { useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { apiRequest } from '../api/client';
import { MilkEntry } from '@family-milk/shared';
import { X, Edit3, AlertCircle } from 'lucide-react';

interface CorrectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  entry: MilkEntry | null;
}

export const CorrectionModal: React.FC<CorrectionModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  entry,
}) => {
  const { t } = useLanguage();

  const [date, setDate] = useState<string>(entry?.date || '');
  const [quantityMl, setQuantityMl] = useState<number>(entry?.quantityMl || 500);
  const [notes, setNotes] = useState<string>(entry?.notes || '');
  const [correctionNotes, setCorrectionNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Sync state if entry changes
  React.useEffect(() => {
    if (entry) {
      setDate(entry.date);
      setQuantityMl(entry.quantityMl);
      setNotes(entry.notes || '');
      setCorrectionNotes('');
    }
  }, [entry]);

  if (!isOpen || !entry) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!correctionNotes.trim()) {
      setError(t('requiredField') + ': ' + t('correctionReason'));
      return;
    }

    setIsSubmitting(true);
    try {
      await apiRequest(`/api/milk/entries/${entry.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          date,
          quantityMl,
          notes: notes.trim() || undefined,
          correctionNotes: correctionNotes.trim(),
        }),
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || t('errorSaving'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Edit3 size={24} color="#d97706" />
            <h2 className="modal-title">{t('editCorrection')}</h2>
          </div>
          <button className="modal-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {error && (
          <div style={{ background: '#fee2e2', color: '#b91c1c', padding: '0.75rem', borderRadius: '10px', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem' }}>
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">{t('date')}</label>
            <input
              type="date"
              className="form-input"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">{t('quantityInMl')}</label>
            <input
              type="number"
              step="50"
              min="50"
              max="50000"
              className="form-input"
              value={quantityMl}
              onChange={(e) => setQuantityMl(parseInt(e.target.value, 10) || 0)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">{t('correctionReason')} *</label>
            <input
              type="text"
              className="form-input"
              placeholder={t('correctionReasonPlaceholder')}
              value={correctionNotes}
              onChange={(e) => setCorrectionNotes(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">{t('notes')}</label>
            <input
              type="text"
              className="form-input"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <button
            type="submit"
            className="btn-primary-big"
            style={{ background: 'linear-gradient(135deg, #d97706 0%, #f59e0b 100%)' }}
            disabled={isSubmitting}
          >
            {isSubmitting ? t('saving') : t('saveCorrection')}
          </button>
        </form>
      </div>
    </div>
  );
};
