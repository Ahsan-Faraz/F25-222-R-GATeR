// Main Layout Component

import React, { ReactNode } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import Header from './Header';
import Toast from '../ui/Toast';

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const { data: session, status } = useSession();
  const router = useRouter();

  // Public routes that don't require authentication
  const isPublicRoute = router.pathname === '/login';

  // Show loading while checking authentication
  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-light">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // For public routes, just render without header
  if (isPublicRoute) {
    return (
      <>
        {children}
        <Toast />
      </>
    );
  }

  // For protected routes, redirect to login if not authenticated
  if (status === 'unauthenticated') {
    // Use window.location for a full page redirect to avoid hydration issues
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
    return (
      <div className="min-h-screen flex items-center justify-center bg-light">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent mx-auto"></div>
          <p className="mt-4 text-gray-600">Redirecting to login...</p>
        </div>
      </div>
    );
  }

  // Authenticated - render the full layout
  return (
    <div className="min-h-screen bg-light">
      <Header />
      <main className="container mx-auto px-4 py-8">
        {children}
      </main>
      <Toast />
    </div>
  );
}
