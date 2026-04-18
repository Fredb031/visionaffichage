import { useEffect, useRef, useState } from 'react';
import { MessageCircle, X, Send, Sparkles } from 'lucide-react';
import { useLang } from '@/lib/langContext';

interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
  ts: number;
}

// Vision Affichage knowledge base — used to ground AI replies.
// Edit this when business facts change. Long-term: move to Supabase
// and let admins update via the dashboard.
const KB = {
  fr: [
    'Vision Affichage est une entreprise québécoise de merch corporatif personnalisé fondée en 2021.',
    'Délai de production : 5 jours ouvrables après confirmation. Pas de minimum de commande.',
    'Produits : T-shirts, hoodies, crewnecks, polos, casquettes, tuques, manches longues, sport.',
    'Impression DTG ou sérigraphie selon le produit. Broderie disponible sur polos, casquettes, tuques.',
    'Rabais volume : -10% à partir de 12 unités.',
    'Couleurs disponibles : 70+ variantes (Noir, Blanc, Marine, Bleu royal, Rouge, Forêt, Charbon, etc.).',
    'Taxes : QST + TPS = 14.975% sur toute commande au Québec.',
    'Livraison : standard gratuit (5 jours), express 25 $ (2-3 jours).',
    'Paiement : carte de crédit via Shopify (PCI-compliant).',
    'Contact : 367-380-4808, info@visionaffichage.com, lun-ven 8h-17h heure de l\'Est.',
    'Garantie : 1 an sur l\'impression et le tissu.',
    'Pour modifier ton logo après commande : appelle dans les 24h, sinon la production démarre.',
    '+33 000 produits livrés depuis 2021. 500+ entreprises clientes.',
    'Pour suivre une commande : visite /track avec ton numéro de commande et courriel.',
  ],
  en: [
    'Vision Affichage is a Quebec-based custom corporate merch company founded in 2021.',
    'Production time: 5 business days after confirmation. No minimum order.',
    'Products: T-shirts, hoodies, crewnecks, polos, caps, beanies, long-sleeves, sport.',
    'DTG or screen-print depending on product. Embroidery available on polos, caps, beanies.',
    'Volume discount: -10% from 12 units.',
    '70+ color variants available.',
    'Tax: QST + GST = 14.975% on Quebec orders.',
    'Shipping: standard free (5 days), express $25 (2-3 days).',
    'Payment: credit card via Shopify (PCI-compliant).',
    'Contact: 367-380-4808, info@visionaffichage.com, Mon-Fri 8am-5pm ET.',
    'Warranty: 1 year on print and fabric.',
    'To modify your logo after ordering: call within 24h, after that production starts.',
    '+33,000 products delivered since 2021. 500+ corporate clients.',
    'To track an order: visit /track with your order number and email.',
  ],
};

// Local rule-based responder — fast, free, works offline. For richer
// answers, swap with a fetch to a Supabase edge function calling the
// Anthropic Messages API (Opus 4.7) with the KB above as system prompt.
function answerLocal(question: string, lang: 'fr' | 'en'): string {
  const q = question.toLowerCase();
  const T = lang === 'fr' ? FR : EN;

  if (/(prix|cout|cost|price|combien|how much)/.test(q)) return T.price;
  if (/(delai|deadline|delivery|livraison|combien.*temps|how long|days?)/.test(q)) return T.delivery;
  if (/(minimum|min order|moins de)/.test(q)) return T.minimum;
  if (/(rabais|discount|volume|reduction)/.test(q)) return T.discount;
  if (/(impression|print|dtg|serigraph|embro|brod)/.test(q)) return T.printing;
  if (/(couleur|color|palette)/.test(q)) return T.colors;
  if (/(taille|size|fit|coupe)/.test(q)) return T.sizes;
  if (/(taxe|tax|tps|qst|gst)/.test(q)) return T.tax;
  if (/(suivre|track|where|ou.*ma|status|statut)/.test(q)) return T.track;
  if (/(contact|tel|phone|email|courriel|joindre|reach|appel)/.test(q)) return T.contact;
  if (/(payer|paiement|payment|carte|credit)/.test(q)) return T.payment;
  if (/(retour|return|refund|rembours)/.test(q)) return T.return_;
  if (/(garantie|warranty)/.test(q)) return T.warranty;
  if (/(modif|change|edit|cancel|annul)/.test(q)) return T.edit;
  if (/(quote|soumission|devis)/.test(q)) return T.quote;
  if (/(bonjour|hello|hi|salut|hey)/.test(q)) return T.hello;

  return T.fallback;
}

const FR = {
  price: 'Le prix dépend du produit, de la quantité et de l\'impression. Exemple : T-shirt ATC1000 à partir de 4,15 $ / unité, +4,50 $ pour l\'impression. Rabais -10% à partir de 12 unités. Veux-tu une soumission précise ? Visite /products ou appelle 367-380-4808.',
  delivery: 'On livre en 5 jours ouvrables après confirmation. Express 2-3 jours disponible (+25 $).',
  minimum: 'Aucun minimum de commande chez Vision Affichage — tu peux commander 1 unité.',
  discount: 'Rabais automatique de -10% sur 12 unités ou plus. Pour des volumes > 50, contacte-nous pour un prix encore meilleur.',
  printing: 'On utilise DTG ou sérigraphie selon le produit. Broderie disponible sur polos, casquettes, tuques.',
  colors: 'On a 70+ couleurs : Noir, Blanc, Marine, Bleu royal, Rouge, Forêt, Charbon, et plein d\'autres. Va sur /products pour voir les pastilles.',
  sizes: 'Tailles XS à 5XL selon le produit. Coupes unisexe, femme, enfant disponibles.',
  tax: 'Taxes Québec : QST + TPS = 14,975% calculées au paiement.',
  track: 'Tu peux suivre ta commande à /track avec ton numéro et ton courriel.',
  contact: 'Téléphone : 367-380-4808 · Courriel : info@visionaffichage.com · Lun-Ven 8h-17h.',
  payment: 'Paiement par carte de crédit via Shopify (PCI-compliant). On accepte Visa, MasterCard, Amex, Apple Pay.',
  return_: 'Comme c\'est du sur-mesure, on ne rembourse pas si l\'erreur vient du client. Si l\'impression est défectueuse, on reproduit gratuitement.',
  warranty: 'Garantie 1 an sur l\'impression et le tissu — si ça décolle ou se dégrade, on le remplace.',
  edit: 'Tu peux modifier ton logo dans les 24h après commande. Après, la production démarre. Appelle 367-380-4808 si urgent.',
  quote: 'Pour une soumission personnalisée : appelle 367-380-4808 ou écris à info@visionaffichage.com avec ton logo, quantité, et produit voulu.',
  hello: 'Salut ! Je suis ici pour répondre à tes questions sur Vision Affichage. Délai, prix, couleurs, livraison — demande-moi.',
  fallback: 'Bonne question ! Pour ça, le mieux c\'est d\'appeler au 367-380-4808 ou d\'écrire à info@visionaffichage.com. On répond en moins de 24h.',
};

const EN: typeof FR = {
  price: 'Price depends on product, quantity, and printing. Example: ATC1000 t-shirt from $4.15 / unit, +$4.50 for printing. -10% discount from 12 units. Want a precise quote? Visit /products or call 367-380-4808.',
  delivery: 'We deliver in 5 business days after confirmation. Express 2-3 days available (+$25).',
  minimum: 'No minimum order at Vision Affichage — you can order 1 unit.',
  discount: 'Automatic -10% discount on 12 units or more. For volumes > 50, contact us for an even better price.',
  printing: 'We use DTG or screen-printing depending on the product. Embroidery available on polos, caps, beanies.',
  colors: '70+ colors: Black, White, Navy, Royal Blue, Red, Forest, Charcoal, and many more. See /products for swatches.',
  sizes: 'Sizes XS to 5XL depending on product. Unisex, women, kids cuts available.',
  tax: 'Quebec tax: QST + GST = 14.975% calculated at checkout.',
  track: 'Track your order at /track with your number and email.',
  contact: 'Phone: 367-380-4808 · Email: info@visionaffichage.com · Mon-Fri 8am-5pm.',
  payment: 'Credit card via Shopify (PCI-compliant). We accept Visa, MasterCard, Amex, Apple Pay.',
  return_: 'Since it\'s custom-made, we don\'t refund customer errors. If the print is defective, we reprint for free.',
  warranty: '1-year warranty on print and fabric — if it peels or degrades, we replace it.',
  edit: 'You can change your logo within 24h of ordering. After that, production starts. Call 367-380-4808 if urgent.',
  quote: 'For a custom quote: call 367-380-4808 or email info@visionaffichage.com with your logo, quantity, and product.',
  hello: 'Hi! I\'m here to answer your questions about Vision Affichage. Timing, pricing, colors, shipping — ask me.',
  fallback: 'Good question! For this, best to call 367-380-4808 or email info@visionaffichage.com. We reply within 24h.',
};

const QUICK_PROMPTS_FR = [
  'Combien ça coûte ?',
  'Délai de livraison ?',
  'Comment commander ?',
  'Suivre ma commande',
];
const QUICK_PROMPTS_EN = [
  'How much does it cost?',
  'Delivery time?',
  'How do I order?',
  'Track my order',
];

export function AIChat() {
  const { lang } = useLang();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Greet on first open
  useEffect(() => {
    if (open && messages.length === 0) {
      setMessages([{ role: 'assistant', text: lang === 'fr' ? FR.hello : EN.hello, ts: Date.now() }]);
    }
  }, [open, messages.length, lang]);

  // Auto-scroll on new message
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || thinking) return;
    setMessages(m => [...m, { role: 'user', text: trimmed, ts: Date.now() }]);
    setInput('');
    setThinking(true);
    // Simulate brief thinking for natural feel
    await new Promise(r => setTimeout(r, 400 + Math.random() * 400));
    const reply = answerLocal(trimmed, lang as 'fr' | 'en');
    setMessages(m => [...m, { role: 'assistant', text: reply, ts: Date.now() }]);
    setThinking(false);
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    send(input);
  };

  const quickPrompts = lang === 'fr' ? QUICK_PROMPTS_FR : QUICK_PROMPTS_EN;
  void KB;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-label={lang === 'en' ? 'Open chat' : 'Ouvrir la conversation'}
        aria-expanded={open}
        className="fixed bottom-24 right-4 z-[450] w-14 h-14 rounded-full bg-gradient-to-br from-[#0052CC] to-[#1B3A6B] text-white shadow-2xl flex items-center justify-center hover:scale-105 active:scale-95 transition-transform"
      >
        {open ? <X size={20} /> : <MessageCircle size={22} />}
        {!open && (
          <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-emerald-400 border-2 border-background animate-pulse" />
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label={lang === 'en' ? 'Chat with Vision AI' : 'Discuter avec Vision AI'}
          className="fixed bottom-44 right-4 z-[450] w-[360px] max-w-[calc(100vw-32px)] h-[540px] max-h-[calc(100vh-200px)] bg-white rounded-2xl shadow-2xl border border-border overflow-hidden flex flex-col animate-[staggerUp_0.3s_cubic-bezier(.34,1.4,.64,1)_forwards]"
        >
          {/* Header */}
          <div className="bg-gradient-to-br from-[#0052CC] to-[#1B3A6B] text-white p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white/15 flex items-center justify-center">
              <Sparkles size={18} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-extrabold text-sm">Vision AI</div>
              <div className="text-[11px] opacity-80 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                {lang === 'en' ? 'Online · Replies instantly' : 'En ligne · Réponse instantanée'}
              </div>
            </div>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 bg-secondary/30">
            {messages.map((m, i) => (
              <div
                key={i}
                className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${
                    m.role === 'user'
                      ? 'bg-[#0052CC] text-white rounded-br-md'
                      : 'bg-white text-foreground border border-border rounded-bl-md shadow-sm'
                  }`}
                >
                  {m.text}
                </div>
              </div>
            ))}
            {thinking && (
              <div className="flex justify-start">
                <div className="bg-white text-muted-foreground border border-border rounded-2xl rounded-bl-md px-3.5 py-2 shadow-sm flex items-center gap-1">
                  {[0, 1, 2].map(i => (
                    <span
                      key={i}
                      className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-bounce"
                      style={{ animationDelay: `${i * 120}ms` }}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Quick prompts */}
          {messages.length <= 1 && (
            <div className="px-3 pb-2 flex flex-wrap gap-1.5">
              {quickPrompts.map(p => (
                <button
                  key={p}
                  type="button"
                  onClick={() => send(p)}
                  className="text-[11px] font-bold px-2.5 py-1.5 rounded-full bg-secondary border border-border hover:border-[#0052CC] hover:text-[#0052CC] transition-colors"
                >
                  {p}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <form onSubmit={onSubmit} className="p-3 border-t border-border bg-white flex items-center gap-2">
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder={lang === 'en' ? 'Ask anything…' : 'Pose ta question…'}
              className="flex-1 bg-secondary border border-border rounded-full px-4 py-2 text-sm outline-none focus:border-[#0052CC]"
              disabled={thinking}
            />
            <button
              type="submit"
              disabled={!input.trim() || thinking}
              className="w-10 h-10 rounded-full bg-[#0052CC] text-white flex items-center justify-center disabled:opacity-30 hover:opacity-90"
              aria-label={lang === 'en' ? 'Send' : 'Envoyer'}
            >
              <Send size={14} />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
