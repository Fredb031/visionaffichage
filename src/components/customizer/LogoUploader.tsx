import { useState, useCallback, useRef, useEffect } from 'react';
import { Upload, X, Loader2, CheckCircle2, Scissors, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { removeBackground } from '@/lib/removeBg';
import { uploadLogo } from '@/lib/supabase';
import { trimTransparentPadding } from '@/lib/trimLogo';
import { useLang } from '@/lib/langContext';

type UploadStatus = 'idle' | 'removing-bg' | 'saving' | 'done' | 'error';

type QualityCheck = {
  ok: boolean;
  naturalWidth: number;
  naturalHeight: number;
  /** Message to display, null when quality is fine. */
  warning: string | null;
};

/** Inspect the uploaded image and warn the user if the resolution is too
 * low for print. Industry rule of thumb: ≥ 300 DPI at 10 cm wide =
 * ~1200px. Anything under ~600px on the longest edge is likely blurry
 * once printed. SVGs skip the check (they're resolution-independent). */
async function checkImageQuality(file: File, lang: 'fr' | 'en'): Promise<QualityCheck> {
  if (file.type === 'image/svg+xml') {
    return { ok: true, naturalWidth: 0, naturalHeight: 0, warning: null };
  }
  return new Promise(resolve => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      const longest = Math.max(w, h);
      let warning: string | null = null;
      if (longest < 600) {
        warning = lang === 'en'
          ? `Low-res image (${w}×${h}px). Your print may look blurry — aim for at least 1200×1200px.`
          : `Image basse résolution (${w}×${h}px). L\u2019impression risque d\u2019être floue — vise au moins 1200×1200px.`;
      } else if (longest < 1200) {
        warning = lang === 'en'
          ? `Moderate resolution (${w}×${h}px). Good for small prints, may soften on a full-back design.`
          : `Résolution moyenne (${w}×${h}px). Correcte pour petit format, peut adoucir sur un dos complet.`;
      }
      resolve({ ok: longest >= 600, naturalWidth: w, naturalHeight: h, warning });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve({ ok: true, naturalWidth: 0, naturalHeight: 0, warning: null });
    };
    img.src = url;
  });
}

export function LogoUploader({
  onLogoReady,
}: {
  onLogoReady: (previewUrl: string, processedUrl: string, originalFile: File) => void;
}) {
  const { t, lang } = useLang();
  const [status, setStatus] = useState<UploadStatus>('idle');
  const [preview, setPreview] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [currentFile, setCurrentFile] = useState<File | null>(null);
  const [bgRemoved, setBgRemoved] = useState(false);
  const [quality, setQuality] = useState<QualityCheck | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // Track every blob URL we createObjectURL so we can revoke them on
  // replace / unmount. Without this, memory grows on every upload.
  const blobUrlsRef = useRef<string[]>([]);
  const trackBlobUrl = (url: string) => {
    blobUrlsRef.current.push(url);
    return url;
  };
  useEffect(() => {
    return () => {
      blobUrlsRef.current.forEach(u => {
        try { URL.revokeObjectURL(u); } catch { /* already revoked */ }
      });
      blobUrlsRef.current = [];
    };
  }, []);

  const processFile = useCallback(async (file: File, autoRemoveBg = true) => {
    if (!file.type.startsWith('image/')) {
      setErrorMsg(lang === 'en' ? 'Invalid format. PNG, JPG, or SVG required.' : 'Format invalide. PNG, JPG ou SVG requis.');
      setStatus('error');
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      setErrorMsg(lang === 'en' ? 'File too large (max 20MB).' : 'Fichier trop volumineux (max 20 Mo).');
      setStatus('error');
      return;
    }

    setErrorMsg(null);
    setCurrentFile(file);
    setBgRemoved(false);
    // Inspect resolution so we can warn the customer BEFORE they commit
    // to an order that'll print blurry. Runs in parallel with the BG
    // removal so there's no extra wait.
    void checkImageQuality(file, lang === 'en' ? 'en' : 'fr').then(setQuality);
    const localUrl = trackBlobUrl(URL.createObjectURL(file));
    setPreview(localUrl);

    if (autoRemoveBg) {
      setStatus('removing-bg');
      try {
        const noBgBlob = await removeBackground(file);
        // Trim transparent padding so fabric centres the VISIBLE logo,
        // not the raster box. Fixes the "logo lands off-centre even
        // though the customizer says it's centred" complaint.
        const trimmedBlob = await trimTransparentPadding(noBgBlob);
        const noBgUrl = trackBlobUrl(URL.createObjectURL(trimmedBlob));
        setPreview(noBgUrl);
        setBgRemoved(true);
        setStatus('saving');
        try {
          const uploadedUrl = await uploadLogo(trimmedBlob, file.name);
          setStatus('done');
          onLogoReady(noBgUrl, uploadedUrl ?? noBgUrl, file);
        } catch (uploadErr) {
          // Supabase upload failed but BG-removal worked — surface a soft
          // warning and keep using the local blob so the user can still
          // preview + order. The edge function will get a re-upload on
          // checkout.
          console.warn('[LogoUploader] Supabase upload failed:', uploadErr);
          setStatus('done');
          onLogoReady(noBgUrl, noBgUrl, file);
          setErrorMsg(lang === 'en'
            ? 'Logo saved locally — we\u2019ll finish uploading when you place the order.'
            : 'Logo sauvegardé localement — on finalise l\u2019upload à la commande.');
        }
      } catch (bgErr) {
        // BG-removal failed. Common causes: SVG without rasterization,
        // network blip, model timeout. Keep the original image (trimmed
        // if it has transparent padding) so user can still proceed, and
        // tell them WHY.
        console.warn('[LogoUploader] BG removal failed:', bgErr);
        let fallbackBlob: Blob = file;
        try { fallbackBlob = await trimTransparentPadding(file); } catch { /* ignore */ }
        const fallbackUrl = trackBlobUrl(URL.createObjectURL(fallbackBlob));
        setStatus('done');
        setPreview(fallbackUrl);
        onLogoReady(fallbackUrl, fallbackUrl, file);
        setErrorMsg(lang === 'en'
          ? 'Couldn\u2019t auto-remove the background. Your logo will print with its original background — tap "Remove background" below to try again.'
          : 'Impossible de supprimer le fond automatiquement. Le logo sera imprimé avec son fond — clique « Supprimer le fond » ci-dessous pour réessayer.');
      }
    } else {
      setStatus('done');
      onLogoReady(localUrl, localUrl, file);
    }
  }, [onLogoReady, lang]);

  // Manual remove bg button — for when user uploads first then removes bg
  const handleManualRemoveBg = useCallback(async () => {
    if (!currentFile) return;
    setStatus('removing-bg');
    try {
      const noBgBlob = await removeBackground(currentFile);
      const trimmedBlob = await trimTransparentPadding(noBgBlob);
      const noBgUrl = trackBlobUrl(URL.createObjectURL(trimmedBlob));
      setPreview(noBgUrl);
      setBgRemoved(true);
      setStatus('saving');
      const uploadedUrl = await uploadLogo(trimmedBlob, currentFile.name);
      setStatus('done');
      onLogoReady(noBgUrl, uploadedUrl ?? noBgUrl, currentFile);
    } catch {
      setStatus('done');
    }
  }, [currentFile, onLogoReady]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }, [processFile]);

  const statusLabel: Record<UploadStatus, string> = {
    idle: '',
    'removing-bg': lang === 'en' ? 'Removing background...' : 'Suppression du fond...',
    saving: lang === 'en' ? 'Saving...' : 'Sauvegarde...',
    done: '',
    error: errorMsg ?? (lang === 'en' ? 'Error' : 'Erreur'),
  };

  return (
    <div className="space-y-3">
      <AnimatePresence mode="wait">
        {(status === 'idle' || status === 'error') && (
          <motion.div
            key="drop"
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            onClick={() => inputRef.current?.click()}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                inputRef.current?.click();
              }
            }}
            onDrop={handleDrop}
            onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
            onDragLeave={() => setIsDragOver(false)}
            role="button"
            tabIndex={0}
            aria-label={t('glisserLogo')}
            className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${
              isDragOver ? 'border-primary bg-primary/5 scale-[1.01]' : 'border-border hover:border-primary/40 hover:bg-secondary'
            }`}
          >
            <Upload className="mx-auto mb-3 text-muted-foreground" size={28} aria-hidden="true" />
            <p className="text-sm font-semibold text-foreground">{t('glisserLogo')}</p>
            <p className="text-xs text-muted-foreground mt-1">PNG · JPG · SVG — max 20MB</p>
            <div className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-green-700">
              <CheckCircle2 size={12} aria-hidden="true" /> {t('fondSupprimeAuto')}
            </div>
          </motion.div>
        )}

        {status === 'done' && preview && (
          <motion.div key="preview" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
            {/* Preview with checkered bg */}
            <div className="relative rounded-xl overflow-hidden border border-border" style={{ height: 140 }}>
              <div className="absolute inset-0" style={{ backgroundImage: 'repeating-conic-gradient(#e5e5e5 0% 25%, white 0% 50%)', backgroundSize: '14px 14px' }} />
              <img src={preview} alt="Logo" className="relative w-full h-full object-contain p-4 z-10" />
              <button
                type="button"
                onClick={() => { setStatus('idle'); setPreview(null); setBgRemoved(false); }}
                aria-label={lang === 'en' ? 'Remove uploaded logo' : 'Retirer le logo téléversé'}
                className="absolute top-2 right-2 z-20 w-7 h-7 rounded-full bg-background shadow flex items-center justify-center text-muted-foreground hover:bg-destructive/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-destructive focus-visible:ring-offset-1"
              >
                <X size={14} aria-hidden="true" />
              </button>
              {bgRemoved && (
                <div className="absolute bottom-2 left-2 z-20 bg-green-700/90 text-white text-[10px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1">
                  <CheckCircle2 size={10} aria-hidden="true" /> {t('fondSupprime')}
                </div>
              )}
            </div>

            {/* Remove BG button if not yet removed */}
            {!bgRemoved && (
              <button
                type="button"
                onClick={handleManualRemoveBg}
                className="mt-2 w-full flex items-center justify-center gap-2 border border-border rounded-xl py-2.5 text-xs font-bold text-foreground hover:border-primary hover:bg-primary/5 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
              >
                <Scissors size={13} aria-hidden="true" /> {t('supprimerFond')}
              </button>
            )}

            {/* DPI / resolution warning — industry-standard trust signal.
                Users appreciate knowing BEFORE ordering that their logo
                might print blurry. */}
            {quality?.warning && (
              <div role="status" className="mt-2 flex items-start gap-2 rounded-xl border border-amber-500/40 bg-amber-500/5 text-amber-800 text-[11px] font-semibold p-2.5">
                <AlertTriangle size={13} className="flex-shrink-0 mt-0.5" aria-hidden="true" />
                <span>{quality.warning}</span>
              </div>
            )}

            {/* Soft-error notice (BG removal or upload failed but we still
                have a usable logo). Shown on the "done" state so the user
                knows why their logo still has a background. */}
            {errorMsg && status === 'done' && (
              <div role="alert" className="mt-2 flex items-start gap-2 rounded-xl border border-amber-500/40 bg-amber-500/5 text-amber-800 text-[11px] font-semibold p-2.5">
                <AlertTriangle size={13} className="flex-shrink-0 mt-0.5" aria-hidden="true" />
                <span>{errorMsg}</span>
              </div>
            )}
          </motion.div>
        )}

        {(status === 'removing-bg' || status === 'saving') && (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            role="status"
            aria-live="polite"
            className="rounded-xl border border-border bg-secondary flex flex-col items-center justify-center gap-3"
            style={{ height: 140 }}
          >
            <Loader2 className="text-primary animate-spin" size={28} aria-hidden="true" />
            <p className="text-sm font-medium text-muted-foreground">{statusLabel[status]}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {errorMsg && status === 'error' && <p role="alert" className="text-xs text-destructive font-medium px-1">{errorMsg}</p>}

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/svg+xml,image/webp"
        aria-label={t('glisserLogo')}
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) processFile(f); }}
      />
    </div>
  );
}
