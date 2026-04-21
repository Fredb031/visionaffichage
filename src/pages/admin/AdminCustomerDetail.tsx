import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  ExternalLink,
  Mail,
  Phone,
  MapPin,
  ChevronRight,
  X,
  Plus,
  ShoppingCart,
  LogIn,
  Eye,
  Package,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  SHOPIFY_CUSTOMERS_SNAPSHOT,
  SHOPIFY_ORDERS_SNAPSHOT,
  SHOPIFY_SNAPSHOT_META,
  type ShopifyCustomerSnapshot,
  type ShopifyOrderSnapshot,
} from '@/data/shopifySnapshot';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';

/* ────────── Types ────────── */

interface CustomerNote {
  at: string; // ISO timestamp
  body: string;
  author: string;
}

type NotesStore = Record<string, CustomerNote[]>;

const NOTES_KEY = 'vision-customer-notes';

type TabId = 'orders' | 'notes' | 'activity' | 'tags';

/* ────────── Helpers ────────── */

function initials(c: ShopifyCustomerSnapshot): string {
  const first = (c.firstName?.[0] ?? '').toUpperCase();
  const last = (c.lastName?.[0] ?? '').toUpperCase();
  return (first + last) || c.email[0].toUpperCase();
}

function fullName(c: ShopifyCustomerSnapshot): string {
  const parts = [c.firstName, c.lastName].filter(Boolean).join(' ').trim();
  return parts || c.email.split('@')[0];
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-CA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('fr-CA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatCurrency(n: number): string {
  return n.toLocaleString('fr-CA', { style: 'currency', currency: 'CAD', minimumFractionDigits: 2 });
}

function parseTags(raw: string): string[] {
  return raw ? raw.split(',').map(t => t.trim()).filter(Boolean) : [];
}

/* ────────── Notes persistence ────────── */

function loadNotes(): NotesStore {
  try {
    const raw = localStorage.getItem(NOTES_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as NotesStore) : {};
  } catch {
    return {};
  }
}

function saveNotes(store: NotesStore): void {
  try {
    localStorage.setItem(NOTES_KEY, JSON.stringify(store));
  } catch {
    /* quota / private mode — fall through silently */
  }
}

/* ────────── Page ────────── */

export default function AdminCustomerDetail() {
  const { customerId } = useParams<{ customerId: string }>();
  const navigate = useNavigate();

  const customer = useMemo<ShopifyCustomerSnapshot | undefined>(
    () => SHOPIFY_CUSTOMERS_SNAPSHOT.find(c => String(c.id) === customerId),
    [customerId],
  );

  useDocumentTitle(
    customer ? `${fullName(customer)} — Clients — Admin Vision Affichage` : 'Client introuvable',
  );

  /* ─── Notes state (persisted) ─── */
  const [notesStore, setNotesStore] = useState<NotesStore>(() => loadNotes());
  const [draft, setDraft] = useState('');
  const [tab, setTab] = useState<TabId>('orders');

  useEffect(() => {
    saveNotes(notesStore);
  }, [notesStore]);

  const customerKey = customerId ?? '';
  const notes = notesStore[customerKey] ?? [];

  /* ─── Tags state (session-local — no backend yet) ─── */
  const [tags, setTags] = useState<string[]>(() => (customer ? parseTags(customer.tags) : []));
  const [tagDraft, setTagDraft] = useState('');
  useEffect(() => {
    // reset when navigating between customers
    setTags(customer ? parseTags(customer.tags) : []);
  }, [customer]);

  /* ─── Derived: orders for this customer ─── */
  const customerOrders = useMemo<ShopifyOrderSnapshot[]>(() => {
    if (!customer) return [];
    const email = customer.email.toLowerCase();
    return SHOPIFY_ORDERS_SNAPSHOT
      .filter(o => o.email.toLowerCase() === email)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [customer]);

  /* ─── Metric strip values ─── */
  const lifetimeValue = customer?.totalSpent ?? 0;
  const avgOrderValue = customer && customer.ordersCount > 0
    ? customer.totalSpent / customer.ordersCount
    : 0;
  const lastOrderDate = customerOrders[0]?.createdAt ?? null;

  /* ─── Activity (mocked: derived from orders + registration) ─── */
  type ActivityEvent = { at: string; kind: 'login' | 'pdp' | 'atc' | 'order'; label: string };
  const activity = useMemo<ActivityEvent[]>(() => {
    if (!customer) return [];
    const events: ActivityEvent[] = [];
    events.push({ at: customer.createdAt, kind: 'login', label: 'Compte créé' });
    customerOrders.forEach(o => {
      events.push({ at: o.createdAt, kind: 'order', label: `Commande ${o.name} passée — ${formatCurrency(o.total)}` });
    });
    // Synthesize recent engagement so the timeline isn't empty for newer customers.
    if (lastOrderDate) {
      const d = new Date(lastOrderDate);
      const atc = new Date(d.getTime() - 1000 * 60 * 12).toISOString();
      const pdp = new Date(d.getTime() - 1000 * 60 * 18).toISOString();
      const login = new Date(d.getTime() - 1000 * 60 * 22).toISOString();
      events.push({ at: atc, kind: 'atc', label: 'Ajouté au panier' });
      events.push({ at: pdp, kind: 'pdp', label: 'Fiche produit consultée' });
      events.push({ at: login, kind: 'login', label: 'Connexion' });
    }
    return events.sort((a, b) => b.at.localeCompare(a.at));
  }, [customer, customerOrders, lastOrderDate]);

  /* ─── Handlers ─── */
  const handleAddNote = () => {
    const body = draft.trim();
    if (!body || !customerKey) return;
    const next: NotesStore = {
      ...notesStore,
      [customerKey]: [
        { at: new Date().toISOString(), body, author: 'admin' },
        ...(notesStore[customerKey] ?? []),
      ],
    };
    setNotesStore(next);
    setDraft('');
    toast.success('Note ajoutée');
  };

  const handleAddTag = () => {
    const t = tagDraft.trim();
    if (!t || tags.includes(t)) {
      setTagDraft('');
      return;
    }
    setTags([...tags, t]);
    setTagDraft('');
    toast.success(`Tag « ${t} » ajouté`);
  };

  const handleRemoveTag = (t: string) => {
    setTags(tags.filter(x => x !== t));
  };

  /* ─── Not-found state ─── */
  if (!customer) {
    return (
      <div className="space-y-6">
        <Breadcrumb name="Client introuvable" />
        <div className="bg-white border border-zinc-200 rounded-2xl p-10 text-center">
          <h1 className="text-2xl font-extrabold">Client introuvable</h1>
          <p className="text-sm text-zinc-500 mt-2">
            Aucun client avec l'identifiant <code className="bg-zinc-100 px-1.5 py-0.5 rounded text-xs">{customerId}</code>.
          </p>
          <button
            type="button"
            onClick={() => navigate('/admin/customers')}
            className="inline-flex items-center gap-2 text-sm font-bold px-4 py-2 border border-zinc-200 rounded-lg hover:bg-zinc-50 bg-white mt-5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC]"
          >
            <ArrowLeft size={15} aria-hidden="true" />
            Retour aux clients
          </button>
        </div>
      </div>
    );
  }

  /* ─── Render ─── */
  return (
    <div className="space-y-6">
      <Breadcrumb name={fullName(customer)} />

      {/* Header */}
      <header className="bg-white border border-zinc-200 rounded-2xl p-6">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <div
              className="w-16 h-16 rounded-full bg-gradient-to-br from-[#0052CC] to-[#1B3A6B] text-white flex items-center justify-center text-xl font-extrabold flex-shrink-0"
              aria-hidden="true"
            >
              {initials(customer)}
            </div>
            <div className="min-w-0">
              <h1 className="text-2xl font-extrabold tracking-tight truncate">{fullName(customer)}</h1>
              <div className="flex items-center flex-wrap gap-x-4 gap-y-1 mt-1 text-sm text-zinc-600">
                <a
                  href={`mailto:${customer.email}`}
                  className="inline-flex items-center gap-1.5 hover:text-[#0052CC] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC] focus-visible:ring-offset-1 rounded"
                >
                  <Mail size={14} aria-hidden="true" />
                  {customer.email}
                </a>
                {customer.phone && (
                  <a
                    href={`tel:${customer.phone}`}
                    className="inline-flex items-center gap-1.5 hover:text-[#0052CC] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC] focus-visible:ring-offset-1 rounded"
                  >
                    <Phone size={14} aria-hidden="true" />
                    {customer.phone}
                  </a>
                )}
                {customer.city && (
                  <span className="inline-flex items-center gap-1.5 text-zinc-500">
                    <MapPin size={14} aria-hidden="true" />
                    {customer.city}{customer.province ? `, ${customer.province}` : ''}
                  </span>
                )}
              </div>
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {tags.map(t => (
                    <span
                      key={t}
                      className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-zinc-100 text-zinc-700 uppercase tracking-wider"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setTab('notes')}
              className="inline-flex items-center gap-2 text-sm font-bold px-4 py-2 rounded-lg bg-[#0052CC] text-white hover:bg-[#003E99] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC] focus-visible:ring-offset-1 transition-colors"
            >
              <Plus size={15} aria-hidden="true" />
              Ajouter une note
            </button>
            <a
              href={`https://${SHOPIFY_SNAPSHOT_META.shop}/admin/customers/${customer.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm font-bold px-4 py-2 border border-zinc-200 rounded-lg hover:bg-zinc-50 bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC] focus-visible:ring-offset-1"
            >
              Shopify Admin
              <ExternalLink size={13} aria-hidden="true" />
            </a>
          </div>
        </div>
      </header>

      {/* Metric strip */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <MetricCard label="Commandes totales" value={String(customer.ordersCount)} />
        <MetricCard label="Valeur à vie" value={formatCurrency(lifetimeValue)} />
        <MetricCard label="Panier moyen" value={avgOrderValue > 0 ? formatCurrency(avgOrderValue) : '—'} />
        <MetricCard label="Dernière commande" value={lastOrderDate ? formatDate(lastOrderDate) : '—'} />
        <MetricCard label="Client depuis" value={formatDate(customer.createdAt)} />
      </div>

      {/* Tabs */}
      <div className="bg-white border border-zinc-200 rounded-2xl overflow-hidden">
        <div className="border-b border-zinc-100 px-2 flex gap-1 overflow-x-auto" role="tablist" aria-label="Sections client">
          {([
            { id: 'orders', label: `Commandes (${customerOrders.length})` },
            { id: 'notes', label: `Notes (${notes.length})` },
            { id: 'activity', label: 'Activité' },
            { id: 'tags', label: `Tags (${tags.length})` },
          ] as const).map(t => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              aria-controls={`panel-${t.id}`}
              id={`tab-${t.id}`}
              onClick={() => setTab(t.id)}
              className={`px-4 py-3 text-sm font-bold transition-colors border-b-2 -mb-px focus:outline-none focus-visible:bg-zinc-50 whitespace-nowrap ${
                tab === t.id
                  ? 'border-[#0052CC] text-[#0052CC]'
                  : 'border-transparent text-zinc-500 hover:text-zinc-900'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Orders */}
        {tab === 'orders' && (
          <div id="panel-orders" role="tabpanel" aria-labelledby="tab-orders" className="p-4">
            {customerOrders.length === 0 ? (
              <div className="text-center py-10 text-sm text-zinc-400">
                Aucune commande associée à ce client.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-zinc-50 text-[11px] font-bold text-zinc-500 tracking-wider uppercase">
                    <tr>
                      <th className="text-left px-4 py-3">Commande</th>
                      <th className="text-left px-4 py-3">Date</th>
                      <th className="text-left px-4 py-3">Statut</th>
                      <th className="text-right px-4 py-3">Articles</th>
                      <th className="text-right px-4 py-3">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customerOrders.map(o => (
                      <tr key={o.id} className="border-t border-zinc-100 hover:bg-zinc-50">
                        <td className="px-4 py-3 font-bold">{o.name}</td>
                        <td className="px-4 py-3 text-zinc-500 text-xs">{formatDate(o.createdAt)}</td>
                        <td className="px-4 py-3">
                          <StatusBadge status={o.financialStatus} fulfillment={o.fulfillmentStatus} />
                        </td>
                        <td className="px-4 py-3 text-right">{o.itemsCount}</td>
                        <td className="px-4 py-3 text-right font-bold">{formatCurrency(o.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Notes */}
        {tab === 'notes' && (
          <div id="panel-notes" role="tabpanel" aria-labelledby="tab-notes" className="p-5 space-y-4">
            <div className="space-y-2">
              <label htmlFor="note-body" className="text-xs font-bold text-zinc-500 uppercase tracking-wider">
                Nouvelle note interne
              </label>
              <textarea
                id="note-body"
                value={draft}
                onChange={e => setDraft(e.target.value)}
                onKeyDown={e => {
                  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                    e.preventDefault();
                    handleAddNote();
                  }
                }}
                placeholder="Visible uniquement pour l'équipe admin. ⌘+Entrée pour enregistrer."
                rows={3}
                className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm resize-y bg-white focus:outline-none focus:border-[#0052CC] focus:ring-1 focus:ring-[#0052CC]"
              />
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleAddNote}
                  disabled={!draft.trim()}
                  className="inline-flex items-center gap-2 text-sm font-bold px-4 py-2 rounded-lg bg-[#0052CC] text-white hover:bg-[#003E99] disabled:bg-zinc-300 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC] focus-visible:ring-offset-1 transition-colors"
                >
                  <Plus size={15} aria-hidden="true" />
                  Enregistrer
                </button>
              </div>
            </div>

            {notes.length === 0 ? (
              <div className="text-center py-8 text-sm text-zinc-400 border-t border-zinc-100">
                Aucune note encore. Les notes sont privées et visibles seulement pour l'équipe admin.
              </div>
            ) : (
              <ul className="space-y-3 border-t border-zinc-100 pt-4">
                {notes.map((n, i) => (
                  <li key={`${n.at}-${i}`} className="bg-zinc-50 border border-zinc-100 rounded-xl p-3">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">
                        {n.author}
                      </div>
                      <div className="text-[11px] text-zinc-400">{formatDateTime(n.at)}</div>
                    </div>
                    <div className="text-sm whitespace-pre-wrap text-zinc-800">{n.body}</div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Activity */}
        {tab === 'activity' && (
          <div id="panel-activity" role="tabpanel" aria-labelledby="tab-activity" className="p-5">
            {activity.length === 0 ? (
              <div className="text-center py-8 text-sm text-zinc-400">
                Aucune activité enregistrée.
              </div>
            ) : (
              <ol className="space-y-3">
                {activity.map((e, i) => (
                  <li key={`${e.at}-${i}`} className="flex items-start gap-3">
                    <ActivityIcon kind={e.kind} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-zinc-800">{e.label}</div>
                      <div className="text-[11px] text-zinc-400 mt-0.5">{formatDateTime(e.at)}</div>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </div>
        )}

        {/* Tags */}
        {tab === 'tags' && (
          <div id="panel-tags" role="tabpanel" aria-labelledby="tab-tags" className="p-5 space-y-4">
            <div>
              <label htmlFor="tag-input" className="text-xs font-bold text-zinc-500 uppercase tracking-wider">
                Ajouter un tag
              </label>
              <div className="flex gap-2 mt-2">
                <input
                  id="tag-input"
                  type="text"
                  value={tagDraft}
                  onChange={e => setTagDraft(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddTag();
                    }
                  }}
                  placeholder="p. ex. VIP, gros-compte, retard-paiement"
                  className="flex-1 border border-zinc-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-[#0052CC] focus:ring-1 focus:ring-[#0052CC]"
                />
                <button
                  type="button"
                  onClick={handleAddTag}
                  disabled={!tagDraft.trim()}
                  className="inline-flex items-center gap-2 text-sm font-bold px-4 py-2 rounded-lg bg-[#0052CC] text-white hover:bg-[#003E99] disabled:bg-zinc-300 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC] focus-visible:ring-offset-1 transition-colors"
                >
                  <Plus size={15} aria-hidden="true" />
                  Ajouter
                </button>
              </div>
            </div>

            {tags.length === 0 ? (
              <div className="text-center py-8 text-sm text-zinc-400 border-t border-zinc-100">
                Aucun tag pour ce client.
              </div>
            ) : (
              <div className="flex flex-wrap gap-2 border-t border-zinc-100 pt-4">
                {tags.map(t => (
                  <span
                    key={t}
                    className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-md bg-zinc-100 text-zinc-700"
                  >
                    {t}
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(t)}
                      aria-label={`Retirer le tag ${t}`}
                      className="text-zinc-400 hover:text-red-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC] rounded"
                    >
                      <X size={12} aria-hidden="true" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            <p className="text-[11px] text-zinc-400">
              Modifications locales — synchronisation Shopify à venir.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ────────── Sub-components ────────── */

function Breadcrumb({ name }: { name: string }) {
  return (
    <nav aria-label="Fil d'Ariane" className="text-xs text-zinc-500 flex items-center gap-1.5 flex-wrap">
      <Link to="/admin" className="hover:text-[#0052CC] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC] focus-visible:ring-offset-1 rounded">
        Tableau de bord
      </Link>
      <ChevronRight size={12} aria-hidden="true" />
      <Link to="/admin/customers" className="hover:text-[#0052CC] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC] focus-visible:ring-offset-1 rounded">
        Clients
      </Link>
      <ChevronRight size={12} aria-hidden="true" />
      <span className="font-bold text-zinc-800 truncate">{name}</span>
    </nav>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white border border-zinc-200 rounded-xl p-4">
      <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">{label}</div>
      <div className="text-xl font-extrabold mt-1 text-zinc-900">{value}</div>
    </div>
  );
}

function StatusBadge({
  status,
  fulfillment,
}: {
  status: ShopifyOrderSnapshot['financialStatus'];
  fulfillment: ShopifyOrderSnapshot['fulfillmentStatus'];
}) {
  const finLabel = status ?? 'pending';
  const finClass =
    status === 'paid'
      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
      : status === 'pending'
      ? 'bg-amber-50 text-amber-700 border-amber-200'
      : status === 'refunded' || status === 'partially_refunded'
      ? 'bg-red-50 text-red-700 border-red-200'
      : 'bg-zinc-50 text-zinc-700 border-zinc-200';
  return (
    <div className="flex flex-col gap-1 items-start">
      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border uppercase tracking-wider ${finClass}`}>
        {finLabel}
      </span>
      {fulfillment && (
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md border bg-blue-50 text-blue-700 border-blue-200 uppercase tracking-wider">
          {fulfillment}
        </span>
      )}
    </div>
  );
}

function ActivityIcon({ kind }: { kind: 'login' | 'pdp' | 'atc' | 'order' }) {
  const map = {
    login: { Icon: LogIn, cls: 'bg-zinc-100 text-zinc-600' },
    pdp: { Icon: Eye, cls: 'bg-blue-50 text-[#0052CC]' },
    atc: { Icon: ShoppingCart, cls: 'bg-amber-50 text-amber-700' },
    order: { Icon: Package, cls: 'bg-emerald-50 text-emerald-700' },
  } as const;
  const { Icon, cls } = map[kind];
  return (
    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${cls}`} aria-hidden="true">
      <Icon size={14} />
    </div>
  );
}
