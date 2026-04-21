import { useMemo, useState } from 'react';
import { Search, Plus, Trash2, Send, Percent, DollarSign, Save } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { toast } from 'sonner';
import { PRODUCTS, PRINT_PRICE, findColorImage, type Product } from '@/data/products';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useProductColors } from '@/hooks/useProductColors';
import type { ShopifyVariantColor } from '@/lib/shopify';
import { isValidEmail, normalizeInvisible } from '@/lib/utils';
import { isAutomationActive } from '@/lib/automations';

// The size column order that matches what the client can actually order on
// Shopify — keep this constant in sync with the matrix header below so the
// per-color rows line up perfectly with it. 2XL is persisted as "XXL" to
// match the legacy LineItem.size values the email preview reads from.
const SIZE_COLUMNS = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL'] as const;
type SizeCol = typeof SIZE_COLUMNS[number];

type Placement = 'front' | 'back' | 'both';

// Each placement is one printed zone. "both" = 2 zones, which doubles the
// PRINT_PRICE-per-zone fee below. Matches the per-zone fee the client sees
// on /quote/:id so there is no drift between what the vendor quotes and
// what the client is invoiced.
const PLACEMENT_ZONES: Record<Placement, number> = {
  front: 1,
  back: 1,
  both: 2,
};

const PLACEMENT_LABEL: Record<Placement, string> = {
  front: 'Devant',
  back: 'Dos',
  both: 'Devant + Dos',
};

interface LineItem {
  id: string;
  productSku: string;
  productName: string;
  shopifyHandle: string;
  image: string;
  /** Legacy single-color field — kept so downstream readers (email preview,
   *  QuoteAccept, AdminQuotes summary) still show a human label. Populated
   *  from `colors[0]` at persist time. */
  color: string;
  /** Legacy single-size field — kept for the same reason as `color`. */
  size: string;
  /** Legacy total qty across the matrix (colors × sizes). */
  quantity: number;
  /** Unit price — either the live Shopify variant price of the first
   *  picked color, or the product-level fallback from products.ts. */
  unitPrice: number;
  placementNote: string;
  /** Phase A2 — multi-select color palette (names, e.g. "Noir", "Marine"). */
  colors: string[];
  /** Phase A3 — per-color × per-size quantity matrix.
   *  Shape: `{ [colorName]: { [size]: qty } }`. Empty cells are 0. */
  sizeQuantities: Record<string, Partial<Record<SizeCol, number>>>;
  /** Phase A4 — logo placement selector. */
  placement: Placement;
}

function totalQtyForItem(it: LineItem): number {
  let total = 0;
  for (const color of it.colors) {
    const row = it.sizeQuantities[color];
    if (!row) continue;
    for (const sz of SIZE_COLUMNS) {
      total += Math.max(0, row[sz] ?? 0);
    }
  }
  return total;
}

function lineTotalForItem(it: LineItem): number {
  const qty = totalQtyForItem(it);
  if (qty === 0) return 0;
  const zones = PLACEMENT_ZONES[it.placement];
  // Pricing: base variant price × qty + print fee × zones × qty. Matches
  // the /quote/:id invoice formula (see PRINT_PRICE per zone in products.ts).
  return (it.unitPrice + PRINT_PRICE * zones) * qty;
}

export default function QuoteBuilder() {
  const location = useLocation();
  const isAdminPath = location.pathname.startsWith('/admin');
  const backHref = isAdminPath ? '/admin/quotes' : '/vendor';
  useDocumentTitle('Nouvelle soumission — Vision Affichage');
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<LineItem[]>([]);
  const [clientEmail, setClientEmail] = useState('');
  const [clientName, setClientName] = useState('');
  const [discountKind, setDiscountKind] = useState<'percent' | 'flat'>('percent');
  const [discountValue, setDiscountValue] = useState('');
  const [notes, setNotes] = useState('');

  const filtered = useMemo(() => {
    if (!query.trim()) return PRODUCTS.slice(0, 8);
    const q = query.toLowerCase();
    return PRODUCTS.filter(p => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q)).slice(0, 12);
  }, [query]);

  const addProduct = (sku: string) => {
    const product = PRODUCTS.find(p => p.sku === sku);
    if (!product) return;
    setItems(prev => [
      ...prev,
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        productSku: product.sku,
        productName: product.name,
        shopifyHandle: product.shopifyHandle,
        image: product.imageDevant,
        color: '',
        size: 'M',
        quantity: 0,
        unitPrice: product.basePrice,
        placementNote: '',
        colors: [],
        sizeQuantities: {},
        placement: 'front',
      },
    ]);
  };

  const updateItem = (id: string, patch: Partial<LineItem>) => {
    setItems(prev => prev.map(it => (it.id === id ? { ...it, ...patch } : it)));
  };

  const removeItem = (id: string) => setItems(prev => prev.filter(it => it.id !== id));

  const subtotal = items.reduce((s, it) => s + lineTotalForItem(it), 0);
  const discountAmount = (() => {
    const v = Math.max(0, parseFloat(discountValue) || 0);
    // Cap the discount at 100% (or the full subtotal for flat rates)
    // so a typo like "150" in the percent input doesn't produce a
    // negative post-tax total. Negative totals made the summary
    // panel render like "-42.13 $" and would have been a real billing
    // bug if the vendor didn't spot it before sending.
    if (discountKind === 'percent') {
      const pct = Math.min(100, v);
      return (subtotal * pct) / 100;
    }
    return Math.min(subtotal, v);
  })();
  const tax = Math.max(0, subtotal - discountAmount) * 0.14975;
  const total = Math.max(0, subtotal - discountAmount) + tax;

  // Mirror the checkout email validation so a vendor can't "Send to
  // client" a quote addressed to "@" or "foo@" — those silently bounce
  // and the vendor thinks the client received it. Also require every
  // line to have a positive quantity so a stray 0 doesn't go out.
  const everyItemValid = items.length > 0 && items.every(it => totalQtyForItem(it) > 0);
  const canSend = isValidEmail(clientEmail) && everyItemValid;

  const persistQuote = (status: 'draft' | 'sent') => {
    // Defensive: older builds may have stored vision-quotes as non-array
    // (string, object). Array.isArray guards .length/.unshift below from
    // generating 'Q-YYYY-NaN' numbers or throwing a TypeError at .unshift.
    const list: unknown[] = (() => {
      try {
        const raw = JSON.parse(localStorage.getItem('vision-quotes') ?? '[]');
        return Array.isArray(raw) ? raw : [];
      } catch { return []; }
    })();
    // Use a monotonic counter — not list.length — because the list
    // itself is capped at 100 via slice(0, 100) below. Past 100
    // quotes, list.length plateaus at 100 and every new quote would
    // get the same `Q-YYYY-0101` number as the previous one. The
    // counter keeps growing even after the oldest entries are dropped.
    const nextSeq = (() => {
      try {
        const raw = Number(localStorage.getItem('vision-quotes-seq') ?? '0');
        const curr = Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : list.length;
        const next = curr + 1;
        localStorage.setItem('vision-quotes-seq', String(next));
        return next;
      } catch {
        return list.length + 1;
      }
    })();
    const number = `Q-${new Date().getFullYear()}-${String(nextSeq).padStart(4, '0')}`;
    // Scrub invisible chars before persisting — a vendor paste of the
    // client name or email from Slack/Notion could carry a ZWSP that
    // would later break QuoteList's email display + any strict match.
    const cleanName = normalizeInvisible(clientName).trim();
    const cleanEmail = normalizeInvisible(clientEmail).trim().toLowerCase();
    // Sync the legacy fields (color/size/quantity) from the matrix so
    // downstream readers (QuoteAccept mock, email preview, AdminQuotes
    // summary) still have a human-readable label when they don't know
    // about the new shape yet.
    const itemsWithLegacy = items.map(it => {
      const firstColor = it.colors[0] ?? '';
      const qty = totalQtyForItem(it);
      // Pick the first size with any qty as the "headline" size for
      // legacy consumers; default to M if nothing is filled yet so we
      // never persist an empty string for size (the old shape required
      // it to be present).
      let headlineSize: SizeCol = 'M';
      if (firstColor) {
        const row = it.sizeQuantities[firstColor] ?? {};
        const hit = SIZE_COLUMNS.find(s => (row[s] ?? 0) > 0);
        if (hit) headlineSize = hit;
      }
      return {
        ...it,
        color: firstColor,
        size: headlineSize,
        quantity: qty,
      };
    });
    const quote = {
      id: `q-${Date.now()}`,
      number,
      status,
      clientName: cleanName,
      clientEmail: cleanEmail,
      items: itemsWithLegacy,
      subtotal,
      discountKind,
      discountValue: parseFloat(discountValue) || 0,
      discountAmount,
      tax,
      total,
      notes,
      createdAt: new Date().toISOString(),
      lang: 'fr',
    };
    list.unshift(quote);
    try { localStorage.setItem('vision-quotes', JSON.stringify(list.slice(0, 100))); }
    catch (e) { console.warn('[QuoteBuilder] Quote could not be saved locally:', e); }
    return quote;
  };

  const handleSaveDraft = () => {
    if (items.length === 0) return;
    const q = persistQuote('draft');
    toast.success(`Brouillon ${q.number} sauvegardé.`, {
      description: 'Visible dans /admin/quotes et /vendor/quotes.',
    });
  };

  const handleSendToClient = () => {
    if (!canSend) return;
    // Honor the /admin/automations pause toggle. When an admin has
    // flipped 'quote-requested-admin' to paused, don't compose the
    // mailto — surface a toast so the vendor knows why nothing opened
    // and log so we can confirm the gate actually fired in the console.
    if (!isAutomationActive('quote-requested-admin')) {
      console.info('[automation] skipped paused automation:', 'quote-requested-admin');
      toast.warning('Envoi de soumission suspendu', {
        description: 'L\u2019automatisation « Quote requested » est en pause dans /admin/automations.',
      });
      return;
    }
    const q = persistQuote('sent');
    // Truncate the line list if the client ordered so many items that
    // the full mailto URL would blow the browser limit (~2000 chars in
    // IE/some mail clients, ~8000 in modern Chrome). The quote link is
    // the authoritative source anyway — the email is just a preview.
    const quoteUrl = `https://visionaffichage.com/quote/${q.id}`;
    const MAX_LINES_IN_EMAIL = 12;
    const truncated = items.length > MAX_LINES_IN_EMAIL;
    const shown = truncated ? items.slice(0, MAX_LINES_IN_EMAIL) : items;
    const lines = shown.map(it => {
      const qty = totalQtyForItem(it);
      const colorSummary = it.colors.length > 0 ? it.colors.join(', ') : '—';
      const lineTotal = lineTotalForItem(it).toFixed(2);
      return `• ${it.productName} (${colorSummary}) × ${qty} — ${PLACEMENT_LABEL[it.placement]} = ${lineTotal} $${it.placementNote ? ` — Note: ${it.placementNote}` : ''}`;
    }).join('\n');
    const subject = encodeURIComponent(`Ta soumission ${q.number} de Vision Affichage`);
    // Build the salutation with care for the empty-name case — the
    // 'Send to client' button doesn't require a name (it only gates on
    // a valid email), so without this guard the email body opened with
    // 'Bonjour ,\n\n' (lone comma after the space). Use the trimmed
    // clientName and drop the comma + space when there's nothing to
    // address.
    const cleanClientName = normalizeInvisible(clientName).trim();
    // Scrub + normalize the recipient too: a ZWSP or trailing space
    // pasted from Slack would otherwise flow into the mailto URL as
    // percent-encoded garbage ("client%E2%80%8B@foo.com"), producing
    // a broken recipient the mail client can't resolve. The quote
    // itself already persists a cleaned value via persistQuote().
    const cleanClientEmail = normalizeInvisible(clientEmail).trim();
    const salutation = cleanClientName ? `Bonjour ${cleanClientName},` : 'Bonjour,';
    const body = encodeURIComponent(
      `${salutation}\n\n` +
      `Voici ta soumission personnalisée :\n\n` +
      `${lines}\n` +
      (truncated ? `… et ${items.length - MAX_LINES_IN_EMAIL} autre${items.length - MAX_LINES_IN_EMAIL > 1 ? 's' : ''} article${items.length - MAX_LINES_IN_EMAIL > 1 ? 's' : ''} — détail complet sur la page Web.\n\n` : '\n') +
      `Sous-total : ${subtotal.toFixed(2)} $\n` +
      `${discountAmount > 0 ? `Rabais : -${discountAmount.toFixed(2)} $\n` : ''}` +
      `Taxes : ${tax.toFixed(2)} $\n` +
      `Total : ${total.toFixed(2)} $ CAD\n\n` +
      `Pour accepter et payer : ${quoteUrl}\n\n` +
      `Livraison en 5 jours ouvrables après confirmation.\n\n` +
      `— L'équipe Vision Affichage`,
    );
    // Do NOT encodeURIComponent the recipient — that turns "@" into
    // "%40" which several desktop mail clients (Outlook, Thunderbird,
    // some macOS Mail versions) fail to unescape into the To: field,
    // leaving it blank and forcing the vendor to retype the address.
    // canSend already gated on isValidEmail, so cleanClientEmail is
    // guaranteed to only contain chars safe in the mailto addr-spec
    // ([A-Za-z0-9._%+-]@[A-Za-z0-9.-]+\.[A-Za-z]{2,}).
    window.location.href = `mailto:${cleanClientEmail}?subject=${subject}&body=${body}`;
  };

  return (
    <div className="min-h-screen bg-zinc-50">
      <header className="bg-white border-b border-zinc-200 px-4 md:px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            to={backHref}
            className="text-sm text-zinc-500 hover:text-zinc-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC] focus-visible:ring-offset-1 rounded px-1"
          >
            ← Retour
          </Link>
          <h1 className="font-extrabold text-lg">Nouvelle soumission</h1>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleSaveDraft}
            disabled={items.length === 0}
            className="inline-flex items-center gap-2 text-sm font-bold px-3 py-2 border border-zinc-200 rounded-lg bg-white hover:bg-zinc-50 disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC] focus-visible:ring-offset-1"
          >
            <Save size={14} aria-hidden="true" />
            Brouillon
          </button>
          <button
            type="button"
            onClick={handleSendToClient}
            disabled={!canSend}
            className="inline-flex items-center gap-2 text-sm font-bold px-4 py-2 bg-[#0052CC] text-white rounded-lg hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC] focus-visible:ring-offset-2"
          >
            <Send size={14} aria-hidden="true" />
            Envoyer au client
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr_360px] gap-0 min-h-[calc(100vh-70px)]">
        <aside className="bg-white border-r border-zinc-200 p-4 overflow-y-auto">
          <h2 className="font-bold text-sm mb-3">Catalogue</h2>
          <div className="flex items-center gap-2 mb-4 border border-zinc-200 rounded-lg px-3 py-2 bg-zinc-50">
            <Search size={14} className="text-zinc-400" aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Rechercher un produit"
              aria-label="Rechercher un produit"
              className="bg-transparent border-none outline-none text-sm flex-1"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            {filtered.map(p => (
              <button
                key={p.sku}
                type="button"
                onClick={() => addProduct(p.sku)}
                aria-label={`Ajouter ${p.name} à la soumission`}
                className="text-left border border-zinc-200 rounded-lg overflow-hidden hover:border-[#0052CC] hover:shadow-md transition-all bg-white group focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC] focus-visible:ring-offset-2"
              >
                <div className="aspect-square bg-zinc-100 relative">
                  {p.imageDevant && <img src={p.imageDevant} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover" />}
                  <div className="absolute inset-0 bg-[#0052CC]/0 group-hover:bg-[#0052CC]/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all">
                    <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-md">
                      <Plus size={16} className="text-[#0052CC]" aria-hidden="true" />
                    </div>
                  </div>
                </div>
                <div className="p-2">
                  <div className="text-[11px] font-mono text-zinc-400">{p.sku}</div>
                  <div className="text-xs font-bold truncate">{p.name}</div>
                  <div className="text-[11px] font-bold text-[#0052CC]">{p.basePrice.toFixed(2)} $</div>
                </div>
              </button>
            ))}
          </div>
        </aside>

        <main className="p-4 md:p-6 overflow-y-auto">
          {items.length === 0 ? (
            <div className="border-2 border-dashed border-zinc-200 rounded-2xl p-16 text-center bg-white">
              <div className="text-zinc-400 text-sm">
                Sélectionne des produits dans le catalogue pour commencer
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {items.map(it => {
                const product = PRODUCTS.find(p => p.sku === it.productSku);
                return (
                  <QuoteLineItemRow
                    key={it.id}
                    item={it}
                    product={product}
                    onPatch={patch => updateItem(it.id, patch)}
                    onRemove={() => removeItem(it.id)}
                  />
                );
              })}
            </div>
          )}
        </main>

        <aside className="bg-white border-l border-zinc-200 p-5 space-y-4">
          <div>
            <h2 className="font-bold text-sm mb-3">Client</h2>
            <label className="flex flex-col gap-1 mb-2">
              <span className="text-[11px] text-zinc-500 uppercase tracking-wider">Nom du client</span>
              <input
                value={clientName}
                onChange={e => setClientName(e.target.value)}
                placeholder="Entreprise ABC"
                className="border border-zinc-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#0052CC]"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[11px] text-zinc-500 uppercase tracking-wider">Courriel *</span>
              {(() => {
                const invalid = clientEmail.trim().length > 0 && !isValidEmail(clientEmail);
                return (
                  <input
                    type="email"
                    value={clientEmail}
                    onChange={e => setClientEmail(e.target.value)}
                    placeholder="client@entreprise.ca"
                    aria-invalid={invalid || undefined}
                    className={`border rounded-lg px-3 py-2 text-sm outline-none ${
                      invalid ? 'border-rose-300 focus:border-rose-500' : 'border-zinc-200 focus:border-[#0052CC]'
                    }`}
                  />
                );
              })()}
            </label>
          </div>

          <div>
            <h2 className="font-bold text-sm mb-3">Rabais</h2>
            <div className="flex gap-2" role="radiogroup" aria-label="Type de rabais">
              <button
                type="button"
                role="radio"
                aria-checked={discountKind === 'percent'}
                onClick={() => setDiscountKind('percent')}
                className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-lg text-sm font-bold border focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC] focus-visible:ring-offset-1 ${
                  discountKind === 'percent' ? 'border-[#0052CC] bg-[#0052CC]/5 text-[#0052CC]' : 'border-zinc-200 text-zinc-500'
                }`}
              >
                <Percent size={14} aria-hidden="true" />%
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={discountKind === 'flat'}
                onClick={() => setDiscountKind('flat')}
                className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-lg text-sm font-bold border focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC] focus-visible:ring-offset-1 ${
                  discountKind === 'flat' ? 'border-[#0052CC] bg-[#0052CC]/5 text-[#0052CC]' : 'border-zinc-200 text-zinc-500'
                }`}
              >
                <DollarSign size={14} aria-hidden="true" />$
              </button>
            </div>
            <input
              type="number"
              value={discountValue}
              onChange={e => setDiscountValue(e.target.value)}
              placeholder="0"
              // decimal (not numeric) so mobile shows a keypad that
              // includes the period — discount can be fractional
              // percent or dollar amounts. min="0" prevents the spinner
              // arrows from clicking into negative territory.
              inputMode="decimal"
              min={0}
              className="w-full mt-2 border border-zinc-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#0052CC]"
              aria-label={discountKind === 'percent' ? 'Valeur du rabais en pourcentage' : 'Valeur du rabais en dollars'}
            />
          </div>

          <div>
            <h2 className="font-bold text-sm mb-2">Notes</h2>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
              maxLength={2000}
              placeholder="Instructions internes, détails spéciaux…"
              className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#0052CC] resize-none"
              aria-label="Notes internes"
            />
            <div className="text-[10px] text-zinc-400 mt-1 text-right font-mono">
              {notes.length}/2000
            </div>
          </div>

          <div className="border-t border-zinc-200 pt-3 space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-zinc-500">Sous-total</span>
              <span className="font-semibold">{subtotal.toFixed(2)} $</span>
            </div>
            {discountAmount > 0 && (
              <div className="flex justify-between text-emerald-700">
                <span>Rabais</span>
                <span className="font-semibold">- {discountAmount.toFixed(2)} $</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-zinc-500">Taxes (14.975%)</span>
              <span className="font-semibold">{tax.toFixed(2)} $</span>
            </div>
            <div className="flex justify-between pt-2 border-t border-zinc-100 text-base">
              <span className="font-bold">Total</span>
              <span className="font-extrabold text-[#0052CC]">{total.toFixed(2)} $</span>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

// ── Per-product builder row ─────────────────────────────────────────────────
// One row = one product in the quote. Pulls real Shopify colors for the
// handle, filters to colors that actually have a COLOR_IMAGES entry (so no
// orphan swatches), lets the vendor pick multiple colors + fill a per-color
// size/qty matrix + pick a logo placement. Live total below.
function QuoteLineItemRow({
  item,
  product,
  onPatch,
  onRemove,
}: {
  item: LineItem;
  product: Product | undefined;
  onPatch: (patch: Partial<LineItem>) => void;
  onRemove: () => void;
}) {
  const { data: shopifyColors, isLoading } = useProductColors(item.shopifyHandle);

  // Only offer colors that (a) come back from Shopify AND (b) have a
  // COLOR_IMAGES entry in products.ts. The latter guarantees the swatch
  // preview image will resolve — avoids showing orphan swatches that'd
  // render a broken preview in the /quote/:id invoice later.
  const availableColors = useMemo<ShopifyVariantColor[]>(() => {
    if (!shopifyColors || !product) return [];
    return shopifyColors.filter(c => {
      if (!c.availableForSale) return false;
      const hit = findColorImage(product.sku, c.colorName);
      return !!hit;
    });
  }, [shopifyColors, product]);

  // Variant price: prefer the live Shopify variant price for the first
  // selected color (matches what the client will pay on Shopify). Fall
  // back to the product-level basePrice from products.ts if no color is
  // picked yet or the Shopify fetch hasn't returned.
  const liveUnitPrice = useMemo(() => {
    if (!shopifyColors || item.colors.length === 0) return item.unitPrice;
    const first = shopifyColors.find(c => c.colorName === item.colors[0]);
    if (!first) return item.unitPrice;
    const parsed = parseFloat(first.price);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : item.unitPrice;
  }, [shopifyColors, item.colors, item.unitPrice]);

  // Sync the live price back into the stored item whenever it drifts —
  // this keeps the quote total, the persisted snapshot, and the email
  // preview all reading the same authoritative Shopify number without
  // requiring the vendor to re-save anything.
  if (liveUnitPrice !== item.unitPrice) {
    // Defer the state update via microtask so we don't setState during
    // render and trigger React's "cannot update during render" warning.
    queueMicrotask(() => onPatch({ unitPrice: liveUnitPrice }));
  }

  const totalQty = totalQtyForItem(item);
  const zones = PLACEMENT_ZONES[item.placement];
  const baseFee = item.unitPrice * totalQty;
  const printFee = PRINT_PRICE * zones * totalQty;
  const lineTotal = baseFee + printFee;

  const toggleColor = (name: string) => {
    const isOn = item.colors.includes(name);
    const nextColors = isOn ? item.colors.filter(c => c !== name) : [...item.colors, name];
    // When removing a color, also drop its matrix row so we don't keep
    // stale qty numbers for a color the vendor decided not to ship.
    const nextMatrix = { ...item.sizeQuantities };
    if (isOn) {
      delete nextMatrix[name];
    } else if (!nextMatrix[name]) {
      nextMatrix[name] = {};
    }
    onPatch({ colors: nextColors, sizeQuantities: nextMatrix });
  };

  const setCellQty = (color: string, size: SizeCol, raw: string) => {
    // Clamp: negatives become 0, non-numeric strings become 0. Anything
    // above 10000 is almost certainly a typo — cap it so a slipped zero
    // doesn't produce a 5-figure bill in the summary without the vendor
    // noticing.
    const n = Math.max(0, Math.min(10000, parseInt(raw, 10) || 0));
    const row = { ...(item.sizeQuantities[color] ?? {}) };
    if (n === 0) delete row[size];
    else row[size] = n;
    onPatch({ sizeQuantities: { ...item.sizeQuantities, [color]: row } });
  };

  return (
    <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden shadow-sm">
      {/* Header: product identity + remove */}
      <div className="flex gap-4 p-4 border-b border-zinc-100">
        <img src={item.image} alt="" className="w-16 h-16 rounded-lg object-cover bg-zinc-100 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-[11px] text-zinc-500 uppercase tracking-wider">Produit</div>
          <div className="font-bold text-sm truncate">{item.productName}</div>
          <div className="text-[11px] font-mono text-zinc-400">{item.productSku}</div>
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="w-8 h-8 rounded-lg text-zinc-400 hover:bg-rose-50 hover:text-rose-600 flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-1 flex-shrink-0"
          aria-label={`Retirer ${item.productName}`}
        >
          <Trash2 size={15} aria-hidden="true" />
        </button>
      </div>

      {/* A2 — Color palette swatches */}
      <div className="p-4 border-b border-zinc-100">
        <div className="flex items-baseline justify-between mb-2">
          <h3 className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">
            Couleurs disponibles
          </h3>
          <span className="text-[11px] text-zinc-400">
            {item.colors.length > 0 ? `${item.colors.length} sélectionnée${item.colors.length > 1 ? 's' : ''}` : 'Aucune'}
          </span>
        </div>
        {isLoading ? (
          <div className="text-xs text-zinc-400 italic py-2">Chargement des couleurs Shopify…</div>
        ) : availableColors.length === 0 ? (
          <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            Aucune couleur disponible pour ce produit sur Shopify.
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {availableColors.map(c => {
              const selected = item.colors.includes(c.colorName);
              return (
                <button
                  key={c.variantId}
                  type="button"
                  onClick={() => toggleColor(c.colorName)}
                  aria-pressed={selected}
                  aria-label={`${selected ? 'Retirer' : 'Ajouter'} la couleur ${c.colorName}`}
                  title={c.colorName}
                  className={`group relative flex items-center gap-2 pl-1 pr-2.5 py-1 rounded-full border text-[12px] font-semibold transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[#E8A838] focus-visible:ring-offset-1 ${
                    selected
                      ? 'border-[#1B3A6B] bg-[#1B3A6B]/5 text-[#1B3A6B] shadow-sm'
                      : 'border-zinc-200 text-zinc-600 hover:border-zinc-400'
                  }`}
                >
                  <span
                    className={`w-6 h-6 rounded-full border ${selected ? 'border-[#E8A838] ring-2 ring-[#E8A838]/40' : 'border-zinc-300'}`}
                    style={{ backgroundColor: c.hex }}
                    aria-hidden="true"
                  />
                  <span>{c.colorName}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* A3 — Size × qty matrix, one row per selected color */}
      {item.colors.length > 0 && (
        <div className="p-4 border-b border-zinc-100 overflow-x-auto">
          <h3 className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 mb-2">
            Tailles et quantités par couleur
          </h3>
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="text-[11px] uppercase tracking-wider text-zinc-500">
                <th className="text-left font-semibold py-1.5 pr-3 w-[140px]">Couleur</th>
                {SIZE_COLUMNS.map(s => (
                  <th key={s} className="text-center font-semibold py-1.5 px-1 w-[56px]">
                    {s}
                  </th>
                ))}
                <th className="text-right font-semibold py-1.5 pl-3 w-[60px]">Total</th>
              </tr>
            </thead>
            <tbody>
              {item.colors.map(colorName => {
                const row = item.sizeQuantities[colorName] ?? {};
                const colorHex =
                  availableColors.find(a => a.colorName === colorName)?.hex ?? '#888';
                const rowTotal = SIZE_COLUMNS.reduce((s, sz) => s + (row[sz] ?? 0), 0);
                return (
                  <tr key={colorName} className="border-t border-zinc-100">
                    <td className="py-1.5 pr-3">
                      <span className="flex items-center gap-2">
                        <span
                          className="w-4 h-4 rounded-full border border-zinc-300 flex-shrink-0"
                          style={{ backgroundColor: colorHex }}
                          aria-hidden="true"
                        />
                        <span className="font-semibold truncate">{colorName}</span>
                      </span>
                    </td>
                    {SIZE_COLUMNS.map(sz => (
                      <td key={sz} className="py-1 px-1">
                        <input
                          type="number"
                          inputMode="numeric"
                          min={0}
                          step={1}
                          value={row[sz] ?? ''}
                          onChange={e => setCellQty(colorName, sz, e.target.value)}
                          placeholder="0"
                          aria-label={`Quantité ${colorName} taille ${sz}`}
                          className="w-full border border-zinc-200 rounded px-1.5 py-1 text-sm text-center outline-none focus:border-[#0052CC] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                      </td>
                    ))}
                    <td className="py-1.5 pl-3 text-right font-bold text-[#1B3A6B]">
                      {rowTotal}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* A4 — Placement selector */}
      <div className="p-4 border-b border-zinc-100">
        <h3 className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 mb-2">
          Placement du logo
        </h3>
        <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Placement du logo">
          {(['front', 'back', 'both'] as const).map(p => {
            const active = item.placement === p;
            return (
              <button
                key={p}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => onPatch({ placement: p })}
                className={`flex flex-col items-center justify-center py-2 rounded-lg border text-sm font-bold transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[#E8A838] focus-visible:ring-offset-1 ${
                  active
                    ? 'border-[#1B3A6B] bg-[#1B3A6B] text-white shadow-sm'
                    : 'border-zinc-200 text-zinc-600 hover:border-zinc-400 bg-white'
                }`}
              >
                <span>{PLACEMENT_LABEL[p]}</span>
                <span className={`text-[10px] font-normal mt-0.5 ${active ? 'text-[#E8A838]' : 'text-zinc-400'}`}>
                  {PLACEMENT_ZONES[p]} zone{PLACEMENT_ZONES[p] > 1 ? 's' : ''}
                </span>
              </button>
            );
          })}
        </div>
        <label className="flex flex-col gap-1 mt-3">
          <span className="text-[11px] text-zinc-500 uppercase tracking-wider">Note de placement (optionnel)</span>
          <input
            value={item.placementNote}
            onChange={e => onPatch({ placementNote: e.target.value })}
            maxLength={120}
            placeholder="Ex. Coeur gauche, dos en bas"
            aria-label="Note de placement"
            className="w-full border border-zinc-200 rounded-lg px-2 py-1 text-sm outline-none focus:border-[#0052CC]"
          />
        </label>
      </div>

      {/* Live pricing breakdown */}
      <div className="p-4 bg-[#1B3A6B]/[0.03] flex flex-wrap items-baseline justify-between gap-3">
        <div className="text-xs text-zinc-500 space-y-0.5">
          <div>
            <span className="font-semibold text-zinc-700">Prix unitaire :</span>{' '}
            {item.unitPrice.toFixed(2)} $
            <span className="text-zinc-400"> · Shopify</span>
          </div>
          <div>
            <span className="font-semibold text-zinc-700">Frais d&apos;impression :</span>{' '}
            {PRINT_PRICE.toFixed(2)} $ × {zones} zone{zones > 1 ? 's' : ''} × {totalQty} unité{totalQty > 1 ? 's' : ''} = {printFee.toFixed(2)} $
          </div>
          <div>
            <span className="font-semibold text-zinc-700">Quantité totale :</span> {totalQty}
          </div>
        </div>
        <div className="text-right">
          <div className="text-[11px] text-zinc-500 uppercase tracking-wider">Sous-total ligne</div>
          <div className="font-extrabold text-xl text-[#1B3A6B]">
            {lineTotal.toFixed(2)} <span className="text-sm font-bold text-[#E8A838]">$</span>
          </div>
        </div>
      </div>
    </div>
  );
}
