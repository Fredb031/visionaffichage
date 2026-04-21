/**
 * Sonner toast wrapper — hardcoded to the system theme so we don't need
 * next-themes as a dependency. The project has no ThemeProvider mounted
 * anyway, so `useTheme()` was always returning the default "system" —
 * dropping the hook also drops the next-themes package.
 */
import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

// Task 17.9 — position top-right so toasts don't collide with the
// bottom-mounted cart drawer / sticky mobile CTA. pauseWhenPageIsHidden
// is sonner's default but we set it explicitly so the behaviour is
// discoverable in source. Pause-on-hover is also on by default in
// sonner and needs no prop. closeButton lets users dismiss early;
// 4s is our standard duration (per-call toast.success/error can still
// override via their own `duration` option).
const Toaster = ({ ...props }: ToasterProps) => (
  <Sonner
    theme="system"
    className="toaster group"
    position="top-right"
    duration={4000}
    closeButton
    pauseWhenPageIsHidden
    toastOptions={{
      classNames: {
        toast:
          "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
        description: "group-[.toast]:text-muted-foreground",
        actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
        cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
      },
    }}
    {...props}
  />
);

export { Toaster, toast };
