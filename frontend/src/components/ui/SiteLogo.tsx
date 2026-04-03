import React from 'react';
import Image from 'next/image';
import Link from 'next/link';

/** Served from `frontend/public/logo.png` (also keep a copy under `src/public` if you use it elsewhere). */
export const SITE_LOGO_PATH = '/logo.png';

type SiteLogoProps = {
  size?: number;
  className?: string;
  /** When set, wraps the mark in a link */
  href?: string;
  priority?: boolean;
};

/** Square logo mark only */
export function SiteLogoMark({ size = 32, className = '', href, priority }: SiteLogoProps) {
  const img = (
    <Image
      src={SITE_LOGO_PATH}
      alt="GATeR"
      width={size}
      height={size}
      className={`object-contain ${className}`.trim()}
      priority={priority}
    />
  );
  if (href) {
    return (
      <Link href={href} className="inline-flex shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 rounded">
        {img}
      </Link>
    );
  }
  return <span className="inline-flex shrink-0">{img}</span>;
}

type SiteLogoLockupProps = SiteLogoProps & {
  children: React.ReactNode;
};

/** Logo + arbitrary right column (titles, etc.) */
export default function SiteLogoLockup({ size = 32, className = '', href, priority, children }: SiteLogoLockupProps) {
  const row = (
    <>
      <SiteLogoMark size={size} priority={priority} />
      {children}
    </>
  );
  if (href) {
    return (
      <Link
        href={href}
        className={`inline-flex items-center gap-3 min-w-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 rounded-md ${className}`.trim()}
      >
        {row}
      </Link>
    );
  }
  return <span className={`inline-flex items-center gap-3 min-w-0 ${className}`.trim()}>{row}</span>;
}
