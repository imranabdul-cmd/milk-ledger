import React, { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react';
import { useLanguage } from './LanguageContext';
import { Droplets, CheckCircle2, AlertCircle, Info, X, Sparkles, LogOut, Trash2, AlertTriangle, HelpCircle } from 'lucide-react';

export type ToastType = 'milk' | 'success' | 'error' | 'info' | 'warning';

export interface ToastOptions {
  type?: ToastType;
  title?: string;
  message: string;
  durationMs?: number;
}

export interface ToastItem extends ToastOptions {
  id: string;
  createdAt: number;
}

export interface ConfirmOptions {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'milk' | 'danger' | 'warning' | 'info' | 'logout';
}

interface ConfirmState extends ConfirmOptions {
  isOpen: boolean;
  resolve: (value: boolean) => void;
}

interface ToastContextType {
  toast: {
    show: (opts: ToastOptions) => void;
    milk: (message: string, title?: string) => void;
    success: (message: string, title?: string) => void;
    error: (message: string, title?: string) => void;
    info: (message: string, title?: string) => void;
    warning: (message: string, title?: string) => void;
  };
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);
  const { language } = useLanguage();

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const show = useCallback(
    ({ type = 'milk', title, message, durationMs = 3400 }: ToastOptions) => {
      const id = `toast_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const newToast: ToastItem = {
        id,
        type,
        title,
        message,
        durationMs,
        createdAt: Date.now(),
      };

      setToasts((prev) => {
        // Keep at most 3 active toasts at a time to prevent screen clutter
        const next = [...prev, newToast];
        return next.slice(-3);
      });

      // Auto dismiss after duration
      if (durationMs > 0) {
        setTimeout(() => {
          dismiss(id);
        }, durationMs);
      }
    },
    [dismiss]
  );

  const confirm = useCallback((opts: ConfirmOptions): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      setConfirmState({
        ...opts,
        isOpen: true,
        resolve,
      });
    });
  }, []);

  const handleConfirmCancel = useCallback(() => {
    if (confirmState?.resolve) {
      confirmState.resolve(false);
    }
    setConfirmState(null);
  }, [confirmState]);

  const handleConfirmAccept = useCallback(() => {
    if (confirmState?.resolve) {
      confirmState.resolve(true);
    }
    setConfirmState(null);
  }, [confirmState]);

  // Keyboard accessibility: Escape to cancel, Enter to confirm
  useEffect(() => {
    if (!confirmState?.isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleConfirmCancel();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        handleConfirmAccept();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [confirmState, handleConfirmCancel, handleConfirmAccept]);

  const toastMethods = useMemo(
    () => ({
      show,
      milk: (message: string, title?: string) =>
        show({
          type: 'milk',
          message,
          title: title || (language === 'ta' ? 'பால் கணக்கு' : language === 'ml' ? 'പാൽ കണക്ക്' : 'Family Milk'),
        }),
      success: (message: string, title?: string) =>
        show({
          type: 'success',
          message,
          title: title || (language === 'ta' ? 'வெற்றி' : language === 'ml' ? 'വിജയം' : 'Success'),
        }),
      error: (message: string, title?: string) =>
        show({
          type: 'error',
          message,
          title: title || (language === 'ta' ? 'கவனம்' : language === 'ml' ? 'ശ്രദ്ധിക്കുക' : 'Notice'),
        }),
      info: (message: string, title?: string) =>
        show({
          type: 'info',
          message,
          title: title || (language === 'ta' ? 'தகவல்' : language === 'ml' ? 'വിവരം' : 'Info'),
        }),
      warning: (message: string, title?: string) =>
        show({
          type: 'warning',
          message,
          title: title || (language === 'ta' ? 'எச்சரிக்கை' : language === 'ml' ? 'മുന്നറിയിപ്പ്' : 'Warning'),
        }),
    }),
    [show, language]
  );

  return (
    <ToastContext.Provider value={{ toast: toastMethods, confirm, dismiss }}>
      {children}

      {/* Floating Milky Glassmorphic Toaster Container */}
      <div className="milk-toaster-container" aria-live="polite" aria-atomic="true">
        {toasts.map((item) => (
          <div
            key={item.id}
            className={`milk-toast-card toast-${item.type || 'milk'}`}
            role="status"
            onClick={() => dismiss(item.id)}
          >
            {/* Ambient Milky Sheen Ripple Overlay */}
            <div className="milk-toast-ambient" />

            {/* Left Milk Icon with glowing gradient ring */}
            <div className={`milk-toast-icon-wrapper icon-${item.type || 'milk'}`}>
              {item.type === 'milk' && <Droplets size={20} className="milk-toast-icon" />}
              {item.type === 'success' && <CheckCircle2 size={20} className="milk-toast-icon" />}
              {item.type === 'error' && <AlertCircle size={20} className="milk-toast-icon" />}
              {item.type === 'info' && <Info size={20} className="milk-toast-icon" />}
              {item.type === 'warning' && <Sparkles size={20} className="milk-toast-icon" />}
            </div>

            {/* Text Content: Important Message Only */}
            <div className="milk-toast-body">
              {item.title && <div className="milk-toast-title">{item.title}</div>}
              <div className="milk-toast-msg">{item.message}</div>
            </div>

            {/* Dismiss Close Button */}
            <button
              type="button"
              className="milk-toast-close"
              onClick={(e) => {
                e.stopPropagation();
                dismiss(item.id);
              }}
              aria-label="Close"
            >
              <X size={15} />
            </button>

            {/* Micro Timer Shimmer Bar */}
            <div
              className="milk-toast-timer"
              style={{ animationDuration: `${item.durationMs || 3400}ms` }}
            />
          </div>
        ))}
      </div>

      {/* Pure Milk Glassmorphic Confirmation Modal / Dialog */}
      {confirmState?.isOpen && (
        <div
          className="milk-confirm-overlay"
          onClick={handleConfirmCancel}
          role="dialog"
          aria-modal="true"
          aria-labelledby="milk-confirm-title"
          aria-describedby="milk-confirm-desc"
        >
          <div
            className={`milk-confirm-card confirm-type-${confirmState.type || 'warning'}`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Ambient Milky Frosted Light Reflection */}
            <div className="milk-toast-ambient" />

            {/* Glowing Claymorphic Icon Badge */}
            <div className={`milk-confirm-icon-wrapper icon-type-${confirmState.type || 'warning'}`}>
              {confirmState.type === 'logout' && <LogOut size={26} />}
              {confirmState.type === 'danger' && <Trash2 size={26} />}
              {confirmState.type === 'warning' && <AlertTriangle size={26} />}
              {confirmState.type === 'milk' && <Droplets size={26} />}
              {(!confirmState.type || confirmState.type === 'info') && <HelpCircle size={26} />}
            </div>

            {/* Title & Message */}
            <div className="milk-confirm-body">
              <h3 id="milk-confirm-title" className="milk-confirm-title">
                {confirmState.title || (language === 'ta' ? 'உறுதிப்படுத்தவும்' : language === 'ml' ? 'സ്ഥിരീകരിക്കുക' : 'Please Confirm')}
              </h3>
              <p id="milk-confirm-desc" className="milk-confirm-message">
                {confirmState.message}
              </p>
            </div>

            {/* Action Buttons */}
            <div className="milk-confirm-actions">
              <button
                type="button"
                className="milk-confirm-btn btn-cancel"
                onClick={handleConfirmCancel}
              >
                {confirmState.cancelText || (language === 'ta' ? 'ரத்து செய்' : language === 'ml' ? 'റദ്ദാക്കുക' : 'Cancel')}
              </button>
              <button
                type="button"
                className={`milk-confirm-btn btn-confirm btn-${confirmState.type || 'warning'}`}
                onClick={handleConfirmAccept}
                autoFocus
              >
                {confirmState.confirmText || (language === 'ta' ? 'சரி' : language === 'ml' ? 'ശരി' : 'Confirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </ToastContext.Provider>
  );
};

export function useToast(): ToastContextType {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return ctx;
}

export function useConfirm() {
  const { confirm } = useToast();
  return { confirm };
}
