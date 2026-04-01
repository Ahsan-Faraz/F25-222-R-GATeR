import React from 'react';
import Link from 'next/link';
import { signIn } from 'next-auth/react';

function MaterialIcon({ name, className = '' }: { name: string; className?: string }) {
  return <span className={`material-symbols-outlined ${className}`.trim()}>{name}</span>;
}

export default function StitchMarketingTopNav({
  active = 'pipeline',
}: {
  active?: 'pipeline' | 'about';
}) {
  return (
    <header className="bg-surface dark:bg-[#131315] font-headline tracking-tight flex justify-between items-center px-8 h-16 w-full fixed top-0 z-50 bg-[#0e0e0f]">
      <Link href="/landing" className="text-xl font-bold tracking-tighter text-[#e5e1e3]">
        GATeR
      </Link>
      <nav className="hidden md:flex items-center gap-8">
        <Link
          href="/pipeline"
          className={
            active === 'pipeline'
              ? 'text-primary border-b-2 border-primary pb-1 hover:text-primary transition-colors'
              : 'text-on-surface/70 hover:text-primary transition-colors'
          }
        >
          Pipeline
        </Link>
        <a
          className={
            active === 'about'
              ? 'text-primary border-b-2 border-primary pb-1'
              : 'text-on-surface/70 hover:text-primary transition-colors'
          }
          href="#about"
        >
          About
        </a>
      </nav>
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => signIn('github', { callbackUrl: '/workspace' })}
          className="bg-gradient-to-r from-primary to-primary-container text-on-primary px-5 py-2 font-semibold text-sm scale-98 hover:scale-100 duration-200 flex items-center gap-2 rounded"
        >
          <MaterialIcon name="terminal" className="!text-sm" />
          Sign In with GitHub
        </button>
      </div>
    </header>
  );
}
