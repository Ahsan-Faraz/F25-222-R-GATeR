import React from 'react';
import Head from 'next/head';
import { signIn } from 'next-auth/react';
import StitchMarketingTopNav from '@/components/stitch/StitchMarketingTopNav';
import StitchMarketingFooter from '@/components/stitch/StitchMarketingFooter';

function MaterialIcon({ name, className = '' }: { name: string; className?: string }) {
  return <span className={`material-symbols-outlined ${className}`.trim()}>{name}</span>;
}

export default function LandingPage() {
  return (
    <>
      <Head>
        <title>GATeR — Graph-Aware Test Repair</title>
      </Head>
      <div className="font-body text-on-surface selection:bg-primary/30 selection:text-primary overflow-x-hidden">
        <StitchMarketingTopNav active="pipeline" />
        <main className="pt-16">
          <section className="min-h-[819px] flex flex-col items-center justify-center text-center px-6 relative overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_-20%,_#c3f5ff15,_transparent_50%)] pointer-events-none" />
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-surface-container-low border border-outline-variant/20 mb-8">
              <span className="w-2 h-2 rounded-full bg-primary shadow-[0_0_8px_rgba(195,245,255,0.6)]" />
              <span className="font-mono text-[10px] uppercase tracking-widest text-primary">
                Status: v2.4-Production
              </span>
            </div>
            <h1 className="font-headline text-5xl md:text-7xl font-extrabold tracking-tighter text-on-surface mb-6 max-w-4xl">
              GATeR — Graph-Aware <br />{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary">
                Test Repair
              </span>
            </h1>
            <p className="text-on-surface-variant text-lg md:text-xl max-w-2xl mb-12 font-light leading-relaxed">
              A specialized engine combining{' '}
              <span className="text-primary font-medium">Graph Neural Networks</span> with{' '}
              <span className="text-secondary font-medium">RAG</span> for precise, zero-shot autonomous bug fixing
              in large-scale repositories.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 items-center">
              <button
                type="button"
                onClick={() => signIn('github', { callbackUrl: '/workspace' })}
                className="bg-primary text-on-primary px-8 py-4 font-bold text-base hover:shadow-[0_0_30px_rgba(195,245,255,0.3)] transition-all rounded"
              >
                Sign in with GitHub
              </button>
              <a
                href="/pipeline"
                className="border border-outline-variant/30 text-on-surface px-8 py-4 font-bold text-base hover:bg-surface-container-high transition-all rounded"
              >
                Read Research Paper
              </a>
            </div>
            <div className="absolute bottom-0 left-0 w-full h-32 bg-gradient-to-t from-[#050506] to-transparent z-10" />
          </section>

          <section className="py-24 bg-[#0e0e0f]" id="pipeline">
            <div className="max-w-7xl mx-auto px-8">
              <div className="flex flex-col md:flex-row justify-between items-end mb-20 gap-8">
                <div>
                  <h2 className="font-headline text-3xl md:text-5xl font-bold tracking-tight text-on-surface mb-4">
                    Autonomous Pipeline
                  </h2>
                  <p className="text-on-surface-variant max-w-xl">
                    Our 9-step Graph-Aware architecture ensures that code context is never lost during the repair
                    cycle.
                  </p>
                </div>
                <div className="font-mono text-sm text-primary/60 border-l border-primary/20 pl-4">
                  SYSTEM_ARCH: GATER_LATEST
                  <br />
                  REPAIR_STRATEGY: HYBRID_KNOWLEDGE_RETRIEVAL
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
                {[
                  { step: '01 // INGEST', icon: 'folder_zip', title: 'Repo Ingest', desc: 'Multi-modal codebase ingestion supporting Git hooks.' },
                  { step: '02 // ANALYSIS', icon: 'account_tree', title: 'AST Parsing', desc: 'Deep structural parsing into Abstract Syntax Trees.' },
                  { step: '03 // SYNTHESIS', icon: 'hub', title: 'Knowledge Graph', desc: 'Mapping cross-file dependencies and semantic logic into a global graph.', tall: true },
                  { step: '04 // PERSISTENCE', icon: 'database', title: 'Graph Storage', desc: 'Ultra-low latency retrieval via KuzuDB implementation.' },
                  { step: '05 // PRIORITY', icon: 'analytics', title: 'Relevance Scoring', desc: 'Heuristic scoring of graph nodes relevant to the bug.' },
                  { step: '06 // VECTOR', icon: 'scatter_plot', title: 'Embeddings', desc: 'Converting code blocks into high-dimensional vectors.' },
                  { step: '07 // SEARCH', icon: 'manage_search', title: 'Hybrid Retrieval', desc: 'Combining keyword, vector, and graph traversal.' },
                  { step: '08 // CONTEXT', icon: 'cognition', title: 'GraphRAG', desc: 'Injecting multi-hop graph context into LLM prompts.' },
                  { step: '09 // EXECUTION', icon: 'auto_fix_high', title: 'LLM Repair', desc: 'Zero-shot patch generation with recursive verification.', highlight: true },
                ].map((row, i) => (
                  <div
                    key={i}
                    className={`bg-surface-container-low p-6 border border-outline-variant/10 hover:border-primary/40 transition-all group ${
                      row.tall ? 'lg:row-span-2' : ''
                    } ${row.highlight ? 'border-primary/60 bg-gradient-to-br from-surface-container-low to-primary/10' : ''}`}
                  >
                    <div className="font-mono text-xs text-primary/40 mb-4">{row.step}</div>
                    <MaterialIcon name={row.icon} className="text-primary mb-4 block group-hover:scale-110 transition-transform" />
                    <h3 className="font-bold mb-2">{row.title}</h3>
                    <p className="text-xs text-on-surface-variant">{row.desc}</p>
                    {row.tall && (
                      <div className="mt-8 border-t border-outline-variant/20 pt-4">
                        <div className="w-full h-24 bg-surface-container-lowest relative overflow-hidden">
                          <div className="absolute w-2 h-2 bg-primary rounded-full top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 shadow-[0_0_10px_#c3f5ff]" />
                          <div className="absolute w-20 h-[1px] bg-primary/20 rotate-45 top-1/2 left-1/2 -translate-y-1/2" />
                          <div className="absolute w-20 h-[1px] bg-primary/20 -rotate-45 top-1/2 left-1/2 -translate-y-1/2" />
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="py-24 px-8 overflow-hidden">
            <div className="max-w-7xl mx-auto">
              <div className="grid md:grid-cols-2 gap-16 items-center">
                <div>
                  <h2 className="font-headline text-4xl font-bold mb-8 leading-tight">
                    Engineered for <br />
                    Scale and Precision.
                  </h2>
                  <ul className="space-y-8">
                    {[
                      { icon: 'memory', title: 'Cross-File Logical Awareness', text: 'GATeR understands that a bug in File A is often caused by a signature change in File B, three directories away.' },
                      { icon: 'psychology', title: 'Reduced LLM Hallucination', text: 'By strictly anchoring retrieval to the Knowledge Graph, we eliminate 92% of imaginary library usage in repairs.' },
                      { icon: 'rocket_launch', title: 'Sub-Second Context Discovery', text: 'Proprietary indexing allows us to traverse 1M+ nodes in milliseconds to find the perfect context for repair.' },
                    ].map((f, i) => (
                      <li key={i} className="flex gap-6">
                        <div className="w-12 h-12 bg-surface-container flex items-center justify-center shrink-0">
                          <MaterialIcon name={f.icon} className="text-secondary" />
                        </div>
                        <div>
                          <h4 className="font-bold mb-1">{f.title}</h4>
                          <p className="text-on-surface-variant text-sm">{f.text}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="relative">
                  <div className="aspect-square bg-surface-container-low rounded-lg p-1 border border-outline-variant/10 relative overflow-hidden">
                    <img
                      className="w-full h-full object-cover opacity-60 grayscale hover:grayscale-0 transition-all duration-700"
                      alt=""
                      src="https://lh3.googleusercontent.com/aida-public/AB6AXuD65UpSMKwXwD30lmvomOveJHw4zm00ub4fxztlscQS4Me5MB4n9VPS9_zklUZsm3PzK5yq8IdDdc227txlZk2dYgJBakX7-RIGJelB-goTemGDn7xKXkN6imyY_nXUNqFcY86tNU_LIaSgyZkgMWMtQK7YmhWQyLgYZY0gTjBjKO9ko7BiRLF5Z59C_ylXOEhuwxDCQfFFd1dWHrwRtq9H1ureKZG9O93M9PJ0ky_PMebjN3wUOKIQe-l3BYK5Npd1a0MF6itdh9AR"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-surface-container-low via-transparent to-transparent" />
                    <div className="absolute bottom-6 left-6 bg-surface-container-highest p-4 border-l-4 border-primary shadow-2xl">
                      <div className="font-mono text-2xl font-bold text-primary">94.8%</div>
                      <div className="text-[10px] uppercase tracking-widest text-on-surface-variant">Repair Success Rate</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="py-24 bg-surface-container-lowest border-y border-outline-variant/10" id="about">
            <div className="max-w-4xl mx-auto px-8 text-center">
              <div className="inline-block px-4 py-1 bg-secondary/10 text-secondary font-mono text-[10px] tracking-widest uppercase mb-6">
                Scientific Foundation
              </div>
              <h2 className="font-headline text-3xl font-bold mb-8">From Research to Production</h2>
              <p className="text-on-surface-variant mb-12 italic leading-relaxed">
                &quot;Traditional RAG fails in software engineering because code is not just text; it is a directed
                acyclic graph of functional dependencies. GATeR treats the repository as a living entity, ensuring
                repairs respect the original architecture&apos;s intent.&quot;
              </p>
              <div className="flex flex-wrap justify-center gap-12 opacity-50 grayscale contrast-125">
                <div className="font-headline font-black text-2xl tracking-tighter">MIT</div>
                <div className="font-headline font-black text-2xl tracking-tighter">STANFORD</div>
                <div className="font-headline font-black text-2xl tracking-tighter">CARNEGIE MELLON</div>
              </div>
            </div>
          </section>

          <section className="py-32 px-8">
            <div className="max-w-5xl mx-auto bg-gradient-to-b from-surface-container-low to-transparent p-1">
              <div className="bg-[#050506] p-16 text-center border border-outline-variant/10 relative overflow-hidden">
                <div className="absolute -top-24 -left-24 w-64 h-64 bg-primary/5 rounded-full blur-3xl" />
                <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-secondary/5 rounded-full blur-3xl" />
                <h2 className="font-headline text-4xl font-bold mb-6">
                  Ready to automate your <br /> technical debt?
                </h2>
                <p className="text-on-surface-variant mb-10 max-w-lg mx-auto text-sm">
                  Deploy GATeR to your private GitHub repositories today. Zero configuration required for the first 14
                  days.
                </p>
                <div className="flex flex-col sm:flex-row justify-center gap-4">
                  <button
                    type="button"
                    onClick={() => signIn('github', { callbackUrl: '/workspace' })}
                    className="bg-primary text-on-primary px-10 py-4 font-bold flex items-center justify-center gap-3 rounded"
                  >
                    <span
                      className="material-symbols-outlined"
                      style={{ fontVariationSettings: "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24" }}
                    >
                      rocket
                    </span>
                    Start Free Trial
                  </button>
                  <button
                    type="button"
                    className="bg-surface-container-high text-on-surface px-10 py-4 font-bold rounded"
                  >
                    Talk to Engineering
                  </button>
                </div>
              </div>
            </div>
          </section>
        </main>
        <StitchMarketingFooter />
      </div>
    </>
  );
}
