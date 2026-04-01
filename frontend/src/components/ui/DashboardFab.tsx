import React from 'react';
import MaterialIcon from '@/components/ui/MaterialIcon';

export interface DashboardFabProps {
  onClick?: () => void;
}

/**
 * Stitch f8392340720a469cb944211c9fac7ea3 — contextual FAB (+).
 */
export default function DashboardFab({ onClick }: DashboardFabProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="fixed bottom-8 right-8 w-14 h-14 bg-primary rounded-full shadow-2xl flex items-center justify-center text-on-primary group hover:scale-105 transition-transform duration-200 z-50"
      aria-label="Add or expand"
    >
      <MaterialIcon
        name="add"
        className="!text-3xl group-hover:rotate-90 transition-transform duration-300"
      />
    </button>
  );
}
