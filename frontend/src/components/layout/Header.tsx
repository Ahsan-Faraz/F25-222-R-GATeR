import React from 'react';
import { useSession, signOut } from 'next-auth/react';
import Button from '../ui/Button';

export default function Header() {
  const { data: session } = useSession();

  const handleLogout = async () => {
    await signOut({ callbackUrl: '/' });
  };

  if (!session) {
    return null;
  }

  return (
    <header className="bg-[#0e0e0f] border-b border-outline-variant/15 sticky top-0 z-50">
      <div className="container mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="text-lg font-headline font-bold text-primary tracking-tight leading-none">
              GATeR
              <span className="block text-[10px] font-mono text-on-surface-variant/60 tracking-widest uppercase mt-1">
                Workspace
              </span>
            </div>
          </div>

          <div className="flex items-center gap-6">
            {session.user && (
              <div className="flex items-center gap-3 pl-2 pr-4 py-1.5 rounded-lg bg-surface-container-low border border-outline-variant/20">
                {session.user.image ? (
                  <img
                    src={session.user.image}
                    alt={session.user.name || 'User'}
                    className="w-8 h-8 rounded-full border border-outline-variant/30 object-cover"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-secondary-container flex items-center justify-center text-xs font-bold text-on-secondary-container">
                    {session.user.name?.charAt(0) || 'U'}
                  </div>
                )}
                <div className="text-right hidden md:block">
                  <p className="text-sm font-medium text-on-surface leading-tight">{session.user.name}</p>
                </div>
              </div>
            )}
            <Button variant="accent" size="sm" onClick={handleLogout} className="text-xs tracking-wider uppercase">
              Sign Out
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}
