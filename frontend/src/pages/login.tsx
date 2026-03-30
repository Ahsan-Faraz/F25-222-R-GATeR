import React, { useEffect } from 'react';
import { useSession, signIn } from 'next-auth/react';
import { useRouter } from 'next/router';
import { motion } from 'framer-motion';
import GlassCard from '@/components/ui/GlassCard';
import Button from '@/components/ui/Button';
import { GitBranch, Lock, Zap, Shield, Database, Network } from 'lucide-react';

const GithubIcon = () => (
  <svg className="w-5 h-5 mr-3" fill="currentColor" viewBox="0 0 24 24">
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
      <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg)]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--color-cyan)] mx-auto"></div>
      </div>
    );
  }

  const features = [
    {
      icon: GitBranch,
      title: "Repository Analysis",
      description: "Deep code understanding through knowledge graphs"
    },
    {
      icon: Database,
      title: "Vector Search",
      description: "AI-powered semantic test case retrieval"
    },
    {
      icon: Network,
      title: "Graph Exploration",
      description: "Interactive knowledge graph visualization"
    },
    {
      icon: Zap,
      title: "Fast Test Repair",
      description: "Automated test fixing with RAG technology"
    }
  ];

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0B2E33] px-4 py-12 relative overflow-hidden">
      {/* Animated background blobs with varied colors */}
      <div className="absolute top-0 left-0 w-96 h-96 bg-[#4F7C82] opacity-10 blur-[120px] rounded-full"></div>
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-[#B8E3E9] opacity-10 blur-[120px] rounded-full"></div>
      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-[#D4A574] opacity-5 blur-[100px] rounded-full"></div>
      
      <div className="max-w-6xl w-full grid lg:grid-cols-2 gap-8 items-center relative z-10">
        {/* Left side - Branding & Features */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6 }}
          className="space-y-8"
        >
          {/* Logo and Title */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-[#4F7C82] to-[#B8E3E9] rounded-xl flex items-center justify-center shadow-lg">
                <Database className="w-7 h-7 text-white" />
              </div>
              <div>
                <h1 className="text-5xl font-display font-bold text-white tracking-wide">
                  GATeR
                </h1>
                <p className="text-[#D4A574] text-sm tracking-widest font-semibold">WORKSPACE</p>
              </div>
            </div>
            
            <h2 className="text-3xl font-bold text-[#B8E3E9] leading-tight">
              Graph-Augmented Test-case Retrieval
            </h2>
            <p className="text-[#B8E3E9] text-lg leading-relaxed">
              AI-powered test repair using knowledge graphs and semantic search. Connect your repository to get started.
            </p>
          </div>

          {/* Features Grid */}
          <div className="grid grid-cols-2 gap-4">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              const colors = [
                { bg: 'rgba(79,124,130,0.2)', border: 'rgba(184,227,233,0.3)', icon: '#B8E3E9' },
                { bg: 'rgba(212,165,116,0.2)', border: 'rgba(212,165,116,0.3)', icon: '#D4A574' },
                { bg: 'rgba(79,124,130,0.15)', border: 'rgba(184,227,233,0.25)', icon: '#93B1B5' },
                { bg: 'rgba(212,165,116,0.15)', border: 'rgba(232,212,184,0.25)', icon: '#E8D4B8' }
              ];
              const color = colors[index % 4];
              
              return (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                  className="rounded-xl p-4 backdrop-blur-md"
                  style={{ 
                    background: color.bg,
                    border: `1px solid ${color.border}`
                  }}
                >
                  <Icon className="w-6 h-6 mb-2" style={{ color: color.icon }} />
                  <h3 className="text-white font-semibold text-sm mb-1">{feature.title}</h3>
                  <p className="text-[#B8E3E9] text-xs leading-relaxed">{feature.description}</p>
                </motion.div>
              );
            })}
          </div>

          {/* Trust Badges */}
          <div className="flex items-center gap-4 pt-4">
            <div className="flex items-center gap-2 text-[#B8E3E9] text-sm">
              <Shield className="w-4 h-4 text-[#D4A574]" />
              <span>Secure OAuth</span>
            </div>
            <div className="flex items-center gap-2 text-[#B8E3E9] text-sm">
              <Lock className="w-4 h-4 text-[#D4A574]" />
              <span>Private Repos Supported</span>
            </div>
          </div>
        </motion.div>

        {/* Right side - Login Card */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <GlassCard className="p-10 border-2 border-[rgba(184,227,233,0.3)] shadow-2xl relative overflow-hidden">
            {/* Glow effects with varied colors */}
            <div className="absolute top-0 right-0 w-40 h-40 bg-[#4F7C82] opacity-20 blur-[60px]"></div>
            <div className="absolute bottom-0 left-0 w-40 h-40 bg-[#D4A574] opacity-15 blur-[60px]"></div>
            
            <div className="text-center space-y-6 relative z-10">
              {/* Card Header */}
              <div className="space-y-2">
                <div className="inline-block px-4 py-1 bg-[rgba(79,124,130,0.3)] border border-[rgba(184,227,233,0.4)] rounded-full">
                  <span className="text-[#B8E3E9] text-xs font-semibold tracking-wide">AUTHENTICATION REQUIRED</span>
                </div>
                <h2 className="text-2xl font-bold text-white">Sign In to Dashboard</h2>
                <p className="text-[#B8E3E9] text-sm leading-relaxed">
                  Access your repositories and start analyzing test cases with AI-powered insights
                </p>
              </div>

              {/* GitHub Sign In Button */}
              <div className="pt-4">
                <Button
                  onClick={() => signIn('github', { callbackUrl: '/' })}
                  className="w-full bg-gradient-to-r from-[#4F7C82] to-[#3a5e64] text-white hover:from-[#5a8b93] hover:to-[#4F7C82] border-2 border-[rgba(184,227,233,0.4)] hover:border-[#B8E3E9] shadow-lg hover:shadow-[0_0_30px_rgba(184,227,233,0.4)] transition-all duration-300 py-4 text-base font-semibold"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <GithubIcon />
                  Continue with GitHub
                </Button>
              </div>

              {/* Why GitHub Section */}
              <div className="pt-6 space-y-3 border-t border-[rgba(184,227,233,0.2)]">
                <p className="text-[#D4A574] text-xs font-semibold tracking-wide">WHY GITHUB?</p>
                <div className="space-y-2">
                  <div className="flex items-start gap-2 text-left">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#B8E3E9] mt-1.5 flex-shrink-0"></div>
                    <p className="text-[#B8E3E9] text-xs">Access both public and private repositories securely</p>
                  </div>
                  <div className="flex items-start gap-2 text-left">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#D4A574] mt-1.5 flex-shrink-0"></div>
                    <p className="text-[#B8E3E9] text-xs">Analyze commits, PRs, and issues for comprehensive insights</p>
                  </div>
                  <div className="flex items-start gap-2 text-left">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#B8E3E9] mt-1.5 flex-shrink-0"></div>
                    <p className="text-[#B8E3E9] text-xs">No data stored - we only analyze what you authorize</p>
                  </div>
                </div>
              </div>
              
              {/* Footer */}
              <p className="text-xs text-[rgba(184,227,233,0.5)] pt-4">
                By signing in, you agree to our{' '}
                <a href="#" className="text-[#D4A574] hover:text-[#E8D4B8] hover:underline">Terms of Service</a>
                {' '}and{' '}
                <a href="#" className="text-[#D4A574] hover:text-[#E8D4B8] hover:underline">Privacy Policy</a>
              </p>
            </div>
          </GlassCard>
        </motion.div>
      </div>
    </div>
  );
}
