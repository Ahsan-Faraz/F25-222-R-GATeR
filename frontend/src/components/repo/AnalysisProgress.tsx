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
    <div className="bg-white border-2 border-accent rounded-2xl p-6 shadow-card">
      <h4 className="font-bold text-primary mb-4 flex items-center gap-2">
        <span className="animate-spin inline-block">⚙️</span>
        Analysis in Progress
      </h4>

      {/* Progress Bar */}
      <div className="mb-6">
        <div className="flex justify-between text-sm mb-2">
          <span className="text-gray-600">Step {currentStep} of {STEPS.length}</span>
          <span className="font-bold text-accent">{percentage}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-3">
          <div
            className="bg-accent h-3 rounded-full transition-all duration-500 ease-out"
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
                  ? 'bg-accent bg-opacity-15 border-2 border-accent'
                  : isCompleted
                  ? 'bg-green-50 border border-green-200'
                  : 'bg-gray-50 border border-gray-200 opacity-50'
              }`}
            >
              {/* Step Icon/Status */}
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm ${
                  isCompleted
                    ? 'bg-green-500 text-white'
                    : isActive
                    ? 'bg-accent text-white animate-pulse'
                    : 'bg-gray-300 text-gray-500'
                }`}
              >
                {isCompleted ? '✓' : step.icon}
              </div>

              {/* Step Info */}
              <div className="flex-1">
                <div className="font-medium text-primary">
                  {step.name}
                </div>
                {isActive && stepDescription && (
                  <div className="text-sm text-gray-600 mt-1">
                    {stepDescription}
                  </div>
                )}
              </div>

              {/* Active indicator */}
              {isActive && (
                <div className="flex items-center gap-1">
                  <span className="w-2 h-2 bg-accent rounded-full animate-ping" />
                  <span className="text-xs text-accent font-medium">Processing</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Details Preview (for steps 3 and 4) */}
      {currentStep >= 3 && Object.keys(details).length > 0 && (
        <div className="mt-4 p-4 bg-gray-50 rounded-lg">
          <h5 className="font-medium text-sm text-gray-700 mb-2">Extraction Details:</h5>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
            {details.classes !== undefined && (
              <div className="bg-white p-2 rounded border">
                <span className="text-gray-500">Classes:</span>{' '}
                <span className="font-bold">{details.classes}</span>
              </div>
            )}
            {details.functions !== undefined && (
              <div className="bg-white p-2 rounded border">
                <span className="text-gray-500">Functions:</span>{' '}
                <span className="font-bold">{details.functions}</span>
              </div>
            )}
            {details.tests !== undefined && (
              <div className="bg-white p-2 rounded border">
                <span className="text-gray-500">Tests:</span>{' '}
                <span className="font-bold">{details.tests}</span>
              </div>
            )}
            {details.nodes !== undefined && (
              <div className="bg-white p-2 rounded border">
                <span className="text-gray-500">Nodes:</span>{' '}
                <span className="font-bold">{details.nodes}</span>
              </div>
            )}
            {details.relationships !== undefined && (
              <div className="bg-white p-2 rounded border">
                <span className="text-gray-500">Relationships:</span>{' '}
                <span className="font-bold">{details.relationships}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
