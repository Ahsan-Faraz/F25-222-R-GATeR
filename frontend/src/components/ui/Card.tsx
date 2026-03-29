// Reusable Card Component

import React, { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  title?: string;
  className?: string;
  noPadding?: boolean;
}

export default function Card({ children, title, className = '', noPadding = false }: CardProps) {
  return (
    <div className={`bg-white rounded-2xl shadow-card hover:shadow-card-hover transition-shadow ${className}`}>
      {title && (
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-xl font-bold text-primary">{title}</h3>
        </div>
      )}
      <div className={noPadding ? '' : 'p-6'}>
        {children}
      </div>
    </div>
  );
}
