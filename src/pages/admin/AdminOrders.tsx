import { Link } from 'react-router-dom';
import { useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  Package,
  Search,
  Truck,
  XCircle,
} from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { useLang } from '@/lib/langContext';

type OrderStatus = 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';

interface OrderLine {
  title: string;
  variant: string;
  qty: number;
  unitPrice: number;
}

interface Order {
  id: string;
  customer: string;
  company: string;
  email: string;
  createdAt: string;
  total: number;
  status: OrderStatus;
  items: OrderLine[];
  shippingAddress: string;
  notes?: string;
}

// Mock dataset — replaced by real Shopify admin orders when the backend wiring lands.
const MOCK_ORDERS: Order[] = [
  {
    id: '#VA-1042',
    customer: 'Marie Tremblay',
    company: 'Clinique Dentaire du Plateau',
    email: 'marie@cliniqueplateau.ca',
    createdAt: '2025-01-14T10:12:00Z',
    total: 1248.50,
    status: 'processing',
    shippingAddress: '4821 rue Saint-Denis, Montréal, QC H2J 2L6',
    notes: 'Livraison avant le 25 janvier si possible.',
    items: [
      { title: 'Hoodie Premium Navy', variant: 'L · Brodé logo', qty: 12, unitPrice: 72.00 },
      { title: 'Tuque Acrylique Noire', variant: 'Taille unique', qty: 15, unitPrice: 24.00 },
    ],
  },
  {
    id: '#VA-1041',
    customer: 'Jean-François Côté',
    company: 'Construction Côté & Fils',
    email: 'jf@construction-cote.ca',
    createdAt: '2025-01-13T14:48:00Z',
    total: 2180.00,
    status: 'shipped',
    shippingAddress: '112 boul. des Chenaux, Trois-Rivières, QC G9A 1A5',
    items: [
      { title: 'Veste Softshell Imprimée', variant: 'XL · Logo poitrine', qty: 8, unitPrice: 135.00 },
      { title: 'Polo Performance', variant: 'M · Brodé manche', qty: 20, unitPrice: 55.00 },
    ],
  },
  {
    id: '#VA-1040',
    customer: 'Sarah Beauchamp',
    company: 'Studio Beauchamp Design',
    email: 'hello@studiobeauchamp.com',
    createdAt: '2025-01-12T09:03:00Z',
    total: 386.25,
    status: 'delivered',
    shippingAddress: '77 av. du Mont-Royal E, Montréal, QC H2T 1N7',
    items: [
      { title: 'T-shirt Coton Bio Blanc', variant: 'S · Sérigraphie', qty: 15, unitPrice: 22.00 },
    ],
  },
  {
    id: '#VA-1039',
    customer: 'Olivier Lambert',
    company: 'Brasserie La Côte',
    email: 'olivier@brasserielacote.ca',
    createdAt: '2025-01-11T16:30:00Z',
    total: 742.00,
    status: 'pending',
    shippingAddress: '88 rue du Quai, Rimouski, QC G5L 3M5',
    notes: 'Confirmer le Pantone du logo avant production.',
    items: [
      { title: 'Casquette Trucker Noire', variant: 'Taille unique · Patch cuir', qty: 30, unitPrice: 24.00 },
    ],
  },
  {
    id: '#VA-1038',
    customer: 'Isabelle Roy',
    company: 'Académie Sportive Laval',
    email: 'iroy@academielaval.qc.ca',
    createdAt: '2025-01-10T11:21:00Z',
    total: 1980.75,
    status: 'processing',
    shippingAddress: '3200 boul. Le Corbusier, Laval, QC H7L 1V2',
    items: [
      { title: 'Crewneck Fleece Gris', variant: 'M · Brodé', qty: 25, unitPrice: 62.00 },
      { title: 'Tuque à pompon', variant: 'Taille unique', qty: 25, unitPrice: 18.00 },
    ],
  },
  {
    id: '#VA-1037',
    customer: 'Marc Perron',
    company: 'Perron Immobilier',
    email: 'marc@perronimmo.ca',
    createdAt: '2025-01-08T08:05:00Z',
    total: 512.00,
    status: 'cancelled',
    shippingAddress: '410 rue Principale, Saint-Jérôme, QC J7Z 1Z9',
    notes: 'Annulée — doublon de la commande #VA-1032.',
    items: [
      { title: 'Polo Classique Bleu', variant: 'L · Brodé', qty: 8, unitPrice: 58.00 },
    ],
  },
];

const STATUS_META: Record<
  OrderStatus,
  { fr: string; en: string; classes: string; Icon: typeof Clock }
> = {
  pending:    { fr: 'En attente',    en: 'Pending',    Icon: Clock,        classes: 'bg-amber-100 text-amber-800 ring-amber-200' },
  processing: { fr: 'En traitement', en: 'Processing', Icon: Package,      classes: 'bg-blue-100 text-blue-800 ring-blue-200' },
  shipped:    { fr: 'Expédiée',      en: 'Shipped',    Icon: Truck,        classes: 'bg-indigo-100 text-indigo-800 ring-indigo-200' },
  delivered:  { fr: 'Livrée',        en: 'Delivered',  Icon: CheckCircle2, classes: 'bg-emerald-100 text-emerald-800 ring-emerald-200' },
  cancelled:  { fr: 'Annulée',       en: 'Cancelled',  Icon: XCircle,      classes: 'bg-rose-100 text-rose-700 ring-rose-200' },
};

const STATUS_FILTERS: Array<OrderStatus | 'all'> = ['all', 'pending', 'processing', 'shipped', 'delivered', 'cancelled'];

function formatMoney(amount: number, lang: 'fr' | 'en') {
  return new Intl.NumberFormat(lang === 'fr' ? 'fr-CA' : 'en-CA', {
    style: 'currency',
    currency: 'CAD',
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatDate(iso: string, lang: 'fr' | 'en') {
  return new Intl.DateTimeFormat(lang === 'fr' ? 'fr-CA' : 'en-CA', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(iso));
}

function StatusBadge({ status, lang }: { status: OrderStatus; lang: 'fr' | 'en' }) {
  const meta = STATUS_META[status];
  const Icon = meta.Icon;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset',
        meta.classes,
      )}
    >
      <Icon className="h-3 w-3" aria-hidden="true" />
      {lang === 'fr' ? meta.fr : meta.en}
    </span>
  );
}

export default function AdminOrders() {
  const { lang } = useLang();
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'all'>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filteredOrders = useMemo(() => {
    const q = query.trim().toLowerCase();
    return MOCK_ORDERS.filter((order) => {
      if (statusFilter !== 'all' && order.status !== statusFilter) return false;
      if (!q) return true;
      return (
        order.id.toLowerCase().includes(q) ||
        order.customer.toLowerCase().includes(q) ||
        order.company.toLowerCase().includes(q) ||
        order.email.toLowerCase().includes(q)
      );
    });
  }, [query, statusFilter]);

  const totals = useMemo(() => {
    const all = MOCK_ORDERS.length;
    const pending = MOCK_ORDERS.filter((o) => o.status === 'pending').length;
    const processing = MOCK_ORDERS.filter((o) => o.status === 'processing').length;
    const revenue = MOCK_ORDERS
      .filter((o) => o.status !== 'cancelled')
      .reduce((sum, o) => sum + o.total, 0);
    return { all, pending, processing, revenue };
  }, []);

  const selectedOrder = selectedId
    ? MOCK_ORDERS.find((o) => o.id === selectedId) ?? null
    : null;

  const statusLabel = (s: OrderStatus | 'all') => {
    if (s === 'all') return lang === 'fr' ? 'Toutes' : 'All';
    return lang === 'fr' ? STATUS_META[s].fr : STATUS_META[s].en;
  };

  return (
    <div className="min-h-screen bg-secondary/40">
      {/* Top bar */}
      <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <Link
              to="/"
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:border-primary hover:text-primary"
              aria-label={lang === 'fr' ? 'Retour au site' : 'Back to site'}
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            </Link>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                Vision · Admin
              </div>
              <h1 className="text-base font-extrabold text-foreground sm:text-lg">
                {lang === 'fr' ? 'Commandes' : 'Orders'}
              </h1>
            </div>
          </div>
          <div className="hidden items-center gap-2 sm:flex">
            <span className="text-xs text-muted-foreground">
              {lang === 'fr' ? 'Connecté en tant que' : 'Signed in as'}
            </span>
            <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
              Frederick B.
            </span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
        {/* Stat cards */}
        <section
          aria-label={lang === 'fr' ? 'Statistiques des commandes' : 'Orders statistics'}
          className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4"
        >
          <StatCard
            label={lang === 'fr' ? 'Total' : 'Total'}
            value={String(totals.all)}
            hint={lang === 'fr' ? 'Commandes' : 'Orders'}
          />
          <StatCard
            label={lang === 'fr' ? 'En attente' : 'Pending'}
            value={String(totals.pending)}
            hint={lang === 'fr' ? 'À confirmer' : 'To confirm'}
            tone="amber"
          />
          <StatCard
            label={lang === 'fr' ? 'En traitement' : 'Processing'}
            value={String(totals.processing)}
            hint={lang === 'fr' ? 'En production' : 'In production'}
            tone="blue"
          />
          <StatCard
            label={lang === 'fr' ? 'Revenu' : 'Revenue'}
            value={formatMoney(totals.revenue, lang)}
            hint={lang === 'fr' ? 'Hors annulations' : 'Net of cancellations'}
            tone="emerald"
          />
        </section>

        {/* Toolbar */}
        <section className="mt-6 rounded-2xl border border-border bg-background p-4 shadow-sm sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <label className="relative flex-1 sm:max-w-sm">
              <span className="sr-only">
                {lang === 'fr' ? 'Rechercher une commande' : 'Search an order'}
              </span>
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={
                  lang === 'fr'
                    ? 'Rechercher par # ou client…'
                    : 'Search by # or customer…'
                }
                className="h-10 w-full rounded-full border border-border bg-secondary/60 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </label>
            <div
              role="tablist"
              aria-label={lang === 'fr' ? 'Filtrer par statut' : 'Filter by status'}
              className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 scrollbar-hide"
            >
              {STATUS_FILTERS.map((s) => {
                const active = statusFilter === s;
                return (
                  <button
                    key={s}
                    role="tab"
                    aria-selected={active}
                    onClick={() => setStatusFilter(s)}
                    className={cn(
                      'shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition-all',
                      active
                        ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                        : 'border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground',
                    )}
                  >
                    {statusLabel(s)}
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {/* Table */}
        <section className="mt-5 overflow-hidden rounded-2xl border border-border bg-background shadow-sm">
          {filteredOrders.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 px-6 py-16 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary text-muted-foreground">
                <Search className="h-5 w-5" aria-hidden="true" />
              </div>
              <p className="text-sm font-semibold text-foreground">
                {lang === 'fr' ? 'Aucune commande trouvée' : 'No orders found'}
              </p>
              <p className="max-w-xs text-xs text-muted-foreground">
                {lang === 'fr'
                  ? 'Modifie la recherche ou sélectionne un autre statut.'
                  : 'Adjust your search or pick a different status.'}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-secondary/40 hover:bg-secondary/40">
                  <TableHead className="text-[11px] font-bold uppercase tracking-wider">#</TableHead>
                  <TableHead className="text-[11px] font-bold uppercase tracking-wider">
                    {lang === 'fr' ? 'Client' : 'Customer'}
                  </TableHead>
                  <TableHead className="text-[11px] font-bold uppercase tracking-wider">
                    {lang === 'fr' ? 'Date' : 'Date'}
                  </TableHead>
                  <TableHead className="text-[11px] font-bold uppercase tracking-wider">
                    {lang === 'fr' ? 'Statut' : 'Status'}
                  </TableHead>
                  <TableHead className="text-right text-[11px] font-bold uppercase tracking-wider">
                    {lang === 'fr' ? 'Total' : 'Total'}
                  </TableHead>
                  <TableHead className="w-12" aria-hidden="true" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOrders.map((order) => (
                  <TableRow
                    key={order.id}
                    onClick={() => setSelectedId(order.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setSelectedId(order.id);
                      }
                    }}
                    tabIndex={0}
                    role="button"
                    aria-label={`${lang === 'fr' ? 'Voir la commande' : 'View order'} ${order.id}`}
                    className="cursor-pointer focus:bg-secondary/60 focus:outline-none"
                  >
                    <TableCell className="font-mono text-xs font-bold text-foreground">
                      {order.id}
                    </TableCell>
                    <TableCell>
                      <div className="font-semibold text-foreground">{order.customer}</div>
                      <div className="text-xs text-muted-foreground">{order.company}</div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(order.createdAt, lang)}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={order.status} lang={lang} />
                    </TableCell>
                    <TableCell className="text-right font-bold text-foreground">
                      {formatMoney(order.total, lang)}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      <ArrowUpRight className="ml-auto h-4 w-4" aria-hidden="true" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </section>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          {lang === 'fr'
            ? `${filteredOrders.length} commande${filteredOrders.length > 1 ? 's' : ''} affichée${filteredOrders.length > 1 ? 's' : ''}`
            : `${filteredOrders.length} order${filteredOrders.length === 1 ? '' : 's'} shown`}
        </p>
      </main>

      {/* Drawer — order details */}
      <Sheet open={selectedOrder !== null} onOpenChange={(open) => !open && setSelectedId(null)}>
        <SheetContent
          side="right"
          className="w-full overflow-y-auto p-0 sm:max-w-md"
        >
          {selectedOrder ? (
            <div className="flex h-full flex-col">
              <SheetHeader className="space-y-1 border-b border-border bg-secondary/40 px-6 py-5 text-left">
                <div className="flex items-center justify-between">
                  <SheetTitle className="font-mono text-lg font-extrabold text-foreground">
                    {selectedOrder.id}
                  </SheetTitle>
                  <StatusBadge status={selectedOrder.status} lang={lang} />
                </div>
                <SheetDescription className="text-xs">
                  {formatDate(selectedOrder.createdAt, lang)} ·{' '}
                  {formatMoney(selectedOrder.total, lang)}
                </SheetDescription>
              </SheetHeader>

              <div className="flex-1 space-y-6 px-6 py-5">
                <section>
                  <h3 className="mb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    {lang === 'fr' ? 'Client' : 'Customer'}
                  </h3>
                  <div className="rounded-xl border border-border bg-background p-4">
                    <div className="font-bold text-foreground">{selectedOrder.customer}</div>
                    <div className="text-sm text-muted-foreground">{selectedOrder.company}</div>
                    <a
                      href={`mailto:${selectedOrder.email}`}
                      className="mt-1 inline-block text-sm text-primary hover:underline"
                    >
                      {selectedOrder.email}
                    </a>
                  </div>
                </section>

                <section>
                  <h3 className="mb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    {lang === 'fr' ? 'Articles' : 'Items'}
                  </h3>
                  <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-background">
                    {selectedOrder.items.map((item, idx) => (
                      <li key={idx} className="flex items-start justify-between gap-4 p-4">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-foreground">
                            {item.title}
                          </div>
                          <div className="text-xs text-muted-foreground">{item.variant}</div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            {lang === 'fr' ? 'Qté' : 'Qty'} {item.qty} ·{' '}
                            {formatMoney(item.unitPrice, lang)}
                          </div>
                        </div>
                        <div className="shrink-0 text-sm font-bold text-foreground">
                          {formatMoney(item.qty * item.unitPrice, lang)}
                        </div>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-3 flex items-center justify-between rounded-xl bg-secondary/60 px-4 py-3 text-sm">
                    <span className="font-semibold text-muted-foreground">
                      {lang === 'fr' ? 'Total' : 'Total'}
                    </span>
                    <span className="text-base font-extrabold text-foreground">
                      {formatMoney(selectedOrder.total, lang)}
                    </span>
                  </div>
                </section>

                <section>
                  <h3 className="mb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    {lang === 'fr' ? 'Livraison' : 'Shipping'}
                  </h3>
                  <div className="rounded-xl border border-border bg-background p-4 text-sm text-foreground">
                    {selectedOrder.shippingAddress}
                  </div>
                </section>

                {selectedOrder.notes ? (
                  <section>
                    <h3 className="mb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      {lang === 'fr' ? 'Notes' : 'Notes'}
                    </h3>
                    <div className="rounded-xl border border-dashed border-border bg-secondary/30 p-4 text-sm italic text-muted-foreground">
                      {selectedOrder.notes}
                    </div>
                  </section>
                ) : null}
              </div>

              <div className="sticky bottom-0 flex gap-2 border-t border-border bg-background px-6 py-4">
                <button
                  type="button"
                  onClick={() => setSelectedId(null)}
                  className="flex-1 rounded-full border border-border bg-background px-4 py-2.5 text-sm font-bold text-foreground transition-colors hover:border-primary hover:text-primary"
                >
                  {lang === 'fr' ? 'Fermer' : 'Close'}
                </button>
                <button
                  type="button"
                  className="flex-1 rounded-full gradient-navy px-4 py-2.5 text-sm font-bold text-primary-foreground shadow-navy transition-opacity hover:opacity-90"
                >
                  {lang === 'fr' ? 'Marquer expédiée' : 'Mark shipped'}
                </button>
              </div>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
  tone = 'default',
}: {
  label: string;
  value: string;
  hint: string;
  tone?: 'default' | 'amber' | 'blue' | 'emerald';
}) {
  const toneClasses: Record<NonNullable<typeof tone>, string> = {
    default: 'text-foreground',
    amber: 'text-amber-700',
    blue: 'text-blue-700',
    emerald: 'text-emerald-700',
  };
  return (
    <div className="rounded-2xl border border-border bg-background p-4 shadow-sm transition-shadow hover:shadow-md sm:p-5">
      <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className={cn('mt-1 text-xl font-extrabold sm:text-2xl', toneClasses[tone])}>
        {value}
      </div>
      <div className="mt-0.5 text-[11px] text-muted-foreground">{hint}</div>
    </div>
  );
}
