import React, { useState, useCallback, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../api/client';
import { MilkEntry, formatPaise, formatMilkQuantity } from '@family-milk/shared';
import { QuickPurchaseModal } from '../components/QuickPurchaseModal';
import { CorrectionModal } from '../components/CorrectionModal';
import { ExportBillModal } from '../components/ExportBillModal';
import { DateTimeBadge } from '../components/DateTimeBadge';
import { Droplets, Plus, Filter, Edit3, Trash2, Clock, CheckCircle, FileSpreadsheet } from 'lucide-react';
import { useAutoSync, notifyDataChanged } from '../hooks/useAutoSync';

export const PurchasesPage: React.FC = () => {
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.role === 'owner';

  const currentMonthStr = new Date().toISOString().substring(0, 7);
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthStr);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [entries, setEntries] = useState<MilkEntry[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [editingEntry, setEditingEntry] = useState<MilkEntry | null>(null);
  const [isExportModalOpen, setIsExportModalOpen] = useState<boolean>(false);

  const fetchEntries = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    try {
      let url = `/api/milk/entries?month=${selectedMonth}`;
      if (statusFilter !== 'all') {
        url += `&paymentStatus=${statusFilter}`;
      }
      const res = await apiRequest<{ entries: MilkEntry[] }>(url);
      setEntries(res.entries);
    } catch (err) {
      console.error('Failed to fetch milk entries:', err);
    } finally {
      setIsLoading(false);
    }
  }, [selectedMonth, statusFilter]);

  // Fetch immediately on mount & whenever filters change
  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  // Silent background sync
  useAutoSync(fetchEntries, { intervalMs: 8000, immediate: false });

  const handleDelete = async (id: string) => {
    if (!isAdmin) {
      alert(language === 'ta' ? 'அட்மின்களுக்கு மட்டுமே இந்த அனுமதியுள்ளது' : language === 'ml' ? 'അഡ്മിന് മാത്രമേ അനുവാദമുള്ളൂ' : 'Admin privilege required to delete records');
      return;
    }

    if (!window.confirm(t('deleteConfirm'))) return;

    try {
      await apiRequest(`/api/milk/entries/${id}`, { method: 'DELETE' });
      fetchEntries(true);
      notifyDataChanged();
    } catch (err: any) {
      alert(err.message || 'Failed to delete');
    }
  };

  return (
    <div className="main-content">
      {/* Header & Add Button */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
        <div>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--slate-900)' }}>
            {t('purchases')}
          </h2>
          <p style={{ fontSize: '0.85rem', color: '#64748b' }}>
            {entries.length} {language === 'ml' ? 'ഇടപാടുകൾ' : 'purchases'}
          </p>
        </div>

        <button
          className="btn-primary-big"
          style={{ width: 'auto', minHeight: '44px', padding: '0.6rem 1.25rem', fontSize: '0.95rem' }}
          onClick={() => setIsAddModalOpen(true)}
        >
          <Plus size={18} />
          <span>{t('save')}</span>
        </button>
      </div>

      {/* Filters Bar */}
      <div style={{ background: 'white', borderRadius: 'var(--radius-md)', padding: '1rem', marginBottom: '1.25rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center', border: '1px solid var(--slate-200)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#64748b', fontSize: '0.85rem', fontWeight: 700 }}>
          <Filter size={16} />
          <span>Filter:</span>
        </div>

        {/* Month Selector */}
        <input
          type="month"
          className="form-input"
          style={{ width: 'auto', padding: '0.45rem 0.75rem', fontSize: '0.9rem' }}
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
        />

        {/* Status Filter */}
        <select
          className="form-select"
          style={{ width: 'auto', padding: '0.45rem 0.75rem', fontSize: '0.9rem' }}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="all">{t('allStatuses')}</option>
          <option value="paid">{t('onlyPaid')}</option>
          <option value="pending">{t('onlyPending')}</option>
        </select>

        <button
          type="button"
          className="btn-secondary"
          style={{ marginLeft: 'auto', padding: '0.45rem 0.85rem', fontSize: '0.85rem', gap: '0.4rem', borderColor: '#059669', color: '#059669', fontWeight: 700 }}
          onClick={() => setIsExportModalOpen(true)}
        >
          <FileSpreadsheet size={16} color="#059669" />
          <span>{t('exportBill')}</span>
        </button>
      </div>

      {/* Entries List */}
      {isLoading ? (
        <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
          <p>{language === 'ml' ? 'വിവരങ്ങൾ എടുക്കുന്നു...' : 'Loading purchases...'}</p>
        </div>
      ) : entries.length === 0 ? (
        <div style={{ background: 'white', borderRadius: 'var(--radius-lg)', padding: '3rem 1rem', textAlign: 'center', color: '#94a3b8' }}>
          <Droplets size={44} style={{ margin: '0 auto 0.75rem', color: '#cbd5e1' }} />
          <p style={{ fontWeight: 600 }}>{language === 'ml' ? 'ഈ മാസത്തിൽ വാങ്ങലുകൾ രേഖപ്പെടുത്തിയിട്ടില്ല' : 'No purchases found for this filter.'}</p>
        </div>
      ) : (
        <div>
          {entries.map((entry) => (
            <div key={entry.id} className="activity-card" style={{ padding: '1.15rem 1rem' }}>
              <div className="activity-left">
                <div className="activity-icon-badge badge-milk">
                  <Droplets size={24} />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span className="activity-title">
                      {formatMilkQuantity(entry.quantityMl, language)}
                    </span>
                    {entry.isCorrected && (
                      <span style={{ fontSize: '0.7rem', background: '#fef3c7', color: '#b45309', padding: '0.15rem 0.4rem', borderRadius: '4px', fontWeight: 700 }}>
                        Corrected
                      </span>
                    )}
                  </div>
                  <div className="activity-meta">
                    <DateTimeBadge date={entry.date} createdAt={entry.createdAt} />
                    <span className="datetime-pill-date" style={{ background: '#f8fafc', color: '#475569' }}>
                      @ {formatPaise(entry.ratePaisePerLitre)}/L
                    </span>
                    {entry.createdByName && (
                      <span className="activity-user-pill">
                        👤 {entry.createdByName}
                      </span>
                    )}
                  </div>
                  {entry.notes && (
                    <div style={{ fontSize: '0.76rem', color: '#64748b', marginTop: '0.25rem', fontStyle: 'italic' }}>
                      "{entry.notes}"
                    </div>
                  )}
                </div>
              </div>

              <div className="activity-right">
                <div className="activity-amount" style={{ color: '#0f172a' }}>
                  {formatPaise(entry.totalAmountPaise)}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.35rem', marginTop: '0.25rem' }}>
                  {entry.paymentStatus === 'paid' ? (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem', color: '#059669', fontSize: '0.75rem', fontWeight: 700 }}>
                      <CheckCircle size={13} />
                      {t('paid')}
                    </span>
                  ) : (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem', color: '#dc2626', fontSize: '0.75rem', fontWeight: 700 }}>
                      <Clock size={13} />
                      {t('pending')}
                    </span>
                  )}
                </div>

                {/* Edit & Delete Action Buttons */}
                <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                  <button
                    className="btn-secondary"
                    style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', gap: '0.25rem' }}
                    onClick={() => setEditingEntry(entry)}
                    title={t('editCorrection')}
                  >
                    <Edit3 size={13} />
                    <span style={{ fontSize: '0.75rem' }}>{language === 'ta' ? 'திருத்து' : language === 'ml' ? 'തിരുത്തുക' : 'Edit'}</span>
                  </button>
                  {isAdmin && (
                    <button
                      className="btn-secondary"
                      style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', color: '#dc2626', borderColor: '#fecaca', gap: '0.25rem' }}
                      onClick={() => handleDelete(entry.id)}
                      title="Delete Record"
                    >
                      <Trash2 size={13} />
                      <span style={{ fontSize: '0.75rem' }}>{language === 'ta' ? 'நீக்கு' : language === 'ml' ? 'ഒഴിവാക്കുക' : 'Delete'}</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Modal */}
      <QuickPurchaseModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={() => {
          fetchEntries(true);
          notifyDataChanged();
        }}
        currentRatePaise={5600}
      />

      {/* Correction Modal */}
      <CorrectionModal
        isOpen={Boolean(editingEntry)}
        onClose={() => setEditingEntry(null)}
        onSuccess={() => {
          fetchEntries(true);
          notifyDataChanged();
        }}
        entry={editingEntry}
      />

      {/* Export Monthly Bill Modal */}
      <ExportBillModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        yearMonth={selectedMonth}
      />
    </div>
  );
};
