import React from 'react';
import Link from 'next/link';
import { signOut } from 'next-auth/react';
import type { Session } from 'next-auth';
import MaterialIcon from '@/components/ui/MaterialIcon';
import { WORKSPACE_NAV_ITEMS, WorkspaceSectionId } from '@/components/layout/workspace-nav';

export interface SidebarProps {
  session: Session | null;
  activeSection: WorkspaceSectionId;
  navHref: (id: WorkspaceSectionId) => string;
}

/**
 * Stitch screen f8392340720a469cb944211c9fac7ea3 — left navigation (verbatim structure).
 */
export default function Sidebar({ session, activeSection, navHref }: SidebarProps) {
  return (
    <aside className="flex flex-col h-screen w-64 fixed left-0 top-0 bg-[#0e0e0f] border-r border-outline-variant/15 z-50 py-6">
      <div className="px-6 mb-8">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-primary-container flex items-center justify-center">
            <MaterialIcon name="hub" className="text-on-primary-container !text-[20px]" filled />
          </div>
          <div>
            <h1 className="text-[#c3f5ff] font-bold font-headline tracking-tighter leading-none">
              GATeR Workspace
            </h1>
            <p className="text-[10px] text-on-surface-variant/60 uppercase tracking-widest mt-1">
              Graph-Aware Repair
            </p>
          </div>
        </div>
      </div>

      <nav className="flex-1 flex flex-col font-inter text-sm overflow-y-auto custom-scrollbar">
        {WORKSPACE_NAV_ITEMS.map((item) => {
          const active = activeSection === item.id;
          return (
            <Link
              key={item.id}
              href={navHref(item.id)}
              className={`flex items-center gap-4 px-6 py-3 transition-all duration-150 ${
                active
                  ? 'text-[#c3f5ff] font-semibold border-r-2 border-[#c3f5ff] bg-[#131315] active-tab-glow'
                  : 'text-[#e5e1e3]/60 hover:bg-[#131315] hover:text-[#e5e1e3]'
              }`}
            >
              <MaterialIcon name={item.icon} className="!text-[20px]" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {session?.user && (
        <div className="px-6 pt-6 mt-auto border-t border-outline-variant/10">
          <div
            className="flex items-center gap-3 p-2 rounded-lg bg-surface-container-low"
            title={session.user.email ?? undefined}
          >
            {session.user.image ? (
              <img
                src={session.user.image}
                alt={session.user.name || 'User'}
                className="w-8 h-8 rounded-full border border-outline-variant/20 object-cover"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-secondary-container flex items-center justify-center text-xs font-bold text-on-secondary-container">
                {session.user.name?.charAt(0) || 'U'}
              </div>
            )}
            <div className="flex-1 min-w-0 overflow-hidden">
              <p className="text-xs font-semibold text-on-surface truncate">{session.user.name}</p>
              <p className="text-[10px] text-on-surface-variant truncate">Standard Plan</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: '/landing' })}
            className="mt-3 w-full text-left text-xs text-on-surface-variant hover:text-error px-2 py-1"
          >
            Sign out
          </button>
        </div>
      )}
    </aside>
  );
}
