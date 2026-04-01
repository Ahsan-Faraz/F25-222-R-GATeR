import React from 'react';

export default function MaterialIcon({
  name,
  className = '',
  filled,
}: {
  name: string;
  className?: string;
  /** Stitch hub icon uses filled variant */
  filled?: boolean;
}) {
  return (
    <span
      className={`material-symbols-outlined ${className}`.trim()}
      style={filled ? { fontVariationSettings: "'FILL' 1" } : undefined}
      aria-hidden
    >
      {name}
    </span>
  );
}
