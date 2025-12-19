import React from 'react';
import { Loader2, CheckCircle2, Circle } from 'lucide-react';
import { AppState } from '../types';

interface ProcessingStepProps {
  currentStep: AppState;
}

export const ProcessingStep: React.FC<ProcessingStepProps> = ({ currentStep }) => {
  const steps = [
    { id: AppState.PROCESSING_AUDIO, label: 'Transcribing Audio' },
    { id: AppState.ANALYZING_LYRICS, label: 'Creating Visual Prompts' },
  ];

  // Helper to determine step status
  const getStatus = (stepId: AppState) => {
    // Define order
    const order = [AppState.IDLE, AppState.PROCESSING_AUDIO, AppState.ANALYZING_LYRICS, AppState.READY];
    const currentIndex = order.indexOf(currentStep);
    const stepIndex = order.indexOf(stepId);

    if (currentStep === AppState.ERROR) return 'error';
    if (currentIndex > stepIndex) return 'completed';
    if (currentIndex === stepIndex) return 'active';
    return 'pending';
  };

  if (currentStep === AppState.IDLE || currentStep === AppState.READY || currentStep === AppState.ERROR) return null;

  return (
    <div className="w-full max-w-md mx-auto my-8 p-6 bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700">
      <h3 className="text-center text-lg font-medium text-white mb-6">Processing your track...</h3>
      <div className="space-y-4">
        {steps.map((step) => {
          const status = getStatus(step.id);
          return (
            <div key={step.id} className="flex items-center gap-4">
              <div className="shrink-0">
                {status === 'completed' && <CheckCircle2 className="w-6 h-6 text-green-400" />}
                {status === 'active' && <Loader2 className="w-6 h-6 text-cyan-400 animate-spin" />}
                {status === 'pending' && <Circle className="w-6 h-6 text-slate-600" />}
              </div>
              <span className={`text-sm font-medium ${
                status === 'active' ? 'text-cyan-100' : 
                status === 'completed' ? 'text-green-100/70 line-through' : 'text-slate-500'
              }`}>
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
