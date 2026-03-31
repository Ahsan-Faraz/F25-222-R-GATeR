// Analysis Progress Component - Real-time progress display matching Flask backend

import React from 'react';
import { useAppState } from '@/context/AppStateContext';

// Step definitions matching Flask backend
const STEPS = [
  { id: 1, name: 'Repository Added', icon: '📁' },
  { id: 2, name: 'Cloning/Updating', icon: '⬇️' },
  { id: 3, name: 'Extracting Entities', icon: '🔍' },
  { id: 4, name: 'Building Knowledge Graph', icon: '🕸️' },
  { id: 5, name: 'GitHub Artifacts', icon: '📦' },
  { id: 6, name: 'Vector Embeddings', icon: '🧮' },
];

export default function AnalysisProgress() {
  const { analysisProgress, isAnalyzing } = useAppState();

  // Show component when analyzing or when there's progress
  if (!isAnalyzing && (!analysisProgress || analysisProgress.step === 0)) {
    return null;
  }

  const currentStep = analysisProgress?.step || 0;
  const stepName = analysisProgress?.step_name || '';
  const stepDescription = analysisProgress?.step_description || '';
  const details = analysisProgress?.details || {};
  const percentage = analysisProgress?.percentage || 0;

  return (
    <div className="bg-[#1a4a52] border-2 border-[#D4A574] rounded-2xl p-6 shadow-lg">
      <h4 className="font-bold text-white mb-4 flex items-center gap-2">
        <span className="animate-spin inline-block">⚙️</span>
        Analysis in Progress
      </h4>

      {/* Progress Bar */}
      <div className="mb-6">
        <div className="flex justify-between text-sm mb-2">
          <span className="text-[#B8E3E9]">Step {currentStep} of {STEPS.length}</span>
          <span className="font-bold text-[#D4A574]">{percentage}%</span>
        </div>
        <div className="w-full bg-[#0B2E33] rounded-full h-3 border border-[#4F7C82]">
          <div
            className="bg-gradient-to-r from-[#4ade80] to-[#22c55e] h-3 rounded-full transition-all duration-500 ease-out"
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>

      {/* Step List */}
      <div className="space-y-3">
        {STEPS.map((step) => {
          const isCompleted = currentStep > step.id;
          const isActive = currentStep === step.id;
          const isPending = currentStep < step.id;

          return (
            <div
              key={step.id}
              className={`flex items-center gap-3 p-3 rounded-lg transition-all duration-300 ${
                isActive
                  ? 'bg-[#2a3f36] border-2 border-[#D4A574]'
                  : isCompleted
                  ? 'bg-[#1a3a2f] border border-[#4ade80]'
                  : 'bg-[#0B2E33] border border-[#4F7C82] opacity-50'
              }`}
            >
              {/* Step Icon/Status */}
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm ${
                  isCompleted
                    ? 'bg-[#4ade80] text-[#0B2E33]'
                    : isActive
                    ? 'bg-[#D4A574] text-[#0B2E33] animate-pulse'
                    : 'bg-[#4F7C82] text-[#93B1B5]'
                }`}
              >
                {isCompleted ? '✓' : step.icon}
              </div>

              {/* Step Info */}
              <div className="flex-1">
                <div className={`font-medium ${isActive ? 'text-[#D4A574]' : isCompleted ? 'text-[#4ade80]' : 'text-[#B8E3E9]'}`}>
                  {step.name}
                </div>
                {isActive && stepDescription && (
                  <div className="text-sm text-[#B8E3E9] mt-1">
                    {stepDescription}
                  </div>
                )}
              </div>

              {/* Active indicator */}
              {isActive && (
                <div className="flex items-center gap-1">
                  <span className="w-2 h-2 bg-[#D4A574] rounded-full animate-ping" />
                  <span className="text-xs text-[#D4A574] font-medium">Processing</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Details Preview (for steps 3 and 4) */}
      {currentStep >= 3 && Object.keys(details).length > 0 && (
        <div className="mt-4 p-4 bg-[#0B2E33] rounded-lg border border-[#4F7C82]">
          <h5 className="font-medium text-sm text-[#D4A574] mb-2">Extraction Details:</h5>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
            {details.classes !== undefined && (
              <div className="bg-[#16424a] p-2 rounded border border-[#4F7C82]">
                <span className="text-[#93B1B5]">Classes:</span>{' '}
                <span className="font-bold text-white">{details.classes}</span>
              </div>
            )}
            {details.functions !== undefined && (
              <div className="bg-[#16424a] p-2 rounded border border-[#4F7C82]">
                <span className="text-[#93B1B5]">Functions:</span>{' '}
                <span className="font-bold text-white">{details.functions}</span>
              </div>
            )}
            {details.tests !== undefined && (
              <div className="bg-[#16424a] p-2 rounded border border-[#4F7C82]">
                <span className="text-[#93B1B5]">Tests:</span>{' '}
                <span className="font-bold text-white">{details.tests}</span>
              </div>
            )}
            {details.nodes !== undefined && (
              <div className="bg-[#16424a] p-2 rounded border border-[#4F7C82]">
                <span className="text-[#93B1B5]">Nodes:</span>{' '}
                <span className="font-bold text-white">{details.nodes}</span>
              </div>
            )}
            {details.relationships !== undefined && (
              <div className="bg-[#16424a] p-2 rounded border border-[#4F7C82]">
                <span className="text-[#93B1B5]">Relationships:</span>{' '}
                <span className="font-bold text-white">{details.relationships}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
