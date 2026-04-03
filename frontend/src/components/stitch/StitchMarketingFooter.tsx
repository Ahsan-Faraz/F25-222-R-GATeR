import React from 'react';
import Link from 'next/link';
import { SiteLogoMark } from '@/components/ui/SiteLogo';

export default function StitchMarketingFooter({
  /** Matches Stitch Pipeline HTML: `mt-24`, `border-[#e5e1e3]/10` */
  variant = 'default',
}: {
  variant?: 'default' | 'marketing';
}) {
  const marketing =
    variant === 'marketing'
      ? 'bg-[#131315] w-full border-t border-[#e5e1e3]/10 flex flex-col md:flex-row justify-between items-center px-12 py-8 font-label text-xs uppercase tracking-widest mt-24'
      : 'bg-[#131315] font-body text-xs uppercase tracking-widest w-full border-t border-on-surface/10 flex flex-col md:flex-row justify-between items-center px-12 py-8';

  return (
    <footer className={marketing}>
      <div
        className={
          variant === 'marketing'
            ? 'flex items-center text-[#e5e1e3]/40 mb-4 md:mb-0'
            : 'flex items-center text-on-surface/40 mb-4 md:mb-0'
        }
      >
        <SiteLogoMark size={28} />
      </div>
      <div className={`flex gap-8 ${variant === 'marketing' ? 'mt-6 md:mt-0' : ''}`}>
        <a
          className={
            variant === 'marketing'
              ? 'text-[#e5e1e3]/40 hover:text-[#e5e1e3] transition-colors'
              : 'text-on-surface/40 hover:text-on-surface transition-colors'
          }
          href="#"
        >
          Documentation
        </a>
        <a
          className={
            variant === 'marketing'
              ? 'text-[#e5e1e3]/40 hover:text-[#e5e1e3] transition-colors'
              : 'text-on-surface/40 hover:text-on-surface transition-colors'
          }
          href="#"
        >
          API
        </a>
        <Link
          href="/landing"
          className={
            variant === 'marketing'
              ? 'text-[#e5e1e3]/40 hover:text-[#e5e1e3] transition-colors'
              : 'text-on-surface/40 hover:text-on-surface transition-colors'
          }
        >
          Privacy
        </Link>
        <Link
          href="/landing"
          className={
            variant === 'marketing'
              ? 'text-[#e5e1e3]/40 hover:text-[#e5e1e3] transition-colors'
              : 'text-on-surface/40 hover:text-on-surface transition-colors'
          }
        >
          Terms
        </Link>
      </div>
    </footer>
  );
}
