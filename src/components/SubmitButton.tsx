import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Loader2, Check } from 'lucide-react';
import { useLang } from '@/lib/langContext';

// Task 17.4 — morphing submit button. A stateful <button> that swaps
// its visible label between idle → loading → success without the
// element re-mounting (so focus/aria-* stay stable). Parent owns the
// timing: flip to 'loading' when the submit starts, 'success' when
// the write lands, then setTimeout(2000) back to 'idle'. The component
// keeps disabled=true during loading/success so a double-tap can't
// fire the handler twice while the tick is still on screen.

export type SubmitButtonState = 'idle' | 'loading' | 'success';

type SubmitButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  state: SubmitButtonState;
  children: ReactNode;
};

// The three label rows are stacked in a relative container and cross-
// faded via opacity + translate. Only one row has opacity-100 at a
// time; the others sit at opacity-0 and pointer-events-none so clicks
// always resolve to the button itself. The button's outer width is
// pinned by the widest row (the invisible 'sizer' span) so the layout
// doesn't jump when the label changes length between languages.
export const SubmitButton = forwardRef<HTMLButtonElement, SubmitButtonProps>(
  function SubmitButton({ state, children, className, disabled, type, ...rest }, ref) {
    const { lang } = useLang();
    const successLabel = lang === 'en' ? 'Sent' : 'Envoyé';
    // During loading/success the button MUST refuse further clicks —
    // otherwise a user impatient with the 2s success dwell could fire
    // the parent handler again and double-post. Merge with any caller-
    // provided disabled so validation-disabled still wins when idle.
    const isBusy = state !== 'idle';
    const effectiveDisabled = disabled || isBusy;

    return (
      <button
        ref={ref}
        type={type ?? 'submit'}
        disabled={effectiveDisabled}
        aria-busy={state === 'loading' || undefined}
        aria-live="polite"
        data-state={state}
        className={className}
        {...rest}
      >
        <span className="relative inline-flex items-center justify-center">
          {/* Invisible sizer — locks the outer width to the widest of
              the three possible labels so the button doesn't jitter
              when state flips. aria-hidden so AT ignores it. */}
          <span aria-hidden="true" className="invisible inline-flex items-center gap-2 whitespace-nowrap">
            {children}
            <span className="inline-flex items-center gap-2">
              <Check size={16} aria-hidden="true" strokeWidth={3} />
              {successLabel}
            </span>
          </span>
          {/* idle row */}
          <span
            aria-hidden={state !== 'idle'}
            className={`absolute inset-0 inline-flex items-center justify-center gap-2 whitespace-nowrap transition-all duration-200 ease-out ${
              state === 'idle'
                ? 'opacity-100 translate-y-0'
                : 'opacity-0 -translate-y-1 pointer-events-none'
            }`}
          >
            {children}
          </span>
          {/* loading row */}
          <span
            aria-hidden={state !== 'loading'}
            className={`absolute inset-0 inline-flex items-center justify-center gap-2 whitespace-nowrap transition-all duration-200 ease-out ${
              state === 'loading'
                ? 'opacity-100 translate-y-0'
                : 'opacity-0 translate-y-1 pointer-events-none'
            }`}
          >
            <Loader2 size={15} aria-hidden="true" className="animate-spin" />
            {children}
          </span>
          {/* success row — Check rendered in a lighter gold halo against
              the button's own bg. On the blue contact submit the default
              currentColor (white) already reads; on the gold newsletter
              submit we keep currentColor so the tick inherits the navy. */}
          <span
            aria-hidden={state !== 'success'}
            className={`absolute inset-0 inline-flex items-center justify-center gap-2 whitespace-nowrap transition-all duration-200 ease-out ${
              state === 'success'
                ? 'opacity-100 translate-y-0'
                : 'opacity-0 translate-y-1 pointer-events-none'
            }`}
          >
            <Check size={16} aria-hidden="true" strokeWidth={3} />
            {successLabel}
          </span>
        </span>
      </button>
    );
  },
);
