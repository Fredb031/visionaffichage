// Customer dashboard for saved designs — Mega Blueprint Section 6.2.
//
// Reads the localStorage list maintained by lib/savedDesigns.ts and
// renders a responsive grid of preview tiles. Each tile exposes
// "Recommander" (re-order, currently a TODO Link), "Modifier" (jump
// back to the customizer with the saved snapshot, also TODO until the
// customizer accepts a `?design=:id` query param), and "Supprimer"
// (immediate local delete with confirm).
//
// The route isn't registered in App.tsx in this commit — the operator
// gets to pick the URL slug (`/account/designs` vs `/mes-designs`).
// Component is the default export so the eventual <Route> can pull it
// in lazily.

import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Bookmark, Edit3, RefreshCw, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Navbar } from '@/components/Navbar';
import { BottomNav } from '@/components/BottomNav';
import {
  deleteSavedDesign,
  listSavedDesigns,
  type SavedDesign,
} from '@/lib/savedDesigns';

// French short-date formatter — matches the rest of the customer-
// facing UI (fr-CA copy throughout, no en fallback on this page).
const dateFmt = new Intl.DateTimeFormat('fr-CA', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

function formatSavedAt(ts: number): string {
  try {
    return dateFmt.format(new Date(ts));
  } catch {
    // Defensive — Intl.DateTimeFormat shouldn't throw on a valid
    // number, but a corrupted entry could land here mid-render.
    return '';
  }
}

export function Designs() {
  // Hydrate from localStorage in an effect rather than at module load.
  // SSR-safety isn't strictly required (Vite SPA), but the pattern
  // keeps the initial render deterministic and lets us re-fetch after
  // a delete without round-tripping through a context provider.
  const [designs, setDesigns] = useState<SavedDesign[]>([]);
  const [hydrated, setHydrated] = useState(false);

  const refresh = useCallback(() => {
    setDesigns(listSavedDesigns());
  }, []);

  useEffect(() => {
    refresh();
    setHydrated(true);
  }, [refresh]);

  const handleDelete = useCallback(
    (id: string, name: string) => {
      // Confirm() instead of an inline destructive UI for the same
      // reason SaveDesignButton uses prompt() — Section 6 keeps the
      // skeleton minimal and a styled dialog lands in a follow-up.
      const ok = window.confirm(
        `Supprimer le design « ${name} » ? Cette action est irréversible.`,
      );
      if (!ok) return;
      deleteSavedDesign(id);
      refresh();
      toast.success('Design supprimé');
    },
    [refresh],
  );

  return (
    <div className="min-h-screen bg-background pb-24">
      <Navbar />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 pt-6">
        <Link
          to="/compte"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
        >
          <ArrowLeft size={16} aria-hidden="true" />
          Retour au compte
        </Link>

        <header className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-navy font-lora">
            Mes designs sauvegardés
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Retrouve tes créations et recommande-les en un clic.
          </p>
        </header>

        {!hydrated ? (
          // Skeleton placeholder — three pulsing tiles matches the
          // grid breakpoints below. Avoids a "no designs" flash on
          // the customer's first render before we read localStorage.
          <div
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
            aria-hidden="true"
          >
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="aspect-square rounded-2xl bg-zinc-100 animate-pulse"
              />
            ))}
          </div>
        ) : designs.length === 0 ? (
          <EmptyState />
        ) : (
          <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {designs.map((d) => (
              <DesignCard key={d.id} design={d} onDelete={handleDelete} />
            ))}
          </ul>
        )}
      </main>

      <BottomNav />
    </div>
  );
}

interface CardProps {
  design: SavedDesign;
  onDelete: (id: string, name: string) => void;
}

function DesignCard({ design, onDelete }: CardProps) {
  return (
    <li className="group relative bg-white border border-border rounded-2xl overflow-hidden flex flex-col">
      <div className="relative aspect-square bg-zinc-50 flex items-center justify-center overflow-hidden">
        {design.canvasPreviewDataUrl ? (
          <img
            src={design.canvasPreviewDataUrl}
            alt={`Aperçu de ${design.name}`}
            className="w-full h-full object-contain"
            loading="lazy"
          />
        ) : (
          <div className="flex flex-col items-center justify-center text-zinc-300">
            <Bookmark size={48} aria-hidden="true" />
            <span className="text-xs mt-2 text-zinc-400">Aucun aperçu</span>
          </div>
        )}

        {/* Hover overlay — opacity-0 by default, visible on hover or
            when any descendant is focus-visible so keyboard users can
            still reach the actions. */}
        <div className="absolute inset-0 bg-navy/70 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2 p-4">
          <button
            type="button"
            onClick={() =>
              toast(
                'Recommander : à venir — la commande rapide reliera le panier au design.',
              )
            }
            className="inline-flex items-center gap-1.5 bg-gold text-navy text-sm font-bold px-4 py-2 rounded-full hover:bg-gold-light transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-navy w-40 justify-center"
          >
            <RefreshCw size={14} aria-hidden="true" />
            Recommander
          </button>
          <button
            type="button"
            onClick={() =>
              toast(
                'Modifier : à venir — le personnalisateur rechargera ce design.',
              )
            }
            className="inline-flex items-center gap-1.5 bg-white text-navy text-sm font-bold px-4 py-2 rounded-full hover:bg-zinc-100 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-navy w-40 justify-center"
          >
            <Edit3 size={14} aria-hidden="true" />
            Modifier
          </button>
        </div>
      </div>

      <div className="p-4 flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="font-bold text-sm text-foreground truncate" title={design.name}>
            {design.name}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5 truncate" title={design.productSku}>
            SKU : {design.productSku}
          </div>
          <div className="text-[11px] text-muted-foreground mt-1">
            Sauvegardé le {formatSavedAt(design.createdAt)}
          </div>
        </div>
        <button
          type="button"
          onClick={() => onDelete(design.id, design.name)}
          aria-label={`Supprimer ${design.name}`}
          title="Supprimer"
          className="flex-shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-destructive focus-visible:ring-offset-2"
        >
          <Trash2 size={14} aria-hidden="true" />
        </button>
      </div>
    </li>
  );
}

function EmptyState() {
  return (
    <section
      className="bg-white border border-border rounded-2xl p-10 text-center"
      aria-labelledby="designs-empty-heading"
    >
      <Bookmark size={40} className="text-zinc-300 mx-auto mb-3" aria-hidden="true" />
      <h2 id="designs-empty-heading" className="font-bold text-base text-foreground mb-1">
        Aucun design pour l&rsquo;instant
      </h2>
      <p className="text-sm text-muted-foreground mb-5 max-w-md mx-auto">
        Tu n&rsquo;as pas encore sauvegardé de design — utilise le bouton
        {' '}
        <Bookmark
          size={14}
          className="inline align-text-bottom text-navy"
          aria-hidden="true"
        />
        {' '}
        dans le personnalisateur.
      </p>
      <Link
        to="/products"
        className="inline-flex items-center gap-1.5 bg-primary text-primary-foreground font-bold text-sm px-5 py-2.5 rounded-full hover:bg-primary/90 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
      >
        Personnaliser un produit
      </Link>
    </section>
  );
}

export default Designs;
