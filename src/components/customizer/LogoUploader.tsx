import { useState, useCallback, useRef, useEffect, type CSSProperties } from 'react';
import { Upload, X, Loader2, CheckCircle2, Scissors, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { removeBackground } from '@/lib/removeBg';
import { uploadLogo } from '@/lib/supabase';
import { trimTransparentPadding } from '@/lib/trimLogo';
import { useLang } from '@/lib/langContext';

type UploadStatus = 'idle' | 'removing-bg' | 'saving' | 'done' | 'error';

/** Industry-standard 20×20px checker pattern (Photoshop / Figma / Sketch
 * all use this) — shown behind a logo preview so transparent pixels read
 * as transparent instead of being masked by a solid tile. Kept as an
 * exported const so other preview surfaces (Step 4 review thumbnail,
 * admin logo QC, etc.) can reuse the same pattern without drifting. */
export const CHECKER_BG_STYLE: CSSProperties = {
  backgroundImage: [
    'linear-gradient(45deg, #e5e5e5 25%, transparent 25%)',
    'linear-gradient(-45deg, #e5e5e5 25%, transparent 25%)',
    'linear-gradient(45deg, transparent 75%, #e5e5e5 75%)',
    'linear-gradient(-45deg, transparent 75%, #e5e5e5 75%)',
  ].join(','),
  backgroundSize: '20px 20px',
  backgroundPosition: '0 0, 0 10px, 10px -10px, 10px 0',
  backgroundColor: '#f5f5f5',
};

/** Human-readable byte size. fr-CA uses 'o' / 'ko' / 'Mo' (octet),
 * en uses 'B' / 'KB' / 'MB'. Kept local + tiny so we don't pull a
 * dependency for a 3-branch conditional. */
const formatFileSize = (bytes: number, lang: 'fr' | 'en'): string => {
  const fr = lang !== 'en';
  const b = fr ? 'o' : 'B';
  const k = fr ? 'ko' : 'KB';
  const m = fr ? 'Mo' : 'MB';
  if (bytes < 1024) return `${bytes} ${b}`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} ${k}`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} ${m}`;
};

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
  // Track every blob URL we createObjectURL so we can revoke superseded
  // ones on replace / unmount. Without this, memory grows on every upload.
  //
  // CRITICAL: URLs we hand off to the parent via onLogoReady live beyond
  // this component's lifecycle — they end up inside the fabric canvas,
  // the Step 4 review thumbnail, and the customizer store. Revoking them
  // on unmount (which fires as soon as the user advances from Step 1
  // because AnimatePresence tears the step-1 tree down) kills those
  // downstream renders — canvas rebuilds on window resize would load
  // a dead blob and render nothing, and the review thumbnail shows a
  // broken image. Keep handed-off URLs alive; revoke only the
  // intermediate ones superseded during BG removal or manual retry.
  const blobUrlsRef = useRef<string[]>([]);
  const handedOffUrlsRef = useRef<Set<string>>(new Set());
  const trackBlobUrl = (url: string) => {
    blobUrlsRef.current.push(url);
    return url;
  };
  const markHandedOff = (url: string | null | undefined) => {
    if (url && url.startsWith('blob:')) handedOffUrlsRef.current.add(url);
  };
  // Track mount state so the long-running processFile / handleManualRemoveBg
  // chains don't setState on an unmounted component when the customizer
  // modal closes mid-upload (React dev warning + wasted renders).
  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      const keep = handedOffUrlsRef.current;
      blobUrlsRef.current.forEach(u => {
        if (keep.has(u)) return;
        try { URL.revokeObjectURL(u); } catch { /* already revoked */ }
      });
      blobUrlsRef.current = [];
    };
  }, []);
  // Helpers that respect unmount — used inside await chains so a closed
  // modal doesn't flash state on a dead component.
  const safeSetStatus = (s: UploadStatus) => { if (isMountedRef.current) setStatus(s); };
  const safeSetPreview = (u: string | null) => { if (isMountedRef.current) setPreview(u); };
  const safeSetBgRemoved = (v: boolean) => { if (isMountedRef.current) setBgRemoved(v); };
  const safeSetErrorMsg = (m: string | null) => { if (isMountedRef.current) setErrorMsg(m); };

  const processFile = useCallback(async (file: File, autoRemoveBg = true) => {
    if (!file.type.startsWith('image/')) {
      setErrorMsg(lang === 'en' ? 'Invalid format. PNG, JPG, SVG, or WebP required.' : 'Format invalide. PNG, JPG, SVG ou WebP requis.');
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
    // Gate setQuality on mount — the image-load promise can resolve
    // after the customizer modal closes, and the raw setter would
    // otherwise fire on a dead component.
    void checkImageQuality(file, lang === 'en' ? 'en' : 'fr').then(q => {
      if (isMountedRef.current) setQuality(q);
    });
    const localUrl = trackBlobUrl(URL.createObjectURL(file));
    setPreview(localUrl);

    if (autoRemoveBg) {
      safeSetStatus('removing-bg');
      try {
        const noBgBlob = await removeBackground(file);
        // Trim transparent padding so fabric centres the VISIBLE logo,
        // not the raster box. Fixes the "logo lands off-centre even
        // though the customizer says it's centred" complaint.
        const trimmedBlob = await trimTransparentPadding(noBgBlob);
        if (!isMountedRef.current) return;
        const noBgUrl = trackBlobUrl(URL.createObjectURL(trimmedBlob));
        safeSetPreview(noBgUrl);
        safeSetBgRemoved(true);
        safeSetStatus('saving');
        try {
          const uploadedUrl = await uploadLogo(trimmedBlob, file.name);
          if (!isMountedRef.current) return;
          safeSetStatus('done');
          markHandedOff(noBgUrl);
          markHandedOff(uploadedUrl ?? noBgUrl);
          onLogoReady(noBgUrl, uploadedUrl ?? noBgUrl, file);
        } catch (uploadErr) {
          // Supabase upload failed but BG-removal worked — surface a soft
          // warning and keep using the local blob so the user can still
          // preview + order. The edge function will get a re-upload on
          // checkout.
          console.warn('[LogoUploader] Supabase upload failed:', uploadErr);
          if (!isMountedRef.current) return;
          safeSetStatus('done');
          markHandedOff(noBgUrl);
          onLogoReady(noBgUrl, noBgUrl, file);
          safeSetErrorMsg(lang === 'en'
            ? 'Logo saved locally — we\u2019ll finish uploading when you place the order.'
            : 'Logo sauvegardé localement — on finalise l\u2019upload à la commande.');
        }
      } catch (bgErr) {
        // BG-removal failed. Common causes: SVG without rasterization,
        // network blip, model timeout. Keep the original image (trimmed
        // if it has transparent padding) so user can still proceed, and
        // tell them WHY.
        console.warn('[LogoUploader] BG removal failed:', bgErr);
        if (!isMountedRef.current) return;
        let fallbackBlob: Blob = file;
        try { fallbackBlob = await trimTransparentPadding(file); } catch { /* ignore */ }
        if (!isMountedRef.current) return;
        const fallbackUrl = trackBlobUrl(URL.createObjectURL(fallbackBlob));
        safeSetStatus('done');
        safeSetPreview(fallbackUrl);
        markHandedOff(fallbackUrl);
        onLogoReady(fallbackUrl, fallbackUrl, file);
        safeSetErrorMsg(lang === 'en'
          ? 'Couldn\u2019t auto-remove the background. Your logo will print with its original background — tap "Remove background" below to try again.'
          : 'Impossible de supprimer le fond automatiquement. Le logo sera imprimé avec son fond — clique « Supprimer le fond » ci-dessous pour réessayer.');
      }
    } else {
      safeSetStatus('done');
      markHandedOff(localUrl);
      onLogoReady(localUrl, localUrl, file);
    }
  }, [onLogoReady, lang]);

  // Manual remove bg button — for when user uploads first then removes bg.
  // Every success/failure path MUST either call onLogoReady with a URL
  // that matches the visible preview, OR leave both untouched. Otherwise
  // the store's previewUrl (what gets PRINTED) drifts from what the user
  // sees in the uploader — we had a report where the BG-removed preview
  // showed correctly but the printed logo still had its original fill.
  const handleManualRemoveBg = useCallback(async () => {
    if (!currentFile) return;
    safeSetStatus('removing-bg');
    let noBgUrl: string | null = null;
    let trimmedBlob: Blob | null = null;
    try {
      const noBgBlob = await removeBackground(currentFile);
      trimmedBlob = await trimTransparentPadding(noBgBlob);
      if (!isMountedRef.current) return;
      noBgUrl = trackBlobUrl(URL.createObjectURL(trimmedBlob));
      safeSetPreview(noBgUrl);
      safeSetBgRemoved(true);
    } catch (bgErr) {
      console.warn('[LogoUploader] Manual BG removal failed:', bgErr);
      if (!isMountedRef.current) return;
      safeSetStatus('done');
      safeSetErrorMsg(lang === 'en'
        ? 'Couldn\u2019t remove the background this time. Try a higher-contrast image or keep the original.'
        : 'Impossible de supprimer le fond cette fois. Essaie une image plus contrastée ou garde l\u2019originale.');
      return;
    }

    safeSetStatus('saving');
    try {
      const uploadedUrl = await uploadLogo(trimmedBlob, currentFile.name);
      if (!isMountedRef.current) return;
      safeSetStatus('done');
      markHandedOff(noBgUrl);
      markHandedOff(uploadedUrl ?? noBgUrl);
      onLogoReady(noBgUrl, uploadedUrl ?? noBgUrl, currentFile);
    } catch (uploadErr) {
      // Upload failed but BG-removal worked — commit the BG-removed URL
      // to the store anyway so the printed logo matches the preview.
      console.warn('[LogoUploader] Supabase upload (manual BG) failed:', uploadErr);
      if (!isMountedRef.current) return;
      safeSetStatus('done');
      markHandedOff(noBgUrl);
      onLogoReady(noBgUrl, noBgUrl, currentFile);
      safeSetErrorMsg(lang === 'en'
        ? 'Logo saved locally — we\u2019ll finish uploading when you place the order.'
        : 'Logo sauvegardé localement — on finalise l\u2019upload à la commande.');
    }
  }, [currentFile, onLogoReady, lang]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dragCounterRef.current = 0;
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }, [processFile]);

  // Drag counter — dragenter/dragleave fire on every child element the
  // cursor crosses (Upload icon, the two text lines), so naive
  // setIsDragOver(false) on dragleave used to flash the highlight off
  // and on as the user dragged across the inner content. Increment on
  // enter, decrement on leave, only flip the visual state at zero.
  const dragCounterRef = useRef(0);
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dragCounterRef.current += 1;
    if (dragCounterRef.current === 1) setIsDragOver(true);
  }, []);
  const handleDragLeave = useCallback(() => {
    dragCounterRef.current = Math.max(0, dragCounterRef.current - 1);
    if (dragCounterRef.current === 0) setIsDragOver(false);
  }, []);

  const statusLabel: Record<UploadStatus, string> = {
    idle: '',
    'removing-bg': lang === 'en' ? 'Processing...' : 'Traitement...',
    saving: lang === 'en' ? 'Processing...' : 'Traitement...',
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
            onDragOver={(e) => { e.preventDefault(); }}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            role="button"
            tabIndex={0}
            aria-label={t('glisserLogo')}
            className={`border-2 rounded-xl p-6 text-center cursor-pointer transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${
              isDragOver
                ? 'border-solid border-brand-blue bg-brand-blue/5 scale-[1.01]'
                : 'border-dashed border-border hover:border-primary/40 hover:bg-secondary'
            }`}
          >
            <Upload
              className={`mx-auto mb-3 transition-all duration-200 ${
                isDragOver
                  ? 'text-brand-blue scale-110 motion-safe:animate-pulse motion-reduce:animate-none motion-reduce:scale-100'
                  : 'text-muted-foreground'
              }`}
              size={28}
              aria-hidden="true"
            />
            <p className={`text-sm font-semibold transition-colors duration-200 ${isDragOver ? 'text-brand-blue' : 'text-foreground'}`}>
              {isDragOver
                ? (lang === 'en' ? 'Drop to upload' : 'Relâche pour téléverser')
                : t('glisserLogo')}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {lang === 'en'
                ? 'PNG · JPG · SVG · WebP — max 20 MB'
                : 'PNG · JPG · SVG · WebP — max 20 Mo'}
            </p>
            <div className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-green-700">
              <CheckCircle2 size={12} aria-hidden="true" /> {t('fondSupprimeAuto')}
            </div>
          </motion.div>
        )}

        {status === 'done' && preview && (
          <motion.div key="preview" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
            {/* Preview with checker bg — industry-standard 20×20px pattern
                (Photoshop / Figma / Sketch all use this) so transparent
                pixels in the logo read as transparent. Without it a white
                tile hides whether BG-removal actually worked, and users
                couldn't tell if their PNG had a transparent background
                before ordering. */}
            <div className="relative rounded-xl overflow-hidden border border-border" style={{ height: 140 }}>
              <div className="absolute inset-0" style={CHECKER_BG_STYLE} />
              <img src={preview} alt="Logo" className="relative w-full h-full object-contain p-4 z-10" onError={e => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden'; }} />
              <button
                type="button"
                onClick={() => {
                  setStatus('idle');
                  setPreview(null);
                  setBgRemoved(false);
                  setCurrentFile(null);
                  setErrorMsg(null);
                  setQuality(null);
                  // Clear the file input's value so re-uploading the
                  // SAME file triggers onChange again. Without this,
                  // a user who clicks X then picks the same file from
                  // their picker sees nothing happen — the input's
                  // value is unchanged so React never fires onChange.
                  if (inputRef.current) inputRef.current.value = '';
                }}
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

            {/* Filename + size under the preview. Truncated with CSS so a
                long filename doesn't push the size off the row. Title
                attribute exposes the full name on hover. */}
            {currentFile && (
              <p
                className="mt-2 text-[11px] text-muted-foreground px-1 truncate"
                title={currentFile.name}
              >
                <span className="font-medium text-foreground">{currentFile.name}</span>
                <span className="mx-1">—</span>
                <span>{formatFileSize(currentFile.size, lang === 'en' ? 'en' : 'fr')}</span>
              </p>
            )}

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
