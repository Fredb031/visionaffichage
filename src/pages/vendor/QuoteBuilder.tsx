import { useMemo, useState } from 'react';
import { Search, Plus, Trash2, Send, Percent, DollarSign, Save } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { toast } from 'sonner';
import { PRODUCTS } from '@/data/products';
import { isValidEmail } from '@/lib/utils';

interface LineItem {
  id: string;
  productSku: string;
  productName: string;
  image: string;
  color: string;
  size: string;
  quantity: number;
  unitPrice: number;
  placementNote: string;
}

export default function QuoteBuilder() {
  const location = useLocation();
  const isAdminPath = location.pathname.startsWith('/admin');
  const backHref = isAdminPath ? '/admin/quotes' : '/vendor';
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
        image: product.imageDevant,
        color: '',
        size: 'M',
        quantity: 10,
        unitPrice: product.basePrice,
        placementNote: '',
      },
    ]);
  };

  const updateItem = (id: string, patch: Partial<LineItem>) => {
    setItems(prev => prev.map(it => (it.id === id ? { ...it, ...patch } : it)));
  };

  const removeItem = (id: string) => setItems(prev => prev.filter(it => it.id !== id));

  const subtotal = items.reduce((s, it) => s + it.unitPrice * it.quantity, 0);
  const discountAmount = (() => {
    const v = parseFloat(discountValue) || 0;
    if (discountKind === 'percent') return (subtotal * v) / 100;
    return v;
  })();
  const tax = (subtotal - discountAmount) * 0.14975;
  const total = subtotal - discountAmount + tax;

  // Mirror the checkout email validation so a vendor can't "Send to
  // client" a quote addressed to "@" or "foo@" — those silently bounce
  // and the vendor thinks the client received it. Also require every
  // line to have a positive quantity so a stray 0 doesn't go out.
  const everyItemValid = items.length > 0 && items.every(it => it.quantity > 0);
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
    const quote = {
      id: `q-${Date.now()}`,
      number,
      status,
      clientName,
      clientEmail,
      items,
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
    const q = persistQuote('sent');
    const lines = items.map(it =>
      `• ${it.productName} (${it.color || '—'}, ${it.size}) × ${it.quantity} = ${(it.unitPrice * it.quantity).toFixed(2)} $${it.placementNote ? ` — Placement: ${it.placementNote}` : ''}`,
    ).join('\n');
    const subject = encodeURIComponent(`Ta soumission ${q.number} de Vision Affichage`);
    const body = encodeURIComponent(
      `Bonjour ${clientName || ''},\n\n` +
      `Voici ta soumission personnalisée :\n\n` +
      `${lines}\n\n` +
      `Sous-total : ${subtotal.toFixed(2)} $\n` +
      `${discountAmount > 0 ? `Rabais : -${discountAmount.toFixed(2)} $\n` : ''}` +
      `Taxes : ${tax.toFixed(2)} $\n` +
      `Total : ${total.toFixed(2)} $ CAD\n\n` +
      `Pour accepter et payer : https://visionaffichage.com/quote/${q.id}\n\n` +
      `Livraison en 5 jours ouvrables après confirmation.\n\n` +
      `— L'équipe Vision Affichage`,
    );
    // Encode the recipient too — merchants occasionally enter an email
    // with `+alias@…` or spaces that would break the URL otherwise.
    window.location.href = `mailto:${encodeURIComponent(clientEmail)}?subject=${subject}&body=${body}`;
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
            <div className="space-y-3">
              {items.map(it => (
                <div key={it.id} className="bg-white border border-zinc-200 rounded-xl p-4 flex gap-4">
                  <img src={it.image} alt="" className="w-20 h-20 rounded-lg object-cover bg-zinc-100 flex-shrink-0" />
                  <div className="flex-1 grid grid-cols-2 md:grid-cols-5 gap-2">
                    <div className="col-span-2">
                      <div className="text-[11px] text-zinc-500 uppercase tracking-wider">Produit</div>
                      <div className="font-bold text-sm">{it.productName}</div>
                      <div className="text-[11px] font-mono text-zinc-400">{it.productSku}</div>
                    </div>
                    <LabeledInput label="Couleur" value={it.color} onChange={v => updateItem(it.id, { color: v })} placeholder="Ex. Noir" />
                    <LabeledSelect
                      label="Taille"
                      value={it.size}
                      onChange={v => updateItem(it.id, { size: v })}
                      options={['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL']}
                    />
                    <LabeledInput
                      label="Qté"
                      type="number"
                      value={String(it.quantity)}
                      onChange={v => updateItem(it.id, { quantity: parseInt(v) || 0 })}
                    />
                    <div className="col-span-2">
                      <div className="text-[11px] text-zinc-500 uppercase tracking-wider">Placement du logo</div>
                      <input
                        value={it.placementNote}
                        onChange={e => updateItem(it.id, { placementNote: e.target.value })}
                        placeholder="Ex. Coeur gauche, dos en bas"
                        className="w-full border border-zinc-200 rounded-lg px-2 py-1 text-sm outline-none focus:border-[#0052CC]"
                      />
                    </div>
                    <div className="col-span-2 md:col-span-3 flex items-center justify-end gap-3">
                      <div className="text-right">
                        <div className="text-[11px] text-zinc-500">Prix unitaire</div>
                        <div className="font-bold">{it.unitPrice.toFixed(2)} $</div>
                      </div>
                      <div className="text-right">
                        <div className="text-[11px] text-zinc-500">Sous-total</div>
                        <div className="font-extrabold text-[#0052CC]">{(it.unitPrice * it.quantity).toFixed(2)} $</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeItem(it.id)}
                        className="w-8 h-8 rounded-lg text-zinc-400 hover:bg-rose-50 hover:text-rose-600 flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-1"
                        aria-label={`Retirer ${it.productName}`}
                      >
                        <Trash2 size={15} aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
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
              <input
                type="email"
                value={clientEmail}
                onChange={e => setClientEmail(e.target.value)}
                placeholder="client@entreprise.ca"
                className="border border-zinc-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#0052CC]"
              />
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
              className="w-full mt-2 border border-zinc-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#0052CC]"
            />
          </div>

          <div>
            <h2 className="font-bold text-sm mb-2">Notes</h2>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
              placeholder="Instructions internes, détails spéciaux…"
              className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#0052CC] resize-none"
            />
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

function LabeledInput({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <label className="flex flex-col gap-0.5">
      <span className="text-[11px] text-zinc-500 uppercase tracking-wider">{label}</span>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="border border-zinc-200 rounded-lg px-2 py-1 text-sm outline-none focus:border-[#0052CC]"
      />
    </label>
  );
}

function LabeledSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <label className="flex flex-col gap-0.5">
      <span className="text-[11px] text-zinc-500 uppercase tracking-wider">{label}</span>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="border border-zinc-200 rounded-lg px-2 py-1 text-sm outline-none focus:border-[#0052CC] bg-white"
      >
        {options.map(o => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    </label>
  );
}
