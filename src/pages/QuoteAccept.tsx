import { useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Check, CreditCard, ShieldCheck, MapPin, Mail } from 'lucide-react';
import { DeliveryBadge } from '@/components/DeliveryBadge';
import { LogoUploadDropzone } from '@/components/LogoUploadDropzone';
import { useLang } from '@/lib/langContext';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';

interface MockLineItem {
  id: string;
  name: string;
  image: string;
  color: string;
  size: string;
  qty: number;
  unit: number;
  placement: string;
}

const MOCK_QUOTE = {
  number: 'Q-2026-0042',
  vendor: 'Sophie Tremblay',
  client: 'Entreprise ABC',
  clientEmail: 'contact@entrepriseabc.ca',
  createdAt: '2026-04-17',
  expiresAt: '2026-04-24',
  items: [
    {
      id: '1',
      name: 'T-Shirt Unisex',
      image: 'https://cdn.shopify.com/s/files/1/0578/1038/7059/files/tshirt-black-front.png?width=300',
      color: 'Noir',
      size: 'M',
      qty: 24,
      unit: 21.95,
      placement: 'Coeur gauche + dos centré',
    },
    {
      id: '2',
      name: 'Hoodie',
      image: 'https://cdn.shopify.com/s/files/1/0578/1038/7059/files/hoodie-navy-front.png?width=300',
      color: 'Marine',
      size: 'L',
      qty: 12,
      unit: 42.54,
      placement: 'Coeur gauche',
    },
  ] as MockLineItem[],
  discount: { kind: 'percent' as const, value: 10, reason: 'Volume client régulier' },
  notes: 'Livraison prioritaire demandée pour événement du 30 avril.',
};

export default function QuoteAccept() {
  const { id } = useParams();
  const { lang } = useLang();
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  const quoteNumber = id ?? MOCK_QUOTE.number;
  useDocumentTitle(lang === 'en'
    ? `Quote ${quoteNumber} — Vision Affichage`
    : `Soumission ${quoteNumber} — Vision Affichage`);

  const subtotal = useMemo(() => MOCK_QUOTE.items.reduce((s, it) => s + it.unit * it.qty, 0), []);
  const discountAmount = (subtotal * MOCK_QUOTE.discount.value) / 100;
  const tax = (subtotal - discountAmount) * 0.14975;
  const total = subtotal - discountAmount + tax;

  const canPay = logoFile !== null && acceptedTerms;

  return (
    <div className="min-h-screen bg-gradient-to-b from-secondary/40 to-background">
      <header className="bg-white border-b border-border px-4 md:px-8 py-5 flex items-center justify-between print:border-b-2 print:border-zinc-900">
        <Link to="/" aria-label="Vision Affichage — Home" className="rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC] focus-visible:ring-offset-2">
          <img
            src="https://visionaffichage.com/cdn/shop/files/Asset_1_d5d82510-0b83-4657-91b7-3ac1992ee697.svg?height=90&v=1769614651"
            alt="Vision Affichage"
            width={96}
            height={24}
            decoding="async"
            className="h-6 w-auto"
          />
        </Link>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => window.print()}
            className="hidden md:inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 border border-border rounded-lg hover:bg-secondary transition-colors print:hidden"
          >
            🖨️ {lang === 'en' ? 'Print' : 'Imprimer'}
          </button>
          <DeliveryBadge size="sm" />
        </div>
      </header>

      <style>{`
        @media print {
          body { background: white !important; }
          .print\\:hidden { display: none !important; }
          .lg\\:sticky { position: static !important; }
          aside { page-break-inside: avoid; }
          section { page-break-inside: avoid; }
          .min-h-screen { min-height: auto !important; }
          .shadow-2xl, .shadow-xl, .shadow-md { box-shadow: none !important; }
          button { display: none !important; }
        }
      `}</style>

      <main className="max-w-[1100px] mx-auto px-4 md:px-8 py-8 md:py-12 space-y-6">
        <div className="text-center">
          <div className="text-[11px] font-bold tracking-[2px] uppercase text-[#0052CC] mb-2">
            {lang === 'en' ? 'Custom quote' : 'Soumission personnalisée'}
          </div>
          <h1 className="text-[clamp(28px,4vw,42px)] font-extrabold tracking-[-1px] text-foreground mb-2">
            {lang === 'en' ? `Quote for ${MOCK_QUOTE.client}` : `Soumission pour ${MOCK_QUOTE.client}`}
          </h1>
          <p className="text-sm text-muted-foreground">
            {lang === 'en'
              ? `Prepared by ${MOCK_QUOTE.vendor} · ${MOCK_QUOTE.number} · Quote #${id ?? MOCK_QUOTE.number}`
              : `Préparée par ${MOCK_QUOTE.vendor} · ${MOCK_QUOTE.number}`}
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6">
          <div className="space-y-6">
            <section className="bg-white border border-border rounded-2xl p-5 md:p-6">
              <h2 className="font-extrabold text-lg mb-4 flex items-center gap-2">
                <Check size={18} className="text-[#0052CC]" />
                {lang === 'en' ? 'Your order' : 'Ta commande'}
              </h2>
              <div className="space-y-3">
                {MOCK_QUOTE.items.map(it => (
                  <div key={it.id} className="flex gap-4 items-center p-3 bg-secondary/30 rounded-xl">
                    <img src={it.image} alt="" loading="lazy" decoding="async" className="w-20 h-20 rounded-lg object-cover bg-white flex-shrink-0 border border-border" />
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-sm">{it.name}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {it.color} · {lang === 'en' ? 'Size' : 'Taille'} {it.size} · {it.qty} {lang === 'en' ? 'units' : 'unités'}
                      </div>
                      <div className="text-[11px] text-[#0052CC] mt-1 font-semibold">
                        📍 {it.placement}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="font-extrabold text-[#0052CC]">{(it.unit * it.qty).toFixed(2)} $</div>
                      <div className="text-[10px] text-muted-foreground">{it.unit.toFixed(2)} $ / {lang === 'en' ? 'unit' : 'unité'}</div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="bg-white border border-border rounded-2xl p-5 md:p-6">
              <h2 className="font-extrabold text-lg mb-1 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-[#0052CC] text-white flex items-center justify-center text-xs">1</span>
                {lang === 'en' ? 'Upload your logo' : 'Téléverse ton logo'}
              </h2>
              <p className="text-sm text-muted-foreground mb-4">
                {lang === 'en'
                  ? 'Highest quality: vector (SVG, AI, PDF). We remove the background automatically.'
                  : 'Meilleure qualité : vectoriel (SVG, AI, PDF). On enlève le fond automatiquement.'}
              </p>
              <LogoUploadDropzone
                onFileReady={f => setLogoFile(f)}
                onRemove={() => setLogoFile(null)}
              />
            </section>

            <section className="bg-white border border-border rounded-2xl p-5 md:p-6">
              <h2 className="font-extrabold text-lg mb-4 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-[#0052CC] text-white flex items-center justify-center text-xs">2</span>
                {lang === 'en' ? 'Shipping address' : 'Adresse de livraison'}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Input label={lang === 'en' ? 'Full name' : 'Nom complet'} autoComplete="name" />
                <Input label={lang === 'en' ? 'Company' : 'Entreprise'} defaultValue={MOCK_QUOTE.client} autoComplete="organization" />
                <Input label={lang === 'en' ? 'Street address' : 'Adresse'} autoComplete="street-address" className="md:col-span-2" />
                <Input label={lang === 'en' ? 'City' : 'Ville'} autoComplete="address-level2" />
                <Input label={lang === 'en' ? 'Postal code' : 'Code postal'} autoComplete="postal-code" />
              </div>
            </section>

            <section className="bg-white border border-border rounded-2xl p-5 md:p-6">
              <h2 className="font-extrabold text-lg mb-4 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-[#0052CC] text-white flex items-center justify-center text-xs">3</span>
                {lang === 'en' ? 'Terms & conditions' : 'Conditions'}
              </h2>
              <label className="flex items-start gap-3 cursor-pointer p-3 bg-secondary/30 rounded-xl hover:bg-secondary/50 transition-colors">
                <input
                  type="checkbox"
                  checked={acceptedTerms}
                  onChange={e => setAcceptedTerms(e.target.checked)}
                  className="mt-0.5 w-5 h-5 rounded border-2 border-border accent-[#0052CC] cursor-pointer"
                />
                <span className="text-sm text-foreground">
                  {lang === 'en'
                    ? "I agree to the terms of service and confirm my logo placement instructions are correct. I understand production starts once payment is confirmed."
                    : "J'accepte les conditions de service et confirme que les instructions de placement du logo sont exactes. Je comprends que la production débute dès la confirmation du paiement."}
                </span>
              </label>
            </section>
          </div>

          <aside className="lg:sticky lg:top-6 h-fit">
            <div className="bg-white border border-border rounded-2xl p-5 md:p-6 space-y-4">
              <div>
                <h2 className="font-extrabold text-lg">{lang === 'en' ? 'Summary' : 'Résumé'}</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {lang === 'en' ? 'Expires' : 'Expire'} {MOCK_QUOTE.expiresAt}
                </p>
              </div>

              <div className="space-y-1.5 text-sm border-y border-border py-4">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{lang === 'en' ? 'Subtotal' : 'Sous-total'}</span>
                  <span className="font-semibold">{subtotal.toFixed(2)} $</span>
                </div>
                <div className="flex justify-between text-emerald-700">
                  <span className="font-semibold">
                    {lang === 'en' ? 'Discount' : 'Rabais'} ({MOCK_QUOTE.discount.value}%)
                  </span>
                  <span className="font-bold">- {discountAmount.toFixed(2)} $</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{lang === 'en' ? 'Tax' : 'Taxes'} (14.975%)</span>
                  <span className="font-semibold">{tax.toFixed(2)} $</span>
                </div>
              </div>

              <div className="flex justify-between items-baseline">
                <span className="text-lg font-extrabold">Total</span>
                <div className="text-right">
                  <div className="text-2xl font-extrabold text-[#0052CC] leading-none">{total.toFixed(2)} $</div>
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wider">CAD · taxes incluses</div>
                </div>
              </div>

              <button
                type="button"
                disabled={!canPay}
                className="w-full py-4 bg-gradient-to-br from-[#0052CC] to-[#1B3A6B] text-white rounded-xl font-extrabold flex items-center justify-center gap-2 hover:shadow-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <CreditCard size={18} />
                {lang === 'en' ? 'Review & pay' : 'Vérifier et payer'}
              </button>

              {!canPay && (
                <p className="text-[11px] text-muted-foreground text-center">
                  {!logoFile
                    ? lang === 'en' ? '⬆ Upload your logo first' : '⬆ Téléverse ton logo d\'abord'
                    : lang === 'en' ? '⬆ Accept terms to continue' : '⬆ Accepte les conditions pour continuer'}
                </p>
              )}

              <div className="space-y-2 pt-2 border-t border-border">
                <Bullet icon={ShieldCheck}>{lang === 'en' ? 'Secure Shopify checkout' : 'Paiement Shopify sécurisé'}</Bullet>
                <Bullet icon={MapPin}>{lang === 'en' ? 'Printed in Québec' : 'Imprimé au Québec'}</Bullet>
                <Bullet icon={Mail}>{lang === 'en' ? 'Proof sent within 24h' : 'Épreuve envoyée en 24h'}</Bullet>
              </div>
            </div>
          </aside>
        </div>

        {MOCK_QUOTE.notes && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm">
            <div className="font-bold text-amber-900 mb-1">
              {lang === 'en' ? 'Note from your rep' : 'Note de ton conseiller'}
            </div>
            <div className="text-amber-800">{MOCK_QUOTE.notes}</div>
          </div>
        )}
      </main>
    </div>
  );
}

function Input({ label, defaultValue, autoComplete, className = '' }: { label: string; defaultValue?: string; autoComplete?: string; className?: string }) {
  return (
    <label className={`flex flex-col gap-1 ${className}`}>
      <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">{label}</span>
      <input
        type="text"
        defaultValue={defaultValue}
        autoComplete={autoComplete}
        className="border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-[#0052CC] focus:ring-2 focus:ring-[#0052CC]/10 bg-white"
      />
    </label>
  );
}

function Bullet({ icon: Icon, children }: { icon: typeof ShieldCheck; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
      <Icon size={14} className="text-[#0052CC] flex-shrink-0" aria-hidden="true" />
      <span>{children}</span>
    </div>
  );
}
