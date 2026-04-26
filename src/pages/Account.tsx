import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Package, LogOut, User as UserIcon, Mail, Calendar, ShieldCheck, ExternalLink, ShoppingBag, AlertTriangle, Trash2, Download, Languages, BellRing } from 'lucide-react';
import { toast } from 'sonner';
import { Navbar } from '@/components/Navbar';
import { BottomNav } from '@/components/BottomNav';
import { AIChat } from '@/components/AIChat';
import { useLang } from '@/lib/langContext';
import { useAuthStore } from '@/stores/authStore';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useEscapeKey } from '@/hooks/useEscapeKey';
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { WishlistGrid } from '@/components/WishlistGrid';
import { RecentlyViewed } from '@/components/RecentlyViewed';
import { LoyaltyCard } from '@/components/LoyaltyCard';
import { SHOPIFY_ORDERS_SNAPSHOT } from '@/data/shopifySnapshot';
import { normalizeInvisible } from '@/lib/utils';

// Law 25 (Québec) account-deletion request queue. We persist the
// request in localStorage so an admin can drain it manually while the
// real Supabase deletion hook is pending. Cap at 100 to prevent an
// unbounded grow on a shared browser.
// TODO(backend): wire this to a Supabase Edge Function that removes
// the auth user + all profile/orders rows, then clear the matching
// entry from the queue. Until then an admin processes these manually.
const DELETION_QUEUE_KEY = 'vision-account-deletion-requests';
const DELETION_QUEUE_MAX = 100;
interface DeletionRequest {
  userId: string;
  email: string;
  requestedAt: string;
}
function enqueueDeletionRequest(req: DeletionRequest) {
  try {
    const raw = localStorage.getItem(DELETION_QUEUE_KEY);
    const existing: DeletionRequest[] = raw ? JSON.parse(raw) : [];
    const list = Array.isArray(existing) ? existing : [];
    const next = [req, ...list].slice(0, DELETION_QUEUE_MAX);
    localStorage.setItem(DELETION_QUEUE_KEY, JSON.stringify(next));
  } catch (e) {
    console.warn('[Account] Could not persist deletion request:', e);
  }
}

// Law 25 (Québec) right-of-access companion to the deletion queue
// above. Bundles every localStorage key the site writes for a given
// visitor into a single JSON blob the customer can download with one
// click. Server-side data (Shopify orders, Supabase rows) is *not*
// included on purpose — those live on back-ends we don't ship from
// this browser; the bilingual footnote in the UI sends customers to
// info@visionaffichage.com for that half of the request.
const EXPORT_KEYS = {
  wishlist: 'vision-wishlist',
  recentlyViewed: 'vision-recently-viewed',
  cart: 'vision-cart',
  savedForLater: 'vision-saved-for-later',
  newsletterSubscribers: 'vision-newsletter-subscribers',
  cookieConsent: 'vision-cookie-consent',
  deletionRequests: DELETION_QUEUE_KEY,
  lang: 'vision-lang',
} as const;
function readJSON(key: string): unknown {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return null;
    try { return JSON.parse(raw); } catch { return raw; }
  } catch { return null; }
}
// Account-level email-notifications preferences. Persisted under a
// namespaced key so the nightly-newsletter worker (Supabase Edge fn)
// can cross-reference it against subscriber state without colliding
// with the older vision-newsletter-subscribers shape. All three flags
// default to true so we don't silently drop transactional receipts on
// legacy visitors; the user opts *out* explicitly.
const EMAIL_PREFS_KEY = 'va:account-email-prefs';
interface EmailPrefs {
  orderConfirmations: boolean;
  promos: boolean;
  newcomers: boolean;
}
const DEFAULT_EMAIL_PREFS: EmailPrefs = {
  orderConfirmations: true,
  promos: true,
  newcomers: true,
};
function readEmailPrefs(): EmailPrefs {
  try {
    const raw = localStorage.getItem(EMAIL_PREFS_KEY);
    if (!raw) return DEFAULT_EMAIL_PREFS;
    const parsed = JSON.parse(raw) as Partial<EmailPrefs>;
    return {
      orderConfirmations: typeof parsed.orderConfirmations === 'boolean' ? parsed.orderConfirmations : true,
      promos: typeof parsed.promos === 'boolean' ? parsed.promos : true,
      newcomers: typeof parsed.newcomers === 'boolean' ? parsed.newcomers : true,
    };
  } catch {
    return DEFAULT_EMAIL_PREFS;
  }
}
function writeEmailPrefs(prefs: EmailPrefs): void {
  try {
    localStorage.setItem(EMAIL_PREFS_KEY, JSON.stringify(prefs));
  } catch (e) {
    console.warn('[Account] Could not persist email prefs:', e);
  }
}

function filterDeletionRequestsForEmail(email: string | undefined): unknown {
  if (!email) return [];
  const raw = readJSON(EXPORT_KEYS.deletionRequests);
  if (!Array.isArray(raw)) return [];
  const me = email.trim().toLowerCase();
  return raw.filter((r: unknown) => {
    if (!r || typeof r !== 'object') return false;
    const candidate = (r as { email?: unknown }).email;
    return typeof candidate === 'string' && candidate.trim().toLowerCase() === me;
  });
}

/**
 * Customer account page — profile header, order history, language and email
 * preferences, Law 25 (Québec) data export, and self-serve deletion request.
 */
export default function Account() {
  const { lang, setLang } = useLang();
  const navigate = useNavigate();
  const user = useAuthStore(s => s.user);
  const signOut = useAuthStore(s => s.signOut);
  const loading = useAuthStore(s => s.loading);
  const [hydrated, setHydrated] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  // Task 18.4 — double-click guards on the two Law 25 buttons. The
  // export path builds a Blob + triggers an <a download>; a twitchy
  // tap fires two downloads and two success toasts. The delete path
  // does enqueue + signOut + navigate; a double-click re-enqueues
  // the same request and calls signOut a second time mid-async.
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  // Email-notifications prefs — lazy-init from localStorage so the
  // checkbox row reflects the visitor's last-saved state on first
  // render instead of flashing the defaults and then snapping.
  const [emailPrefs, setEmailPrefs] = useState<EmailPrefs>(() => readEmailPrefs());
  const updateEmailPref = (key: keyof EmailPrefs, next: boolean) => {
    setEmailPrefs(prev => {
      const merged = { ...prev, [key]: next };
      writeEmailPrefs(merged);
      return merged;
    });
  };
  const verificationWord = lang === 'en' ? 'DELETE' : 'SUPPRIMER';
  const canConfirmDelete = deleteConfirm.trim().toUpperCase() === verificationWord;

  useEffect(() => {
    if (!loading) setHydrated(true);
  }, [loading]);

  // Modal a11y wiring — ESC to dismiss, body scroll lock so the page
  // underneath doesn't bleed scroll, and a focus trap so keyboard users
  // can't Tab into the dimmed background. Matches the same pattern used
  // by the cart drawer and photo-zoom overlay elsewhere on the site.
  const closeDeleteDialog = () => { setDeleteOpen(false); setDeleteConfirm(''); };
  useEscapeKey(deleteOpen, closeDeleteDialog);
  useBodyScrollLock(deleteOpen);
  const deleteDialogRef = useFocusTrap<HTMLDivElement>(deleteOpen);

  useDocumentTitle(lang === 'en' ? 'My account — Vision Affichage' : 'Mon compte — Vision Affichage');

  // Match orders by customer email (best-effort with the snapshot).
  // Strip invisibles on both sides so a Shopify-exported order email
  // that accidentally carried a ZWSP still matches the signed-in
  // user's normalized email.
  const myOrders = useMemo(() => {
    if (!user?.email) return [];
    const me = normalizeInvisible(user.email).trim().toLowerCase();
    return SHOPIFY_ORDERS_SNAPSHOT
      .filter(o => normalizeInvisible(o.email).trim().toLowerCase() === me)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [user?.email]);

  if (hydrated && !user) {
    return (
      <div className="min-h-screen bg-background flex flex-col pb-20">
        <Navbar />
        <div className="flex-1 flex items-center justify-center px-6 py-20 pt-24">
          <div className="text-center max-w-md">
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-secondary flex items-center justify-center">
              <UserIcon size={32} className="text-muted-foreground" aria-hidden="true" />
            </div>
            <h1 className="text-2xl font-extrabold text-foreground mb-2">
              {lang === 'en' ? 'Sign in to your account' : 'Connecte-toi à ton compte'}
            </h1>
            <p className="text-sm text-muted-foreground mb-6">
              {lang === 'en'
                ? 'Track your orders, save your designs, manage your info.'
                : 'Suis tes commandes, sauvegarde tes designs, gère ton compte.'}
            </p>
            <div className="flex gap-3 justify-center">
              <Link
                to="/admin/login"
                className="inline-flex items-center gap-2 text-sm font-extrabold text-primary-foreground gradient-navy px-6 py-3 rounded-full shadow-navy focus:outline-none focus-visible:ring-4 focus-visible:ring-[#E8A838]/60 focus-visible:ring-offset-2"
              >
                {lang === 'en' ? 'Sign in' : 'Se connecter'}
              </Link>
              <Link
                to="/admin/signup"
                className="inline-flex items-center gap-2 text-sm font-extrabold border border-border bg-background px-6 py-3 rounded-full hover:border-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              >
                {lang === 'en' ? 'Create account' : 'Créer un compte'}
              </Link>
            </div>
          </div>
        </div>
        <BottomNav />
      </div>
    );
  }

  if (!user) {
    return (
      <div
        className="min-h-screen bg-background flex items-center justify-center"
        role="status"
        aria-live="polite"
        aria-busy="true"
      >
        <div
          className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin"
          aria-hidden="true"
        />
        <span className="sr-only">{lang === 'en' ? 'Loading account…' : 'Chargement du compte…'}</span>
      </div>
    );
  }

  const handleLogout = async () => {
    await signOut();
    navigate('/');
  };

  const handleConfirmDelete = async () => {
    if (!canConfirmDelete || !user || deleting) return;
    setDeleting(true);
    enqueueDeletionRequest({
      userId: user.id,
      email: user.email,
      requestedAt: new Date().toISOString(),
    });
    setDeleteOpen(false);
    setDeleteConfirm('');
    await signOut();
    navigate('/');
    toast.success(
      lang === 'en'
        ? 'Deletion request logged. We will contact you within 24h.'
        : 'Demande de suppression enregistrée. On vous contactera sous 24h.'
    );
    // No need to setDeleting(false) — we've navigated away.
  };

  // Law 25 right-of-access — pack everything we store on this device
  // about the signed-in user into a single downloadable JSON. We strip
  // deletion requests to the caller's email so one customer can't
  // harvest another's pending request on a shared browser.
  const handleExportData = () => {
    if (!user || exporting) return;
    setExporting(true);
    try {
      const exportedAt = new Date().toISOString();
      const payload = {
        exportedAt,
        schemaVersion: 1,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          initials: user.initials,
          role: user.role,
          title: user.title ?? null,
        },
        data: {
          wishlist: readJSON(EXPORT_KEYS.wishlist),
          recentlyViewed: readJSON(EXPORT_KEYS.recentlyViewed),
          cart: readJSON(EXPORT_KEYS.cart),
          savedForLater: readJSON(EXPORT_KEYS.savedForLater),
          newsletterSubscribers: readJSON(EXPORT_KEYS.newsletterSubscribers),
          cookieConsent: readJSON(EXPORT_KEYS.cookieConsent),
          deletionRequests: filterDeletionRequestsForEmail(user.email),
          lang: readJSON(EXPORT_KEYS.lang),
        },
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `vision-affichage-data-${exportedAt}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      // Revoke on next tick so Safari has time to start the download.
      setTimeout(() => URL.revokeObjectURL(url), 0);
      toast.success(
        lang === 'en'
          ? 'Your data export has been downloaded.'
          : 'Votre export de données a été téléchargé.'
      );
    } catch (e) {
      console.warn('[Account] Data export failed:', e);
      toast.error(
        lang === 'en'
          ? 'Could not generate your data export. Please try again.'
          : "Impossible de générer l'export. Réessayez."
      );
    } finally {
      // Brief lockout so a second click doesn't re-trigger the browser
      // download prompt on fast machines where the JSON serialization
      // lands inside a single frame.
      setTimeout(() => setExporting(false), 600);
    }
  };

  const totalSpent = myOrders.reduce((s, o) => s + o.total, 0);

  return (
    <div id="main-content" tabIndex={-1} className="min-h-screen bg-gradient-to-b from-secondary/30 to-background pb-20 focus:outline-none">
      <Navbar />

      <main className="max-w-[920px] mx-auto px-4 md:px-8 pt-20 pb-16">
        <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          {lang === 'en' ? 'Back home' : "Retour à l'accueil"}
        </Link>

        {/* Header card */}
        <div className="bg-white border border-border rounded-2xl p-5 md:p-6 mb-5 flex items-center gap-4">
          <div className={`w-16 h-16 rounded-full text-white flex items-center justify-center text-xl font-extrabold flex-shrink-0 ${
            user.role === 'president'
              ? 'bg-gradient-to-br from-[#E8A838] to-[#B37D10] ring-2 ring-[#E8A838]/30'
              : 'bg-gradient-to-br from-[#0052CC] to-[#1B3A6B]'
          }`}>
            {user.initials}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              {user.role === 'president' && <span role="img" aria-label="Président" title="Président">👑</span>}
              <h1 className="text-xl md:text-2xl font-extrabold truncate">{user.name}</h1>
            </div>
            <div className="text-xs text-muted-foreground truncate">{user.email}</div>
            <div className="text-[10px] uppercase tracking-wider font-bold text-[#0052CC] mt-1">
              {user.title ?? user.role}
            </div>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="hidden sm:inline-flex items-center gap-1.5 text-xs font-bold px-3 py-2 border border-border rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
          >
            <LogOut size={13} aria-hidden="true" />
            {lang === 'en' ? 'Sign out' : 'Déconnexion'}
          </button>
        </div>

        {/* Loyalty — Mega Blueprint Section 15.2. Surfaces points,
            dollar-equivalent rebate, tier badge, and progress to free
            express shipping. localStorage-backed for now; flip to
            Supabase once loyalty_accounts ships. */}
        <LoyaltyCard />

        {/* Quick stats */}
        <div className="grid grid-cols-3 gap-3 mb-5">
          <div className="bg-white border border-border rounded-2xl p-4">
            <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
              {lang === 'en' ? 'Orders' : 'Commandes'}
            </div>
            <div className="text-2xl font-extrabold text-foreground mt-1">{myOrders.length}</div>
          </div>
          <div className="bg-white border border-border rounded-2xl p-4">
            <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
              {lang === 'en' ? 'Total spent' : 'Total dépensé'}
            </div>
            <div className="text-2xl font-extrabold text-primary mt-1">
              {totalSpent.toLocaleString(lang === 'fr' ? 'fr-CA' : 'en-CA', { maximumFractionDigits: 0 })} $
            </div>
          </div>
          <Link to="/products" className="bg-gradient-to-br from-[#0052CC] to-[#1B3A6B] text-white rounded-2xl p-4 hover:shadow-lg transition-shadow focus:outline-none focus-visible:ring-4 focus-visible:ring-[#E8A838]/60 focus-visible:ring-offset-2">
            <div className="text-[10px] font-bold uppercase tracking-wider opacity-80">
              {lang === 'en' ? 'Reorder' : 'Recommander'}
            </div>
            <div className="text-sm font-extrabold mt-1 flex items-center gap-1">
              {lang === 'en' ? 'Browse' : 'Magasiner'} →
            </div>
          </Link>
        </div>

        {/* Saved products — renders nothing when the wishlist is empty */}
        <WishlistGrid />

        {/* Orders */}
        <div className="bg-white border border-border rounded-2xl overflow-hidden">
          <div className="px-5 py-3 border-b border-border flex items-center justify-between">
            <h2 className="font-bold flex items-center gap-2">
              <Package size={16} className="text-primary" aria-hidden="true" />
              {lang === 'en' ? 'My orders' : 'Mes commandes'}
            </h2>
            <Link to="/track" className="text-xs font-bold text-[#0052CC] hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 rounded">
              {lang === 'en' ? 'Track an order →' : 'Suivre une commande →'}
            </Link>
          </div>

          {myOrders.length === 0 ? (
            <div className="p-10 md:p-12 text-center">
              <ShoppingBag size={36} className="text-[#0052CC]/30 mx-auto mb-3" aria-hidden="true" />
              <h3 className="text-base font-extrabold text-foreground mb-1">
                {lang === 'en' ? 'No orders yet' : 'Pas encore de commande'}
              </h3>
              <p className="text-sm text-muted-foreground mb-5 max-w-xs mx-auto leading-relaxed">
                {lang === 'en'
                  ? 'Once you place an order, you\u2019ll see status, tracking and delivery dates right here.'
                  : 'Dès ta première commande, tu verras le statut, le suivi et la date de livraison ici.'}
              </p>
              <Link
                to="/products"
                className="inline-flex items-center gap-1.5 text-sm font-extrabold text-primary-foreground gradient-navy px-6 py-3 rounded-full hover:-translate-y-0.5 transition-transform focus:outline-none focus-visible:ring-4 focus-visible:ring-[#E8A838]/60 focus-visible:ring-offset-2"
              >
                {lang === 'en' ? 'Start your first order →' : 'Commencer ma première commande →'}
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {myOrders.map(o => {
                const status = o.fulfillmentStatus === 'fulfilled' ? 'delivered'
                  : o.financialStatus === 'pending' ? 'pending'
                  : 'production';
                const statusLabel = {
                  delivered: { fr: 'Livré', en: 'Delivered' },
                  pending: { fr: 'Paiement en attente', en: 'Payment pending' },
                  production: { fr: 'En production', en: 'In production' },
                }[status];
                const statusTone = {
                  delivered: 'bg-emerald-50 text-emerald-700',
                  pending: 'bg-amber-50 text-amber-700',
                  production: 'bg-blue-50 text-blue-700',
                }[status];
                return (
                  <Link
                    key={o.id}
                    to={`/track/${o.name.replace('#', '')}`}
                    className="flex items-center gap-4 p-4 hover:bg-zinc-50 transition-colors group focus:outline-none focus-visible:bg-zinc-50 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset"
                  >
                    <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center flex-shrink-0">
                      <Package size={16} className="text-primary" aria-hidden="true" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold">{o.name}</span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${statusTone}`}>
                          {lang === 'en' ? statusLabel.en : statusLabel.fr}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-3">
                        <span className="flex items-center gap-1"><Calendar size={10} aria-hidden="true" /> {new Date(o.createdAt).toLocaleDateString(lang === 'fr' ? 'fr-CA' : 'en-CA')}</span>
                        <span>{o.itemsCount} {lang === 'en'
                          ? `item${o.itemsCount !== 1 ? 's' : ''}`
                          : `article${o.itemsCount !== 1 ? 's' : ''}`}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-extrabold">{o.total.toLocaleString(lang === 'fr' ? 'fr-CA' : 'en-CA', { minimumFractionDigits: 2 })} $</div>
                      <ExternalLink size={11} className="text-zinc-300 group-hover:text-[#0052CC] group-focus-visible:text-[#0052CC] inline-block" aria-hidden="true" />
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* Recently-viewed strip — useful for returning customers to
            jump back into a product they were eyeing. Renders nothing
            when the user has no browsing history yet, so it doesn't
            leave an awkward empty card on first visit. */}
        <RecentlyViewed limit={4} />

        {/* Profile info */}
        <div className="bg-white border border-border rounded-2xl p-5 md:p-6 mt-5 space-y-3">
          <h2 className="font-bold flex items-center gap-2 mb-3">
            <UserIcon size={16} className="text-primary" aria-hidden="true" />
            {lang === 'en' ? 'My info' : 'Mes informations'}
          </h2>
          <div className="space-y-2 text-sm">
            <Row icon={UserIcon} label={lang === 'en' ? 'Name' : 'Nom'} value={user.name} />
            <Row icon={Mail} label={lang === 'en' ? 'Email' : 'Courriel'} value={user.email} />
            <Row icon={ShieldCheck} label={lang === 'en' ? 'Role' : 'Rôle'} value={user.title ?? user.role} />
          </div>
          <Link
            to="/admin/reset-password"
            className="inline-block mt-3 text-xs font-bold text-[#0052CC] hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC] focus-visible:ring-offset-1 rounded"
          >
            {lang === 'en' ? 'Change password →' : 'Changer mon mot de passe →'}
          </Link>
        </div>

        {/* Preferences — explicit language switch (mirrors the nav
            toggle but surfaced inside the account UI for people who
            opened /account directly from a bookmark) and per-channel
            email opt-outs. Both flip localStorage synchronously so
            the existing cross-tab listeners in langContext pick up
            the new language immediately. */}
        <section
          aria-labelledby="preferences-heading"
          className="bg-white border border-border rounded-2xl p-5 md:p-6 mt-5"
        >
          <h2 id="preferences-heading" className="font-bold flex items-center gap-2 mb-4">
            <Languages size={16} className="text-primary" aria-hidden="true" />
            {lang === 'en' ? 'Preferences' : 'Préférences'}
          </h2>

          <fieldset className="mb-5">
            <legend className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2">
              {lang === 'en' ? 'Preferred language' : 'Langue préférée'}
            </legend>
            <div role="radiogroup" aria-label={lang === 'en' ? 'Preferred language' : 'Langue préférée'} className="inline-flex items-center gap-2 p-1 bg-secondary/60 rounded-full">
              <button
                type="button"
                role="radio"
                aria-checked={lang === 'fr'}
                onClick={() => setLang('fr')}
                className={`px-4 py-1.5 text-xs font-extrabold rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 ${
                  lang === 'fr' ? 'bg-white text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                FR
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={lang === 'en'}
                onClick={() => setLang('en')}
                className={`px-4 py-1.5 text-xs font-extrabold rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 ${
                  lang === 'en' ? 'bg-white text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                EN
              </button>
            </div>
          </fieldset>

          <fieldset>
            <legend className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <BellRing size={12} aria-hidden="true" />
              {lang === 'en' ? 'Email me about' : 'Recevoir les courriels pour'}
            </legend>
            <div className="space-y-2">
              <label className="flex items-center gap-3 p-2 rounded-lg hover:bg-secondary/40 cursor-pointer">
                <input
                  type="checkbox"
                  checked={emailPrefs.orderConfirmations}
                  onChange={e => updateEmailPref('orderConfirmations', e.target.checked)}
                  className="h-4 w-4 rounded border-border text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
                />
                <span className="text-sm">
                  {lang === 'en' ? 'Order confirmations' : 'Confirmations de commande'}
                </span>
              </label>
              <label className="flex items-center gap-3 p-2 rounded-lg hover:bg-secondary/40 cursor-pointer">
                <input
                  type="checkbox"
                  checked={emailPrefs.promos}
                  onChange={e => updateEmailPref('promos', e.target.checked)}
                  className="h-4 w-4 rounded border-border text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
                />
                <span className="text-sm">
                  {lang === 'en' ? 'Promos' : 'Promos'}
                </span>
              </label>
              <label className="flex items-center gap-3 p-2 rounded-lg hover:bg-secondary/40 cursor-pointer">
                <input
                  type="checkbox"
                  checked={emailPrefs.newcomers}
                  onChange={e => updateEmailPref('newcomers', e.target.checked)}
                  className="h-4 w-4 rounded border-border text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
                />
                <span className="text-sm">
                  {lang === 'en' ? 'New products' : 'Nouveautés produits'}
                </span>
              </label>
            </div>
            <p className="text-[11px] text-muted-foreground mt-3 leading-relaxed">
              {lang === 'en'
                ? 'Saved to this device. Server-side preferences sync on your next sign-in.'
                : 'Enregistré sur cet appareil. La synchronisation serveur se fait à la prochaine connexion.'}
            </p>
          </fieldset>
        </section>

        <button
          type="button"
          onClick={handleLogout}
          className="sm:hidden w-full mt-5 inline-flex items-center justify-center gap-2 px-4 py-3 border border-border rounded-xl text-sm font-bold text-muted-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
        >
          <LogOut size={14} aria-hidden="true" />
          {lang === 'en' ? 'Sign out' : 'Déconnexion'}
        </button>

        {/* My data — Law 25 right-of-access companion to the deletion
            queue below. One-click JSON download of every localStorage
            key we write for this visitor (profile, cart, wishlist,
            recently-viewed, consent, newsletter sub, deletion
            requests). Server-side records live elsewhere — the
            bilingual note points customers to the mailbox for those. */}
        <section
          aria-labelledby="my-data-heading"
          className="mt-8 bg-white border border-border rounded-2xl p-5 md:p-6"
        >
          <div className="flex items-start gap-3">
            <Download size={18} className="text-[#0052CC] flex-shrink-0 mt-0.5" aria-hidden="true" />
            <div className="flex-1">
              <h2 id="my-data-heading" className="font-bold text-foreground">
                {lang === 'en' ? 'My data' : 'Mes données'}
              </h2>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                {lang === 'en'
                  ? 'This export contains all data stored on this device. Server-side requests: info@visionaffichage.com.'
                  : 'Cette export contient toutes les données stockées sur cet appareil. Demandes serveur via info@visionaffichage.com.'}
              </p>
              <button
                type="button"
                onClick={handleExportData}
                disabled={exporting}
                aria-busy={exporting || undefined}
                className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold text-primary-foreground gradient-navy hover:-translate-y-0.5 transition-transform focus:outline-none focus-visible:ring-4 focus-visible:ring-[#E8A838]/60 focus-visible:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0"
              >
                <Download size={14} aria-hidden="true" />
                {lang === 'en' ? 'Download my data (JSON)' : 'Télécharger mes données (JSON)'}
              </button>
            </div>
          </div>
        </section>

        {/* Danger zone — Law 25 self-serve deletion request. Muted/border
            styling keeps it visually separated from the rest of the page
            so a casual click is unlikely. Actual destructive action hides
            behind a typed-verification modal. */}
        <section
          aria-labelledby="danger-zone-heading"
          className="mt-8 bg-white border border-border rounded-2xl p-5 md:p-6"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle size={18} className="text-[#DC2626] flex-shrink-0 mt-0.5" aria-hidden="true" />
            <div className="flex-1">
              <h2 id="danger-zone-heading" className="font-bold text-[#DC2626]">
                {lang === 'en' ? 'Danger zone' : 'Zone dangereuse'}
              </h2>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                {lang === 'en'
                  ? 'Permanently request deletion of your account and associated data. This is irreversible.'
                  : 'Demander la suppression définitive de votre compte et des données associées. Cette action est irréversible.'}
              </p>
              <button
                type="button"
                onClick={() => setDeleteOpen(true)}
                className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold text-white bg-[#DC2626] hover:bg-[#B91C1C] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#DC2626] focus-visible:ring-offset-2"
              >
                <Trash2 size={14} aria-hidden="true" />
                {lang === 'en' ? 'Delete my account' : 'Supprimer mon compte'}
              </button>
            </div>
          </div>
        </section>
      </main>

      {deleteOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-dialog-heading"
          className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/50"
          onClick={closeDeleteDialog}
        >
          <div
            ref={deleteDialogRef}
            className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-border"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-[#DC2626]/10 flex items-center justify-center flex-shrink-0">
                <AlertTriangle size={20} className="text-[#DC2626]" aria-hidden="true" />
              </div>
              <h3 id="delete-dialog-heading" className="text-lg font-extrabold text-foreground mt-1">
                {lang === 'en' ? 'Delete your account?' : 'Supprimer votre compte ?'}
              </h3>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed mb-4">
              {lang === 'en'
                ? `This action is irreversible. All your orders, addresses, and preferences will be deleted within 30 days (Law 25 obligation). Type ${verificationWord} to confirm.`
                : `Cette action est irréversible. Toutes vos commandes, adresses, et préférences seront supprimées sous 30 jours (obligation Loi 25). Tapez ${verificationWord} pour confirmer.`}
            </p>
            <label htmlFor="delete-confirm-input" className="sr-only">
              {lang === 'en' ? `Type ${verificationWord} to confirm` : `Tapez ${verificationWord} pour confirmer`}
            </label>
            <input
              id="delete-confirm-input"
              type="text"
              value={deleteConfirm}
              onChange={e => setDeleteConfirm(e.target.value)}
              placeholder={verificationWord}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              className="w-full px-3 py-2 border border-border rounded-lg text-sm font-mono tracking-widest focus:outline-none focus-visible:ring-2 focus-visible:ring-[#DC2626] focus-visible:border-[#DC2626]"
            />
            <div className="flex gap-3 mt-5 justify-end">
              <button
                type="button"
                onClick={closeDeleteDialog}
                className="px-4 py-2 rounded-lg text-sm font-bold border border-border bg-background hover:bg-secondary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
              >
                {lang === 'en' ? 'Cancel' : 'Annuler'}
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={!canConfirmDelete || deleting}
                aria-busy={deleting || undefined}
                className="px-4 py-2 rounded-lg text-sm font-bold text-white bg-[#DC2626] hover:bg-[#B91C1C] disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-[#DC2626] focus-visible:ring-offset-1"
              >
                {lang === 'en' ? 'Confirm deletion' : 'Confirmer la suppression'}
              </button>
            </div>
          </div>
        </div>
      )}

      <AIChat />
      <BottomNav />
    </div>
  );
}

function Row({ icon: Icon, label, value }: { icon: typeof UserIcon; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 p-2 bg-secondary/40 rounded-lg">
      <Icon size={14} className="text-muted-foreground flex-shrink-0" aria-hidden="true" />
      <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider min-w-[70px]">{label}</span>
      <span className="text-sm flex-1 truncate">{value}</span>
    </div>
  );
}
