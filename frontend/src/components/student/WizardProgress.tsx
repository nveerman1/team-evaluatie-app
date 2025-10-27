"use client";

type WizardProgressProps = {
  currentStep: number;
  steps: { number: number; label: string; completed?: boolean }[];
  onStepClick: (step: number) => void;
};

export function WizardProgress({
  currentStep,
  steps,
  onStepClick,
}: WizardProgressProps) {
  return (
    <div className="flex items-center justify-center gap-2">
      {steps.map((step, index) => (
        <div key={step.number} className="flex items-center">
          <button
            onClick={() => onStepClick(step.number)}
            className={`
              px-4 py-2 rounded-lg border transition-all
              ${
                currentStep === step.number
                  ? "bg-black text-white border-black"
                  : step.completed
                    ? "bg-green-50 border-green-500 text-green-700 hover:bg-green-100"
                    : "bg-white border-gray-300 text-gray-700 hover:bg-gray-50"
              }
            `}
            title={step.label}
          >
            <span className="flex items-center gap-2">
              {step.completed && currentStep !== step.number && (
                <span className="text-green-600">✓</span>
              )}
              <span className="hidden sm:inline">{step.label}</span>
              <span className="sm:hidden">Stap {step.number}</span>
            </span>
          </button>
          
          {index < steps.length - 1 && (
            <div className="w-8 h-0.5 bg-gray-300 mx-1" />
          )}
        </div>
      ))}
    </div>
  );
}
