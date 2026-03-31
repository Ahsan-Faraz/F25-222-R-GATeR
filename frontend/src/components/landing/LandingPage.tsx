// Minimal Landing Page to test
import React from 'react';
import { signIn } from 'next-auth/react';
import { Database } from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center">
      <div className="text-center">
        <Database className="w-16 h-16 mx-auto mb-4 text-blue-500" />
        <h1 className="text-4xl font-bold mb-4">GATeR</h1>
        <p className="text-zinc-400 mb-8">Graph-Augmented Test Repair</p>
        <button
          onClick={() => signIn('github')}
          className="bg-white text-black px-6 py-3 rounded-lg font-semibold hover:bg-zinc-100 transition-colors"
        >
          Sign In with GitHub
        </button>
      </div>
    </div>
  );
}