import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { lazy, Suspense } from "react";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { SkipLink } from "@/components/SkipLink";
import { LangProvider } from "@/lib/langContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ScrollToTop } from "@/components/ScrollToTop";
import { AuthGuard } from "@/components/AuthGuard";
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
const AdminAbandonedCarts = lazy(() => import("./pages/admin/AdminAbandonedCarts"));
const AdminAnalytics = lazy(() => import("./pages/admin/AdminAnalytics"));
const AdminQuotes = lazy(() => import("./pages/admin/AdminQuotes"));
const AdminSettings = lazy(() => import("./pages/admin/AdminSettings"));
const AdminEmails = lazy(() => import("./pages/admin/AdminEmails"));
const AdminImageGen = lazy(() => import("./pages/admin/AdminImageGen"));
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

// Client-facing (lazy)
const QuoteAccept = lazy(() => import("./pages/QuoteAccept"));

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 5 * 60 * 1000 } },
});

const LazyFallback = () => (
  <div className="min-h-screen flex items-center justify-center bg-zinc-50" role="status" aria-live="polite">
    <div className="w-6 h-6 border-2 border-[#0052CC] border-t-transparent rounded-full animate-spin" aria-hidden="true" />
    <span className="sr-only">Loading</span>
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <LangProvider>
      <Sonner />
      <ErrorBoundary>
          <BrowserRouter>
            <SkipLink />
            <ScrollToTop />
            <Suspense fallback={<LazyFallback />}>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/products" element={<Products />} />
                <Route path="/product/:handle" element={<ProductDetail />} />
                <Route path="/cart" element={<Cart />} />
                <Route path="/checkout" element={<Checkout />} />
                <Route path="/track" element={<TrackOrder />} />
                <Route path="/track/:orderNumber" element={<TrackOrder />} />
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
                  <Route path="users" element={<AdminUsers />} />
                  <Route path="customers" element={<AdminCustomers />} />
                  <Route path="abandoned-carts" element={<AdminAbandonedCarts />} />
                  <Route path="analytics" element={<AdminAnalytics />} />
                  <Route path="quotes" element={<AdminQuotes />} />
                  <Route path="emails" element={<AdminEmails />} />
                  <Route path="images" element={<AdminImageGen />} />
                  <Route path="settings" element={<AdminSettings />} />
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

                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </BrowserRouter>
        </ErrorBoundary>
    </LangProvider>
  </QueryClientProvider>
);

export default App;
