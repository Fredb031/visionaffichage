// Section 11 #5 / Volume II Section 13 #5 — shared low-level skeleton
// primitive.
//
// A purely presentational <div> with the project's branded shimmer
// (`.va-skeleton`, defined in index.css). Pages that need a skeleton
// compose <Skeleton /> with sizing utility classes (e.g. `h-4 w-3/4`)
// instead of inlining the bg + animation pair every time.
//
// Notes:
//   - `.va-skeleton` carries the sweeping highlight via a ::after
//     pseudo-element so the consumer's sizing/rounded utilities can
//     still control the outer box (overflow:hidden is handled inside
//     the class so border-radius clips the sweep cleanly).
//   - aria-hidden so screen readers don't announce decorative blocks;
//     the parent loading container is responsible for the role=status
//     + sr-only announcement.
//   - prefers-reduced-motion is handled globally by the @media rule in
//     index.css, which collapses the shimmer to ~0ms.
export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div
      className={`va-skeleton rounded ${className}`}
      aria-hidden="true"
    />
  );
}
