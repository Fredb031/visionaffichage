// Bookmark-icon button that hands the current customizer snapshot
// off to lib/savedDesigns.ts. Mega Blueprint Section 06.
//
// Intentionally thin: the customizer owns the snapshot shape and is
// responsible for rendering the canvas preview to a data URL before
// calling this component. We don't reach into the customizer's state
// from here so the button stays trivially testable and the wiring is
// a follow-up commit.
//
// Example wiring (kept here for the operator who lands the next
// commit — don't import this from the customizer yet):
//
//   <SaveDesignButton current={{
//     name: '',                     // overwritten by prompt()
//     productSku: variant.sku,
//     colorId: selectedColor?.id ?? null,
//     logoUrl: uploadedLogoUrl,
//     placement: placement ?? null,
//     sizeQty: quantitiesBySize,
//     canvasPreviewDataUrl: canvasRef.current?.toDataURL('image/png') ?? null,
//   }} />

import { useState } from 'react';
import { Bookmark } from 'lucide-react';
import { toast } from 'sonner';
import { saveDesign, type SavedDesign } from '@/lib/savedDesigns';

interface Props {
  current: Omit<SavedDesign, 'id' | 'createdAt'>;
  // Optional className escape hatch so the customizer can place this
  // inside its sticky summary bar without us prescribing the layout.
  className?: string;
}

export function SaveDesignButton({ current, className }: Props) {
  // Guard against a double-click submitting two prompts in a row on
  // slow devices where the modal lifecycle overlaps.
  const [busy, setBusy] = useState(false);

  function handleClick() {
    if (busy) return;
    setBusy(true);
    try {
      // prompt() is the placeholder per the brief — Section 6 will
      // eventually wrap this in a styled dialog with name validation.
      // Falling back to a date-stamped default keeps the flow moving
      // when the customer hits Cancel-then-Save accidentally.
      const fallbackName = `Design ${new Date().toLocaleDateString('fr-CA')}`;
      const raw = window.prompt(
        'Nomme ton design pour le retrouver plus tard :',
        current.name || fallbackName,
      );
      // null === user hit Cancel. Treat empty string the same way so
      // an accidental Enter doesn't persist an unnamed entry.
      if (raw === null) return;
      const name = raw.trim() || fallbackName;

      saveDesign({ ...current, name });
      toast.success('Design sauvegardé');
    } catch (err) {
      // saveDesign() itself shouldn't throw — readLS/writeLS swallow
      // storage errors — but a future Supabase swap might surface a
      // network error here, so guard the whole path.
      console.warn('[SaveDesignButton] save failed', err);
      toast.error('Impossible de sauvegarder le design');
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={busy}
      aria-label="Sauvegarder ce design"
      title="Sauvegarder ce design"
      className={
        className ??
        'inline-flex items-center justify-center w-10 h-10 rounded-full border border-border bg-white text-navy hover:bg-navy hover:text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed'
      }
    >
      <Bookmark size={18} aria-hidden="true" />
    </button>
  );
}

export default SaveDesignButton;
