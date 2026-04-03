import React, { useCallback, useEffect, useState } from 'react';
import Head from 'next/head';
import { signIn } from 'next-auth/react';
import StitchMarketingTopNav from '@/components/stitch/StitchMarketingTopNav';
import StitchMarketingFooter from '@/components/stitch/StitchMarketingFooter';
import MaterialIcon from '@/components/ui/MaterialIcon';

/**
 * Stitch screen `007b0af1d8e14f93a3fabd06798c4480` — Pipeline Deep Dive.
 * Nine steps + summary; sidebar syncs to scroll via IntersectionObserver.
 */

const PIPELINE_STEPS = [
  'Ingestion',
  'AST Extraction',
  'KG Mapping',
  'Semantic Linkage',
  'Fault Localization',
  'Graph Search',
  'Candidate Gen',
  'Validation',
  'Export',
] as const;

const SECTION_IDS = [
  'step-01',
  'step-02',
  'step-03',
  'step-04',
  'step-05',
  'step-06',
  'step-07',
  'step-08',
  'step-09',
  'steps-summary',
] as const;

export default function PipelinePage() {
  /** Active sidebar index 0–8 while in steps 1–9; stays 8 when summary is in view. */
  const [activeStepIndex, setActiveStepIndex] = useState(0);

  const scrollToSection = useCallback((index: number) => {
    const id =
      index < 9
        ? `step-${String(index + 1).padStart(2, '0')}`
        : 'steps-summary';
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  useEffect(() => {
    const elements = SECTION_IDS.map((id) => document.getElementById(id)).filter(
      (el): el is HTMLElement => el != null
    );
    if (elements.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const intersecting = entries.filter((e) => e.isIntersecting);
        if (intersecting.length === 0) return;
        const best = intersecting.reduce((a, b) =>
          a.intersectionRatio >= b.intersectionRatio ? a : b
        );
        const id = best.target.id;
        if (id === 'steps-summary') {
          setActiveStepIndex(8);
          return;
        }
        const m = id.match(/^step-(\d{2})$/);
        if (m) {
          const n = parseInt(m[1], 10);
          if (n >= 1 && n <= 9) setActiveStepIndex(n - 1);
        }
      },
      {
        root: null,
        rootMargin: '-12% 0px -45% 0px',
        threshold: [0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.35, 0.5, 0.75, 1],
      }
    );

    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <>
      <Head>
        <title>GATeR | Pipeline Deep Dive</title>
      </Head>
      <div className="bg-background text-on-background font-body selection:bg-primary selection:text-on-primary">
        <StitchMarketingTopNav active="pipeline" variant="marketing" />

        <main className="pt-32 pb-24 px-6 md:px-12 max-w-7xl mx-auto flex flex-col md:flex-row gap-12">
          <aside className="hidden md:block w-64 shrink-0 h-fit sticky top-32 self-start">
            <nav
              className="border-l border-outline-variant/20 ml-4 py-4 space-y-1"
              aria-label="Pipeline steps"
            >
              {PIPELINE_STEPS.map((label, i) => {
                const active = activeStepIndex === i;
                return (
                  <button
                    key={label}
                    type="button"
                    onClick={() => scrollToSection(i)}
                    className={`relative flex w-full items-center gap-4 pl-6 py-2 text-left rounded-r-lg transition-all duration-300 ease-out cursor-pointer
                      ${active ? 'opacity-100' : 'opacity-40 hover:opacity-90'}`}
                  >
                    <span
                      className={`absolute -left-[5px] top-1/2 -translate-y-1/2 w-2 h-2 rounded-full transition-all duration-300 ${
                        active
                          ? 'bg-primary shadow-[0_0_8px_rgba(195,245,255,0.6)] scale-110'
                          : 'bg-outline-variant'
                      }`}
                    />
                    <span
                      className={`text-xs font-mono tabular-nums transition-colors duration-300 ${
                        active ? 'text-primary' : 'text-on-surface-variant'
                      }`}
                    >
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <span
                      className={`text-sm font-medium transition-colors duration-300 ${
                        active ? 'text-on-surface' : 'text-on-surface/80'
                      }`}
                    >
                      {label}
                    </span>
                  </button>
                );
              })}
            </nav>
          </aside>

          <div className="flex-1 space-y-24">
            <header className="space-y-4 scroll-mt-32">
              <h1 className="text-5xl font-extrabold font-headline tracking-tighter text-on-surface">
                The Pipeline Deep Dive
              </h1>
              <p className="text-xl text-on-surface-variant max-w-2xl leading-relaxed">
                Explore the modular, high-precision engine driving GATeR. From raw repository ingestion to graph-aware
                automated repair.
              </p>
            </header>

            {/* Step 01 */}
            <section className="space-y-8 scroll-mt-32 group" id="step-01">
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
                        <span className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                        Sparse checkout optimization for massive monorepos.
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                        Automatic environment detection and lockfile parsing.
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
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

            {/* Step 02 */}
            <section className="space-y-8 border-t border-outline-variant/10 pt-16 scroll-mt-32" id="step-02">
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
                  <button
                    type="button"
                    className="text-primary text-sm font-bold flex items-center gap-1 hover:underline"
                  >
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

            {/* Step 03 */}
            <section className="space-y-8 border-t border-outline-variant/10 pt-16 scroll-mt-32" id="step-03">
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
                  {
                    icon: 'data_object',
                    title: 'Entity Resolution',
                    text: 'Identifying variables, functions, and modules as unique nodes in a persistent graph.',
                  },
                  {
                    icon: 'mediation',
                    title: 'Relation Mapping',
                    text: 'Defining how nodes interact—calls, inheritance, imports, and state mutations.',
                  },
                  {
                    icon: 'schema',
                    title: 'Cross-Reference',
                    text: 'Linking internal code logic to external documentation and library signatures.',
                  },
                ].map((c) => (
                  <div
                    key={c.title}
                    className="bg-surface-container-lowest p-6 rounded border border-outline-variant/10 transition-colors hover:bg-surface-container-low"
                  >
                    <div className="text-secondary mb-4">
                      <MaterialIcon name={c.icon} />
                    </div>
                    <h4 className="font-bold mb-2 text-on-surface">{c.title}</h4>
                    <p className="text-sm text-on-surface-variant">{c.text}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* Step 04 — Semantic Linkage */}
            <section className="space-y-8 border-t border-outline-variant/10 pt-16 scroll-mt-32" id="step-04">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded bg-surface-container-high flex items-center justify-center text-primary border border-outline-variant/20">
                  <MaterialIcon name="scatter_plot" />
                </div>
                <div>
                  <span className="text-xs font-mono text-secondary uppercase tracking-widest">Phase 04</span>
                  <h2 className="text-3xl font-bold text-on-surface">Semantic Linkage</h2>
                </div>
              </div>
              <p className="text-on-surface-variant max-w-3xl leading-relaxed">
                CodeBERT-style embeddings align every graph entity with a dense vector. LanceDB stores tables for fast ANN
                search; each vector is linked back to its Kuzu node id so hybrid retrieval never loses structural context.
              </p>
              <div className="grid md:grid-cols-2 gap-6">
                <div className="p-6 rounded-lg border border-outline-variant/10 bg-surface-container-lowest">
                  <h4 className="text-sm font-bold text-on-surface mb-2">Embedding sync</h4>
                  <p className="text-sm text-on-surface-variant">
                    After analysis, entities are batched through the embedding service, normalized, and written to
                    versioned Lance tables with metadata for filtering by file, type, and repo.
                  </p>
                </div>
                <div className="p-6 rounded-lg border border-outline-variant/10 bg-surface-container-lowest">
                  <h4 className="text-sm font-bold text-on-surface mb-2">KG ↔ vector join</h4>
                  <p className="text-sm text-on-surface-variant">
                    Retrieval joins vector hits with graph neighborhoods so the LLM sees both similarity and dependency
                    paths—not either alone.
                  </p>
                </div>
              </div>
            </section>

            {/* Step 05 — Fault Localization */}
            <section className="space-y-8 border-t border-outline-variant/10 pt-16 scroll-mt-32" id="step-05">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded bg-surface-container-high flex items-center justify-center text-primary border border-outline-variant/20">
                  <MaterialIcon name="analytics" />
                </div>
                <div>
                  <span className="text-xs font-mono text-secondary uppercase tracking-widest">Phase 05</span>
                  <h2 className="text-3xl font-bold text-on-surface">Fault Localization</h2>
                </div>
              </div>
              <p className="text-on-surface-variant max-w-3xl leading-relaxed">
                Given a failing test and stack trace, GATeR scores graph nodes with spectrum-inspired signals and
                centrality on the dependency slice. The top band of entities feeds KGCompass relevance scoring.
              </p>
              <ul className="space-y-3 text-sm text-on-surface-variant max-w-2xl">
                <li className="flex gap-2">
                  <span className="text-primary font-mono">•</span>
                  Commit and blame metadata narrow time windows when GitHub artifacts are enabled.
                </li>
                <li className="flex gap-2">
                  <span className="text-primary font-mono">•</span>
                  Test-to-code edges in Kuzu prioritize methods that historically co-change with the failure.
                </li>
              </ul>
            </section>

            {/* Step 06 — Graph Search */}
            <section className="space-y-8 border-t border-outline-variant/10 pt-16 scroll-mt-32" id="step-06">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded bg-surface-container-high flex items-center justify-center text-primary border border-outline-variant/20">
                  <MaterialIcon name="manage_search" />
                </div>
                <div>
                  <span className="text-xs font-mono text-secondary uppercase tracking-widest">Phase 06</span>
                  <h2 className="text-3xl font-bold text-on-surface">Graph Search</h2>
                </div>
              </div>
              <p className="text-on-surface-variant max-w-3xl leading-relaxed">
                Hybrid retrieval combines constrained graph walks (multi-hop from seed nodes) with vector search and
                optional keyword filters. Path decay and relation types are tuned so deep paths do not drown precise
                local matches.
              </p>
              <div className="p-6 rounded-xl border border-outline-variant/15 bg-surface-container-low font-mono text-xs text-on-surface-variant overflow-x-auto">
                <div className="text-primary/90">POST /vectors/search</div>
                <div className="mt-2 text-on-surface/70">
                  {`{ "query": "...", "top_k": 20, "use_hybrid": true }`}
                </div>
              </div>
            </section>

            {/* Step 07 — Candidate Generation */}
            <section className="space-y-8 border-t border-outline-variant/10 pt-16 scroll-mt-32" id="step-07">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded bg-surface-container-high flex items-center justify-center text-primary border border-outline-variant/20">
                  <MaterialIcon name="auto_fix_high" />
                </div>
                <div>
                  <span className="text-xs font-mono text-secondary uppercase tracking-widest">Phase 07</span>
                  <h2 className="text-3xl font-bold text-on-surface">Candidate Generation</h2>
                </div>
              </div>
              <p className="text-on-surface-variant max-w-3xl leading-relaxed">
                GraphRAG packs entities, edges, and code snippets into a token-budgeted prompt. The local LLM (e.g.
                Ollama) proposes a patch with explicit references to retrieved context, reducing hallucinated APIs.
              </p>
              <div className="grid md:grid-cols-2 gap-6">
                <div className="p-6 rounded-lg border border-outline-variant/10 bg-surface-container-lowest">
                  <h4 className="text-sm font-bold text-on-surface mb-2">Context assembly</h4>
                  <p className="text-sm text-on-surface-variant">
                    Compression and aggregation steps collapse redundant hops while preserving failing-line adjacency.
                  </p>
                </div>
                <div className="p-6 rounded-lg border border-outline-variant/10 bg-surface-container-lowest">
                  <h4 className="text-sm font-bold text-on-surface mb-2">Strategy selection</h4>
                  <p className="text-sm text-on-surface-variant">
                    Repair strategy is recorded in the response for audit: graphrag_llm vs fallback paths.
                  </p>
                </div>
              </div>
            </section>

            {/* Step 08 — Validation */}
            <section className="space-y-8 border-t border-outline-variant/10 pt-16 scroll-mt-32" id="step-08">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded bg-surface-container-high flex items-center justify-center text-primary border border-outline-variant/20">
                  <MaterialIcon name="fact_check" />
                </div>
                <div>
                  <span className="text-xs font-mono text-secondary uppercase tracking-widest">Phase 08</span>
                  <h2 className="text-3xl font-bold text-on-surface">Validation</h2>
                </div>
              </div>
              <p className="text-on-surface-variant max-w-3xl leading-relaxed">
                Patches can be checked against the original test command, diff summaries, and compilation signals where
                available. Failures loop context back into retrieval for a second pass (project-dependent).
              </p>
            </section>

            {/* Step 09 — Export */}
            <section className="space-y-8 border-t border-outline-variant/10 pt-16 scroll-mt-32" id="step-09">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded bg-surface-container-high flex items-center justify-center text-primary border border-outline-variant/20">
                  <MaterialIcon name="download" />
                </div>
                <div>
                  <span className="text-xs font-mono text-secondary uppercase tracking-widest">Phase 09</span>
                  <h2 className="text-3xl font-bold text-on-surface">Export</h2>
                </div>
              </div>
              <p className="text-on-surface-variant max-w-3xl leading-relaxed">
                The workspace API exposes CSV, JSON, and JSONL exports of graph entities and relationships for offline
                review, paper experiments, or CI artifacts. Optional PR flows package verified fixes with rationale text.
              </p>
            </section>

            {/* Summary CTA */}
            <section
              className="bg-surface-container-lowest border border-outline-variant/10 rounded-2xl p-12 overflow-hidden relative scroll-mt-32"
              id="steps-summary"
            >
              <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
                <MaterialIcon name="build" className="!text-[12rem]" />
              </div>
              <div className="relative z-10 space-y-12">
                <div className="max-w-xl">
                  <h2 className="text-4xl font-bold mb-6 text-on-surface">The Automated Repair Cycle</h2>
                  <p className="text-on-surface-variant text-lg leading-relaxed">
                    Following KG construction, the pipeline moves into high-speed iterations. Faults are localized within
                    the graph, candidate patches are synthesized using multi-modal LLMs, and every fix is validated
                    against the original test suite.
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-12">
                  {[
                    {
                      t: '05 — Fault Localization',
                      p: 'Using spectrum-based analysis and graph centrality to pinpoint root causes.',
                    },
                    {
                      t: '07 — Candidate Generation',
                      p: 'Context-aware patch generation using our specialized KGCompass engine.',
                    },
                    {
                      t: '09 — Export & PR',
                      p: 'Verified fixes are packaged into Pull Requests with full rationalization reports.',
                    },
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

        <StitchMarketingFooter variant="marketing" />
      </div>
    </>
  );
}
