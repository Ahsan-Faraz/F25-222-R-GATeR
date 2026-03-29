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
  const bgColors = {
    success: 'bg-success',
    error: 'bg-error',
    warning: 'bg-warning',
    info: 'bg-info',
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
      className={`${bgColors[toast.type]} text-white px-6 py-4 rounded-lg shadow-lg min-w-[300px] max-w-md animate-fade-in flex items-start gap-3`}
    >
      <span className="text-2xl font-bold flex-shrink-0">{icons[toast.type]}</span>
      <div className="flex-1">
        <p className="font-medium">{toast.message}</p>
      </div>
      <button
        onClick={onClose}
        className="text-white hover:text-gray-200 flex-shrink-0 text-xl"
        aria-label="Close"
      >
        ×
      </button>
    </div>
  );
}
