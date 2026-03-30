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
      <div className="min-h-screen flex items-center justify-center bg-[#0B2E33]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#D4A574] mx-auto"></div>
          <p className="mt-4 text-[#B8E3E9]">Loading...</p>
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
      <div className="min-h-screen flex items-center justify-center bg-[#0B2E33]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#D4A574] mx-auto"></div>
          <p className="mt-4 text-[#B8E3E9]">Redirecting to login...</p>
        </div>
      </div>
    );
  }

  // Authenticated - render the full layout
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0B2E33] via-[#1a4a52] to-[#0B2E33] relative">
      {/* Subtle background decoration - multiple color blobs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        {/* Top left - cyan glow */}
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-[#4F7C82] opacity-8 blur-[150px] rounded-full"></div>
        {/* Bottom right - warm brown glow */}
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-[#D4A574] opacity-8 blur-[150px] rounded-full"></div>
        {/* Left middle - light cyan */}
        <div className="absolute top-1/2 left-0 w-64 h-64 bg-[#B8E3E9] opacity-5 blur-[100px] rounded-full"></div>
        {/* Top right - dark accent */}
        <div className="absolute top-20 right-10 w-48 h-48 bg-[#0B2E33] opacity-30 blur-[80px] rounded-full"></div>
        {/* Center - subtle white tint */}
        <div className="absolute top-1/3 left-1/2 w-72 h-72 bg-white opacity-[0.02] blur-[120px] rounded-full"></div>
      </div>
      <Header />
      <main className="container mx-auto px-4 py-8 relative z-10">
        {children}
      </main>
      <Toast />
    </div>
  );
}
