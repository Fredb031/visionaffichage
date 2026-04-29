import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, useLocation } from "react-router-dom";
import { lazy, Suspense } from "react";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { SkipLink } from "@/components/SkipLink";
import { LangProvider, useLang } from "@/lib/langContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ScrollToTop } from "@/components/ScrollToTop";
import { useChatTriggers } from "@/lib/chatTriggers";
import { useVisitorTracking } from "@/hooks/useVisitorTracking";
import { AuthGuard } from "@/components/AuthGuard";
import { RequirePermission } from "@/components/RequirePermission";
import { CookieConsent } from "@/components/CookieConsent";
import { WhatsAppButton } from "@/components/WhatsAppButton";
import { SocialProofNotification } from "@/components/SocialProofNotification";
import Index from "./pages/Index";
import Products from "./pages/Products";
// Cart, ProductDetail, NotFound used to be eager — there's no reason
// the home page should bundle them. Lazy-split so only the page that
// actually gets navigated to pulls its chunk.
const ProductDetail = lazy(() => import("./pages/ProductDetail"));
const Cart = lazy(() => import("./pages/Cart"));
const Checkout = lazy(() => import("./pages/Checkout"));
const TrackOrder = lazy(() => import("./pages/TrackOrder"));
const Account = lazy(() => import("./pages/Account"));
const NotFound = lazy(() => import("./pages/NotFound"));

// Admin (lazy)
const AdminLayout = lazy(() => import("@/components/admin/AdminLayout").then(m => ({ default: m.AdminLayout })));
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));
const AdminOrders = lazy(() => import("./pages/admin/AdminOrders"));
const AdminProducts = lazy(() => import("./pages/admin/AdminProducts"));
const AdminVendors = lazy(() => import("./pages/admin/AdminVendors"));
const AdminCustomers = lazy(() => import("./pages/admin/AdminCustomers"));
const AdminCustomerDetail = lazy(() => import("./pages/admin/AdminCustomerDetail"));
const AdminAbandonedCarts = lazy(() => import("./pages/admin/AdminAbandonedCarts"));
const AdminAnalytics = lazy(() => import("./pages/admin/AdminAnalytics"));
const AdminQuotes = lazy(() => import("./pages/admin/AdminQuotes"));
const AdminSettings = lazy(() => import("./pages/admin/AdminSettings"));
const AdminEmails = lazy(() => import("./pages/admin/AdminEmails"));
const AdminImageGen = lazy(() => import("./pages/admin/AdminImageGen"));
const AdminAutomations = lazy(() => import("./pages/admin/AdminAutomations"));
const AdminLogin = lazy(() => import("./pages/admin/AdminLogin"));
const Signup = lazy(() => import("./pages/admin/Signup"));
const ForgotPassword = lazy(() => import("./pages/admin/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/admin/ResetPassword"));
const AcceptInvite = lazy(() => import("./pages/admin/AcceptInvite"));
const AdminUsers = lazy(() => import("./pages/admin/AdminUsers"));
// Volume II §10.1 — manual editor for the weekly_capacity surrogate
// that drives the public CapacityWidget. Lazy because it's an
// operator-only surface reached from the admin nav, not the hot
// path. localStorage today; Supabase weekly_capacity table is the
// follow-up wiring.
const AdminCapacity = lazy(() => import("./pages/admin/AdminCapacity"));
// Volume II §22 — admin expansion shells. Each renders a placeholder
// "Bientôt disponible" frame with a TODO note where the underlying
// Supabase / Shopify / GA4 wiring is still operator follow-up. Lazy
// for the same reason as the other admin pages — operator-only
// surfaces, not the home hot path.
const AdminClients = lazy(() => import("./pages/admin/AdminClients"));
const AdminPortals = lazy(() => import("./pages/admin/AdminPortals"));
const AdminChatLogs = lazy(() => import("./pages/admin/AdminChatLogs"));
const AdminLoyalty = lazy(() => import("./pages/admin/AdminLoyalty"));
// SanMar Canada operator console (Step 4 of the SanMar integration).
// Lazy because only `admin` / `president` reach it and the page pulls
// the sanmarClient wrapper + sanmar_catalog/sanmar_sync_log Supabase
// queries — no point bundling those into the home hot path. The page
// gracefully renders a soft empty state when VITE_SANMAR_NEXT_GEN is
// off so flipping the gate doesn't brick the route.
const AdminSanMar = lazy(() => import("./pages/admin/AdminSanMar"));

// Vendor (lazy)
const VendorLayout = lazy(() => import("@/components/vendor/VendorLayout").then(m => ({ default: m.VendorLayout })));
const VendorDashboard = lazy(() => import("./pages/vendor/VendorDashboard"));
const QuoteBuilder = lazy(() => import("./pages/vendor/QuoteBuilder"));
const QuoteList = lazy(() => import("./pages/vendor/QuoteList"));
// Public vendor profile (Task 10.4) — shareable URL for prospects, no
// auth required. Lazy because it's reached from an external link, not
// the hot path.
const VendorProfile = lazy(() => import("./pages/vendor/VendorProfile"));

// Client-facing (lazy)
const QuoteAccept = lazy(() => import("./pages/QuoteAccept"));

// Mega Blueprint Section 02 — public quote-request form. Lazy because
// it's reached from the navbar/hero CTA, not the home hot path; the
// form pulls PRODUCTS + pricing tiers, so keeping it out of the Index
// chunk matches how Cart and PDP are split.
const QuoteRequest = lazy(() => import("./pages/QuoteRequest"));

// Legal stubs (lazy) — placeholder pages behind /privacy, /terms,
// /returns, /accessibility. Real copy is owner-uploaded; we lazy-load
// because these are link-from-footer-only routes that don't need to
// land in the main bundle.
const Privacy = lazy(() => import("./pages/legal/Privacy"));
const Terms = lazy(() => import("./pages/legal/Terms"));
const Returns = lazy(() => import("./pages/legal/Returns"));
const Accessibility = lazy(() => import("./pages/legal/Accessibility"));

// Contact surface (Task 11.10) — lazy because it's reached from the
// footer/nav, not the hot path. Keeps the Index bundle lean.
const Contact = lazy(() => import("./pages/Contact"));

// Volume II §05.2 — public Net 30 / corporate-account application form.
// Lazy because B2B prospects reach it from a footer link, not the home
// hot path; keeping it out of the Index chunk matches how Contact and
// the legal stubs are split.
const CompteCorporatif = lazy(() => import("./pages/CompteCorporatif"));

// Mega Blueprint §9.5 + §17.11 — /merci order-confirmation page that
// Shopify's "Order status URL" can redirect to after checkout. Lazy
// because it's a one-shot post-checkout landing, not a navbar route.
const ThankYou = lazy(() => import("./pages/ThankYou"));

// About surface (Task 11.9) — bilingual founder story + values + stat
// tiles. Same lazy rationale as Contact: reached from the footer, not
// the home hot path, so it shouldn't bloat the Index chunk.
const About = lazy(() => import("./pages/About"));

// Volume II §15 — product comparison page. Lazy because it's only
// reached after the user has flagged 2+ products via the sticky
// CompareBar; no point shipping the table chunk to first-time
// visitors who haven't checked anything yet.
const Compare = lazy(() => import("./pages/Compare"));

// Volume II §15.1 — sticky compare bar. Mounts at the App root so the
// selection persists across route changes. Eager (small footprint)
// because subscribing to the compareStore from a lazy chunk would
// race with the first card render.
import { CompareBar } from "@/components/CompareBar";

// Phase 4 §5 — desktop exit-intent recovery modal. OP-9: lazy-loaded
// because it's the eager carrier for framer-motion (motion +
// AnimatePresence + useReducedMotion). The modal only fires once per
// session on a real exit-intent gesture, so deferring it until idle/
// trigger keeps the framer-motion chunk out of the eager critical
// path. Mounts at App root inside <Suspense> so the lazy import
// resolves transparently.
const ExitIntent = lazy(() =>
  import("@/components/ExitIntent").then((m) => ({ default: m.ExitIntent }))
);

// Mega Blueprint §08.3 — industry-specific SEO landing pages. Each
// targets a Quebec keyword cluster (uniformes construction Québec,
// vêtements paysagement Québec, etc.) and reuses a shared
// IndustryPageShell that handles hero, recommended-product grid,
// FAQ accordion + FAQPage JSON-LD, and Service schema. Lazy because
// each surface is reached from search/external link, not the home
// hot path; keeping them out of the Index chunk matches how legal
// stubs and Contact are split.
const IndustriesHub = lazy(() => import("./pages/industries/IndustriesHub"));
const IndustryConstruction = lazy(() => import("./pages/industries/Construction"));
const IndustryPaysagement = lazy(() => import("./pages/industries/Paysagement"));
const IndustryPlomberieElectricite = lazy(() => import("./pages/industries/PlomberieElectricite"));
const IndustryCorporate = lazy(() => import("./pages/industries/Corporate"));
const IndustryMunicipalites = lazy(() => import("./pages/industries/Municipalites"));

// Volume II §14 — /histoires-de-succes hub + /:slug detail. Lazy
// because they're reached from the homepage mini-card row and the
// nav, not the home hot path; matches how /industries is split.
const CaseStudies = lazy(() => import("./pages/CaseStudies"));
const CaseStudyDetail = lazy(() => import("./pages/CaseStudyDetail"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 5 * 60 * 1000,
      // refetchOnWindowFocus defaults to true, which re-fires every Shopify
      // Storefront query (products, PDP) on every tab focus — needless
      // Shopify traffic when the catalog barely changes, and flashes
      // skeletons for no reason. staleTime still controls freshness;
      // window focus just stops auto-retriggering.
      refetchOnWindowFocus: false,
    },
  },
});

// Bilingual Suspense fallback — the sr-only label is the only text
// assistive tech hears while a lazy chunk is in flight. Previously it
// was hardcoded English, so a francophone screen-reader user heard
// "Loading" in the middle of an otherwise French flow. useLang is
// safe here because this component is rendered inside <LangProvider>.
const LazyFallback = () => {
  const { lang } = useLang();
  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50" role="status" aria-live="polite">
      <div className="w-6 h-6 border-2 border-[#0052CC] border-t-transparent rounded-full animate-spin" aria-hidden="true" />
      <span className="sr-only">{lang === 'en' ? 'Loading' : 'Chargement'}</span>
    </div>
  );
};

// Mounts the proactive chat trigger hook (Mega Blueprint §3.2). Sits
// inside <BrowserRouter> so useLocation() works, but separate from
// AnimatedRoutes so customizer-store subscriptions in the hook don't
// cause the routed tree to re-render on every store change.
const ChatTriggers = () => {
  useChatTriggers();
  return null;
};

// Volume II §06 — visitor profile tracker. Bumps sessionCount on
// mount and captures UTM/industry hints from the landing URL into
// the persisted profile so the home banner + AI chat + recommendation
// surfaces can read a populated profile from first paint. Sits inside
// <BrowserRouter> for parity with ChatTriggers and to let future
// per-route tracking (already supported in the hook) plug in without
// a tree move.
const VisitorTracker = () => {
  useVisitorTracking();
  return null;
};

// OP-9: replaced framer-motion's AnimatePresence cross-fade with a
// CSS-keyframe fade-in keyed on pathname. The previous implementation
// pulled framer-motion into the eager bundle just to fade routes in
// for 150ms. The static `fadeIn` keyframe in src/index.css produces the
// same visual effect, respects `prefers-reduced-motion` via the global
// reduce-motion override, and lets framer-motion be lazy-loaded by
// only the routes/components that need real motion (customizer, cart
// drawer, exit-intent, etc.). useLocation() keys the wrapper div on
// pathname so React remounts it on each route change, retriggering the
// CSS animation.
const AnimatedRoutes = () => {
  const location = useLocation();
  return (
    <div
      key={location.pathname}
      style={{ animation: 'fadeIn 150ms ease-out' }}
    >
      <Routes location={location}>
          <Route path="/" element={<Index />} />
          <Route path="/products" element={<Products />} />
          {/* Master Prompt French aliases — /boutique mirrors /products
              and /panier mirrors /cart so Navbar/BottomNav links
              resolve without a 404 hop. Both originals stay live so
              existing inbound links keep working. /customizer renders
              Products because the customizer is launched as a modal
              from the PDP (no standalone route); this gives users a
              shopping surface to pick a product to customize. */}
          <Route path="/boutique" element={<Products />} />
          <Route path="/customizer" element={<Products />} />
          <Route path="/product/:handle" element={<ProductDetail />} />
          <Route path="/cart" element={<Cart />} />
          <Route path="/panier" element={<Cart />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/track" element={<TrackOrder />} />
          <Route path="/track/:orderNumber" element={<TrackOrder />} />
          {/* French-canonical aliases (Mega Blueprint §16). /suivi mirrors
              /track so links shared in French copy resolve without a
              redirect hop. Same component, same param name. */}
          <Route path="/suivi" element={<TrackOrder />} />
          <Route path="/suivi/:orderNumber" element={<TrackOrder />} />
          <Route path="/account" element={<Account />} />

          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/admin/signup" element={<Signup />} />
          <Route path="/admin/forgot-password" element={<ForgotPassword />} />
          <Route path="/admin/reset-password" element={<ResetPassword />} />
          <Route path="/admin/accept-invite/:token" element={<AcceptInvite />} />
          <Route
            path="/admin"
            element={
              <AuthGuard requiredRole="admin">
                <AdminLayout />
              </AuthGuard>
            }
          >
            <Route index element={<AdminDashboard />} />
            <Route path="orders" element={<AdminOrders />} />
            <Route path="products" element={<AdminProducts />} />
            <Route path="vendors" element={<AdminVendors />} />
            <Route
              path="users"
              element={
                <RequirePermission permission="users:read">
                  <AdminUsers />
                </RequirePermission>
              }
            />
            <Route path="capacity" element={<AdminCapacity />} />
            {/* SanMar Canada operator console (Step 4). Gated on
                `sanmar:read`, which both `admin` and `president`
                inherit via the spread in ROLE_PERMISSIONS. */}
            <Route
              path="sanmar"
              element={
                <RequirePermission permission="sanmar:read">
                  <AdminSanMar />
                </RequirePermission>
              }
            />
            <Route path="customers" element={<AdminCustomers />} />
            {/* Volume II §22 expansion routes. Sit inside the existing
                AuthGuard requiredRole="admin" + AdminLayout shell so
                role-gating + nav chrome are inherited unchanged. */}
            <Route path="clients" element={<AdminClients />} />
            <Route path="portals" element={<AdminPortals />} />
            <Route path="chat-logs" element={<AdminChatLogs />} />
            <Route path="loyalty" element={<AdminLoyalty />} />
            <Route path="customers/:customerId" element={<AdminCustomerDetail />} />
            <Route path="abandoned-carts" element={<AdminAbandonedCarts />} />
            <Route path="analytics" element={<AdminAnalytics />} />
            <Route path="quotes" element={<AdminQuotes />} />
            <Route
              path="emails"
              element={
                <RequirePermission permission="emails:read">
                  <AdminEmails />
                </RequirePermission>
              }
            />
            <Route
              path="emails/templates"
              element={
                <RequirePermission permission="emails:read">
                  <AdminEmails />
                </RequirePermission>
              }
            />
            <Route path="images" element={<AdminImageGen />} />
            <Route
              path="automations"
              element={
                <RequirePermission permission="automations:read">
                  <AdminAutomations />
                </RequirePermission>
              }
            />
            <Route
              path="settings"
              element={
                <RequirePermission permission="settings:read">
                  <AdminSettings />
                </RequirePermission>
              }
            />
          </Route>

          <Route
            path="/vendor"
            element={
              <AuthGuard requiredRole={["vendor", "admin"]}>
                <VendorLayout />
              </AuthGuard>
            }
          >
            <Route index element={<VendorDashboard />} />
            <Route path="quotes" element={<QuoteList />} />
          </Route>
          <Route
            path="/vendor/quotes/new"
            element={
              <AuthGuard requiredRole={["vendor", "admin"]}>
                <QuoteBuilder />
              </AuthGuard>
            }
          />
          <Route
            path="/admin/quotes/new"
            element={
              <AuthGuard requiredRole="admin">
                <QuoteBuilder />
              </AuthGuard>
            }
          />

          <Route path="/quote/:id" element={<QuoteAccept />} />
          <Route path="/devis" element={<QuoteRequest />} />

          {/* Public vendor profile (Task 10.4). Sits outside the
              /vendor AuthGuard tree on purpose — prospects follow the
              link without a login. */}
          <Route path="/vendor/:vendorId" element={<VendorProfile />} />

          <Route path="/privacy" element={<Privacy />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/returns" element={<Returns />} />
          <Route path="/accessibility" element={<Accessibility />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/compte-corporatif" element={<CompteCorporatif />} />
          <Route path="/merci" element={<ThankYou />} />
          <Route path="/comparer" element={<Compare />} />
          <Route path="/about" element={<About />} />

          {/* Mega Blueprint §08.3 — industry SEO landing pages. */}
          <Route path="/industries" element={<IndustriesHub />} />
          <Route path="/industries/construction" element={<IndustryConstruction />} />
          <Route path="/industries/paysagement" element={<IndustryPaysagement />} />
          <Route path="/industries/plomberie-electricite" element={<IndustryPlomberieElectricite />} />
          <Route path="/industries/corporate" element={<IndustryCorporate />} />
          <Route path="/industries/municipalites" element={<IndustryMunicipalites />} />

          {/* Volume II §14 — case studies hub + detail. */}
          <Route path="/histoires-de-succes" element={<CaseStudies />} />
          <Route path="/histoires-de-succes/:slug" element={<CaseStudyDetail />} />

          <Route path="*" element={<NotFound />} />
        </Routes>
    </div>
  );
};

/** Root app: wires QueryClient, LangProvider, ErrorBoundary, router, and the lazy-route Suspense fallback. */
const App = () => (
  <QueryClientProvider client={queryClient}>
    <LangProvider>
      <Sonner />
      <CookieConsent />
      <ErrorBoundary>
          <BrowserRouter
            // Opt-in to React Router v7 transition behavior so the dev
            // console isn't spammed with "Future Flag Warning" on every
            // route mount. Both flags are forward-compat with v6 and
            // line up with v7's defaults.
            future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
          >
            <SkipLink />
            <ScrollToTop />
            <ChatTriggers />
            <VisitorTracker />
            {/* Volume II §09 — floating WhatsApp Business CTA. Sits
                outside <AnimatedRoutes> so route transitions don't
                fade the button in/out (it self-gates via a 10s
                sessionStorage timer + pathname-based suppression on
                /checkout + /admin). */}
            <WhatsAppButton />
            <SocialProofNotification />
            <Suspense fallback={<LazyFallback />}>
              <AnimatedRoutes />
            </Suspense>
            <CompareBar />
            {/* OP-9: ExitIntent is lazy because it's the eager
                framer-motion carrier. A null fallback is fine — the
                modal doesn't render anything until exit-intent fires. */}
            <Suspense fallback={null}>
              <ExitIntent />
            </Suspense>
          </BrowserRouter>
        </ErrorBoundary>
    </LangProvider>
  </QueryClientProvider>
);

export default App;
