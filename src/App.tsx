import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, useLocation } from "react-router-dom";
import { lazy, Suspense } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { SkipLink } from "@/components/SkipLink";
import { LangProvider, useLang } from "@/lib/langContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ScrollToTop } from "@/components/ScrollToTop";
import { useChatTriggers } from "@/lib/chatTriggers";
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

// Mega Blueprint §9.5 + §17.11 — /merci order-confirmation page that
// Shopify's "Order status URL" can redirect to after checkout. Lazy
// because it's a one-shot post-checkout landing, not a navbar route.
const ThankYou = lazy(() => import("./pages/ThankYou"));

// About surface (Task 11.9) — bilingual founder story + values + stat
// tiles. Same lazy rationale as Contact: reached from the footer, not
// the home hot path, so it shouldn't bloat the Index chunk.
const About = lazy(() => import("./pages/About"));

// Blog / content hub (Task 11.6) — /blog index + /blog/:slug stub. Lazy
// because merch-tips content is reached from a footer link, not the
// home hot path; keeping it out of the Index chunk matches how legal
// stubs and Contact are split.
const Blog = lazy(() => import("./pages/Blog"));
const BlogPost = lazy(() => import("./pages/BlogPost"));

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
// nav, not the home hot path; matches how /industries and /blog
// are split.
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

// AnimatePresence needs useLocation() to key routes, which requires being
// inside <BrowserRouter>. This inner component renders the routed tree and
// cross-fades between route elements on pathname change. useReducedMotion
// collapses the transition to an instant swap for users who opt out of
// motion, so we don't defy their OS setting.
const AnimatedRoutes = () => {
  const location = useLocation();
  const reduce = useReducedMotion();
  const transition = reduce
    ? { duration: 0 }
    : { duration: 0.15, ease: 'easeOut' as const };
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={location.pathname}
        initial={reduce ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={reduce ? { opacity: 1 } : { opacity: 0 }}
        transition={transition}
      >
        <Routes location={location}>
          <Route path="/" element={<Index />} />
          <Route path="/products" element={<Products />} />
          <Route path="/product/:handle" element={<ProductDetail />} />
          <Route path="/cart" element={<Cart />} />
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
            <Route path="customers" element={<AdminCustomers />} />
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
          <Route path="/merci" element={<ThankYou />} />
          <Route path="/about" element={<About />} />
          <Route path="/blog" element={<Blog />} />
          <Route path="/blog/:slug" element={<BlogPost />} />

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
      </motion.div>
    </AnimatePresence>
  );
};

/** Root app: wires QueryClient, LangProvider, ErrorBoundary, router, and the lazy-route Suspense fallback. */
const App = () => (
  <QueryClientProvider client={queryClient}>
    <LangProvider>
      <Sonner />
      <CookieConsent />
      <ErrorBoundary>
          <BrowserRouter>
            <SkipLink />
            <ScrollToTop />
            <ChatTriggers />
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
          </BrowserRouter>
        </ErrorBoundary>
    </LangProvider>
  </QueryClientProvider>
);

export default App;
