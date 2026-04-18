import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Package, LogOut, User as UserIcon, Mail, Calendar, ExternalLink, ShoppingBag } from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { BottomNav } from '@/components/BottomNav';
import { AIChat } from '@/components/AIChat';
import { useLang } from '@/lib/langContext';
import { useAuthStore } from '@/stores/authStore';
import { SHOPIFY_ORDERS_SNAPSHOT } from '@/data/shopifySnapshot';

export default function Account() {
  const { lang } = useLang();
  const navigate = useNavigate();
  const user = useAuthStore(s => s.user);
  const signOut = useAuthStore(s => s.signOut);
  const loading = useAuthStore(s => s.loading);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (!loading) setHydrated(true);
  }, [loading]);

  // Match orders by customer email (best-effort with the snapshot)
  const myOrders = useMemo(() => {
    if (!user?.email) return [];
    return SHOPIFY_ORDERS_SNAPSHOT
      .filter(o => o.email.toLowerCase() === user.email)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [user?.email]);

  if (hydrated && !user) {
    return (
      <div className="min-h-screen bg-background flex flex-col pb-20">
        <Navbar />
        <div className="flex-1 flex items-center justify-center px-6 py-20 pt-24">
          <div className="text-center max-w-md">
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-secondary flex items-center justify-center">
              <UserIcon size={32} className="text-muted-foreground" />
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
                className="inline-flex items-center gap-2 text-sm font-extrabold text-primary-foreground gradient-navy px-6 py-3 rounded-full shadow-navy"
              >
                {lang === 'en' ? 'Sign in' : 'Se connecter'}
              </Link>
              <Link
                to="/admin/signup"
                className="inline-flex items-center gap-2 text-sm font-extrabold border border-border bg-background px-6 py-3 rounded-full hover:border-primary"
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
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const handleLogout = async () => {
    await signOut();
    navigate('/');
  };

  const totalSpent = myOrders.reduce((s, o) => s + o.total, 0);

  return (
    <div id="main-content" tabIndex={-1} className="min-h-screen bg-gradient-to-b from-secondary/30 to-background pb-20 focus:outline-none">
      <Navbar />

      <main className="max-w-[920px] mx-auto px-4 md:px-8 pt-20 pb-16">
        <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="h-4 w-4" />
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
              {user.role === 'president' && <span aria-label="Président" title="Président">👑</span>}
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
            className="hidden sm:inline-flex items-center gap-1.5 text-xs font-bold px-3 py-2 border border-border rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground"
          >
            <LogOut size={13} />
            {lang === 'en' ? 'Sign out' : 'Déconnexion'}
          </button>
        </div>

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
          <Link to="/products" className="bg-gradient-to-br from-[#0052CC] to-[#1B3A6B] text-white rounded-2xl p-4 hover:shadow-lg transition-shadow">
            <div className="text-[10px] font-bold uppercase tracking-wider opacity-80">
              {lang === 'en' ? 'Reorder' : 'Recommander'}
            </div>
            <div className="text-sm font-extrabold mt-1 flex items-center gap-1">
              {lang === 'en' ? 'Browse' : 'Magasiner'} →
            </div>
          </Link>
        </div>

        {/* Orders */}
        <div className="bg-white border border-border rounded-2xl overflow-hidden">
          <div className="px-5 py-3 border-b border-border flex items-center justify-between">
            <h2 className="font-bold flex items-center gap-2">
              <Package size={16} className="text-primary" />
              {lang === 'en' ? 'My orders' : 'Mes commandes'}
            </h2>
            <Link to="/track" className="text-xs font-bold text-[#0052CC] hover:underline">
              {lang === 'en' ? 'Track an order →' : 'Suivre une commande →'}
            </Link>
          </div>

          {myOrders.length === 0 ? (
            <div className="p-10 md:p-12 text-center">
              <ShoppingBag size={36} className="text-[#0052CC]/30 mx-auto mb-3" />
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
                className="inline-flex items-center gap-1.5 text-sm font-extrabold text-primary-foreground gradient-navy px-6 py-3 rounded-full hover:-translate-y-0.5 transition-transform"
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
                    className="flex items-center gap-4 p-4 hover:bg-zinc-50 transition-colors group"
                  >
                    <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center flex-shrink-0">
                      <Package size={16} className="text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold">{o.name}</span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${statusTone}`}>
                          {lang === 'en' ? statusLabel.en : statusLabel.fr}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-3">
                        <span className="flex items-center gap-1"><Calendar size={10} /> {new Date(o.createdAt).toLocaleDateString(lang === 'fr' ? 'fr-CA' : 'en-CA')}</span>
                        <span>{o.itemsCount} {lang === 'en' ? 'items' : 'articles'}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-extrabold">{o.total.toLocaleString(lang === 'fr' ? 'fr-CA' : 'en-CA', { minimumFractionDigits: 2 })} $</div>
                      <ExternalLink size={11} className="text-zinc-300 group-hover:text-[#0052CC] inline-block" />
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* Profile info */}
        <div className="bg-white border border-border rounded-2xl p-5 md:p-6 mt-5 space-y-3">
          <h2 className="font-bold flex items-center gap-2 mb-3">
            <UserIcon size={16} className="text-primary" />
            {lang === 'en' ? 'My info' : 'Mes informations'}
          </h2>
          <div className="space-y-2 text-sm">
            <Row icon={UserIcon} label={lang === 'en' ? 'Name' : 'Nom'} value={user.name} />
            <Row icon={Mail} label={lang === 'en' ? 'Email' : 'Courriel'} value={user.email} />
            <Row icon={Calendar} label={lang === 'en' ? 'Role' : 'Rôle'} value={user.title ?? user.role} />
          </div>
          <Link
            to="/admin/reset-password"
            className="inline-block mt-3 text-xs font-bold text-[#0052CC] hover:underline"
          >
            {lang === 'en' ? 'Change password →' : 'Changer mon mot de passe →'}
          </Link>
        </div>

        <button
          type="button"
          onClick={handleLogout}
          className="sm:hidden w-full mt-5 inline-flex items-center justify-center gap-2 px-4 py-3 border border-border rounded-xl text-sm font-bold text-muted-foreground"
        >
          <LogOut size={14} />
          {lang === 'en' ? 'Sign out' : 'Déconnexion'}
        </button>
      </main>

      <AIChat />
      <BottomNav />
    </div>
  );
}

function Row({ icon: Icon, label, value }: { icon: typeof UserIcon; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 p-2 bg-secondary/40 rounded-lg">
      <Icon size={14} className="text-muted-foreground flex-shrink-0" />
      <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider min-w-[70px]">{label}</span>
      <span className="text-sm flex-1 truncate">{value}</span>
    </div>
  );
}
