// Analysis Progress Component - Minimalist-Futurism Design

import React from 'react';
import { useAppState } from '@/context/AppStateContext';
import { FolderGit2, Download, Search, Network, Package, Cpu, Check } from 'lucide-react';

// Step definitions matching Flask backend
const STEPS = [
  { id: 1, name: 'Repository Added', Icon: FolderGit2 },
  { id: 2, name: 'Cloning/Updating', Icon: Download },
  { id: 3, name: 'Extracting Entities', Icon: Search },
  { id: 4, name: 'Building Knowledge Graph', Icon: Network },
  { id: 5, name: 'GitHub Artifacts', Icon: Package },
  { id: 6, name: 'Vector Embeddings', Icon: Cpu },
];

export default function AnalysisProgress() {
  const { analysisProgress, isAnalyzing } = useAppState();

  if (!isAnalyzing && (!analysisProgress || analysisProgress.step === 0)) {
    return null;
  }

  const currentStep = analysisProgress?.step || 0;
  const stepDescription = analysisProgress?.step_description || '';
  const details = analysisProgress?.details || {};
  const percentage = analysisProgress?.percentage || 0;

  return (
    <div className="gater-card p-5">
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-sm font-semibold text-text-primary uppercase tracking-wider">
          Analysis Progress
        </h4>
        <span className="font-mono text-primary text-sm">{percentage}%</span>
      </div>

      {/* Progress Bar */}
      <div className="mb-6">
        <div className="w-full bg-surface-container-highest rounded-full h-1">
          <div
            className="bg-primary-container h-1 rounded-full transition-all duration-500 ease-out"
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>

      {/* Step List */}
      <div className="space-y-1">
        {STEPS.map((step) => {
          const isCompleted = currentStep > step.id;
          const isActive = currentStep === step.id;
          const Icon = step.Icon;

          return (
            <div
              key={step.id}
              className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${
                isActive
                  ? 'bg-surface-active'
                  : isCompleted
                  ? 'bg-transparent'
                  : 'bg-transparent opacity-40'
              }`}
            >
              {/* Step Icon/Status */}
              <div
                className={`w-6 h-6 rounded-md flex items-center justify-center ${
                  isCompleted
                    ? 'bg-green-600 text-white'
                    : isActive
                    ? 'bg-primary-container text-on-primary-container'
                    : 'bg-surface-hover text-on-surface-variant'
                }`}
              >
                {isCompleted ? (
                  <Check className="w-3.5 h-3.5" />
                ) : (
                  <Icon className="w-3.5 h-3.5" />
                )}
              </div>

              {/* Step Info */}
              <div className="flex-1">
                <div className={`text-sm ${
                  isActive ? 'text-text-primary' : isCompleted ? 'text-text-secondary' : 'text-text-muted'
                }`}>
                  {step.name}
                </div>
                {isActive && stepDescription && (
                  <div className="text-xs text-text-muted mt-0.5">
                    {stepDescription}
                  </div>
                )}
              </div>

              {/* Active indicator */}
              {isActive && (
                <span className="w-1.5 h-1.5 bg-accent rounded-full animate-pulse" />
              )}
            </div>
          );
        })}
      </div>

      {/* Details */}
      {currentStep >= 3 && Object.keys(details).length > 0 && (
        <div className="mt-4 pt-4 border-t border-border">
          <div className="stat-ribbon text-xs">
            {details.classes !== undefined && (
              <div className="stat-item py-2 px-4">
                <span className="stat-label text-[10px]">Classes</span>
                <span className="stat-value text-base">{details.classes}</span>
              </div>
            )}
            {details.functions !== undefined && (
              <div className="stat-item py-2 px-4">
                <span className="stat-label text-[10px]">Functions</span>
                <span className="stat-value text-base">{details.functions}</span>
              </div>
            )}
            {details.tests !== undefined && (
              <div className="stat-item py-2 px-4">
                <span className="stat-label text-[10px]">Tests</span>
                <span className="stat-value text-base">{details.tests}</span>
              </div>
            )}
            {details.nodes !== undefined && (
              <div className="stat-item py-2 px-4">
                <span className="stat-label text-[10px]">Nodes</span>
                <span className="stat-value text-base">{details.nodes}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
