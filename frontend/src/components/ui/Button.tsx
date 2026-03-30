// Reusable Button Component

import React, { ButtonHTMLAttributes } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'accent' | 'success' | 'error' | 'warning' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
}

export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  className = '',
  ...props
}: ButtonProps) {
  const baseStyles = 'font-semibold rounded-lg transition-all duration-200 inline-flex items-center justify-center';
  
  const variantStyles = {
    primary: 'bg-gradient-to-r from-[#4F7C82] to-[#3a5e64] text-white hover:from-[#5a8b93] hover:to-[#4F7C82] border border-[rgba(184,227,233,0.4)] hover:border-[#B8E3E9] hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed',
    secondary: 'bg-transparent border-2 border-[#4F7C82] text-[#B8E3E9] hover:bg-[rgba(79,124,130,0.2)] hover:border-[#B8E3E9] disabled:opacity-50 disabled:cursor-not-allowed',
    accent: 'bg-gradient-to-r from-[#D4A574] to-[#A67C52] text-[#0B2E33] hover:from-[#E8D4B8] hover:to-[#D4A574] border border-[rgba(212,165,116,0.5)] hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed',
    success: 'bg-[#4ade80] text-white hover:bg-[#22c55e] disabled:opacity-50 disabled:cursor-not-allowed',
    error: 'bg-[#ef4444] text-white hover:bg-[#dc2626] disabled:opacity-50 disabled:cursor-not-allowed',
    warning: 'bg-[#D4A574] text-[#0B2E33] hover:bg-[#E8D4B8] disabled:opacity-50 disabled:cursor-not-allowed',
    outline: 'bg-transparent border-2 border-[rgba(184,227,233,0.3)] text-[#B8E3E9] hover:border-[#B8E3E9] hover:text-white hover:bg-[rgba(79,124,130,0.2)] disabled:opacity-50 disabled:cursor-not-allowed',
    ghost: 'bg-transparent text-[#B8E3E9] hover:bg-[rgba(79,124,130,0.2)] hover:text-white border border-transparent hover:border-[rgba(184,227,233,0.2)] disabled:opacity-50 disabled:cursor-not-allowed',
  };

  const sizeStyles = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg',
  };

  return (
    <button
      className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading && (
        <svg className="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      )}
      {children}
    </button>
  );
}
