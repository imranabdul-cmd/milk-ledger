import React, { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { apiRequest } from '../api/client';
import { Language } from '@family-milk/shared';
import { X, Share2, Copy, Check, MessageSquare } from 'lucide-react';

interface WhatsAppShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  yearMonth: string;
}

export const WhatsAppShareModal: React.FC<WhatsAppShareModalProps> = ({
  isOpen,
  onClose,
  yearMonth,
}) => {
  const { language, t } = useLanguage();
  const [statementLang, setStatementLang] = useState<Language>(language);
  const [statementText, setStatementText] = useState<string>('');
  const [shareUrl, setShareUrl] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    if (!isOpen) return;

    const fetchText = async () => {
      setIsLoading(true);
      try {
        const res = await apiRequest<{ text: string; shareUrl: string }>(
          `/api/settlement/whatsapp-text?month=${yearMonth}&lang=${statementLang}`
        );
        setStatementText(res.text);
        setShareUrl(res.shareUrl);
      } catch (err) {
        console.error('Failed to generate WhatsApp text:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchText();
  }, [isOpen, yearMonth, statementLang]);

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(statementText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <MessageSquare size={24} color="#25d366" />
            <h2 className="modal-title">{t('shareWhatsApp')}</h2>
          </div>
          <button className="modal-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {/* Language Selector for Statement */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
          <button
            type="button"
            className={`btn-secondary ${statementLang === 'ml' ? 'selected-paid' : ''}`}
            style={{ flex: 1, justifyContent: 'center', borderColor: statementLang === 'ml' ? '#2563eb' : undefined }}
            onClick={() => setStatementLang('ml')}
          >
            മലയാളം
          </button>
          <button
            type="button"
            className={`btn-secondary ${statementLang === 'en' ? 'selected-paid' : ''}`}
            style={{ flex: 1, justifyContent: 'center', borderColor: statementLang === 'en' ? '#2563eb' : undefined }}
            onClick={() => setStatementLang('en')}
          >
            English
          </button>
        </div>

        {/* Formatted Text Box */}
        <div style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '12px', padding: '1rem', marginBottom: '1.25rem', whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: '0.85rem', maxHeight: '240px', overflowY: 'auto' }}>
          {isLoading ? 'Loading statement...' : statementText}
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            type="button"
            className="btn-secondary"
            style={{ flex: 1, justifyContent: 'center' }}
            onClick={handleCopy}
            disabled={isLoading}
          >
            {copied ? <Check size={18} color="#059669" /> : <Copy size={18} />}
            <span>{copied ? 'Copied!' : 'Copy'}</span>
          </button>

          <a
            href={shareUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="whatsapp-btn"
            style={{ flex: 2 }}
          >
            <Share2 size={20} />
            <span>{t('shareWhatsApp')}</span>
          </a>
        </div>
      </div>
    </div>
  );
};
