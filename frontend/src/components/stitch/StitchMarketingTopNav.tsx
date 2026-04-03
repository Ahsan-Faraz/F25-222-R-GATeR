import React from 'react';
import Link from 'next/link';
import { signIn } from 'next-auth/react';
import { SiteLogoMark } from '@/components/ui/SiteLogo';

function MaterialIcon({ name, className = '' }: { name: string; className?: string }) {
  return <span className={`material-symbols-outlined ${className}`.trim()}>{name}</span>;
}

export default function StitchMarketingTopNav({
  active = 'pipeline',
  /** `marketing` matches Stitch `fetch_screen_code` for Pipeline / marketing frames (bg-surface, no nav border). */
  variant = 'default',
}: {
  /** `none` = neither Pipeline nor About looks selected (e.g. landing hero). */
  active?: 'pipeline' | 'about' | 'none';
  variant?: 'default' | 'marketing';
}) {
  const shell =
    variant === 'marketing'
      ? 'bg-surface dark:bg-[#131315] font-headline tracking-tight flex justify-between items-center px-8 h-16 w-full fixed top-0 z-50'
      : 'font-headline tracking-tight flex justify-between items-center px-8 h-16 w-full fixed top-0 z-50 bg-[#0e0e0f] border-b border-outline-variant/5';

  return (
    <header className={shell}>
      <Link href="/landing" className="inline-flex items-center shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 rounded" aria-label="Home">
        <SiteLogoMark size={34} priority />
      </Link>
      <nav className="hidden md:flex items-center gap-8">
        <Link
          href="/pipeline"
          className={
            active === 'pipeline'
              ? variant === 'marketing'
                ? 'text-[#c3f5ff] border-b-2 border-[#c3f5ff] pb-1 hover:text-[#c3f5ff] transition-colors scale-98 duration-200'
                : 'text-primary border-b-2 border-primary pb-1 hover:text-primary transition-colors'
              : 'text-on-surface/70 hover:text-primary transition-colors scale-98 duration-200 border-b-2 border-transparent pb-1'
          }
        >
          Pipeline
        </Link>
        <Link
          href="/landing#about"
          className={
            active === 'about'
              ? 'text-primary border-b-2 border-primary pb-1'
              : 'text-on-surface/70 hover:text-primary transition-colors scale-98 duration-200 border-b-2 border-transparent pb-1'
          }
        >
          About
        </Link>
      </nav>
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => signIn('github', { callbackUrl: '/workspace' })}
          className={
            variant === 'marketing'
              ? 'bg-gradient-to-r from-primary to-primary-container text-on-primary px-5 py-2 rounded font-semibold text-sm hover:opacity-90 transition-all active:scale-95'
              : 'bg-gradient-to-r from-primary to-primary-container text-on-primary px-5 py-2 font-semibold text-sm scale-98 hover:scale-100 duration-200 flex items-center gap-2 rounded'
          }
        >
          {variant === 'default' && <MaterialIcon name="terminal" className="!text-sm" />}
          Sign In with GitHub
        </button>
      </div>
    </header>
  );
}
