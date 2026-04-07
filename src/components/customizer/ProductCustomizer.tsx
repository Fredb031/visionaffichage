import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { useCustomizerStore } from '@/store/customizerStore';
import { CustomizerSteps } from './CustomizerSteps';
import { ColorSelector } from './ColorSelector';
import { LogoUploader } from './LogoUploader';
import { PlacementSelector } from './PlacementSelector';
import { SizeQuantityPicker } from './SizeQuantityPicker';
import { ProductViewer3D } from './ProductViewer3D';

function StepContent() {
  const { currentStep, addLogo } = useCustomizerStore();

  const handleLogoReady = (url: string, originalUrl: string) => {
    addLogo({
      zoneId: 'front',
      logoUrl: url,
      originalUrl,
      x: 50,
      y: 50,
      width: 100,
      height: 100,
      rotation: 0,
    });
  };

  switch (currentStep) {
    case 'color':
      return <ColorSelector />;
    case 'logo':
      return <LogoUploader onLogoReady={handleLogoReady} />;
    case 'placement':
      return <PlacementSelector />;
    case 'sizes':
      return <SizeQuantityPicker />;
    case 'summary':
      return <SummaryStep />;
    default:
      return null;
  }
}

function SummaryStep() {
  const { product, selectedColor, logos, getTotalQuantity, getDiscount, getUnitPrice, getTotalPrice } =
    useCustomizerStore();

  return (
    <div className="p-5 space-y-3">
      <h3 className="text-sm font-bold text-foreground">Résumé de ta commande</h3>
      <div className="bg-secondary rounded-xl p-4 space-y-2 text-xs">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Produit</span>
          <span className="font-bold">{product?.title}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Couleur</span>
          <span className="font-bold">{selectedColor}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Logos</span>
          <span className="font-bold">{logos.length} zone(s)</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Quantité</span>
          <span className="font-bold">{getTotalQuantity()}</span>
        </div>
        {getDiscount() > 0 && (
          <div className="flex justify-between text-green-600 font-bold">
            <span>Rabais volume</span>
            <span>-{getDiscount()}%</span>
          </div>
        )}
        <div className="flex justify-between text-sm font-bold text-navy pt-2 border-t border-border">
          <span>Total</span>
          <span>{getTotalPrice().toFixed(2)} $</span>
        </div>
      </div>
    </div>
  );
}

export function ProductCustomizer() {
  const { isOpen, closeCustomizer, product, currentStep, nextStep, prevStep, getTotalQuantity } =
    useCustomizerStore();

  if (!isOpen || !product) return null;

  const isLastStep = currentStep === 'summary';
  const canProceed = currentStep !== 'sizes' || getTotalQuantity() > 0;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[700] bg-foreground/60 backdrop-blur-sm flex items-end justify-center p-4"
        onClick={closeCustomizer}
      >
        <motion.div
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-background rounded-t-2xl w-full max-w-[1060px] max-h-[93vh] overflow-hidden grid grid-cols-[1fr_360px]"
        >
          {/* Left — 3D viewer */}
          <div className="flex flex-col border-r border-border">
            <div className="px-5 py-3.5 border-b border-border flex items-center justify-between">
              <span className="text-sm font-bold text-foreground">{product.title}</span>
              <button onClick={closeCustomizer} className="w-8 h-8 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1">
              <ProductViewer3D />
            </div>
          </div>

          {/* Right — Steps panel */}
          <div className="flex flex-col overflow-hidden">
            <CustomizerSteps />
            <div className="flex-1 overflow-y-auto">
              <StepContent />
            </div>
            <div className="p-5 border-t border-border flex gap-2">
              {currentStep !== 'color' && (
                <button onClick={prevStep} className="px-5 py-3 rounded-xl border border-border text-sm font-bold text-muted-foreground hover:text-foreground transition-colors">
                  Retour
                </button>
              )}
              <button
                onClick={isLastStep ? closeCustomizer : nextStep}
                disabled={!canProceed}
                className="flex-1 py-3 rounded-xl gradient-navy text-white text-sm font-bold disabled:opacity-50 transition-opacity hover:opacity-90"
              >
                {isLastStep ? 'Ajouter au panier' : 'Continuer'}
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
