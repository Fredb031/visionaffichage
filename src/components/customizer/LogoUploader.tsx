import { useState, useCallback, useRef } from 'react';
import { Upload, X, Loader2, CheckCircle2, Scissors } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { removeBackground } from '@/lib/removeBg';
import { uploadLogo } from '@/lib/supabase';
import { useLang } from '@/lib/langContext';

type UploadStatus = 'idle' | 'removing-bg' | 'saving' | 'done' | 'error';

export function LogoUploader({
  onLogoReady,
}: {
  onLogoReady: (previewUrl: string, processedUrl: string, originalFile: File) => void;
}) {
  const { t } = useLang();
  const [status, setStatus] = useState<UploadStatus>('idle');
  const [preview, setPreview] = useState<string | null>(null);
  const [originalPreview, setOriginalPreview] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [currentFile, setCurrentFile] = useState<File | null>(null);
  const [bgRemoved, setBgRemoved] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const processFile = useCallback(async (file: File, autoRemoveBg = true) => {
    if (!file.type.startsWith('image/')) {
      setErrorMsg('Format invalide. PNG, JPG ou SVG requis.');
      setStatus('error');
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      setErrorMsg('Fichier trop volumineux (max 20MB).');
      setStatus('error');
      return;
    }

    setErrorMsg(null);
    setCurrentFile(file);
    setBgRemoved(false);
    const localUrl = URL.createObjectURL(file);
    setPreview(localUrl);
    setOriginalPreview(localUrl);

    if (autoRemoveBg) {
      setStatus('removing-bg');
      try {
        const noBgBlob = await removeBackground(file);
        const noBgUrl = URL.createObjectURL(noBgBlob);
        setPreview(noBgUrl);
        setBgRemoved(true);
        setStatus('saving');
        const uploadedUrl = await uploadLogo(noBgBlob, file.name);
        setStatus('done');
        onLogoReady(noBgUrl, uploadedUrl ?? noBgUrl, file);
      } catch {
        setStatus('done');
        setPreview(localUrl);
        onLogoReady(localUrl, localUrl, file);
      }
    } else {
      setStatus('done');
      onLogoReady(localUrl, localUrl, file);
    }
  }, [onLogoReady]);

  // Manual remove bg button — for when user uploads first then removes bg
  const handleManualRemoveBg = useCallback(async () => {
    if (!currentFile) return;
    setStatus('removing-bg');
    try {
      const noBgBlob = await removeBackground(currentFile);
      const noBgUrl = URL.createObjectURL(noBgBlob);
      setPreview(noBgUrl);
      setBgRemoved(true);
      setStatus('saving');
      const uploadedUrl = await uploadLogo(noBgBlob, currentFile.name);
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
    idle: '', 'removing-bg': 'Suppression du fond...', saving: 'Sauvegarde...', done: '', error: errorMsg ?? 'Erreur',
  };

  return (
    <div className="space-y-3">
      <AnimatePresence mode="wait">
        {(status === 'idle' || status === 'error') && (
          <motion.div
            key="drop"
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            onClick={() => inputRef.current?.click()}
            onDrop={handleDrop}
            onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
            onDragLeave={() => setIsDragOver(false)}
            className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
              isDragOver ? 'border-primary bg-primary/5 scale-[1.01]' : 'border-border hover:border-primary/40 hover:bg-secondary'
            }`}
          >
            <Upload className="mx-auto mb-3 text-muted-foreground" size={28} />
            <p className="text-sm font-semibold text-foreground">{t('glisserLogo')}</p>
            <p className="text-xs text-muted-foreground mt-1">PNG · JPG · SVG — max 20MB</p>
            <div className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-green-700">
              <CheckCircle2 size={12} /> {t('fondSupprimeAuto')}
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
                onClick={() => { setStatus('idle'); setPreview(null); setBgRemoved(false); }}
                className="absolute top-2 right-2 z-20 w-7 h-7 rounded-full bg-background shadow flex items-center justify-center text-muted-foreground hover:bg-destructive/10"
              >
                <X size={14} />
              </button>
              {bgRemoved && (
                <div className="absolute bottom-2 left-2 z-20 bg-green-700/90 text-white text-[10px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1">
                  <CheckCircle2 size={10} /> {t('fondSupprime')}
                </div>
              )}
            </div>

            {/* Remove BG button if not yet removed */}
            {!bgRemoved && (
              <button
                onClick={handleManualRemoveBg}
                className="mt-2 w-full flex items-center justify-center gap-2 border border-border rounded-xl py-2.5 text-xs font-bold text-foreground hover:border-primary hover:bg-primary/5 transition-all"
              >
                <Scissors size={13} /> {t('supprimerFond')}
              </button>
            )}
          </motion.div>
        )}

        {(status === 'removing-bg' || status === 'saving') && (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="rounded-xl border border-border bg-secondary flex flex-col items-center justify-center gap-3"
            style={{ height: 140 }}
          >
            <Loader2 className="text-primary animate-spin" size={28} />
            <p className="text-sm font-medium text-muted-foreground">{statusLabel[status]}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {errorMsg && status === 'error' && <p className="text-xs text-destructive font-medium px-1">{errorMsg}</p>}

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/svg+xml,image/webp"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) processFile(f); }}
      />
    </div>
  );
}
