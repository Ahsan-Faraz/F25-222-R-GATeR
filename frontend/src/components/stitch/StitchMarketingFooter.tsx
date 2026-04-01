import React from 'react';
import Link from 'next/link';

export default function StitchMarketingFooter() {
  return (
    <footer className="bg-[#131315] text-primary font-body text-xs uppercase tracking-widest w-full border-t border-on-surface/10 flex flex-col md:flex-row justify-between items-center px-12 py-8">
      <div className="text-on-surface/40 mb-4 md:mb-0">© 2024 GATeR Systems. Precision Built.</div>
      <div className="flex gap-8">
        <a className="text-on-surface/40 hover:text-on-surface transition-colors" href="#">
          Documentation
        </a>
        <a className="text-on-surface/40 hover:text-on-surface transition-colors" href="#">
          API
        </a>
        <Link href="/landing" className="text-on-surface/40 hover:text-on-surface transition-colors">
          Privacy
        </Link>
        <Link href="/landing" className="text-on-surface/40 hover:text-on-surface transition-colors">
          Terms
        </Link>
      </div>
    </footer>
  );
}
