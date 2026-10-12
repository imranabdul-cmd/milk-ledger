import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { useLanguage } from './LanguageContext';
import { Droplets, CheckCircle2, AlertCircle, Info, X, Sparkles } from 'lucide-react';

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

interface ToastContextType {
  toast: {
    show: (opts: ToastOptions) => void;
    milk: (message: string, title?: string) => void;
    success: (message: string, title?: string) => void;
    error: (message: string, title?: string) => void;
    info: (message: string, title?: string) => void;
    warning: (message: string, title?: string) => void;
  };
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
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
    <ToastContext.Provider value={{ toast: toastMethods, dismiss }}>
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
