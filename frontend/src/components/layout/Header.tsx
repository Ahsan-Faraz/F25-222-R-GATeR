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
    <header className="bg-gradient-to-r from-[#0B2E33] via-[#16424a] to-[#0B2E33] border-b-2 border-[#4F7C82] sticky top-0 z-50 shadow-lg">
      <div className="container mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="text-2xl font-display font-bold text-white tracking-widest leading-none">
              GATeR
              <span className="block text-[10px] font-mono text-[#D4A574] tracking-normal uppercase mt-1">
                Workspace
              </span>
            </div>
          </div>

          <div className="flex items-center gap-6">
            {session.user && (
              <div className="flex items-center gap-3 bg-[#1a4a52] pl-2 pr-4 py-1.5 rounded-full border border-[#4F7C82]">
                {session.user.image ? (
                  <img
                    src={session.user.image}
                    alt={session.user.name || 'User'}
                    className="w-8 h-8 rounded-full border-2 border-[#D4A574]"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#4F7C82] to-[#D4A574] flex items-center justify-center text-xs font-bold text-white">
                    {session.user.name?.charAt(0) || 'U'}
                  </div>
                )}
                <div className="text-right hidden md:block">
                  <p className="text-sm font-medium text-white leading-tight">{session.user.name}</p>
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
