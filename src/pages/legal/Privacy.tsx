import { Navbar } from '@/components/Navbar';
import { SiteFooter } from '@/components/SiteFooter';
import { useLang } from '@/lib/langContext';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';

/**
 * Privacy policy placeholder. Real copy is owner-supplied; this page
 * exists so /privacy links from the footer resolve to something
 * branded instead of the app's 404 page while legal review is pending.
 */
export default function Privacy() {
  const { lang } = useLang();
  useDocumentTitle(lang === 'en' ? 'Privacy policy — Vision Affichage' : 'Politique de confidentialité — Vision Affichage');

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <Navbar />
      <main id="main-content" className="flex-1 max-w-[860px] w-full mx-auto px-6 md:px-10 py-12 md:py-16">
        <h1 className="text-3xl md:text-4xl font-extrabold text-[#0A0A0A] tracking-[-0.5px] mb-3">
          {lang === 'en' ? 'Privacy policy' : 'Politique de confidentialité'}
        </h1>
        <p className="text-xs text-zinc-500 mb-8">
          {lang === 'en' ? 'Last updated: April 2026' : 'Dernière mise à jour\u00a0: avril 2026'}
        </p>
        <div className="prose prose-zinc max-w-none text-[15px] leading-relaxed text-[#374151]">
          <p>
            {lang === 'en' ? (
              <>
                This page is under review. Under Quebec{'’'}s Law 25, you may request access, rectification, deletion, or portability of the personal information we hold about you. To exercise any of these rights, contact our person in charge of personal information protection at{' '}
                <a
                  href="mailto:support@visionaffichage.com?subject=Law%2025%20request%20%E2%80%94%20access%2C%20rectification%2C%20deletion%20or%20portability"
                  className="underline decoration-dotted underline-offset-2 hover:text-[#0A0A0A] focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#0A0A0A]"
                  aria-label="Email Vision Affichage to exercise a Law 25 privacy right (access, rectification, deletion, or portability)"
                >
                  support@visionaffichage.com
                </a>
                . We aim to respond within 30 days, as required by Law 25.
              </>
            ) : (
              <>
                Cette page est en cours de révision. En vertu de la Loi 25 du Québec, tu peux demander l{'’'}accès, la rectification, la suppression ou la portabilité des renseignements personnels que nous détenons à ton sujet. Pour exercer l{'’'}un de ces droits, écris à notre responsable de la protection des renseignements personnels à{' '}
                <a
                  href="mailto:support@visionaffichage.com?subject=Demande%20Loi%2025%20%E2%80%94%20acc%C3%A8s%2C%20rectification%2C%20suppression%20ou%20portabilit%C3%A9"
                  className="underline decoration-dotted underline-offset-2 hover:text-[#0A0A0A] focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#0A0A0A]"
                  aria-label="Écrire à Vision Affichage pour exercer un droit lié à la Loi 25 (accès, rectification, suppression ou portabilité)"
                >
                  support@visionaffichage.com
                </a>
                . Nous visons une réponse sous 30 jours, conformément à la Loi 25.
              </>
            )}
          </p>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
