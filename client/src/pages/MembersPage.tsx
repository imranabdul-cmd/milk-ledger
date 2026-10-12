import React, { useState, useCallback, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../api/client';
import { FamilyMember, MilkRateHistory, formatPaise } from '@family-milk/shared';
import {
  KeyRound,
  TrendingUp,
  ShieldCheck,
  Crown,
  User,
  Copy,
  Share2,
  CheckCircle,
  UserPlus,
  UserX,
  UserCheck,
  RefreshCw,
  AlertCircle,
  X
} from 'lucide-react';
import { DateTimeBadge } from '../components/DateTimeBadge';
import { useAutoSync, notifyDataChanged } from '../hooks/useAutoSync';

export const MembersPage: React.FC = () => {
  const { t, language } = useLanguage();
  const { user } = useAuth();

  const isOwner = user?.role === 'owner';
  const isPrivileged = user?.role === 'owner' || user?.role === 'admin';

  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [rates, setRates] = useState<MilkRateHistory[]>([]);

  // Add Member State
  const [isAddingMember, setIsAddingMember] = useState<boolean>(false);
  const [memberName, setMemberName] = useState<string>('');
  const [memberPhone, setMemberPhone] = useState<string>('');
  const [memberRole, setMemberRole] = useState<'admin' | 'member'>('member');
  const [memberCustomPin, setMemberCustomPin] = useState<string>('');
  const [addMemberError, setAddMemberError] = useState<string | null>(null);
  const [isSubmittingMember, setIsSubmittingMember] = useState<boolean>(false);

  // Single-Time Temporary Credential Display Card
  const [singleTimeCredential, setSingleTimeCredential] = useState<{
    memberName: string;
    phone: string;
    role: string;
    temporaryPin: string;
    isReset?: boolean;
  } | null>(null);
  const [copiedCredential, setCopiedCredential] = useState<boolean>(false);

  // Change PIN State
  const [isChangingPin, setIsChangingPin] = useState<boolean>(false);
  const [currentPin, setCurrentPin] = useState<string>('');
  const [newPin, setNewPin] = useState<string>('');
  const [changePinError, setChangePinError] = useState<string | null>(null);
  const [isSubmittingPin, setIsSubmittingPin] = useState<boolean>(false);

  // Add Rate State
  const [isAddingRate, setIsAddingRate] = useState<boolean>(false);
  const [newRateRupees, setNewRateRupees] = useState<string>('56');
  const [newRateEffectiveFrom, setNewRateEffectiveFrom] = useState<string>(
    new Date().toISOString().substring(0, 10)
  );

  const fetchData = useCallback(async () => {
    try {
      const [membersRes, ratesRes] = await Promise.all([
        apiRequest<{ members: FamilyMember[] }>('/api/family/members'),
        apiRequest<{ rates: MilkRateHistory[] }>('/api/milk/rates'),
      ]);
      setMembers(membersRes.members);
      setRates(ratesRes.rates);
    } catch (err) {
      console.error('Failed to load family data:', err);
    }
  }, []);

  // Fetch immediately on mount
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Silent background sync
  useAutoSync(fetchData, { intervalMs: 15000, immediate: false });

  // Handle Add Member
  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddMemberError(null);
    setIsSubmittingMember(true);

    try {
      const cleanPhone = memberPhone.replace(/\D/g, '');
      if (cleanPhone.length !== 10) {
        throw new Error(language === 'ml' ? 'ദയവായി 10 അക്ക മൊബൈൽ നമ്പർ നൽകുക' : language === 'ta' ? 'சரியான 10-இலக்க மொபைல் எண்ணை உள்ளிடவும்' : 'Please enter a valid 10-digit mobile number');
      }

      const res = await apiRequest<{
        member: FamilyMember;
        temporaryPin: string;
      }>('/api/family/members', {
        method: 'POST',
        body: JSON.stringify({
          name: memberName.trim(),
          phone: cleanPhone,
          role: memberRole,
          temporaryPin: memberCustomPin.trim() || undefined,
        }),
      });

      // Display one-time setup credentials card
      setSingleTimeCredential({
        memberName: res.member.name,
        phone: res.member.phone,
        role: res.member.role,
        temporaryPin: res.temporaryPin,
      });

      // Reset form
      setMemberName('');
      setMemberPhone('');
      setMemberRole('member');
      setMemberCustomPin('');
      setIsAddingMember(false);
      fetchData();
    } catch (err: any) {
      setAddMemberError(err.message || 'Failed to add member');
    } finally {
      setIsSubmittingMember(false);
    }
  };

  // Handle Deactivate / Reactivate
  const handleToggleStatus = async (member: FamilyMember) => {
    const isDeactivating = member.isActive;
    const confirmMsg = isDeactivating
      ? t('deactivateConfirm')
      : t('reactivateConfirm');

    if (!window.confirm(confirmMsg)) return;

    try {
      await apiRequest(`/api/family/members/${member.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          isActive: !isDeactivating,
        }),
      });
      fetchData();
    } catch (err: any) {
      alert(err.message || 'Failed to update member status');
    }
  };

  // Handle Admin Reset PIN
  const handleResetPin = async (member: FamilyMember) => {
    if (!window.confirm(t('resetPinConfirm'))) return;

    try {
      const res = await apiRequest<{
        member: FamilyMember;
        temporaryPin: string;
      }>(`/api/family/members/${member.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          resetPin: true,
        }),
      });

      setSingleTimeCredential({
        memberName: res.member.name,
        phone: res.member.phone,
        role: res.member.role,
        temporaryPin: res.temporaryPin,
        isReset: true,
      });

      fetchData();
    } catch (err: any) {
      alert(err.message || 'Failed to reset PIN');
    }
  };

  // Format WhatsApp Share text
  const getWhatsAppText = (cred: {
    memberName: string;
    phone: string;
    role: string;
    temporaryPin: string;
    isReset?: boolean;
  }) => {
    if (language === 'ml') {
      return `നമസ്കാരം ${cred.memberName},\nനമ്മുടെ കുടുംബ മിൽക്ക് അക്കൗണ്ടിലേക്ക് സ്വാഗതം!\n\n📱 മൊബൈൽ നമ്പർ: *${cred.phone}*\n🔑 താൽക്കാലിക പിൻ: *${cred.temporaryPin}*\n\nആപ്പിൽ പ്രവേശിച്ച് ആദ്യ ലോഗിനിൽ സ്വന്തം പിൻ സജ്ജീകരിക്കുക.`;
    }
    if (language === 'ta') {
      return `வணக்கம் ${cred.memberName},\nநமது குடும்ப பால் கணக்கில் உங்கள் கணக்கு தயாராக உள்ளது!\n\n📱 மொபைல் எண்: *${cred.phone}*\n🔑 தற்காலிக PIN: *${cred.temporaryPin}*\n\nஆப்பில் முதல் முறை லாகின் செய்ததும் உங்கள் புதிய PIN-ஐ அமைக்கவும்.`;
    }
    return `Hello ${cred.memberName},\nYour Family Milk Account access is ready!\n\n📱 Mobile: *${cred.phone}*\n🔑 Temporary PIN: *${cred.temporaryPin}*\n\nPlease log in and choose your personal PIN on first login.`;
  };

  const copyCredentialToClipboard = (cred: {
    memberName: string;
    phone: string;
    temporaryPin: string;
  }) => {
    const text = `Family Milk Account\nName: ${cred.memberName}\nPhone: ${cred.phone}\nTemporary PIN: ${cred.temporaryPin}`;
    navigator.clipboard.writeText(text);
    setCopiedCredential(true);
    setTimeout(() => setCopiedCredential(false), 2500);
  };

  const shareWhatsApp = (cred: {
    memberName: string;
    phone: string;
    role: string;
    temporaryPin: string;
    isReset?: boolean;
  }) => {
    const text = getWhatsAppText(cred);
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  // Change PIN handler
  const handleChangePin = async (e: React.FormEvent) => {
    e.preventDefault();
    setChangePinError(null);
    setIsSubmittingPin(true);

    try {
      await apiRequest('/api/auth/change-pin', {
        method: 'POST',
        body: JSON.stringify({
          currentPin: currentPin.trim(),
          newPin: newPin.trim(),
        }),
      });

      alert(language === 'ml' ? 'പിൻ നമ്പർ വിജയകരമായി മാറ്റി!' : language === 'ta' ? 'PIN எண் மாற்றப்பட்டது!' : 'PIN updated successfully!');
      setIsChangingPin(false);
      setCurrentPin('');
      setNewPin('');
    } catch (err: any) {
      setChangePinError(err.message || 'Failed to change PIN');
    } finally {
      setIsSubmittingPin(false);
    }
  };

  // Add Rate handler
  const handleAddRate = async (e: React.FormEvent) => {
    e.preventDefault();
    const rateRupees = parseFloat(newRateRupees);
    if (isNaN(rateRupees) || rateRupees <= 0) {
      alert(t('invalidNumber'));
      return;
    }

    try {
      await apiRequest('/api/milk/rates', {
        method: 'POST',
        body: JSON.stringify({
          rateRupees,
          effectiveFrom: newRateEffectiveFrom,
          notes: `Updated rate to ₹${rateRupees}/L`,
        }),
      });

      alert(language === 'ml' ? 'പുതിയ നിരക്ക് സേവ് ചെയ്തു!' : language === 'ta' ? 'புதிய விலை சேமிக்கப்பட்டது!' : 'New rate added successfully!');
      setIsAddingRate(false);
      fetchData();
      notifyDataChanged();
    } catch (err: any) {
      alert(err.message || 'Failed to add rate');
    }
  };

  const activeMembersCount = members.filter((m) => m.isActive).length;

  return (
    <div className="main-content">
      {/* Title & Action Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--slate-900)' }}>
            {t('familyMembersTitle')}
          </h2>
          <p style={{ fontSize: '0.85rem', color: '#64748b' }}>
            {activeMembersCount} {t('statusActive').toLowerCase()} • {members.length} {language === 'ml' ? 'ആകെ അംഗങ്ങൾ' : language === 'ta' ? 'மொத்த உறுப்பினர்கள்' : 'total'}
          </p>
        </div>

        {isPrivileged && (
          <button
            className="btn-primary"
            style={{ padding: '0.55rem 1rem', fontSize: '0.88rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
            onClick={() => {
              setIsAddingMember(!isAddingMember);
              setAddMemberError(null);
            }}
          >
            <UserPlus size={17} />
            <span>{t('addMemberBtn')}</span>
          </button>
        )}
      </div>

      {/* SINGLE-TIME TEMPORARY CREDENTIAL BANNER */}
      {singleTimeCredential && (
        <div
          style={{
            background: '#f0fdf4',
            border: '2px solid #22c55e',
            borderRadius: 'var(--radius-xl, 16px)',
            padding: '1.25rem',
            marginBottom: '1.5rem',
            boxShadow: 'var(--shadow-card)',
            position: 'relative',
          }}
        >
          <button
            type="button"
            onClick={() => setSingleTimeCredential(null)}
            style={{
              position: 'absolute',
              top: '0.75rem',
              right: '0.75rem',
              background: 'none',
              border: 'none',
              color: '#64748b',
              cursor: 'pointer',
              padding: '0.25rem',
            }}
            title="Dismiss"
          >
            <X size={18} />
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', color: '#15803d', fontWeight: 700, fontSize: '0.98rem' }}>
            <CheckCircle size={22} color="#16a34a" />
            <span>{singleTimeCredential.isReset ? (language === 'ml' ? 'പിൻ നമ്പർ റീസെറ്റ് ചെയ്തു!' : language === 'ta' ? 'PIN எண் மீட்டமைக்கப்பட்டது!' : 'PIN Reset Successfully!') : t('memberCreatedSuccess')}</span>
          </div>

          <p style={{ fontSize: '0.82rem', color: '#166534', marginBottom: '0.85rem' }}>
            {t('shareMemberNotice')}
          </p>

          <div
            style={{
              background: 'white',
              padding: '1rem',
              borderRadius: '12px',
              border: '1.5px dashed #16a34a',
              marginBottom: '0.85rem',
            }}
          >
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <div>
                <span style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>{t('memberName')}:</span>
                <div style={{ fontWeight: 700, color: '#0f172a' }}>{singleTimeCredential.memberName}</div>
              </div>
              <div>
                <span style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>{t('phoneNumber')}:</span>
                <div style={{ fontWeight: 700, color: '#0f172a' }}>{singleTimeCredential.phone}</div>
              </div>
              <div>
                <span style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>{t('temporaryPinLabel')}:</span>
                <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#2563eb', letterSpacing: '0.1em' }}>
                  {singleTimeCredential.temporaryPin}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn-secondary"
                style={{ padding: '0.45rem 0.85rem', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                onClick={() => copyCredentialToClipboard(singleTimeCredential)}
              >
                <Copy size={15} />
                <span>{copiedCredential ? t('copied') : t('copyCode')}</span>
              </button>

              <button
                type="button"
                className="whatsapp-btn"
                style={{ padding: '0.45rem 0.85rem', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                onClick={() => shareWhatsApp(singleTimeCredential)}
              >
                <Share2 size={15} />
                <span>{t('shareOnWhatsApp')}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADD MEMBER MODAL / FORM */}
      {isAddingMember && (
        <div
          style={{
            background: 'white',
            borderRadius: 'var(--radius-xl, 16px)',
            padding: '1.5rem',
            marginBottom: '1.5rem',
            boxShadow: 'var(--shadow-card)',
            border: '2px solid #2563eb',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#1e3a8a', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <UserPlus size={20} color="#2563eb" />
              <span>{t('addMemberModalTitle')}</span>
            </h3>
            <button
              type="button"
              onClick={() => setIsAddingMember(false)}
              style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: '0.2rem' }}
            >
              <X size={18} />
            </button>
          </div>

          {addMemberError && (
            <div style={{ background: '#fee2e2', color: '#991b1b', padding: '0.65rem 0.85rem', borderRadius: '10px', fontSize: '0.85rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <AlertCircle size={17} style={{ flexShrink: 0 }} />
              <span>{addMemberError}</span>
            </div>
          )}

          <form onSubmit={handleAddMember}>
            <div className="form-group">
              <label className="form-label">{t('fullNameLabel')}</label>
              <input
                type="text"
                className="form-input"
                placeholder={language === 'ml' ? 'ഉദാ: അപ്പ, അമ്മ, സഹോദരൻ' : language === 'ta' ? 'எ.கா: அப்பா, அம்மா, சகோதரன்' : 'e.g. Amma, Appa, Brother'}
                value={memberName}
                onChange={(e) => setMemberName(e.target.value)}
                required
                autoFocus
              />
            </div>

            <div className="form-group">
              <label className="form-label">{t('mobileNumberLabel')}</label>
              <input
                type="tel"
                className="form-input"
                placeholder="10-digit mobile number"
                maxLength={10}
                value={memberPhone}
                onChange={(e) => setMemberPhone(e.target.value.replace(/\D/g, ''))}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">{t('role')}</label>
              <select
                className="form-select"
                value={memberRole}
                onChange={(e) => setMemberRole(e.target.value as any)}
              >
                <option value="member">{t('roleMember')}</option>
                {isOwner && <option value="admin">{t('roleAdmin')}</option>}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">{t('temporaryPinLabel')}</label>
              <input
                type="text"
                className="form-input"
                placeholder={language === 'ml' ? 'സ്വയമേവ നിർമ്മിക്കാൻ ശൂന്യമായി വിടുക' : language === 'ta' ? 'தானாக உருவாக்க காலியாக விடவும்' : 'Leave blank to auto-generate (recommended)'}
                maxLength={6}
                value={memberCustomPin}
                onChange={(e) => setMemberCustomPin(e.target.value.replace(/\D/g, ''))}
              />
              <span style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.25rem', display: 'block' }}>
                {t('temporaryPinHelp')}
              </span>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1.25rem' }}>
              <button
                type="submit"
                className="btn-primary-big"
                disabled={isSubmittingMember}
                style={{ minHeight: '44px', flex: 1 }}
              >
                {isSubmittingMember ? t('saving') : t('addMember')}
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setIsAddingMember(false)}
                style={{ minHeight: '44px' }}
              >
                {t('cancel')}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MEMBERS LIST */}
      <div style={{ marginBottom: '2rem' }}>
        {members.map((m) => {
          const isCurrentUser = m.id === user?.id;
          const isOwnerRow = m.role === 'owner';

          return (
            <div
              key={m.id}
              className="activity-card"
              style={{
                padding: '1.1rem 1.25rem',
                marginBottom: '0.75rem',
                opacity: m.isActive ? 1 : 0.65,
                background: m.isActive ? 'white' : '#f8fafc',
                border: m.isActive ? '1px solid var(--slate-200)' : '1px dashed #cbd5e1',
              }}
            >
              <div className="activity-left" style={{ alignItems: 'flex-start' }}>
                <div
                  className="activity-icon-badge"
                  style={{
                    background: m.role === 'owner' ? '#fef3c7' : m.role === 'admin' ? '#eff6ff' : '#f8fafc',
                    color: m.role === 'owner' ? '#d97706' : m.role === 'admin' ? '#2563eb' : '#64748b',
                    marginTop: '0.1rem',
                  }}
                >
                  {m.role === 'owner' ? <Crown size={24} /> : m.role === 'admin' ? <ShieldCheck size={24} /> : <User size={24} />}
                </div>

                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
                    <span className="activity-title" style={{ fontSize: '1rem', fontWeight: 700 }}>
                      {m.name}
                    </span>

                    {isCurrentUser && (
                      <span style={{ fontSize: '0.7rem', background: '#ecfdf5', color: '#047857', padding: '0.15rem 0.5rem', borderRadius: '4px', fontWeight: 700 }}>
                        You
                      </span>
                    )}

                    {/* Role Badge */}
                    <span
                      style={{
                        fontSize: '0.68rem',
                        padding: '0.15rem 0.45rem',
                        borderRadius: '4px',
                        fontWeight: 800,
                        textTransform: 'uppercase',
                        background: m.role === 'owner' ? '#fef3c7' : m.role === 'admin' ? '#dbeafe' : '#f1f5f9',
                        color: m.role === 'owner' ? '#b45309' : m.role === 'admin' ? '#1d4ed8' : '#475569',
                      }}
                    >
                      {m.role === 'owner' ? t('roleOwner') : m.role === 'admin' ? t('roleAdmin') : t('roleMember')}
                    </span>

                    {/* Active / Inactive Badge */}
                    <span
                      style={{
                        fontSize: '0.68rem',
                        padding: '0.15rem 0.45rem',
                        borderRadius: '4px',
                        fontWeight: 700,
                        background: m.isActive ? '#ecfdf5' : '#fee2e2',
                        color: m.isActive ? '#059669' : '#dc2626',
                      }}
                    >
                      {m.isActive ? t('statusActive') : t('statusInactive')}
                    </span>

                    {/* Setup Pending Badge */}
                    {m.mustChangePin && (
                      <span
                        style={{
                          fontSize: '0.68rem',
                          padding: '0.15rem 0.45rem',
                          borderRadius: '4px',
                          fontWeight: 700,
                          background: '#fffbeb',
                          color: '#d97706',
                          border: '1px solid #fde68a',
                        }}
                      >
                        {t('statusSetupPending')}
                      </span>
                    )}
                  </div>

                  <div className="activity-meta" style={{ marginTop: '0.25rem', color: '#64748b' }}>
                    📞 {m.phone}
                  </div>
                </div>
              </div>

              {/* Action Buttons for Admins/Owners on Other Members */}
              <div className="activity-right" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>
                  {m.languagePreference === 'ta' ? 'தமிழ்' : m.languagePreference === 'ml' ? 'മലയാളം' : 'English'}
                </span>

                {isPrivileged && !isCurrentUser && !isOwnerRow && (
                  <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    {/* Reset PIN Button */}
                    <button
                      type="button"
                      className="btn-secondary"
                      style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                      onClick={() => handleResetPin(m)}
                      title={t('resetPinBtn')}
                    >
                      <RefreshCw size={12} />
                      <span>{t('resetPinBtn')}</span>
                    </button>

                    {/* Deactivate / Reactivate Toggle */}
                    <button
                      type="button"
                      className="btn-secondary"
                      style={{
                        padding: '0.3rem 0.6rem',
                        fontSize: '0.75rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.25rem',
                        color: m.isActive ? '#dc2626' : '#059669',
                        borderColor: m.isActive ? '#fca5a5' : '#86efac',
                      }}
                      onClick={() => handleToggleStatus(m)}
                    >
                      {m.isActive ? <UserX size={12} /> : <UserCheck size={12} />}
                      <span>{m.isActive ? t('deactivateMember') : t('reactivateMember')}</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* CHANGE PERSONAL PIN SECTION */}
      <div style={{ background: 'white', borderRadius: 'var(--radius-lg)', padding: '1.25rem', marginBottom: '2rem', boxShadow: 'var(--shadow-card)', border: '1px solid var(--slate-200)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <KeyRound size={20} color="#2563eb" />
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700 }}>{t('changePin')}</h3>
          </div>
          <button className="btn-secondary" onClick={() => setIsChangingPin(!isChangingPin)}>
            <span>{isChangingPin ? t('cancel') : t('changePin')}</span>
          </button>
        </div>

        {isChangingPin && (
          <form onSubmit={handleChangePin} style={{ marginTop: '1.25rem' }}>
            {changePinError && (
              <div style={{ background: '#fee2e2', color: '#991b1b', padding: '0.65rem 0.85rem', borderRadius: '10px', fontSize: '0.85rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <AlertCircle size={17} style={{ flexShrink: 0 }} />
                <span>{changePinError}</span>
              </div>
            )}

            <div className="form-group">
              <label className="form-label">{language === 'ml' ? 'നിലവിലെ പിൻ' : language === 'ta' ? 'தற்போதைய PIN' : 'Current PIN'}</label>
              <input
                type="password"
                inputMode="numeric"
                className="form-input"
                value={currentPin}
                onChange={(e) => setCurrentPin(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">{t('newPinLabel')}</label>
              <input
                type="password"
                inputMode="numeric"
                maxLength={10}
                className="form-input"
                value={newPin}
                onChange={(e) => setNewPin(e.target.value)}
                required
              />
            </div>

            <button type="submit" className="btn-primary-big" disabled={isSubmittingPin} style={{ minHeight: '44px' }}>
              {isSubmittingPin ? t('saving') : t('save')}
            </button>
          </form>
        )}
      </div>

      {/* MILK RATE MANAGEMENT SECTION */}
      <div style={{ background: 'white', borderRadius: 'var(--radius-lg)', padding: '1.25rem', boxShadow: 'var(--shadow-card)', border: '1px solid var(--slate-200)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <TrendingUp size={20} color="#059669" />
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700 }}>{t('rateInfo')}</h3>
          </div>

          {isPrivileged && (
            <button className="btn-secondary" onClick={() => setIsAddingRate(!isAddingRate)}>
              <span>{isAddingRate ? t('cancel') : '+ New Rate'}</span>
            </button>
          )}
        </div>

        {isAddingRate && (
          <form onSubmit={handleAddRate} style={{ marginBottom: '1.25rem', padding: '1rem', background: '#f8fafc', borderRadius: '10px' }}>
            <div className="form-group">
              <label className="form-label">Rate in Rupees (₹ / Litre)</label>
              <input
                type="number"
                step="0.5"
                className="form-input"
                value={newRateRupees}
                onChange={(e) => setNewRateRupees(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Effective From Date</label>
              <input
                type="date"
                className="form-input"
                value={newRateEffectiveFrom}
                onChange={(e) => setNewRateEffectiveFrom(e.target.value)}
                required
              />
            </div>

            <button type="submit" className="btn-primary-big" style={{ minHeight: '44px', background: '#059669' }}>
              {t('save')}
            </button>
          </form>
        )}

        {/* Rate History List */}
        <div>
          {rates.map((r) => (
            <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 0', borderBottom: '1px solid #f1f5f9' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                <div style={{ fontWeight: 700, color: '#0f172a' }}>
                  {formatPaise(r.ratePaisePerLitre)} / L
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                  <DateTimeBadge date={r.effectiveFrom} createdAt={r.createdAt} />
                  {r.createdByName && (
                    <span className="activity-user-pill">
                      👤 {r.createdByName}
                    </span>
                  )}
                </div>
              </div>
              <span style={{ fontSize: '0.75rem', background: '#ecfdf5', color: '#059669', padding: '0.2rem 0.5rem', borderRadius: '4px', fontWeight: 700 }}>
                Active
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
