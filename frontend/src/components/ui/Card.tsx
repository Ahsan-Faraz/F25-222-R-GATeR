import React, { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  title?: string;
  className?: string;
  noPadding?: boolean;
}

export default function Card({ children, title, className = '', noPadding = false }: CardProps) {
  return (
    // Instead of old white bg, use the new GlassCard CSS for dashboard uniformity
    <div className={`GlassCard ${className}`}>
      {title && (
        <div className="px-6 py-4 border-b border-[rgba(184,227,233,0.15)]">
          <h3 className="text-xl font-bold text-white tracking-wide">{title}</h3>
        </div>
      )}
      <div className={noPadding ? '' : 'p-6'}>
        {children}
      </div>
    </div>
  );
}
