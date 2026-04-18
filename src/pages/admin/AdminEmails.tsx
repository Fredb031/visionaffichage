import { useState } from 'react';
import { Mail, Copy, Check } from 'lucide-react';
import {
  quoteSentEmail,
  paymentConfirmationEmail,
  orderShippedEmail,
  orderDeliveredEmail,
} from '@/lib/emailTemplates';

type TemplateId = 'quote-sent' | 'payment' | 'shipped' | 'delivered';
type Lang = 'fr' | 'en';

const TEMPLATES: Array<{ id: TemplateId; label: string; subtitle: string }> = [
  { id: 'quote-sent', label: 'Soumission envoyée', subtitle: 'Client reçoit le lien pour accepter' },
  { id: 'payment',    label: 'Paiement confirmé',  subtitle: 'Production commence' },
  { id: 'shipped',    label: 'Commande expédiée',  subtitle: 'Avec numéro de suivi' },
  { id: 'delivered',  label: 'Commande livrée',    subtitle: 'Demande d\'avis' },
];

function previewOf(id: TemplateId, lang: Lang) {
  switch (id) {
    case 'quote-sent':
      return quoteSentEmail({
        clientName: 'Anthony Ouellet',
        clientEmail: 'anthony@souspression.ca',
        vendorName: 'Sophie Tremblay',
        quoteNumber: 'Q-2026-0042',
        quoteUrl: 'https://visionaffichage.com/quote/q-2026-0042',
        total: 1840,
        expiresAt: '2026-04-24',
        lang,
      });
    case 'payment':
      return paymentConfirmationEmail({
        clientName: 'Anthony Ouellet',
        orderNumber: 'VA-1048',
        total: 1840,
        etaDate: '2026-04-23',
        trackingUrl: 'https://visionaffichage.com/track/VA-1048',
        lang,
      });
    case 'shipped':
      return orderShippedEmail({
        clientName: 'Anthony Ouellet',
        orderNumber: 'VA-1048',
        trackingNumber: 'PUR-1Z999AA10123456784',
        trackingUrl: 'https://tools.usps.com/go/TrackConfirmAction?tLabels=1Z999AA10123456784',
        carrier: 'Purolator',
        etaDate: '2026-04-23',
        lang,
      });
    case 'delivered':
      return orderDeliveredEmail({
        clientName: 'Anthony Ouellet',
        orderNumber: 'VA-1048',
        reviewUrl: 'https://g.page/r/review-link',
        lang,
      });
  }
}

export default function AdminEmails() {
  const [active, setActive] = useState<TemplateId>('quote-sent');
  const [lang, setLang] = useState<Lang>('fr');
  const [copied, setCopied] = useState(false);

  const email = previewOf(active, lang);

  const copyHtml = () => {
    navigator.clipboard.writeText(email.html);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-extrabold tracking-tight flex items-center gap-2">
          <Mail size={22} className="text-[#0052CC]" />
          Modèles de courriels
        </h1>
        <p className="text-sm text-zinc-500 mt-1">
          Templates HTML prêts à brancher avec Resend, Postmark ou Shopify Email.
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-5">
        <aside className="space-y-1.5">
          {TEMPLATES.map(t => (
            <button
              key={t.id}
              type="button"
              onClick={() => setActive(t.id)}
              className={`w-full text-left p-3 rounded-xl transition-colors ${
                active === t.id
                  ? 'bg-[#0052CC] text-white'
                  : 'bg-white border border-zinc-200 hover:border-[#0052CC]'
              }`}
            >
              <div className="font-bold text-sm">{t.label}</div>
              <div className={`text-[11px] mt-0.5 ${active === t.id ? 'text-white/80' : 'text-zinc-500'}`}>
                {t.subtitle}
              </div>
            </button>
          ))}
        </aside>

        <main className="space-y-4">
          <div className="bg-white border border-zinc-200 rounded-2xl p-4 flex items-center gap-3 flex-wrap">
            <div className="text-sm">
              <span className="text-zinc-500">Sujet :</span>{' '}
              <span className="font-bold">{email.subject}</span>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <div className="inline-flex border border-zinc-200 rounded-lg overflow-hidden">
                <button
                  type="button"
                  onClick={() => setLang('fr')}
                  className={`px-3 py-1.5 text-xs font-bold ${lang === 'fr' ? 'bg-zinc-900 text-white' : 'bg-white text-zinc-600'}`}
                >
                  FR
                </button>
                <button
                  type="button"
                  onClick={() => setLang('en')}
                  className={`px-3 py-1.5 text-xs font-bold ${lang === 'en' ? 'bg-zinc-900 text-white' : 'bg-white text-zinc-600'}`}
                >
                  EN
                </button>
              </div>
              <button
                type="button"
                onClick={copyHtml}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-zinc-100 hover:bg-zinc-200 rounded-lg text-xs font-bold"
              >
                {copied ? <Check size={13} /> : <Copy size={13} />}
                {copied ? 'Copié' : 'Copier HTML'}
              </button>
            </div>
          </div>

          <div className="bg-zinc-100 rounded-2xl p-6 md:p-10 min-h-[400px]">
            <iframe
              srcDoc={email.html}
              className="w-full min-h-[600px] border-none rounded-lg bg-white shadow-lg"
              title="Email preview"
              sandbox=""
            />
          </div>

          <div className="bg-white border border-zinc-200 rounded-2xl p-4">
            <h3 className="font-bold text-xs text-zinc-500 uppercase tracking-wider mb-2">Version texte</h3>
            <pre className="text-xs text-zinc-700 whitespace-pre-wrap font-sans leading-relaxed">{email.text}</pre>
          </div>
        </main>
      </div>
    </div>
  );
}
