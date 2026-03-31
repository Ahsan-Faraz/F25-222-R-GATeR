import React, { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  title?: string;
  className?: string;
  noPadding?: boolean;
  action?: ReactNode;
}

export default function Card({ 
  children, 
  title, 
  className = '', 
  noPadding = false,
  action 
}: CardProps) {
  return (
    <div className={`gater-card ${className}`}>
      {title && (
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-text-secondary">
            {title}
          </h3>
          {action && <div>{action}</div>}
        </div>
      )}
      <div className={noPadding ? '' : 'p-5'}>
        {children}
      </div>
    </div>
  );
}
