import '@/styles/globals.css';
import type { AppProps } from 'next/app';
import { SessionProvider, useSession } from 'next-auth/react';
import { ToastProvider } from '@/hooks/useToast';
import { AppStateProvider } from '@/context/AppStateContext';
import Layout from '@/components/layout/Layout';
import { useEffect } from 'react';
import { setAccessToken } from '@/lib/api-client';

// Component to sync access token with API client
function TokenSync({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();

  useEffect(() => {
    console.log('[TokenSync] Status:', status);
    console.log('[TokenSync] Session:', session);
    
    if (status === 'authenticated' && session?.accessToken) {
      console.log('[TokenSync] Setting access token:', session.accessToken.substring(0, 10) + '...');
      // Set token in API client
      setAccessToken(session.accessToken);
      
      // Optionally sync with Flask backend
      fetch('/api/auth/sync-flask', { method: 'POST' })
        .then(res => {
          if (!res.ok) {
            console.warn('Flask sync returned non-OK status');
          }
          return res.json();
        })
        .then(data => {
          if (data.success) {
            console.log('Session synced with Flask backend');
          }
        })
        .catch(err => {
          console.warn('Flask sync failed (backend may be down):', err.message);
        });
    } else if (status === 'unauthenticated') {
      console.log('[TokenSync] User unauthenticated, clearing token');
      setAccessToken(null);
    } else {
      console.log('[TokenSync] Status is loading or unknown');
    }
  }, [session, status]);

  return <>{children}</>;
}

export default function App({
  Component,
  pageProps: { session, ...pageProps },
}: AppProps) {
  return (
    <SessionProvider session={session}>
      <ToastProvider>
        <AppStateProvider>
          <TokenSync>
            <Layout>
              <Component {...pageProps} />
            </Layout>
          </TokenSync>
        </AppStateProvider>
      </ToastProvider>
    </SessionProvider>
  );
}
