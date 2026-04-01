import React, { ReactNode } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import Toast from '../ui/Toast';
import WorkspaceShell from './WorkspaceShell';

interface LayoutProps {
  children: ReactNode;
}

const PUBLIC_PATHS = ['/login', '/auth-error', '/landing', '/pipeline'];

const WORKSPACE_PATHS = ['/', '/workspace', '/test-repair'];

export default function Layout({ children }: LayoutProps) {
  const { status } = useSession();
  const router = useRouter();
  const pathname = router.pathname;

  const isPublic = PUBLIC_PATHS.includes(pathname);

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-surface-container-lowest flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-2 border-outline-variant border-t-primary rounded-full animate-spin" />
          <p className="text-on-surface-variant text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  if (isPublic) {
    return (
      <>
        {children}
        <Toast />
      </>
    );
  }

  if (status === 'unauthenticated') {
    if (pathname === '/') {
      return (
        <>
          {children}
          <Toast />
        </>
      );
    }
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
    return (
      <div className="min-h-screen bg-surface-container-lowest flex items-center justify-center">
        <div className="w-12 h-12 border-2 border-outline-variant border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (status === 'authenticated' && WORKSPACE_PATHS.includes(pathname)) {
    return (
      <>
        <WorkspaceShell>{children}</WorkspaceShell>
        <Toast />
      </>
    );
  }

  return (
    <>
      {children}
      <Toast />
    </>
  );
}
