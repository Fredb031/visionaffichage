import { Link, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { useLang } from '@/lib/langContext';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { Navbar } from '@/components/Navbar';
import { BottomNav } from '@/components/BottomNav';
import { AIChat } from '@/components/AIChat';
import { ArrowLeft, Home, Compass } from 'lucide-react';

const NotFound = () => {
  const location = useLocation();
  const { lang } = useLang();

  useEffect(() => {
    console.error('404 Error: User attempted to access non-existent route:', location.pathname);
  }, [location.pathname]);

  // Tell crawlers not to index the 404 page itself. Without it, Google
  // can end up storing random non-existent URLs as 'soft 404s' tied to
  // our domain, which dilutes trust. robots meta takes precedence over
  // robots.txt for per-page directives.
  useEffect(() => {
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex, follow';
    document.head.appendChild(meta);
    return () => { document.head.removeChild(meta); };
  }, []);

  // Browser tab + SERP label reflect the 404 state. Restore on unmount
  // is handled by useDocumentTitle.
  useDocumentTitle(lang === 'en' ? 'Page not found (404) — Vision Affichage' : 'Page introuvable (404) — Vision Affichage');

  return (
    <div className="min-h-screen bg-gradient-to-b from-secondary/40 to-background flex flex-col pb-20">
      <Navbar />
      <div id="main-content" tabIndex={-1} className="flex-1 flex items-center justify-center px-6 py-20 pt-24 focus:outline-none">
        <div className="text-center max-w-md">
          <div className="relative w-32 h-32 mx-auto mb-6">
            <div
              className="absolute inset-0 rounded-full bg-gradient-to-br from-[#0052CC]/15 to-[#E8A838]/15 blur-2xl"
              aria-hidden="true"
            />
            <div className="relative w-32 h-32 rounded-full bg-white border border-border flex items-center justify-center shadow-[0_4px_24px_rgba(0,0,0,0.08)]">
              <Compass size={48} className="text-[#0052CC]" strokeWidth={1.5} />
            </div>
            <div className="absolute -top-2 -right-2 w-12 h-12 bg-[#E8A838] text-[#1B3A6B] rounded-full flex items-center justify-center font-extrabold text-sm shadow-lg">
              404
            </div>
          </div>

          <h1 className="text-3xl md:text-4xl font-extrabold text-foreground tracking-tight mb-3">
            {lang === 'en' ? 'Page not found' : 'Page introuvable'}
          </h1>
          <p className="text-muted-foreground text-sm md:text-base mb-2 leading-relaxed">
            {lang === 'en'
              ? "We can't find the page you're looking for — but our products are right where they should be."
              : "On ne trouve pas la page que tu cherches — mais nos produits sont à leur place."}
          </p>
          <code className="text-[11px] text-muted-foreground/60 font-mono">{location.pathname}</code>

          <div className="flex flex-col sm:flex-row gap-3 justify-center mt-7">
            <Link
              to="/"
              className="inline-flex items-center justify-center gap-2 text-sm font-extrabold text-primary-foreground gradient-navy px-7 py-3.5 rounded-full shadow-navy hover:-translate-y-0.5 transition-transform focus:outline-none focus-visible:ring-4 focus-visible:ring-[#E8A838]/60 focus-visible:ring-offset-2"
            >
              <Home className="w-4 h-4" aria-hidden="true" />
              {lang === 'en' ? 'Go home' : "Retour à l'accueil"}
            </Link>
            <Link
              to="/products"
              className="inline-flex items-center justify-center gap-2 text-sm font-extrabold border border-border bg-background px-7 py-3.5 rounded-full hover:border-primary hover:text-primary transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            >
              <ArrowLeft className="w-4 h-4" aria-hidden="true" />
              {lang === 'en' ? 'See products' : 'Voir les produits'}
            </Link>
          </div>

          <p className="text-[11px] text-muted-foreground/70 mt-6">
            {lang === 'en' ? 'Made in Québec · Delivered in 5 business days' : 'Fabriqué au Québec · Livré en 5 jours ouvrables'}
          </p>
        </div>
      </div>
      <AIChat />
      <BottomNav />
    </div>
  );
};

export default NotFound;
