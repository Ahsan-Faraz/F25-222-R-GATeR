// Main Layout Component - Command Center Structure

import React, { ReactNode, useState, useEffect, useCallback } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Toast from '../ui/Toast';
import { 
  FolderGit2, 
  Network, 
  BarChart3, 
  Compass, 
  Database, 
  Search, 
  Wrench, 
  Download,
  LogOut,
  Command,
  ChevronRight,
  User,
  Circle
} from 'lucide-react';

interface LayoutProps {
  children: ReactNode;
}

// Navigation item type
interface NavItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

// Navigation items for sidebar
const navItems: NavItem[] = [
  { id: 'repo', label: 'Repository', icon: FolderGit2 },
  { id: 'kg', label: 'Knowledge Graph', icon: BarChart3 },
  { id: 'kgvis', label: 'Visualization', icon: Network },
  { id: 'kgcompass', label: 'KGCompass', icon: Compass },
  { id: 'kuzu', label: 'KUZU DB', icon: Database },
  { id: 'vectors', label: 'Vector Search', icon: Search },
  { id: 'gatr', label: 'Test Repair', icon: Wrench },
  { id: 'export', label: 'Export', icon: Download },
];

export default function Layout({ children }: LayoutProps) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [showCommandPalette, setShowCommandPalette] = useState(false);

  // Public routes that don't require authentication or layout
  const isPublicRoute = router.pathname === '/login' || 
                        (router.pathname === '/' && !router.query.section && status === 'unauthenticated');

  // Keyboard shortcut for command palette
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setShowCommandPalette(prev => !prev);
      }
      if (e.key === 'Escape') {
        setShowCommandPalette(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Show loading skeleton
  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-2 border-border border-t-accent rounded-full animate-spin" />
          <p className="text-text-muted text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  // For public routes, just render without layout
  if (isPublicRoute) {
    return (
      <>
        {children}
        <Toast />
      </>
    );
  }

  // Redirect unauthenticated users only if they're trying to access protected sections
  if (status === 'unauthenticated' && !isPublicRoute) {
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-2 border-border border-t-accent rounded-full animate-spin" />
          <p className="text-text-muted text-sm">Redirecting...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black flex">
      {/* Vertical Sidebar - 240px fixed */}
      <aside className="w-sidebar fixed left-0 top-0 h-screen bg-black border-r border-border flex flex-col z-40">
        {/* Logo */}
        <div className="px-4 py-5 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-accent rounded-md flex items-center justify-center">
              <Network className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="text-text-primary font-semibold text-base tracking-tight">GATeR</h1>
              <p className="text-text-muted text-[10px] font-mono uppercase tracking-wider">Workspace</p>
            </div>
          </div>
        </div>

        {/* Command Palette Trigger */}
        <div className="px-3 py-3 border-b border-border">
          <button 
            onClick={() => setShowCommandPalette(true)}
            className="cmd-trigger w-full justify-between"
          >
            <div className="flex items-center gap-2">
              <Search className="w-4 h-4" />
              <span>Search...</span>
            </div>
            <div className="flex items-center gap-1">
              <kbd className="kbd">⌘</kbd>
              <kbd className="kbd">K</kbd>
            </div>
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 overflow-y-auto">
          <div className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = router.query.section === item.id || 
                              (!router.query.section && item.id === 'repo');
              
              return (
                <Link 
                  key={item.id}
                  href={`/?section=${item.id}`}
                  className={`nav-link ${isActive ? 'nav-link-active' : ''}`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        </nav>

        {/* User Section */}
        {session?.user && (
          <div className="p-3 border-t border-border">
            <div className="flex items-center gap-3 px-3 py-2">
              {session.user.image ? (
                <img 
                  src={session.user.image} 
                  alt={session.user.name || 'User'} 
                  className="w-8 h-8 rounded-full"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-surface-active flex items-center justify-center">
                  <User className="w-4 h-4 text-text-muted" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm text-text-primary truncate">{session.user.name}</p>
                <p className="text-xs text-text-muted truncate">{session.user.email}</p>
              </div>
            </div>
            <button
              onClick={() => signOut({ callbackUrl: '/' })}
              className="nav-link w-full mt-2 text-text-muted hover:text-error"
            >
              <LogOut className="w-4 h-4" />
              <span>Sign out</span>
            </button>
          </div>
        )}
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 ml-sidebar">
        {/* Breadcrumb Header */}
        <header className="sticky top-0 z-30 bg-black/80 backdrop-blur-sm border-b border-border">
          <div className="flex items-center justify-between px-6 py-3">
            {/* Breadcrumb */}
            <div className="breadcrumb">
              <span className="breadcrumb-item">Workspace</span>
              <ChevronRight className="w-4 h-4 breadcrumb-separator" />
              {session?.user?.name && (
                <>
                  <span className="breadcrumb-item">{session.user.name}</span>
                  <ChevronRight className="w-4 h-4 breadcrumb-separator" />
                </>
              )}
              <span className="breadcrumb-current">
                {navItems.find(n => n.id === (router.query.section || 'repo'))?.label || 'Dashboard'}
              </span>
            </div>

            {/* Status Indicator */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-sm text-text-secondary">
                <Circle className="w-2 h-2 fill-success text-success" />
                <span>Connected</span>
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div className="p-6">
          {children}
        </div>
      </main>

      {/* Command Palette Overlay */}
      {showCommandPalette && (
        <CommandPalette 
          onClose={() => setShowCommandPalette(false)} 
          navItems={navItems}
        />
      )}

      <Toast />
    </div>
  );
}

// Command Palette Component
function CommandPalette({ 
  onClose, 
  navItems 
}: { 
  onClose: () => void; 
  navItems: NavItem[];
}) {
  const router = useRouter();
  const [search, setSearch] = useState('');

  const filteredItems = navItems.filter(item => 
    item.label.toLowerCase().includes(search.toLowerCase())
  );

  const handleSelect = (id: string) => {
    router.push(`/?section=${id}`);
    onClose();
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
      
      {/* Palette */}
      <div 
        className="relative w-full max-w-lg bg-bg-zinc border border-border rounded-lg shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Search Input */}
        <div className="border-b border-border">
          <div className="flex items-center gap-3 px-4 py-3">
            <Search className="w-5 h-5 text-text-muted" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search sections..."
              className="flex-1 bg-transparent text-text-primary placeholder-text-muted outline-none text-sm"
              autoFocus
            />
            <kbd className="kbd">ESC</kbd>
          </div>
        </div>

        {/* Results */}
        <div className="max-h-80 overflow-y-auto py-2">
          {filteredItems.length === 0 ? (
            <div className="px-4 py-8 text-center text-text-muted text-sm">
              No results found
            </div>
          ) : (
            filteredItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => handleSelect(item.id)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-left
                             hover:bg-surface-hover transition-colors"
                >
                  <Icon className="w-4 h-4 text-text-muted" />
                  <span className="text-sm text-text-primary">{item.label}</span>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
