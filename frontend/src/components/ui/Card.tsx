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
    <div
      className={`rounded-lg border border-outline-variant/10 bg-surface-container-lowest overflow-hidden ${className}`}
    >
      {title && (
        <div className="flex items-center justify-between px-5 py-4 border-b border-outline-variant/10">
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/80">
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
