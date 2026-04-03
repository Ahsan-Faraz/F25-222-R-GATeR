// Login Page - Minimalist-Futurism Design

import React, { useEffect } from 'react';
import { useSession, signIn } from 'next-auth/react';
import { useRouter } from 'next/router';
import { GitBranch, Database, Network, Zap, Shield, Lock, ChevronRight } from 'lucide-react';
import { SiteLogoMark } from '@/components/ui/SiteLogo';

const GithubIcon = () => (
  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
    <path fillRule="evenodd" d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.17 6.839 9.49.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.603-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.463-1.11-1.463-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.167 22 16.418 22 12c0-5.523-4.477-10-10-10z" clipRule="evenodd" />
  </svg>
);

export default function LoginPage() {
  const { status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'authenticated') {
      router.push('/');
    }
  }, [status, router]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-container-lowest">
        <div className="skeleton w-12 h-12 rounded-full" />
      </div>
    );
  }

  const features = [
    { icon: GitBranch, label: "Repository Analysis" },
    { icon: Database, label: "Vector Search" },
    { icon: Network, label: "Graph Exploration" },
    { icon: Zap, label: "Test Repair" },
  ];

  return (
    <div className="min-h-screen bg-surface-container-lowest flex">
      {/* Left Panel - Branding */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12 border-r border-outline-variant/15 bg-surface-container-lowest">
        <div>
          {/* Logo */}
          <div className="mb-16">
            <SiteLogoMark size={80} priority />
          </div>

          {/* Hero */}
          <div className="space-y-6 max-w-md">
            <h1 className="text-display font-headline font-extrabold text-on-surface leading-tight tracking-tight">
              Graph-Augmented<br />Test Retrieval
            </h1>
            <p className="text-on-surface-variant text-lg leading-relaxed">
              AI-powered test repair using knowledge graphs and semantic search. 
              Connect your repository to get started.
            </p>
          </div>

          {/* Features */}
          <div className="mt-16 grid grid-cols-2 gap-4">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <div 
                  key={index}
                  className="flex items-center gap-3 p-3 rounded-lg bg-surface-container border border-outline-variant/15"
                >
                  <Icon className="w-5 h-5 text-primary" />
                  <span className="text-sm text-on-surface">{feature.label}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Trust badges */}
        <div className="flex items-center gap-6 text-sm text-on-surface-variant">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4" />
            <span>Secure OAuth</span>
          </div>
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4" />
            <span>Private Repos</span>
          </div>
        </div>
      </div>

      {/* Right Panel - Login */}
      <div className="flex-1 flex items-center justify-center p-8 bg-background">
        <div className="w-full max-w-sm space-y-8">
          {/* Mobile Logo */}
          <div className="lg:hidden mb-8 flex justify-center">
            <SiteLogoMark size={80} />
          </div>

          {/* Card */}
          <div className="rounded-lg border border-outline-variant/10 bg-surface-container-lowest p-8">
            <div className="space-y-6">
              <div className="space-y-2 text-center">
                <h2 className="text-xl font-headline font-semibold text-on-surface">Sign in to continue</h2>
                <p className="text-sm text-on-surface-variant">
                  Access your repositories and start analyzing
                </p>
              </div>

              <button
                onClick={() => signIn('github', { callbackUrl: '/' })}
                className="w-full flex items-center justify-center gap-3 bg-gradient-to-r from-primary to-primary-container text-on-primary font-medium py-3 px-4 rounded-lg hover:opacity-95 transition-opacity shadow-sm"
              >
                <GithubIcon />
                Continue with GitHub
              </button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-outline-variant/20" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="px-2 bg-surface-container-lowest text-on-surface-variant">Why GitHub?</span>
                </div>
              </div>

              <ul className="space-y-3 text-sm text-on-surface-variant">
                <li className="flex items-start gap-2">
                  <ChevronRight className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                  <span>Access public and private repositories</span>
                </li>
                <li className="flex items-start gap-2">
                  <ChevronRight className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                  <span>Analyze commits, PRs, and issues</span>
                </li>
                <li className="flex items-start gap-2">
                  <ChevronRight className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                  <span>No data stored – analyze on demand</span>
                </li>
              </ul>
            </div>
          </div>

          <p className="text-xs text-on-surface-variant/80 text-center">
            By signing in, you agree to our{' '}
            <a href="#" className="text-primary hover:underline">Terms</a>
            {' '}and{' '}
            <a href="#" className="text-primary hover:underline">Privacy Policy</a>
          </p>
        </div>
      </div>
    </div>
  );
}
