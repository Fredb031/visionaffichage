import { useEffect, useMemo, useRef, useState } from 'react';
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
import { readLS, writeLS } from '@/lib/storage';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';

/* ────────── Types ────────── */

interface CustomerNote {
  at: string; // ISO timestamp
  body: string;
  author: string;
}

type NotesStore = Record<string, CustomerNote[]>;
type TagsStore = Record<string, string[]>;

const NOTES_KEY = 'vision-customer-notes';
const TAGS_KEY = 'vision-customer-tags';

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
  // readLS swallows the JSON.parse failure so a corrupted notes blob
  // (left by an older build or a devtools edit during triage) can't
  // crash the customer detail page on open.
  const parsed = readLS<unknown>(NOTES_KEY, {});
  return parsed && typeof parsed === 'object' ? (parsed as NotesStore) : {};
}

function saveNotes(store: NotesStore): void {
  // writeLS falls through silently on quota / private mode — notes
  // just won't persist, but the in-memory state is still accurate.
  writeLS(NOTES_KEY, store);
}

/* ────────── Tags persistence ────────── */

function loadTagsStore(): TagsStore {
  // Mirrors the notes hydration guard — a corrupted tag blob (wrong
  // shape, half-written, devtools-edited) must not crash the detail
  // page on open. readLS already swallows JSON.parse failures.
  const parsed = readLS<unknown>(TAGS_KEY, {});
  return parsed && typeof parsed === 'object' ? (parsed as TagsStore) : {};
}

function saveTagsStore(store: TagsStore): void {
  writeLS(TAGS_KEY, store);
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

  /* ─── Tags state (persisted per-customer to localStorage) ─── */
  const [tagsStore, setTagsStore] = useState<TagsStore>(() => loadTagsStore());
  // Per-customer tags: local override from store wins; otherwise seed
  // from the Shopify snapshot so first-time visits still show the
  // existing CSV-encoded tags instead of an empty list.
  const tags: string[] = useMemo(() => {
    if (!customer) return [];
    const key = String(customer.id);
    const override = tagsStore[key];
    if (override) return override;
    return parseTags(customer.tags);
  }, [customer, tagsStore]);

  // Inline-edit state: which chip index is being edited, and the
  // buffered input value. -1 means "adding a new tag" when addingTag
  // is true; a non-negative index means "renaming tag at index".
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [addingTag, setAddingTag] = useState(false);
  const [editDraft, setEditDraft] = useState('');
  const editInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    saveTagsStore(tagsStore);
  }, [tagsStore]);

  useEffect(() => {
    // Reset inline-edit scratch state when switching customers — stale
    // edit buffers would otherwise bleed into the next customer's view.
    setEditIndex(null);
    setAddingTag(false);
    setEditDraft('');
  }, [customer]);

  useEffect(() => {
    // Autofocus the inline input whenever we enter an edit/add mode so
    // keyboard users can type immediately without an extra click.
    if (editIndex !== null || addingTag) {
      editInputRef.current?.focus();
      editInputRef.current?.select();
    }
  }, [editIndex, addingTag]);

  const commitTags = (next: string[]) => {
    if (!customer) return;
    const key = String(customer.id);
    setTagsStore(prev => ({ ...prev, [key]: next }));
  };

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

  const startAddTag = () => {
    setEditIndex(null);
    setAddingTag(true);
    setEditDraft('');
  };

  const startEditTag = (index: number) => {
    setAddingTag(false);
    setEditIndex(index);
    setEditDraft(tags[index] ?? '');
  };

  const cancelEdit = () => {
    // Revert to original — nothing else needed since the draft is
    // only buffered, not applied until commit.
    setEditIndex(null);
    setAddingTag(false);
    setEditDraft('');
  };

  const commitEdit = () => {
    const trimmed = editDraft.trim();

    // New-tag flow: bail on empty, silently no-op on duplicate.
    if (addingTag) {
      if (!trimmed) {
        cancelEdit();
        return;
      }
      if (tags.includes(trimmed)) {
        toast.error(`Tag « ${trimmed } » déjà présent`);
        cancelEdit();
        return;
      }
      commitTags([...tags, trimmed]);
      toast.success(`Tag « ${trimmed} » ajouté`);
      cancelEdit();
      return;
    }

    // Rename flow: empty-after-trim removes the tag entirely so a
    // user can clear and blur to delete without reaching for the ×.
    if (editIndex !== null) {
      const original = tags[editIndex];
      if (!trimmed) {
        commitTags(tags.filter((_, i) => i !== editIndex));
        toast.success(`Tag « ${original} » retiré`);
        cancelEdit();
        return;
      }
      // No-change: silently close without writing.
      if (trimmed === original) {
        cancelEdit();
        return;
      }
      // Duplicate against another tag: revert, don't clobber.
      if (tags.some((t, i) => i !== editIndex && t === trimmed)) {
        toast.error(`Tag « ${trimmed} » déjà présent`);
        cancelEdit();
        return;
      }
      const next = tags.map((t, i) => (i === editIndex ? trimmed : t));
      commitTags(next);
      cancelEdit();
    }
  };

  const handleRemoveTag = (index: number) => {
    const removed = tags[index];
    commitTags(tags.filter((_, i) => i !== index));
    if (removed) toast.success(`Tag « ${removed} » retiré`);
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
              <div className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">
                Tags du client
              </div>
              <p className="text-[11px] text-zinc-400 mb-3">
                Cliquer sur un tag pour le renommer. Entrée pour enregistrer, Échap pour annuler.
              </p>
              <div className="flex flex-wrap gap-2">
                {tags.map((t, i) => {
                  const isEditing = editIndex === i;
                  if (isEditing) {
                    return (
                      <input
                        key={`edit-${i}`}
                        ref={editInputRef}
                        type="text"
                        value={editDraft}
                        onChange={e => setEditDraft(e.target.value)}
                        onBlur={commitEdit}
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            commitEdit();
                          } else if (e.key === 'Escape') {
                            e.preventDefault();
                            cancelEdit();
                          }
                        }}
                        aria-label={`Renommer le tag ${t}`}
                        className="inline-flex text-xs font-bold px-3 py-1 rounded-full bg-white border border-[#0052CC] text-zinc-800 outline-none ring-2 ring-[#0052CC]/20 min-w-[6rem]"
                      />
                    );
                  }
                  return (
                    <span
                      key={`${t}-${i}`}
                      className="group inline-flex items-center gap-1.5 text-xs font-bold pl-3 pr-2 py-1 rounded-full bg-zinc-100 border border-zinc-200 text-zinc-700 hover:bg-zinc-50 hover:border-zinc-300 transition-colors"
                    >
                      <button
                        type="button"
                        onClick={() => startEditTag(i)}
                        aria-label={`Modifier le tag ${t}`}
                        className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC] rounded-sm"
                      >
                        {t}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveTag(i)}
                        aria-label={`Retirer le tag ${t}`}
                        className="text-zinc-400 hover:text-red-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC] rounded-full transition-colors"
                      >
                        <X size={12} aria-hidden="true" />
                      </button>
                    </span>
                  );
                })}

                {addingTag ? (
                  <input
                    ref={editInputRef}
                    type="text"
                    value={editDraft}
                    onChange={e => setEditDraft(e.target.value)}
                    onBlur={commitEdit}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        commitEdit();
                      } else if (e.key === 'Escape') {
                        e.preventDefault();
                        cancelEdit();
                      }
                    }}
                    placeholder="Nouveau tag…"
                    aria-label="Nouveau tag"
                    className="inline-flex text-xs font-bold px-3 py-1 rounded-full bg-white border border-[#0052CC] text-zinc-800 outline-none ring-2 ring-[#0052CC]/20 min-w-[7rem]"
                  />
                ) : (
                  <button
                    type="button"
                    onClick={startAddTag}
                    aria-label="Ajouter un tag"
                    className="inline-flex items-center gap-1 text-xs font-bold px-3 py-1 rounded-full bg-white border border-dashed border-zinc-300 text-zinc-500 hover:text-[#0052CC] hover:border-[#0052CC] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC] transition-colors"
                  >
                    <Plus size={12} aria-hidden="true" />
                    Ajouter
                  </button>
                )}
              </div>

              {tags.length === 0 && !addingTag && (
                <div className="text-[11px] text-zinc-400 mt-3">
                  Aucun tag pour ce client. Cliquer sur « Ajouter » pour en créer un.
                </div>
              )}
            </div>

            <p className="text-[11px] text-zinc-400 border-t border-zinc-100 pt-3">
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
