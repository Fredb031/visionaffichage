import { useState, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ShoppingBag, Trash2, Tag, ChevronRight } from 'lucide-react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, useTexture } from '@react-three/drei';
import * as THREE from 'three';
import { useCartStore } from '@/store/cartStore';
import { useLang } from '@/lib/langContext';
import type { CartItemCustomization } from '@/types/customization';

// ── Mini 3D preview in cart item ─────────────────────────────────────────────
function MiniProductMesh({ snapshotUrl, logoUrl }: { snapshotUrl: string; logoUrl?: string }) {
  const texture = useTexture(snapshotUrl);
  texture.colorSpace = THREE.SRGBColorSpace;
  const logoTex = logoUrl ? useTexture(logoUrl) : null;
  if (logoTex) { logoTex.colorSpace = THREE.SRGBColorSpace; logoTex.premultiplyAlpha = false; }

  return (
    <group>
      <mesh>
        <planeGeometry args={[1.6, 2.0, 16, 20]} />
        <meshStandardMaterial map={texture} side={THREE.DoubleSide} roughness={0.8} />
      </mesh>
      {logoTex && (
        <mesh position={[0, 0.15, 0.01]}>
          <planeGeometry args={[0.55, 0.35]} />
          <meshBasicMaterial map={logoTex} transparent alphaTest={0.01} depthWrite={false} />
        </mesh>
      )}
    </group>
  );
}

function CartItem3D({ item }: { item: CartItemCustomization }) {
  const logoUrl = item.logoPlacement?.previewUrl ?? item.logoPlacement?.processedUrl;

  return (
    <div className="w-16 h-20 rounded-lg overflow-hidden bg-secondary flex-shrink-0 border border-border touch-none">
      <Canvas camera={{ position: [0, 0, 2.2], fov: 40 }} style={{ background: 'transparent' }} gl={{ antialias: true, alpha: true }}>
        <ambientLight intensity={1.4} />
        <directionalLight position={[2, 3, 3]} intensity={0.8} />
        <Suspense fallback={null}>
          <MiniProductMesh snapshotUrl={item.previewSnapshot} logoUrl={logoUrl} />
        </Suspense>
        <OrbitControls enablePan={false} enableZoom={false} rotateSpeed={0.5} minPolarAngle={Math.PI / 3} maxPolarAngle={Math.PI / 1.7} />
      </Canvas>
    </div>
  );
}

// ── Cart drawer ──────────────────────────────────────────────────────────────
interface CartDrawerProps { isOpen: boolean; onClose: () => void; }

const VALID_CODES: Record<string, number> = { VISION10: 0.10, VISION15: 0.15, VISION20: 0.20 };

export function CartDrawer({ isOpen, onClose }: CartDrawerProps) {
  const { t } = useLang();
  const cart = useCartStore();
  const [discountInput, setDiscountInput] = useState('VISION10');
  const [discountMsg, setDiscountMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const handleApply = () => {
    const ok = cart.applyDiscount(discountInput);
    setDiscountMsg(ok ? { ok: true, text: `Code ${discountInput.toUpperCase()} appliqué !` } : { ok: false, text: 'Code invalide' });
    setTimeout(() => setDiscountMsg(null), 3000);
  };

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <motion.div key="overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-foreground/25 z-[490] backdrop-blur-[2px]" onClick={onClose} />
        )}
      </AnimatePresence>

      <motion.div
        initial={{ x: '100%' }} animate={{ x: isOpen ? '0%' : '100%' }}
        transition={{ type: 'spring', stiffness: 300, damping: 32 }}
        className="fixed top-0 right-0 h-full w-full max-w-sm bg-card z-[500] shadow-2xl flex flex-col border-l border-border"
      >
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShoppingBag size={17} className="text-primary" />
            <h2 className="text-base font-extrabold text-foreground">{t('monPanier')}</h2>
            {cart.getItemCount() > 0 && (
              <span className="bg-primary text-primary-foreground text-[10px] font-extrabold w-5 h-5 rounded-full flex items-center justify-center">
                {cart.getItemCount()}
              </span>
            )}
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:bg-secondary">
            <X size={14} />
          </button>
        </div>

        <div className="flex-1 overflow-auto p-4 space-y-3">
          <AnimatePresence>
            {cart.items.length === 0 ? (
              <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="flex flex-col items-center justify-center h-52 gap-3"
              >
                <ShoppingBag size={38} className="text-border" />
                <p className="text-sm text-muted-foreground font-medium">{t('panierVide')}</p>
                <button onClick={onClose} className="text-xs font-bold text-primary underline">{t('explorerProduits')}</button>
              </motion.div>
            ) : (
              cart.items.map((item) => (
                <motion.div key={item.cartId} layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: 40 }}
                  className="flex gap-3 p-3 border border-border rounded-xl bg-secondary/50"
                >
                  {/* 3D rotating mini preview */}
                  <CartItem3D item={item} />

                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-extrabold text-foreground truncate">{item.productName}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {item.sizeQuantities.filter(s => s.quantity > 0).map(s => `${s.size}×${s.quantity}`).join(' · ')}
                    </p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <p className="text-xs font-extrabold text-primary">{item.totalPrice.toFixed(2)} $</p>
                      <span className="text-[10px] text-muted-foreground">
                        ({item.totalQuantity} {item.totalQuantity !== 1 ? t('unitPluralLabel') : t('unitLabel')})
                      </span>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1 italic">
                      ⟳ Glisse pour tourner
                    </p>
                  </div>

                  <button onClick={() => cart.removeItem(item.cartId)} className="text-muted-foreground hover:text-destructive transition-colors flex-shrink-0 self-start mt-0.5">
                    <Trash2 size={14} />
                  </button>
                </motion.div>
              ))
            )}
          </AnimatePresence>
        </div>

        {cart.items.length > 0 && (
          <div className="p-4 border-t border-border space-y-3 bg-card">
            {!cart.discountApplied ? (
              <div className="flex gap-2">
                <input
                  value={discountInput}
                  onChange={(e) => setDiscountInput(e.target.value.toUpperCase())}
                  placeholder={t('codeRabais')}
                  className="flex-1 border border-border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-primary font-mono bg-secondary"
                />
                <button onClick={handleApply} className="bg-secondary border border-border rounded-xl px-4 py-2.5 text-xs font-extrabold text-foreground hover:border-primary transition-colors">
                  {t('appliquer')}
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 rounded-xl">
                <Tag size={11} className="text-green-700" />
                <span className="text-xs font-bold text-green-700">Code {cart.discountCode} appliqué</span>
                <button onClick={() => cart.applyDiscount('')} className="ml-auto text-green-500"><X size={11} /></button>
              </div>
            )}
            {discountMsg && <p className={`text-xs font-bold px-1 ${discountMsg.ok ? 'text-green-700' : 'text-destructive'}`}>{discountMsg.text}</p>}
            <div className="flex justify-between items-center py-0.5">
              <span className="text-sm text-muted-foreground">{t('totalEstimeLabel')}</span>
              <span className="text-lg font-extrabold text-foreground">{cart.getTotal().toFixed(2)} $</span>
            </div>
            <button
              className="w-full gradient-navy-dark text-primary-foreground font-extrabold text-sm py-3.5 rounded-full flex items-center justify-center gap-2 transition-all hover:opacity-90"
              style={{ boxShadow: '0 6px 20px hsla(var(--navy), 0.3)' }}
              onClick={() => alert('→ Shopify Checkout — configure VITE_SHOPIFY_STOREFRONT_TOKEN')}
            >
              {t('passerCaisse')} <ChevronRight size={15} />
            </button>
            <p className="text-center text-[11px] text-muted-foreground">{t('livraisonNote')}</p>
          </div>
        )}
      </motion.div>
    </>
  );
}

// Re-export as default CartDrawer with isOpen/onClose interface
export { CartDrawer as default };
