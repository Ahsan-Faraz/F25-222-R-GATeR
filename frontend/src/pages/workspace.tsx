import React, { useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import DashboardContent from '@/components/workspace/DashboardContent';

export default function WorkspacePage() {
  const { status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/login');
    }
  }, [status, router]);

  if (status === 'loading') {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="h-32 rounded-lg bg-surface-container-low border border-outline-variant/10 animate-pulse" />
        <div className="h-64 rounded-lg bg-surface-container-low border border-outline-variant/10 animate-pulse" />
      </div>
    );
  }

  if (status === 'unauthenticated') {
    return null;
  }

  return <DashboardContent />;
}
