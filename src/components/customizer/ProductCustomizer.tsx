import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { useCustomizerStore } from '@/store/customizerStore';
import { PRODUCTS, PRINT_PRICE } from '@/data/products';
import { useCartStore } from '@/store/cartStore';
import { CustomizerSteps } from './CustomizerSteps';
import { ColorSelector } from './ColorSelector';
import { LogoUploader } from './LogoUploader';
import { PlacementSelector } from './PlacementSelector';
import { SizeQuantityPicker } from './SizeQuantityPicker';
import { ProductViewer3D } from './ProductViewer3D';

function StepContent() {
  const { step, setLogoPlacement } = useCustomizerStore();

  const handleLogoReady = (url: string) => {
    setLogoPlacement({ zoneId: 'poitrine-centre', mode: 'preset', processedUrl: url, previewUrl: url });
  };

  switch (step) {
    case 1: return <ColorSelector />;
    case 2: return <LogoUploader onLogoReady={(url) => handleLogoReady(url)} />;
    case 3: return <PlacementSelector />;
    case 4: return <SizeQuantityPicker />;
    case 5: return <SummaryStep />;
    default: return null;
  }
}

function SummaryStep() {
  const { productId, colorId, logoPlacement, getTotalQuantity, getEstimatedPrice } = useCustomizerStore();
  const product = PRODUCTS.find((p) => p.id === productId);
  const color = product?.colors.find((c) => c.id === colorId);
  const zone = product?.printZones.find((z) => z.id === logoPlacement?.zoneId);

  return (
    <div className="p-5 space-y-3">
      <h3 className="text-sm font-bold text-foreground">Résumé de ta commande</h3>
      <div className="bg-secondary rounded-xl p-4 space-y-2 text-xs">
        <div className="flex justify-between"><span className="text-muted-foreground">Produit</span><span className="font-bold">{product?.name}</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">Couleur</span><span className="font-bold">{color?.name}</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">Zone</span><span className="font-bold">{zone?.label ?? '—'}</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">Quantité</span><span className="font-bold">{getTotalQuantity()}</span></div>
        <div className="flex justify-between text-sm font-bold text-navy pt-2 border-t border-border">
          <span>Total estimé</span><span>{getEstimatedPrice().toFixed(2)} $</span>
        </div>
      </div>
    </div>
  );
}

export function ProductCustomizer() {
  const store = useCustomizerStore();
  const { addItem } = useCartStore();
  const { productId, step, setStep, reset, getTotalQuantity, getEstimatedPrice } = store;
  const product = PRODUCTS.find((p) => p.id === productId);

  if (!productId || !product) return null;

  const isLastStep = step === 5;
  const canProceed = step !== 4 || getTotalQuantity() > 0;

  const handleNext = () => {
    if (isLastStep) {
      addItem({
        productId: store.productId,
        colorId: store.colorId,
        logoPlacement: store.logoPlacement,
        sizeQuantities: store.sizeQuantities,
        activeView: store.activeView,
        step: store.step,
        productName: product.name,
        previewSnapshot: '',
        unitPrice: product.basePrice + PRINT_PRICE,
        totalQuantity: getTotalQuantity(),
        totalPrice: getEstimatedPrice(),
      });
      reset();
    } else {
      setStep((step + 1) as 1|2|3|4|5);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[700] bg-foreground/60 backdrop-blur-sm flex items-end justify-center p-4"
        onClick={reset}
      >
        <motion.div
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-background rounded-t-2xl w-full max-w-[1060px] max-h-[93vh] overflow-hidden grid grid-cols-[1fr_360px]"
        >
          <div className="flex flex-col border-r border-border">
            <div className="px-5 py-3.5 border-b border-border flex items-center justify-between">
              <span className="text-sm font-bold text-foreground">{product.name}</span>
              <button onClick={reset} className="w-8 h-8 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1"><ProductViewer3D /></div>
          </div>

          <div className="flex flex-col overflow-hidden">
            <CustomizerSteps />
            <div className="flex-1 overflow-y-auto"><StepContent /></div>
            <div className="p-5 border-t border-border flex gap-2">
              {step > 1 && (
                <button onClick={() => setStep((step - 1) as 1|2|3|4|5)} className="px-5 py-3 rounded-xl border border-border text-sm font-bold text-muted-foreground hover:text-foreground">
                  Retour
                </button>
              )}
              <button onClick={handleNext} disabled={!canProceed} className="flex-1 py-3 rounded-xl gradient-navy text-white text-sm font-bold disabled:opacity-50 hover:opacity-90">
                {isLastStep ? 'Ajouter au panier' : 'Continuer'}
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
