import { Navbar } from '@/components/Navbar';
import { SiteFooter } from '@/components/SiteFooter';
import { useLang } from '@/lib/langContext';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';

/**
 * Return policy placeholder. Real copy is owner-supplied; this page
 * exists so /returns links from the footer resolve to something
 * branded instead of the app's 404 page while legal review is pending.
 */
export default function Returns() {
  const { lang } = useLang();
  useDocumentTitle(lang === 'en' ? 'Return policy — Vision Affichage' : 'Politique de retour — Vision Affichage');

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <Navbar />
      <main id="main-content" className="flex-1 max-w-[860px] w-full mx-auto px-6 md:px-10 py-12 md:py-16">
        <h1 className="text-3xl md:text-4xl font-extrabold text-[#0A0A0A] tracking-[-0.5px] mb-3">
          {lang === 'en' ? 'Return policy' : 'Politique de retour'}
        </h1>
        <p className="text-xs text-zinc-500 mb-8">
          {lang === 'en' ? 'Last updated: April 2026' : 'Dernière mise à jour\u00a0: avril 2026'}
        </p>
        <div className="prose prose-zinc max-w-none text-[15px] leading-relaxed text-[#374151]">
          <p>
            {lang === 'en' ? 'This page is under review. Contact us at ' : 'Cette page est en cours de révision. Pour toute question, écris-nous à '}
            <a
              href={`mailto:support@visionaffichage.com?subject=${encodeURIComponent(lang === 'en' ? 'Return policy question' : 'Question politique de retour')}`}
              className="text-[#0052CC] hover:underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC] focus-visible:ring-offset-2 rounded-sm"
            >
              support@visionaffichage.com
            </a>
            {lang === 'en' ? ' for questions.' : '.'}
          </p>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
