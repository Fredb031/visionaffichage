import { Check } from 'lucide-react';
import { useCustomizerStore } from '@/store/customizerStore';
import { CUSTOMIZER_STEPS, type CustomizerStep } from '@/types/customization';

const STEP_ORDER: CustomizerStep[] = ['color', 'logo', 'placement', 'sizes', 'summary'];

export function CustomizerSteps() {
  const { currentStep, setStep } = useCustomizerStore();
  const currentIdx = STEP_ORDER.indexOf(currentStep);

  return (
    <div className="flex items-center gap-2 px-5 py-3 border-b border-border">
      {CUSTOMIZER_STEPS.map((step, i) => {
        const isDone = i < currentIdx;
        const isActive = step.id === currentStep;

        return (
          <button
            key={step.id}
            onClick={() => isDone && setStep(step.id)}
            className={`flex items-center gap-2 text-xs font-bold px-3 py-1.5 rounded-full transition-all ${
              isActive
                ? 'bg-navy text-white'
                : isDone
                ? 'bg-secondary text-foreground cursor-pointer'
                : 'text-muted-foreground'
            }`}
          >
            {isDone ? <Check className="w-3 h-3" /> : <span>{i + 1}</span>}
            <span className="hidden sm:inline">{step.label}</span>
          </button>
        );
      })}
    </div>
  );
}
