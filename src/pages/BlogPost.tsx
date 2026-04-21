import { Link, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { SiteFooter } from '@/components/SiteFooter';
import { useLang } from '@/lib/langContext';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';

/**
 * Task 11.6 — /blog/:slug placeholder. Reads the slug so we can echo it
 * into the title / eyebrow (lets the owner see that routing works before
 * real content lands) and renders a branded "post under review" page
 * with the same Navbar + Footer chrome as the rest of the site. The
 * real post body is an owner upload; when it arrives the body prose
 * swaps in here without touching the page shell or the /blog index.
 */
export default function BlogPost() {
  const { lang } = useLang();
  const { slug = '' } = useParams<{ slug: string }>();

  // Derive a human-readable title from the slug so an owner sharing the
  // URL early sees something coherent in the <title> bar — "Dpi 101
  // Logo Merch" beats "undefined" or the raw slug in a tab.
  const prettyTitle = slug
    .split('-')
    .filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ') || (lang === 'en' ? 'Article' : 'Article');

  useDocumentTitle(
    lang === 'en'
      ? `${prettyTitle} — Vision Affichage`
      : `${prettyTitle} — Vision Affichage`,
    lang === 'en'
      ? 'Merch tips and production playbooks from Vision Affichage.'
      : 'Conseils merch et playbooks de production de Vision Affichage.',
  );

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col">
      <Navbar />
      <main id="main-content" className="flex-1 max-w-[760px] w-full mx-auto px-6 md:px-10 py-12 md:py-16">
        <Link
          to="/blog"
          className="inline-flex items-center gap-1.5 text-sm font-bold text-[#0052CC] hover:text-[#0041A6] mb-6 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC]/50 rounded"
        >
          <ArrowLeft size={14} aria-hidden="true" />
          {lang === 'en' ? 'Back to blog' : 'Retour au blogue'}
        </Link>

        <div className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[2px] text-[#E8A838] mb-2">
          {lang === 'en' ? 'Article' : 'Article'}
        </div>
        <h1 className="text-3xl md:text-4xl font-extrabold text-[#0F2341] tracking-[-0.5px] mb-6">
          {prettyTitle}
        </h1>

        {/* TODO(11.6): owner drops real post body here — Markdown /
            MDX / Shopify CMS fetch, TBD. Until then, a branded review
            notice tells the visitor they're in the right place and
            invites the back-link instead of dead-ending on empty state. */}
        <div className="prose prose-zinc max-w-none text-[15px] leading-relaxed text-zinc-700">
          <p className="bg-white rounded-2xl border border-zinc-200 p-6 md:p-7 shadow-sm text-zinc-600">
            {lang === 'en'
              ? 'This post is under review. Check back soon!'
              : 'Cette publication est en révision. Revenez bientôt\u00a0!'}
          </p>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
