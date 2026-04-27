import { Navbar } from '@/components/Navbar';
import { SiteFooter } from '@/components/SiteFooter';
import { useLang } from '@/lib/langContext';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';

/**
 * Accessibility statement placeholder. Real copy is owner-supplied;
 * this page exists so /accessibility links from the footer resolve to
 * something branded instead of the app's 404 page while legal review
 * is pending.
 */
export default function Accessibility() {
  const { lang } = useLang();
  useDocumentTitle(lang === 'en' ? 'Accessibility — Vision Affichage' : 'Accessibilité — Vision Affichage');

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <Navbar />
      <main id="main-content" className="flex-1 max-w-[860px] w-full mx-auto px-6 md:px-10 py-12 md:py-16">
        <h1 className="text-3xl md:text-4xl font-extrabold text-[#0A0A0A] tracking-[-0.5px] mb-3">
          {lang === 'en' ? 'Accessibility' : 'Accessibilité'}
        </h1>
        <p className="text-xs text-zinc-500 mb-8">
          {lang === 'en' ? 'Last updated: April 2026' : 'Dernière mise à jour\u00a0: avril 2026'}
        </p>
        <div className="prose prose-zinc max-w-none text-[15px] leading-relaxed text-[#374151]">
          <p>
            {lang === 'en' ? (
              <>
                This page is under review. To report an accessibility barrier or request content in an alternate format, contact us at{' '}
                <a
                  href="mailto:support@visionaffichage.com?subject=Accessibility%20feedback"
                  className="underline decoration-dotted underline-offset-2 hover:text-[#0A0A0A] focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#0A0A0A]"
                  aria-label="Email Vision Affichage about an accessibility issue"
                >
                  support@visionaffichage.com
                </a>
                . We aim to respond within 5 business days.
              </>
            ) : (
              <>
                Cette page est en cours de révision. Pour signaler un obstacle d{'’'}accessibilité ou demander un contenu dans un format alternatif, écris-nous à{' '}
                <a
                  href="mailto:support@visionaffichage.com?subject=Commentaire%20accessibilit%C3%A9"
                  className="underline decoration-dotted underline-offset-2 hover:text-[#0A0A0A] focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#0A0A0A]"
                  aria-label="Écrire à Vision Affichage au sujet d'un problème d'accessibilité"
                >
                  support@visionaffichage.com
                </a>
                . Nous visons une réponse sous 5 jours ouvrables.
              </>
            )}
          </p>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
