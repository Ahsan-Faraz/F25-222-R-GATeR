// Header Component with Navigation

import React from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/router';
import Button from '../ui/Button';

export default function Header() {
  const { data: session } = useSession();
  const router = useRouter();

  const handleLogout = async () => {
    await signOut({ callbackUrl: '/login' });
  };

  if (!session) {
    return null;
  }

  return (
    <header className="bg-primary text-white shadow-lg">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="bg-accent p-3 rounded-lg">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <div>
              <h1 className="text-3xl font-bold">GATeR</h1>
              <p className="text-sm opacity-90">Graph-Augmented Test-case Retrieval</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {session.user && (
              <div className="flex items-center gap-3">
                {session.user.image && (
                  <img
                    src={session.user.image}
                    alt={session.user.name || 'User'}
                    className="w-10 h-10 rounded-full border-2 border-accent"
                  />
                )}
                <div className="text-right">
                  <p className="font-semibold">{session.user.name || session.user.email}</p>
                  <p className="text-xs opacity-75">{session.user.email}</p>
                </div>
              </div>
            )}
            <Button variant="secondary" size="sm" onClick={handleLogout}>
              Logout
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}
