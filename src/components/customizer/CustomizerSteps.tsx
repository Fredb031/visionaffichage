import { Check } from 'lucide-react';
import { useCustomizerStore } from '@/store/customizerStore';

const STEPS = [
  { id: 1, label: 'Couleur' },
  { id: 2, label: 'Logo' },
  { id: 3, label: 'Emplacement' },
  { id: 4, label: 'Tailles' },
  { id: 5, label: 'Résumé' },
] as const;

export function CustomizerSteps() {
  const { step, setStep } = useCustomizerStore();

  return (
    <div className="flex items-center gap-2 px-5 py-3 border-b border-border">
      {STEPS.map((s) => {
        const isDone = s.id < step;
        const isActive = s.id === step;

        return (
          <button
            key={s.id}
            onClick={() => isDone && setStep(s.id as 1|2|3|4|5)}
            className={`flex items-center gap-2 text-xs font-bold px-3 py-1.5 rounded-full transition-all ${
              isActive
                ? 'bg-navy text-white'
                : isDone
                ? 'bg-secondary text-foreground cursor-pointer'
                : 'text-muted-foreground'
            }`}
          >
            {isDone ? <Check className="w-3 h-3" /> : <span>{s.id}</span>}
            <span className="hidden sm:inline">{s.label}</span>
          </button>
        );
      })}
    </div>
  );
}
