import React from 'react';
import RepoManager from '@/components/repo/RepoManager';
import DashboardBento from '@/components/DashboardBento';
import MaterialIcon from '@/components/ui/MaterialIcon';
import { useAppState } from '@/context/AppStateContext';

/** Matches Flask analysis pipeline (`useAnalysisProgress` TOTAL_STEPS = 6). */
const STITCH_STEPS = [
  { id: 1, title: 'Repository Added', desc: 'Repository registered with the workspace.' },
  { id: 2, title: 'Cloning / Updating', desc: 'Syncing source tree from Git or cache.' },
  { id: 3, title: 'Extracting Entities', desc: 'AST and symbol extraction for the KG.' },
  { id: 4, title: 'Building Knowledge Graph', desc: 'Loading nodes and edges into Kuzu.' },
  { id: 5, title: 'GitHub Artifacts', desc: 'Issues, PRs, and blame metadata (when enabled).' },
  { id: 6, title: 'Vector Embeddings', desc: 'Embedding code chunks for semantic search.' },
] as const;

/**
 * Stitch screen `ade1a70de8e44ec69174e3aa18ea125c` — Repository Analysis (workspace shell is external).
 */
export default function RepositoryAnalysisScreen() {
  const { analysisProgress, isAnalyzing, currentRepo } = useAppState();
  const step = analysisProgress?.step ?? 0;
  const pct = analysisProgress?.percentage ?? 0;
  const jobId = analysisProgress?.details?.job_id as string | undefined;

  const scrollToOps = () => {
    document.getElementById('gater-repo-operations')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="space-y-10 animate-fade-in">
      <DashboardBento />

      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <h1 className="font-headline text-4xl md:text-5xl font-extrabold tracking-tighter text-on-surface mb-2">
            Repository Analysis
          </h1>
          <p className="text-on-surface-variant max-w-xl text-sm leading-relaxed">
            Intelligent deep-code mapping and knowledge graph generation for architectural consistency and dependency
            tracking.
          </p>
        </div>
        <button
          type="button"
          onClick={scrollToOps}
          className="bg-primary hover:bg-primary-container text-on-primary px-6 py-3 rounded-lg font-bold transition-all active:scale-95 flex items-center gap-2 shrink-0"
        >
          <MaterialIcon name="add_circle" className="!text-[20px]" />
          START NEW ANALYSIS
        </button>
      </div>

      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 lg:col-span-4 space-y-6">
          <section className="bg-surface-container-lowest p-6 rounded-lg border-l-4 border-primary">
            <span className="block text-[10px] font-mono text-on-surface-variant/70 uppercase tracking-widest mb-4">
              Core Selection
            </span>
            <div className="space-y-4 text-sm">
              <div>
                <span className="text-xs text-on-surface-variant block mb-1.5">Active repository</span>
                <p className="font-mono text-on-surface bg-surface-container-high border border-outline-variant/20 rounded px-4 py-3">
                  {currentRepo ? `${currentRepo.owner}/${currentRepo.name}` : '— none selected —'}
                </p>
              </div>
              <div className="mt-8 pt-8 border-t border-outline-variant/10">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs text-on-surface-variant">Repository Health</span>
                  <span className="text-xs font-mono text-primary">{currentRepo ? 'Stable' : 'Idle'}</span>
                </div>
                <div className="h-1 bg-surface-container-high rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all duration-500"
                    style={{ width: currentRepo ? '100%' : '12%' }}
                  />
                </div>
              </div>
            </div>
          </section>

          <section className="bg-surface-container-lowest p-6 rounded-lg border border-outline-variant/10">
            <h3 className="font-mono text-xs text-on-surface-variant/70 uppercase tracking-widest mb-4">
              Execution Context
            </h3>
            <div className="font-mono text-[11px] space-y-2 text-on-surface-variant/80">
              <div className="flex gap-2">
                <span className="text-primary-fixed-dim">INFO</span>
                <span>GATeR analyzer connected to workspace APIs.</span>
              </div>
              <div className="flex gap-2">
                <span className="text-primary-fixed-dim">INFO</span>
                <span>Use the panel below to add or analyze a repository.</span>
              </div>
            </div>
          </section>
        </div>

        <div className="col-span-12 lg:col-span-8">
          <div className="bg-surface-container-low rounded-lg p-6 md:p-8 h-full border border-outline-variant/10">
            <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
              <div>
                <h2 className="text-xl md:text-2xl font-headline font-bold text-on-surface">
                  Analysis: {pct}% complete
                </h2>
                <p className="text-on-surface-variant text-sm font-mono mt-1">
                  Job ID:{' '}
                  <span className="text-primary">{jobId || (isAnalyzing ? '…running' : '—')}</span>
                </p>
              </div>
              <div className="text-right">
                <span className="text-[10px] font-mono text-on-surface-variant/60 uppercase tracking-widest block mb-1">
                  Status
                </span>
                <span className="text-lg font-headline font-bold text-on-surface">
                  {isAnalyzing ? 'Running' : step >= 6 ? 'Done' : 'Idle'}
                </span>
              </div>
            </div>

            <div className="w-full h-3 bg-surface-container rounded-full overflow-hidden mb-10 flex">
              <div
                className="h-full bg-gradient-to-r from-primary to-primary-container relative transition-all duration-500"
                style={{ width: `${Math.min(100, pct)}%` }}
              >
                <div className="absolute inset-0 bg-[linear-gradient(45deg,rgba(255,255,255,0.1)_25%,transparent_25%,transparent_50%,rgba(255,255,255,0.1)_50%,rgba(255,255,255,0.1)_75%,transparent_75%,transparent)] bg-[length:20px_20px]" />
              </div>
            </div>

            <div className="space-y-4">
              {STITCH_STEPS.map((s, idx) => {
                const backendStep = idx + 1;
                const completed = step > backendStep || (!isAnalyzing && step >= 6);
                const active = isAnalyzing && step === backendStep;
                const pending = step < backendStep && !(completed);

                return (
                  <div
                    key={s.id}
                    className={`flex items-start gap-4 p-4 rounded-lg border transition-all ${
                      active
                        ? 'bg-surface-container-high border-2 border-primary'
                        : completed
                          ? 'bg-surface-container-lowest/50 border border-outline-variant/10'
                          : 'bg-surface-container-lowest/20 border border-outline-variant/5 opacity-50'
                    }`}
                  >
                    <div
                      className={`mt-1 w-6 h-6 rounded-full flex items-center justify-center shrink-0 border ${
                        completed
                          ? 'bg-primary/20 border-primary/40'
                          : active
                            ? 'bg-primary border-primary animate-pulse'
                            : 'bg-surface-container-highest border-outline-variant/20'
                      }`}
                    >
                      {completed ? (
                        <MaterialIcon name="check_circle" className="text-primary text-sm" filled />
                      ) : active ? (
                        <MaterialIcon name="sync" className="text-on-primary text-sm" />
                      ) : (
                        <MaterialIcon name="circle" className="text-on-surface-variant/50 text-sm" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between gap-2">
                        <h4 className={`text-sm font-semibold ${pending ? 'text-on-surface-variant/60' : 'text-on-surface'}`}>
                          {s.title}
                        </h4>
                        <span className="text-[10px] font-mono text-on-surface-variant shrink-0">
                          {completed ? 'done' : active ? 'RUNNING' : 'PENDING'}
                        </span>
                      </div>
                      <p className="text-xs text-on-surface-variant mt-0.5">{s.desc}</p>
                      {active && analysisProgress?.step_description && (
                        <p className="text-[11px] font-mono text-primary mt-2">{analysisProgress.step_description}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div id="gater-repo-operations" className="scroll-mt-8">
        <RepoManager />
      </div>

      {(isAnalyzing || pct > 0) && (
        <div className="fixed bottom-8 right-8 z-40 max-w-sm">
          <div className="bg-surface-container-highest/95 backdrop-blur-md p-4 rounded-xl border border-outline-variant/20 shadow-2xl flex items-center gap-4">
            <div className="relative w-12 h-12 shrink-0">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 48 48">
                <circle
                  className="text-surface-container-low"
                  cx="24"
                  cy="24"
                  fill="transparent"
                  r="20"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <circle
                  className="text-primary"
                  cx="24"
                  cy="24"
                  fill="transparent"
                  r="20"
                  stroke="currentColor"
                  strokeWidth="4"
                  strokeDasharray={125.6}
                  strokeDashoffset={125.6 * (1 - pct / 100)}
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-on-surface">
                {pct}%
              </span>
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-on-surface">Analysis Active</p>
              <p className="text-[10px] text-on-surface-variant font-mono truncate">
                {currentRepo ? `${currentRepo.owner}/${currentRepo.name}` : 'No repo'}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
