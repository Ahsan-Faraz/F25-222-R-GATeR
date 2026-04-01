import React from 'react';
import Head from 'next/head';
import { signIn } from 'next-auth/react';
import StitchMarketingFooter from '@/components/stitch/StitchMarketingFooter';

function MaterialIcon({ name, className = '' }: { name: string; className?: string }) {
  return <span className={`material-symbols-outlined ${className}`.trim()}>{name}</span>;
}

export default function PipelinePage() {
  return (
    <>
      <Head>
        <title>GATeR | Pipeline Deep Dive</title>
      </Head>
      <div className="bg-background text-on-background font-body selection:bg-primary selection:text-on-primary">
        <nav className="bg-surface dark:bg-[#131315] flex justify-between items-center px-8 h-16 w-full fixed top-0 z-50 font-headline tracking-tight">
          <a href="/landing" className="text-xl font-bold tracking-tighter text-[#e5e1e3]">
            GATeR
          </a>
          <div className="hidden md:flex items-center gap-8">
            <span className="text-primary border-b-2 border-primary pb-1">Pipeline</span>
            <a className="text-on-surface/70 hover:text-primary transition-colors" href="/landing#about">
              About
            </a>
          </div>
          <button
            type="button"
            onClick={() => signIn('github', { callbackUrl: '/workspace' })}
            className="bg-gradient-to-r from-primary to-primary-container text-on-primary px-5 py-2 rounded font-semibold text-sm hover:opacity-90 transition-all active:scale-95"
          >
            Sign In with GitHub
          </button>
        </nav>

        <main className="pt-32 pb-24 px-6 md:px-12 max-w-7xl mx-auto flex flex-col md:flex-row gap-12">
          <aside className="hidden md:block w-64 shrink-0 h-fit sticky top-32">
            <div className="border-l border-outline-variant/20 ml-4 py-4 space-y-6">
              {[
                'Ingestion',
                'AST Extraction',
                'KG Mapping',
                'Semantic Linkage',
                'Fault Localization',
                'Graph Search',
                'Candidate Gen',
                'Validation',
                'Export',
              ].map((label, i) => (
                <div
                  key={label}
                  className={`relative flex items-center gap-4 pl-6 ${
                    i === 0 ? 'group cursor-pointer' : 'group cursor-pointer opacity-40 hover:opacity-100 transition-opacity'
                  }`}
                >
                  <div
                    className={`absolute -left-[5px] w-2 h-2 rounded-full ${
                      i === 0 ? 'bg-primary shadow-[0_0_8px_rgba(195,245,255,0.6)]' : 'bg-outline-variant'
                    }`}
                  />
                  <span className={`text-xs font-mono ${i === 0 ? 'text-primary' : ''}`}>
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span className={`text-sm font-medium ${i === 0 ? 'text-on-surface' : ''}`}>{label}</span>
                </div>
              ))}
            </div>
          </aside>

          <div className="flex-1 space-y-24">
            <header className="space-y-4">
              <h1 className="text-5xl font-extrabold font-headline tracking-tighter text-on-surface">The Pipeline Deep Dive</h1>
              <p className="text-xl text-on-surface-variant max-w-2xl leading-relaxed">
                Explore the modular, high-precision engine driving GATeR. From raw repository ingestion to graph-aware
                automated repair.
              </p>
            </header>

            <section className="space-y-8 group" id="step-01">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded bg-surface-container-high flex items-center justify-center text-primary border border-outline-variant/20 shadow-[0_0_15px_rgba(0,218,243,0.1)]">
                  <MaterialIcon name="folder_open" />
                </div>
                <div>
                  <span className="text-xs font-mono text-secondary uppercase tracking-widest">Phase 01</span>
                  <h2 className="text-3xl font-bold text-on-surface">Repository Ingestion</h2>
                </div>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="space-y-6">
                  <p className="text-on-surface-variant leading-relaxed">
                    The journey begins with the deep scanning of your codebase. GATeR connects to GitHub, GitLab, or
                    local directories to index source files, configuration manifests, and dependency locks.
                  </p>
                  <div className="p-6 bg-surface-container-lowest border border-outline-variant/10 rounded-lg">
                    <h4 className="text-sm font-bold text-on-surface mb-3 flex items-center gap-2">
                      <MaterialIcon name="list" className="!text-xs" /> Key Capabilities
                    </h4>
                    <ul className="space-y-2 text-sm text-on-surface-variant font-medium">
                      <li className="flex items-start gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5" />
                        Sparse checkout optimization for massive monorepos.
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5" />
                        Automatic environment detection and lockfile parsing.
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5" />
                        Incremental diff analysis for CI/CD efficiency.
                      </li>
                    </ul>
                  </div>
                </div>
                <div className="relative aspect-video rounded-xl overflow-hidden border border-outline-variant/20 bg-surface-container">
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-secondary/5" />
                  <div className="absolute inset-0 flex flex-col items-center justify-center p-8">
                    <div className="w-full h-full bg-[#0e0e0f] rounded-lg p-4 font-mono text-[10px] text-primary-container/60 overflow-hidden select-none">
                      <div>$ gater-cli ingest --source=./project-x</div>
                      <div className="text-secondary/60">[INFO] Scanning files...</div>
                      <div className="text-on-surface/40">index.ts (1.2kb)</div>
                      <div className="text-on-surface/40">utils/math.py (4.5kb)</div>
                      <div className="text-on-surface/40">pkg/core_test.go (12kb)</div>
                      <div className="text-primary mt-2">✔ Found 412 candidates</div>
                      <div className="text-secondary mt-1">Starting AST mapping...</div>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section className="space-y-8 border-t border-outline-variant/10 pt-16" id="step-02">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded bg-surface-container-high flex items-center justify-center text-primary border border-outline-variant/20">
                  <MaterialIcon name="account_tree" />
                </div>
                <div>
                  <span className="text-xs font-mono text-secondary uppercase tracking-widest">Phase 02</span>
                  <h2 className="text-3xl font-bold text-on-surface">AST &amp; Dependency Extraction</h2>
                </div>
              </div>
              <div className="bg-surface-container-low p-8 rounded-xl border border-outline-variant/15 flex flex-col md:flex-row gap-8 items-center">
                <div className="flex-1 space-y-4">
                  <p className="text-on-surface-variant">
                    We decompose the source code into language-agnostic Abstract Syntax Trees (AST). This allows GATeR
                    to understand logic structures, scoping, and data-flow regardless of the programming language.
                  </p>
                  <button type="button" className="text-primary text-sm font-bold flex items-center gap-1 hover:underline">
                    View Mapping Specs <MaterialIcon name="arrow_forward" className="!text-sm" />
                  </button>
                </div>
                <div className="w-full md:w-1/3 h-32 bg-surface-container-highest rounded-lg flex items-center justify-center overflow-hidden">
                  <img
                    alt=""
                    className="w-full h-full object-cover opacity-50 grayscale hover:grayscale-0 transition-all duration-700"
                    src="https://lh3.googleusercontent.com/aida-public/AB6AXuCOCetA3sZN8dQNcyJYqLEY2fBmoTpA1iHy326vR0TQeLasYnaby0HmSxhwxc_qtb8EFBkLY5dCUXRVp5ohbr0kgYSQrdFwOYyLZf0DwdU6cbvkRL_G-sKCHdboiDaqMPUxkTicDH39Dn2HXeVhZwodlVO0kQyTMYXjP9XXezYWkz4BJMuXMIrSqF3yMITgHqV2BBKScqE_OOFlkHAjhX0QcduKsuYcSvs_14Irk_RZ0r3xQ3InGWi6CzeVOaWz7zw90TcEiTKik9yr"
                  />
                </div>
              </div>
            </section>

            <section className="space-y-8 border-t border-outline-variant/10 pt-16" id="step-03">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded bg-surface-container-high flex items-center justify-center text-primary border border-outline-variant/20">
                  <MaterialIcon name="hub" />
                </div>
                <div>
                  <span className="text-xs font-mono text-secondary uppercase tracking-widest">Phase 03</span>
                  <h2 className="text-3xl font-bold text-on-surface">Knowledge Graph Mapping</h2>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[
                  { icon: 'data_object', title: 'Entity Resolution', text: 'Identifying variables, functions, and modules as unique nodes in a persistent graph.' },
                  { icon: 'mediation', title: 'Relation Mapping', text: 'Defining how nodes interact—calls, inheritance, imports, and state mutations.' },
                  { icon: 'schema', title: 'Cross-Reference', text: 'Linking internal code logic to external documentation and library signatures.' },
                ].map((c) => (
                  <div key={c.title} className="bg-surface-container-lowest p-6 rounded border border-outline-variant/10">
                    <div className="text-secondary mb-4">
                      <MaterialIcon name={c.icon} />
                    </div>
                    <h4 className="font-bold mb-2">{c.title}</h4>
                    <p className="text-sm text-on-surface-variant">{c.text}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="bg-surface-container-lowest border border-outline-variant/10 rounded-2xl p-12 overflow-hidden relative" id="steps-summary">
              <div className="absolute top-0 right-0 p-8 opacity-10">
                <MaterialIcon name="build" className="!text-[12rem]" />
              </div>
              <div className="relative z-10 space-y-12">
                <div className="max-w-xl">
                  <h2 className="text-4xl font-bold mb-6">The Automated Repair Cycle</h2>
                  <p className="text-on-surface-variant text-lg leading-relaxed">
                    Following KG construction, the pipeline moves into high-speed iterations. Faults are localized within
                    the graph, candidate patches are synthesized using multi-modal LLMs, and every fix is validated
                    against the original test suite.
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-12">
                  {[
                    { t: '05 - Fault Localization', p: 'Using spectrum-based analysis and graph centrality to pinpoint root causes.' },
                    { t: '07 - Candidate Generation', p: 'Context-aware patch generation using our specialized KGCompass engine.' },
                    { t: '09 - Export & PR', p: 'Verified fixes are packaged into Pull Requests with full rationalization reports.' },
                  ].map((x) => (
                    <div key={x.t} className="space-y-4">
                      <h3 className="text-primary font-mono text-sm">{x.t}</h3>
                      <p className="text-sm text-on-surface/80">{x.p}</p>
                    </div>
                  ))}
                </div>
                <div className="pt-8 flex flex-col sm:flex-row gap-4">
                  <button
                    type="button"
                    onClick={() => signIn('github', { callbackUrl: '/workspace' })}
                    className="bg-primary text-on-primary px-8 py-4 rounded-lg font-bold hover:scale-105 transition-transform"
                  >
                    Start Deep Dive Session
                  </button>
                  <button
                    type="button"
                    className="bg-transparent border border-outline-variant/20 text-on-surface px-8 py-4 rounded-lg font-bold hover:bg-surface-container-low transition-colors"
                  >
                    Download Pipeline Whitepaper
                  </button>
                </div>
              </div>
            </section>
          </div>
        </main>

        <footer className="bg-[#131315] w-full border-t border-[#e5e1e3]/10 flex flex-col md:flex-row justify-between items-center px-12 py-8 font-label text-xs uppercase tracking-widest mt-24">
          <div className="text-on-surface/40">© 2024 GATeR Systems. Precision Built.</div>
          <div className="flex gap-8 mt-6 md:mt-0">
            <a className="text-on-surface/40 hover:text-on-surface transition-colors" href="#">
              Documentation
            </a>
            <a className="text-on-surface/40 hover:text-on-surface transition-colors" href="#">
              API
            </a>
            <a className="text-on-surface/40 hover:text-on-surface transition-colors" href="#">
              Privacy
            </a>
            <a className="text-on-surface/40 hover:text-on-surface transition-colors" href="#">
              Terms
            </a>
          </div>
        </footer>
      </div>
    </>
  );
}
