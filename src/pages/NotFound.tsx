import { Link, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { useLang } from '@/lib/langContext';
import { BottomNav } from '@/components/BottomNav';
import { ArrowLeft, Home } from 'lucide-react';

const NotFound = () => {
  const location = useLocation();
  const { lang } = useLang();

  useEffect(() => {
    console.error('404 Error: User attempted to access non-existent route:', location.pathname);
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-background flex flex-col pb-20">
      <div className="flex-1 flex items-center justify-center px-6 py-20">
        <div className="text-center max-w-sm">
          <div className="text-[96px] font-extrabold text-primary/10 leading-none mb-4">404</div>
          <h1 className="text-2xl font-extrabold text-foreground mb-2">
            {lang === 'en' ? 'Page not found' : 'Page introuvable'}
          </h1>
          <p className="text-muted-foreground text-sm mb-8 leading-relaxed">
            {lang === 'en'
              ? "The page you're looking for doesn't exist or has been moved."
              : "La page que tu cherches n'existe pas ou a été déplacée."}
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              to="/"
              className="inline-flex items-center justify-center gap-2 text-sm font-bold text-primary-foreground gradient-navy px-6 py-3 rounded-full"
            >
              <Home className="w-4 h-4" />
              {lang === 'en' ? 'Go home' : "Retour à l'accueil"}
            </Link>
            <Link
              to="/products"
              className="inline-flex items-center justify-center gap-2 text-sm font-bold border border-border px-6 py-3 rounded-full hover:border-primary hover:text-primary transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              {lang === 'en' ? 'See products' : 'Voir les produits'}
            </Link>
          </div>
        </div>
      </div>
      <BottomNav />
    </div>
  );
};

export default NotFound;
