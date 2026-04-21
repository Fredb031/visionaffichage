import { memo, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * TablePagination — minimal prev/next pagination for admin tables.
 *
 * Used by AdminCustomers, AdminOrders, etc. Stays stateless; the
 * parent owns `page` and passes it in so the filter→reset-to-page-0
 * logic lives next to the filter state (React idiom).
 */
interface Props {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (next: number) => void;
  /** Bilingual label suffix for the counter, e.g. "commandes". */
  itemLabel?: string;
}

function TablePaginationInner({ page, pageSize, total, onPageChange, itemLabel }: Props) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  // Self-clamp: if `page` is beyond the last valid index (e.g. the
  // parent hasn't yet reset on a filter narrowing, or row deletions
  // shrank `total` below the current slice), nudge it back to the
  // last valid page on the next tick. Without this the parent renders
  // an empty table body AND the counter shows a nonsense range like
  // "126–30 sur 30" because first = page*pageSize+1 leaks past total.
  useEffect(() => {
    if (page > totalPages - 1) {
      onPageChange(Math.max(0, totalPages - 1));
    }
  }, [page, totalPages, onPageChange]);

  // Nothing to paginate — don't render the footer at all. Keeps the
  // UI clean for small result sets.
  if (total <= pageSize) return null;

  // Defensive clamp on the displayed numbers too — the effect above
  // resolves the state on the next render, so render-1 still gets a
  // out-of-range page. Clamp here so the visible range never reads
  // bogus values during that single frame.
  const safePage = Math.min(page, totalPages - 1);
  const first = safePage * pageSize + 1;
  const last  = Math.min((safePage + 1) * pageSize, total);

  return (
    <nav
      role="navigation"
      aria-label="Pagination"
      className="flex items-center justify-between px-4 py-3 border-t border-zinc-100 text-xs text-zinc-500"
    >
      <span>
        {first}–{last} sur {total}
        {itemLabel ? ` ${itemLabel}` : ''}
        {' · '}
        <span className="text-zinc-400">
          Page {safePage + 1} de {totalPages}
        </span>
      </span>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onPageChange(Math.max(0, safePage - 1))}
          disabled={safePage === 0}
          aria-label="Page précédente"
          className="p-1.5 rounded-md border border-zinc-200 hover:bg-zinc-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC] focus-visible:ring-offset-1"
        >
          <ChevronLeft size={14} aria-hidden="true" />
        </button>
        <span
          className="px-2 font-semibold text-zinc-700"
          aria-current="page"
          aria-live="polite"
          aria-atomic="true"
        >
          {safePage + 1} / {totalPages}
        </span>
        <button
          type="button"
          onClick={() => onPageChange(Math.min(totalPages - 1, safePage + 1))}
          disabled={safePage >= totalPages - 1}
          aria-label="Page suivante"
          className="p-1.5 rounded-md border border-zinc-200 hover:bg-zinc-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC] focus-visible:ring-offset-1"
        >
          <ChevronRight size={14} aria-hidden="true" />
        </button>
      </div>
    </nav>
  );
}

export const TablePagination = memo(TablePaginationInner);
