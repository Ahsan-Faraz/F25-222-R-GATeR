// Toast Notification Component

import React, { useEffect } from 'react';
import { useToast } from '@/hooks/useToast';
import type { ToastMessage } from '@/types';

export default function Toast() {
  const { toasts, removeToast } = useToast();

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onClose={() => removeToast(toast.id)} />
      ))}
    </div>
  );
}

function ToastItem({ toast, onClose }: { toast: ToastMessage; onClose: () => void }) {
  const accent = {
    success: 'border-l-primary-container',
    error: 'border-l-error',
    warning: 'border-l-tertiary-container',
    info: 'border-l-primary',
  };

  const icons = {
    success: '✓',
    error: '✕',
    warning: '⚠',
    info: 'ℹ',
  };

  useEffect(() => {
    if (toast.duration && toast.duration > 0) {
      const timer = setTimeout(onClose, toast.duration);
      return () => clearTimeout(timer);
    }
  }, [toast.duration, onClose]);

  return (
    <div
      className={`glass-panel border border-outline-variant/20 ${accent[toast.type]} border-l-4 rounded-lg px-5 py-3.5 min-w-[300px] max-w-md animate-fade-in flex items-start gap-3 text-on-surface shadow-2xl`}
    >
      <span className="text-lg font-bold flex-shrink-0 text-primary">{icons[toast.type]}</span>
      <div className="flex-1">
        <p className="text-sm font-medium leading-snug">{toast.message}</p>
      </div>
      <button
        onClick={onClose}
        className="text-on-surface-variant hover:text-on-surface flex-shrink-0 text-lg leading-none"
        aria-label="Close"
      >
        ×
      </button>
    </div>
  );
}
