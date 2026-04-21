import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useMemo, useState, FormEvent } from 'react';
import { useLang } from '@/lib/langContext';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { Navbar } from '@/components/Navbar';
import { BottomNav } from '@/components/BottomNav';
import { AIChat } from '@/components/AIChat';
import { ProductCard } from '@/components/ProductCard';
import { useProducts } from '@/hooks/useProducts';
import { PRODUCTS } from '@/data/products';
import { Search, ArrowRight } from 'lucide-react';

// Four lead categories shown as big tiles on the 404 landing. The
// `cat` slug must stay in sync with `KNOWN_CATS` in Products.tsx, or
// the link will silently collapse to the "overview" fallback.
const CATEGORY_TILES: Array<{ slug: string; fr: string; en: string }> = [
  { slug: 'tshirts',   fr: 'T-shirts',   en: 'T-shirts' },
  { slug: 'chandails', fr: 'Hoodies',    en: 'Hoodies' },
  { slug: 'polos',     fr: 'Polos',      en: 'Polos' },
  { slug: 'headwear',  fr: 'Casquettes', en: 'Caps' },
];

// Three curated SKUs shared with the Products-page empty-state fallback
// (see Products.tsx EMPTY_STATE_POPULAR_SKUS). Keeps the "recovery surface"
// consistent: wherever a user lands without results, these three appear.
const POPULAR_SKUS = ['ATC1000', 'ATCF2500', 'ATC6606'] as const;

const NotFound = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { lang } = useLang();
  const [query, setQuery] = useState('');

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

  // Fetch the live Shopify catalog so the three popular ProductCards
  // render with real prices + images. Falls back to an empty array
  // while loading / on error — we simply don't render that section
  // rather than showing a skeleton on the 404 page.
  const { data: products } = useProducts();

  const popularProducts = useMemo(() => {
    if (!products || !Array.isArray(products)) return [];
    const matched = POPULAR_SKUS
      .map(sku => {
        const local = PRODUCTS.find(p => p.sku === sku);
        if (!local) return undefined;
        return products.find(p => {
          const handle = p?.node?.handle ?? '';
          const title = p?.node?.title ?? '';
          return (
            handle === local.shopifyHandle ||
            handle.toLowerCase().includes(sku.toLowerCase()) ||
            title.toLowerCase().includes(sku.toLowerCase())
          );
        });
      })
      .filter((p): p is NonNullable<typeof p> => Boolean(p?.node?.handle));
    const seen = new Set<string>();
    return matched.filter(p => {
      const handle = p.node.handle;
      if (seen.has(handle)) return false;
      seen.add(handle);
      return true;
    }).slice(0, 3);
  }, [products]);

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const q = query.trim();
    if (!q) {
      navigate('/products');
      return;
    }
    navigate(`/products?q=${encodeURIComponent(q)}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-secondary/40 to-background flex flex-col pb-20">
      <Navbar />
      <main
        id="main-content"
        tabIndex={-1}
        className="flex-1 px-6 py-14 pt-24 focus:outline-none"
      >
        <div className="max-w-[780px] mx-auto">
          {/* Heading block — 404 tastefully small above, friendly title below */}
          <div className="text-center">
            <p className="text-[11px] font-mono tracking-[4px] text-[#E8A838] uppercase mb-2">
              404
            </p>
            <h1 className="text-3xl md:text-5xl font-extrabold text-foreground tracking-tight mb-4">
              {lang === 'en' ? 'Page not found' : 'Page introuvable'}
            </h1>
            <p className="text-muted-foreground text-sm md:text-base leading-relaxed max-w-[560px] mx-auto">
              {lang === 'en'
                ? "We couldn't find that, but here's what might help."
                : "On n'a pas trouvé ce que vous cherchiez, mais voici ce qui pourrait aider."}
            </p>
            {location.pathname && (
              <code className="block text-[11px] text-muted-foreground/60 font-mono mt-2">
                {location.pathname}
              </code>
            )}
          </div>

          {/* Search — jumps to /products?q=<query> on submit */}
          <form
            onSubmit={handleSubmit}
            role="search"
            aria-label={lang === 'en' ? 'Search products' : 'Rechercher des produits'}
            className="mt-8 relative max-w-[560px] mx-auto"
          >
            <Search
              aria-hidden="true"
              className="absolute left-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-muted-foreground/70 pointer-events-none"
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={lang === 'en'
                ? 'Search for a t-shirt, hoodie, cap…'
                : 'Chercher un t-shirt, un hoodie, une casquette…'}
              aria-label={lang === 'en' ? 'Search products' : 'Rechercher des produits'}
              className="w-full pl-11 pr-28 py-3.5 text-sm rounded-full bg-white border border-border shadow-sm focus:outline-none focus:ring-2 focus:ring-[#E8A838]/40 focus:border-[#E8A838]/60 transition-all"
            />
            <button
              type="submit"
              className="absolute right-1.5 top-1/2 -translate-y-1/2 inline-flex items-center gap-1.5 text-xs font-extrabold text-primary-foreground gradient-navy px-4 py-2 rounded-full shadow-navy hover:-translate-y-[1px] transition-transform focus:outline-none focus-visible:ring-2 focus-visible:ring-[#E8A838]/60 focus-visible:ring-offset-2"
            >
              {lang === 'en' ? 'Search' : 'Rechercher'}
            </button>
          </form>

          {/* Popular categories — 4 big tiles */}
          <section className="mt-12" aria-labelledby="popular-categories-heading">
            <h2
              id="popular-categories-heading"
              className="text-sm font-extrabold tracking-[2px] uppercase text-muted-foreground text-center mb-4"
            >
              {lang === 'en' ? 'Popular categories' : 'Catégories populaires'}
            </h2>
            <div className="grid grid-cols-2 gap-3">
              {CATEGORY_TILES.map((tile) => (
                <Link
                  key={tile.slug}
                  to={`/products?cat=${tile.slug}`}
                  className="group relative flex items-center justify-between gap-3 px-5 py-5 rounded-2xl bg-white border border-border hover:border-[#0052CC]/40 hover:shadow-[0_12px_32px_rgba(27,58,107,0.12)] transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[#E8A838]/60 focus-visible:ring-offset-2"
                >
                  <span className="text-base md:text-lg font-extrabold text-foreground group-hover:text-[#1B3A6B] tracking-tight">
                    {lang === 'en' ? tile.en : tile.fr}
                  </span>
                  <span className="w-9 h-9 rounded-full bg-secondary/60 group-hover:bg-[#E8A838] flex items-center justify-center transition-colors">
                    <ArrowRight
                      aria-hidden="true"
                      className="w-4 h-4 text-[#1B3A6B] group-hover:text-[#1B3A6B] transition-transform group-hover:translate-x-0.5"
                    />
                  </span>
                </Link>
              ))}
            </div>
          </section>

          {/* Three popular products — only render when the live catalog
              has matched at least one SKU. On a cold load / network error
              we stay silent rather than render empty card skeletons. */}
          {popularProducts.length > 0 && (
            <section className="mt-12" aria-labelledby="popular-products-heading">
              <h2
                id="popular-products-heading"
                className="text-sm font-extrabold tracking-[2px] uppercase text-muted-foreground text-center mb-4"
              >
                {lang === 'en' ? 'Popular products' : 'Produits populaires'}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {popularProducts.map((p) => (
                  <ProductCard key={p.node.handle} product={p} />
                ))}
              </div>
            </section>
          )}

          {/* Secondary home link */}
          <div className="text-center mt-14">
            <Link
              to="/"
              className="text-sm font-bold text-muted-foreground hover:text-[#1B3A6B] underline underline-offset-4 decoration-dotted focus:outline-none focus-visible:ring-2 focus-visible:ring-[#E8A838]/60 focus-visible:ring-offset-2 rounded"
            >
              {lang === 'en' ? 'Back to home' : "Retour à l'accueil"}
            </Link>
          </div>
        </div>
      </main>
      <AIChat />
      <BottomNav />
    </div>
  );
};

export default NotFound;
