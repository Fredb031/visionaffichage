import { Clock, CheckCircle2, Scissors, PackageCheck } from 'lucide-react';

type Props = {
  heading: string;
  steps: { 1: string; 2: string; 3: string; 4: string };
};

export function ProofTimeline({ heading, steps }: Props) {
  const items = [
    { icon: Clock, text: steps[1] },
    { icon: CheckCircle2, text: steps[2] },
    { icon: Scissors, text: steps[3] },
    { icon: PackageCheck, text: steps[4] },
  ];

  return (
    <section
      aria-labelledby="proof-timeline-heading"
      className="rounded-md border border-sand-300 bg-canvas-050 p-5"
    >
      <h2 id="proof-timeline-heading" className="text-title-md text-ink-950">
        {heading}
      </h2>
      <ol className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {items.map(({ icon: Icon, text }, idx) => (
          <li
            key={idx}
            className="flex items-start gap-3 rounded-sm bg-canvas-000 p-3 shadow-xs"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm bg-sand-100 text-slate-700">
              <Icon aria-hidden className="h-5 w-5" />
            </span>
            <p className="text-body-sm text-ink-950">
              <span aria-hidden className="mr-1 text-meta-xs font-semibold uppercase text-stone-500">
                {String(idx + 1).padStart(2, '0')}
              </span>
              {text}
            </p>
          </li>
        ))}
      </ol>
    </section>
  );
}
