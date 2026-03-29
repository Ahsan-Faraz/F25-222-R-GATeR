// Toast Notification Provider

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import type { ToastMessage } from '@/types';
import { generateId } from '@/lib/utils';

interface ToastContextType {
  toasts: ToastMessage[];
  showToast: (type: ToastMessage['type'], message: string, duration?: number) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = useCallback(
    (type: ToastMessage['type'], message: string, duration = 5000) => {
      const id = generateId();
      const toast: ToastMessage = { id, type, message, duration };
      
      setToasts(prev => [...prev, toast]);

      if (duration > 0) {
        setTimeout(() => {
          setToasts(prev => prev.filter(t => t.id !== id));
        }, duration);
      }
    },
    []
  );

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, showToast, removeToast }}>
      {children}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
}
