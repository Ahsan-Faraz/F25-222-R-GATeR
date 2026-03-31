// Login Page - Minimalist-Futurism Design

import React, { useEffect } from 'react';
import { useSession, signIn } from 'next-auth/react';
import { useRouter } from 'next/router';
import Button from '@/components/ui/Button';
import { GitBranch, Database, Network, Zap, Shield, Lock, ChevronRight } from 'lucide-react';

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
      <div className="min-h-screen flex items-center justify-center bg-bg">
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
    <div className="min-h-screen bg-bg flex">
      {/* Left Panel - Branding */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12 border-r border-border">
        <div>
          {/* Logo */}
          <div className="flex items-center gap-3 mb-16">
            <div className="w-10 h-10 bg-accent rounded-md flex items-center justify-center">
              <Database className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-semibold text-text-primary tracking-tight">GATeR</span>
          </div>

          {/* Hero */}
          <div className="space-y-6 max-w-md">
            <h1 className="text-display text-text-primary leading-tight">
              Graph-Augmented<br />Test Retrieval
            </h1>
            <p className="text-text-secondary text-lg leading-relaxed">
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
                  className="flex items-center gap-3 p-3 bg-surface-elevated border border-border rounded-md"
                >
                  <Icon className="w-5 h-5 text-accent" />
                  <span className="text-sm text-text-primary">{feature.label}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Trust badges */}
        <div className="flex items-center gap-6 text-sm text-text-muted">
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
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-sm space-y-8">
          {/* Mobile Logo */}
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <div className="w-10 h-10 bg-accent rounded-md flex items-center justify-center">
              <Database className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-semibold text-text-primary tracking-tight">GATeR</span>
          </div>

          {/* Card */}
          <div className="gater-card p-8">
            <div className="space-y-6">
              <div className="space-y-2 text-center">
                <h2 className="text-xl font-semibold text-text-primary">Sign in to continue</h2>
                <p className="text-sm text-text-muted">
                  Access your repositories and start analyzing
                </p>
              </div>

              <button
                onClick={() => signIn('github', { callbackUrl: '/' })}
                className="w-full flex items-center justify-center gap-3 bg-white text-black font-medium py-3 px-4 rounded-md hover:bg-zinc-100 transition-colors"
              >
                <GithubIcon />
                Continue with GitHub
              </button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="px-2 bg-surface text-text-muted">Why GitHub?</span>
                </div>
              </div>

              <ul className="space-y-3 text-sm text-text-secondary">
                <li className="flex items-start gap-2">
                  <ChevronRight className="w-4 h-4 text-accent mt-0.5 flex-shrink-0" />
                  <span>Access public and private repositories</span>
                </li>
                <li className="flex items-start gap-2">
                  <ChevronRight className="w-4 h-4 text-accent mt-0.5 flex-shrink-0" />
                  <span>Analyze commits, PRs, and issues</span>
                </li>
                <li className="flex items-start gap-2">
                  <ChevronRight className="w-4 h-4 text-accent mt-0.5 flex-shrink-0" />
                  <span>No data stored – analyze on demand</span>
                </li>
              </ul>
            </div>
          </div>

          <p className="text-xs text-text-muted text-center">
            By signing in, you agree to our{' '}
            <a href="#" className="text-accent hover:underline">Terms</a>
            {' '}and{' '}
            <a href="#" className="text-accent hover:underline">Privacy Policy</a>
          </p>
        </div>
      </div>
    </div>
  );
}
