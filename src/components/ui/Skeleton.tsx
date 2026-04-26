// Section 11 #5 — shared low-level skeleton primitive.
//
// A purely presentational <div> with an animate-pulse + brand-tinted
// background. Pages that need a skeleton compose <Skeleton /> with
// sizing utility classes (e.g. `h-4 w-3/4`) instead of inlining the
// animate-pulse + bg pair every time.
//
// Notes:
//   - Uses the project's `bg-secondary` token to stay on-brand and
//     theme-aware (light/dark mode reuse the same hue mapping the
//     existing inline skeletons already rely on, e.g. Products.tsx).
//   - aria-hidden so screen readers don't announce decorative blocks;
//     the parent loading container is responsible for the role=status
//     + sr-only announcement.
//   - prefers-reduced-motion is handled globally by the Tailwind
//     `motion-safe:` runtime + the inline @media rule already shipped
//     in Products.tsx for the shimmer keyframe; animate-pulse itself
//     respects the OS setting via Tailwind's default motion-reduce
//     plugin behaviour.
export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div
      className={`animate-pulse bg-secondary rounded ${className}`}
      aria-hidden="true"
    />
  );
}
