import React from 'react';
import Link from 'next/link';

/** Stitch f8392340720a469cb944211c9fac7ea3 — footer (verbatim spacing/typography). */
export default function WorkspaceFooter() {
  const links = [
    { href: '#', label: 'Documentation' },
    { href: '#', label: 'API' },
    { href: '#', label: 'Privacy' },
    { href: '#', label: 'Terms' },
  ];
  return (
    <footer className="mt-auto border-t border-outline-variant/10 bg-[#131315]">
      <div className="flex flex-col md:flex-row justify-between items-center px-12 py-8 w-full">
        <p className="font-body text-xs uppercase tracking-widest text-[#e5e1e3]/40">
          © 2024 GATeR Systems. Precision Built.
        </p>
        <div className="flex gap-8 mt-4 md:mt-0">
          {links.map((l) => (
            <Link
              key={l.label}
              href={l.href}
              className="font-body text-xs uppercase tracking-widest text-[#e5e1e3]/40 hover:text-[#e5e1e3] transition-colors"
            >
              {l.label}
            </Link>
          ))}
        </div>
      </div>
    </footer>
  );
}
