// Reusable Button Component

import React, { ButtonHTMLAttributes } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'accent' | 'success' | 'error' | 'warning' | 'outline';
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
    primary: 'bg-primary text-white hover:bg-primary-light disabled:bg-gray-300',
    secondary: 'bg-secondary text-white hover:bg-gray-600 disabled:bg-gray-300',
    accent: 'bg-accent text-white hover:bg-accent-light disabled:bg-gray-300',
    success: 'bg-success text-white hover:bg-green-600 disabled:bg-gray-300',
    error: 'bg-error text-white hover:bg-red-600 disabled:bg-gray-300',
    warning: 'bg-warning text-white hover:bg-yellow-600 disabled:bg-gray-300',
    outline: 'bg-transparent border-2 border-gray-300 text-gray-700 hover:border-accent hover:text-accent disabled:bg-gray-100',
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
