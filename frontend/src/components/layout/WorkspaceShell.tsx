import React, { ReactNode, useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
import { Search } from 'lucide-react';
import { WORKSPACE_NAV_ITEMS, WorkspaceSectionId } from './workspace-nav';
import WorkspaceFooter from './WorkspaceFooter';
import Sidebar from '@/components/ui/Sidebar';
import Topbar from '@/components/ui/Topbar';
import MaterialIcon from '@/components/ui/MaterialIcon';
import { useWorkspaceTopbarMetrics } from '@/hooks/useWorkspaceTopbarMetrics';

function CommandPaletteStitch({
  onClose,
  basePath,
}: {
  onClose: () => void;
  basePath: string;
}) {
  const router = useRouter();
  const [search, setSearch] = useState('');

  const filtered = WORKSPACE_NAV_ITEMS.filter((item) =>
    item.label.toLowerCase().includes(search.toLowerCase())
  );

  const go = (id: WorkspaceSectionId) => {
    if (id === 'gatr') {
      router.push('/test-repair');
    } else {
      router.push(`${basePath}?section=${id}`);
    }
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center pt-[20vh]"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-lg border border-outline-variant/20 rounded-lg shadow-2xl overflow-hidden bg-surface-container-low"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-outline-variant/20">
          <div className="flex items-center gap-3 px-4 py-3">
            <Search className="w-5 h-5 text-on-surface-variant" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search sections..."
              className="flex-1 bg-transparent text-on-surface placeholder:text-on-surface-variant/60 outline-none text-sm"
              autoFocus
            />
            <kbd className="inline-flex items-center justify-center px-1.5 py-0.5 text-xs font-mono text-on-surface-variant bg-surface-container-high border border-outline-variant rounded">
              ESC
            </kbd>
          </div>
        </div>
        <div className="max-h-80 overflow-y-auto py-2 custom-scrollbar">
          {filtered.length === 0 ? (
            <div className="px-4 py-8 text-center text-on-surface-variant text-sm">No results found</div>
          ) : (
            filtered.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => go(item.id)}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-surface-container-high transition-colors"
              >
                <MaterialIcon name={item.icon} className="text-on-surface-variant" />
                <span className="text-sm text-on-surface">{item.label}</span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default function WorkspaceShell({ children }: { children: ReactNode }) {
  const { data: session } = useSession();
  const router = useRouter();
  const [showPalette, setShowPalette] = useState(false);
  const { embeddingsDisplay, activeModelDisplay } = useWorkspaceTopbarMetrics();

  const basePath = router.pathname.startsWith('/workspace') ? '/workspace' : '/';

  const activeSection: WorkspaceSectionId =
    router.pathname === '/test-repair'
      ? 'gatr'
      : ((router.query.section as WorkspaceSectionId) || 'repo');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setShowPalette((p) => !p);
      }
      if (e.key === 'Escape') setShowPalette(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const navHref = (id: WorkspaceSectionId) =>
    id === 'gatr' ? '/test-repair' : `${basePath}?section=${id}`;

  return (
    <div className="min-h-screen bg-surface-container-lowest text-on-surface font-body selection:bg-primary/30 selection:text-primary">
      <Sidebar session={session} activeSection={activeSection} navHref={navHref} />

      <main className="ml-64 min-h-screen flex flex-col bg-[#131315]">
        <Topbar
          embeddingsDisplay={embeddingsDisplay}
          activeModelDisplay={activeModelDisplay}
          onOpenCommandPalette={() => setShowPalette(true)}
        />

        <div className="flex-1 flex flex-col min-h-0">
          {children}
          <WorkspaceFooter />
        </div>
      </main>

      {showPalette && (
        <CommandPaletteStitch onClose={() => setShowPalette(false)} basePath={basePath} />
      )}
    </div>
  );
}
