import { useState, useRef, useCallback } from 'react';
import { X, Upload, Check } from 'lucide-react';
import { ShopifyProduct } from '@/lib/shopify';
import { useCartStore } from '@/stores/cartStore';
import { toast } from 'sonner';

interface ProductCustomizerProps {
  isOpen: boolean;
  onClose: () => void;
  product: ShopifyProduct['node'];
  onCartOpen: () => void;
}

const COLORS = [
  { name: 'Noir', hex: '#111111' },
  { name: 'Blanc', hex: '#FFFFFF' },
  { name: 'Gris', hex: '#6B7280' },
  { name: 'Marine', hex: '#1B3A6B' },
  { name: 'Rouge', hex: '#DC2626' },
  { name: 'Vert', hex: '#16A34A' },
  { name: 'Bleu Royal', hex: '#2563EB' },
  { name: 'Beige', hex: '#D4B896' },
];

const ZONES = [
  { icon: '👕', label: 'Devant' },
  { icon: '🔙', label: 'Dos' },
  { icon: '💪', label: 'Manche' },
];

const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];

const VIEWS = ['Devant', 'Dos', 'Gauche', 'Droite'];

function getVolumeDiscount(total: number): number {
  if (total >= 50) return 0.25;
  if (total >= 25) return 0.20;
  if (total >= 12) return 0.15;
  if (total >= 6) return 0.10;
  return 0;
}

export function ProductCustomizer({ isOpen, onClose, product, onCartOpen }: ProductCustomizerProps) {
  const addItem = useCartStore(state => state.addItem);
  const isCartLoading = useCartStore(state => state.isLoading);

  const [openStep, setOpenStep] = useState(0);
  const [selectedColor, setSelectedColor] = useState(COLORS[0]);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [selectedZone, setSelectedZone] = useState(0);
  const [quantities, setQuantities] = useState<Record<string, number>>(
    Object.fromEntries(SIZES.map(s => [s, 0]))
  );
  const [activeView, setActiveView] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const totalUnits = Object.values(quantities).reduce((a, b) => a + b, 0);
  const discount = getVolumeDiscount(totalUnits);
  const firstVariant = product.variants.edges[0]?.node;
  const unitPrice = firstVariant ? parseFloat(firstVariant.price.amount) : 0;
  const printPrice = 3.50;
  const subtotal = totalUnits * (unitPrice + printPrice);
  const discountAmount = subtotal * discount;
  const total = subtotal - discountAmount;
  const currency = firstVariant?.price.currencyCode || 'CAD';

  const productImage = product.images.edges[0]?.node?.url;

  const stepDone = (step: number) => {
    if (step === 0) return true; // color always selected
    if (step === 1) return !!logoFile;
    if (step === 2) return true; // zone always selected
    if (step === 3) return totalUnits > 0;
    if (step === 4) return totalUnits > 0 && !!logoFile;
    return false;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setLogoPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (!file) return;
    setLogoFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setLogoPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  }, []);

  const handleAddToCart = async () => {
    if (!firstVariant || totalUnits === 0) return;
    const wrappedProduct = { node: product };
    await addItem({
      product: wrappedProduct,
      variantId: firstVariant.id,
      variantTitle: firstVariant.title,
      price: firstVariant.price,
      quantity: totalUnits,
      selectedOptions: firstVariant.selectedOptions || [],
    });
    toast.success(`${product.title} ajouté au panier (${totalUnits} unités)`, { position: 'top-center' });
    onClose();
    onCartOpen();
  };

  const updateQty = (size: string, val: string) => {
    const num = parseInt(val) || 0;
    setQuantities(prev => ({ ...prev, [size]: Math.max(0, num) }));
  };

  if (!isOpen) return null;

  const steps = [
    { label: 'Couleur', num: 1 },
    { label: 'Ton logo', num: 2 },
    { label: "Zone d'impression", num: 3 },
    { label: 'Tailles & quantités', num: 4 },
    { label: 'Résumé', num: 5 },
  ];

  return (
    <div className="fixed inset-0 z-[600] bg-foreground/60 backdrop-blur-[12px] flex items-end justify-center p-5">
      <div className="bg-card rounded-t-3xl w-full max-w-[1100px] max-h-[92vh] overflow-hidden grid grid-cols-1 md:grid-cols-[1fr_380px]">
        {/* Left: Canvas/Preview */}
        <div className="flex flex-col border-r border-border">
          {/* Top bar */}
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <span className="text-[15px] font-bold text-foreground">{product.title}</span>
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1.5 text-[11px] text-green font-bold">
                <span className="w-1.5 h-1.5 bg-green rounded-full" />
                Aperçu live
              </span>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full border border-border bg-transparent cursor-pointer flex items-center justify-center text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Stage */}
          <div className="flex-1 bg-secondary flex items-center justify-center relative min-h-[300px] md:min-h-[380px] overflow-hidden">
            {productImage && (
              <img
                src={productImage}
                alt={product.title}
                className="max-h-[340px] max-w-[90%] object-contain z-[1] relative"
              />
            )}
            {/* Logo zone overlay */}
            <div
              onClick={() => fileInputRef.current?.click()}
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[56%] z-[2] border-[1.5px] border-dashed border-primary/25 rounded-lg w-[108px] h-[84px] flex items-center justify-center flex-col gap-1 cursor-pointer transition-all bg-card/60 hover:bg-card/90 hover:border-primary"
            >
              {logoPreview ? (
                <img src={logoPreview} alt="Logo" className="max-w-full max-h-full object-contain p-1" />
              ) : (
                <>
                  <Upload className="h-4 w-4 text-primary/45" />
                  <span className="text-[9px] font-bold tracking-[1.5px] text-primary/45 uppercase">Ton logo ici</span>
                </>
              )}
            </div>
          </div>

          {/* Views */}
          <div className="flex gap-1.5 px-5 py-3 border-t border-border">
            {VIEWS.map((view, i) => (
              <button
                key={view}
                onClick={() => setActiveView(i)}
                className={`text-[11px] font-bold px-3.5 py-1.5 border-[1.5px] rounded-full cursor-pointer transition-all ${
                  activeView === i
                    ? 'border-primary text-primary'
                    : 'border-border text-muted-foreground hover:border-primary hover:text-primary'
                }`}
              >
                {view}
              </button>
            ))}
          </div>
        </div>

        {/* Right: Steps sidebar */}
        <div className="overflow-y-auto flex flex-col max-h-[92vh] md:max-h-none">
          {steps.map((step, idx) => (
            <div key={idx} className="border-b border-border">
              {/* Step header */}
              <div
                onClick={() => setOpenStep(idx)}
                className="px-5 py-4 flex items-center gap-3 cursor-pointer transition-colors hover:bg-secondary"
              >
                <div className={`w-7 h-7 rounded-full border-[1.5px] flex items-center justify-center text-[11px] font-extrabold flex-shrink-0 transition-all ${
                  openStep === idx
                    ? 'bg-primary border-primary text-primary-foreground'
                    : stepDone(idx)
                    ? 'bg-green border-green text-primary-foreground'
                    : 'border-border text-muted-foreground'
                }`}>
                  {stepDone(idx) && openStep !== idx ? <Check className="h-3 w-3" /> : step.num}
                </div>
                <span className={`text-[13px] font-bold transition-colors ${
                  openStep === idx || stepDone(idx) ? 'text-foreground' : 'text-muted-foreground'
                }`}>
                  {step.label}
                </span>
                {stepDone(idx) && openStep !== idx && (
                  <span className="ml-auto text-green text-sm">✓</span>
                )}
              </div>

              {/* Step body */}
              {openStep === idx && (
                <div className="px-5 pb-5">
                  {/* Step 0: Color */}
                  {idx === 0 && (
                    <>
                      <div className="flex gap-2 flex-wrap mt-1.5">
                        {COLORS.map((c) => (
                          <button
                            key={c.name}
                            onClick={() => setSelectedColor(c)}
                            className={`w-[26px] h-[26px] rounded-full cursor-pointer border-[2.5px] border-transparent transition-all ${
                              selectedColor.name === c.name ? 'outline outline-[2.5px] outline-primary outline-offset-2' : ''
                            }`}
                            style={{ backgroundColor: c.hex }}
                            title={c.name}
                          />
                        ))}
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-2 font-semibold">
                        Couleur : {selectedColor.name}
                      </div>
                    </>
                  )}

                  {/* Step 1: Logo */}
                  {idx === 1 && (
                    <div
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={handleDrop}
                      onClick={() => fileInputRef.current?.click()}
                      className="border-[1.5px] border-dashed border-border rounded-xl p-5 text-center cursor-pointer transition-all hover:border-primary hover:bg-primary/[0.03] mt-1.5"
                    >
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".png,.jpg,.jpeg,.svg,.ai"
                        onChange={handleFileChange}
                        className="hidden"
                      />
                      <div className="w-[38px] h-[38px] bg-primary/8 rounded-[10px] flex items-center justify-center mx-auto mb-2.5">
                        <Upload className="h-4 w-4 text-primary/60" />
                      </div>
                      {logoFile ? (
                        <>
                          <div className="text-[12px] font-bold text-foreground">{logoFile.name}</div>
                          <div className="text-[11px] text-green font-bold mt-1">✓ Fichier uploadé</div>
                        </>
                      ) : (
                        <>
                          <div className="text-[12px] font-bold text-foreground">Glisse ou clique pour uploader</div>
                          <div className="text-[11px] text-muted-foreground mt-0.5">PNG · JPG · SVG · AI</div>
                        </>
                      )}
                    </div>
                  )}

                  {/* Step 2: Print Zone */}
                  {idx === 2 && (
                    <div className="grid grid-cols-3 gap-2 mt-1.5">
                      {ZONES.map((zone, zi) => (
                        <button
                          key={zone.label}
                          onClick={() => setSelectedZone(zi)}
                          className={`border-[1.5px] rounded-[10px] py-3 px-1.5 text-center cursor-pointer transition-all ${
                            selectedZone === zi
                              ? 'border-primary text-primary bg-primary/5'
                              : 'border-border text-muted-foreground hover:border-primary'
                          }`}
                        >
                          <div className="text-xl mb-1">{zone.icon}</div>
                          <div className={`text-[11px] font-bold ${selectedZone === zi ? 'text-primary' : 'text-muted-foreground'}`}>
                            {zone.label}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Step 3: Sizes & Quantities */}
                  {idx === 3 && (
                    <>
                      <table className="w-full mt-1.5 border-collapse">
                        <thead>
                          <tr>
                            {SIZES.map(s => (
                              <th key={s} className="text-[10px] font-extrabold tracking-[1.5px] text-muted-foreground uppercase p-1.5 text-center border-b border-border">
                                {s}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            {SIZES.map(s => (
                              <td key={s} className="p-1.5 text-center">
                                <input
                                  type="number"
                                  min="0"
                                  value={quantities[s] || ''}
                                  onChange={(e) => updateQty(s, e.target.value)}
                                  placeholder="0"
                                  className="w-[44px] text-center border-[1.5px] border-border rounded-md py-1 px-1 text-[13px] font-bold outline-none focus:border-primary bg-background"
                                />
                              </td>
                            ))}
                          </tr>
                        </tbody>
                      </table>
                      <div className="mt-2 text-[12px] text-muted-foreground text-right">
                        Total : {totalUnits} unités
                        {discount > 0 && (
                          <span className="inline-block ml-1.5 text-[10px] font-extrabold bg-green/12 text-green px-2 py-0.5 rounded-full">
                            −{(discount * 100).toFixed(0)}%
                          </span>
                        )}
                      </div>
                    </>
                  )}

                  {/* Step 4: Summary */}
                  {idx === 4 && (
                    <>
                      <div className="bg-secondary rounded-xl p-4 mt-1.5">
                        <div className="flex justify-between text-[12px] text-muted-foreground mb-1.5">
                          <span>Produit</span><span className="font-semibold text-foreground">{product.title}</span>
                        </div>
                        <div className="flex justify-between text-[12px] text-muted-foreground mb-1.5">
                          <span>Couleur</span><span className="font-semibold text-foreground">{selectedColor.name}</span>
                        </div>
                        <div className="flex justify-between text-[12px] text-muted-foreground mb-1.5">
                          <span>Quantité</span><span className="font-semibold text-foreground">{totalUnits} unités</span>
                        </div>
                        <div className="flex justify-between text-[12px] text-muted-foreground mb-1.5">
                          <span>Prix unit.</span><span className="font-semibold text-foreground">{unitPrice.toFixed(2)} $</span>
                        </div>
                        <div className="flex justify-between text-[12px] text-muted-foreground mb-1.5">
                          <span>Impression</span><span className="font-semibold text-foreground">{printPrice.toFixed(2)} $</span>
                        </div>
                        {discount > 0 && (
                          <div className="flex justify-between text-[12px] text-muted-foreground mb-1.5">
                            <span>Rabais {totalUnits}+</span>
                            <span className="font-semibold text-green">−{(discount * 100).toFixed(0)}%</span>
                          </div>
                        )}
                        <div className="flex justify-between text-[15px] font-extrabold text-primary pt-2.5 mt-1.5 border-t border-border">
                          <span>Total</span><span>{total.toFixed(2)} $</span>
                        </div>
                      </div>

                      <button
                        onClick={handleAddToCart}
                        disabled={isCartLoading || totalUnits === 0}
                        className="w-full py-4 gradient-navy text-primary-foreground border-none rounded-xl text-[15px] font-extrabold mt-3.5 cursor-pointer transition-all shadow-navy hover:opacity-88 hover:-translate-y-px disabled:opacity-50"
                      >
                        Ajouter au panier →
                      </button>
                      <div className="text-[11px] text-muted-foreground text-center mt-2 flex items-center justify-center gap-1">
                        🔒 Paiement sécurisé · Livré en 5 jours
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
