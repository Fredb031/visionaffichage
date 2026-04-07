import { useState, useCallback, useRef } from 'react';
import { Upload, X, Loader2, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { removeBackground } from '@/lib/removeBg';
import { uploadLogo } from '@/lib/supabase';

type UploadStatus = 'idle' | 'removing-bg' | 'saving' | 'done' | 'error';

export function LogoUploader({
  onLogoReady,
}: {
  onLogoReady: (previewUrl: string, processedUrl: string, originalFile: File) => void;
}) {
  const [status, setStatus] = useState<UploadStatus>('idle');
  const [preview, setPreview] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const processFile = useCallback(async (file: File) => {
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
    const localUrl = URL.createObjectURL(file);
    setPreview(localUrl);
    setStatus('removing-bg');

    try {
      // 1. Remove background (graceful fallback if API key missing)
      const noBgBlob = await removeBackground(file);
      const noBgUrl = URL.createObjectURL(noBgBlob);
      setPreview(noBgUrl);

      // 2. Try to upload to Supabase (graceful fallback if not configured)
      setStatus('saving');
      const uploadedUrl = await uploadLogo(noBgBlob, file.name);

      setStatus('done');
      // Use uploaded URL if available, otherwise use local blob URL
      onLogoReady(noBgUrl, uploadedUrl ?? noBgUrl, file);
    } catch (err) {
      console.error('Logo processing error:', err);
      // Always succeed with the original file as fallback
      setStatus('done');
      setPreview(localUrl);
      onLogoReady(localUrl, localUrl, file);
    }
  }, [onLogoReady]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }, [processFile]);

  const statusLabel: Record<UploadStatus, string> = {
    idle: '',
    'removing-bg': 'Suppression du fond...',
    saving: 'Sauvegarde...',
    done: 'Logo prêt !',
    error: errorMsg ?? 'Erreur',
  };

  return (
    <div className="space-y-3">
      <AnimatePresence mode="wait">
        {(status === 'idle' || status === 'error') && (
          <motion.div
            key="drop-zone"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            onClick={() => inputRef.current?.click()}
            onDrop={handleDrop}
            onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
            onDragLeave={() => setIsDragOver(false)}
            className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all duration-200 ${
              isDragOver
                ? 'border-primary bg-primary/5 scale-[1.01]'
                : 'border-border hover:border-primary/40 hover:bg-secondary'
            }`}
          >
            <Upload className="mx-auto mb-3 text-muted-foreground" size={28} />
            <p className="text-sm font-semibold text-foreground">Glisse ton logo ici</p>
            <p className="text-xs text-muted-foreground mt-1">PNG · JPG · SVG — max 20MB</p>
            <div className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-green-700">
              <CheckCircle2 size={12} />
              Fond supprimé automatiquement
            </div>
          </motion.div>
        )}

        {status === 'done' && preview && (
          <motion.div
            key="preview"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative rounded-xl overflow-hidden border border-border bg-secondary"
            style={{ height: '140px' }}
          >
            {/* Checkered background to show transparency */}
            <div className="absolute inset-0" style={{ backgroundImage: 'repeating-conic-gradient(#e5e5e5 0% 25%, white 0% 50%)', backgroundSize: '16px 16px' }} />
            <img src={preview} alt="Logo" className="relative w-full h-full object-contain p-4 z-10" />
            <button
              onClick={() => { setStatus('idle'); setPreview(null); }}
              className="absolute top-2 right-2 z-20 w-7 h-7 rounded-full bg-background shadow flex items-center justify-center text-muted-foreground hover:bg-destructive/10 transition-colors"
            >
              <X size={14} />
            </button>
            <div className="absolute bottom-2 left-2 z-20 bg-green-700/90 text-white text-xs font-bold px-2.5 py-1 rounded-full flex items-center gap-1">
              <CheckCircle2 size={11} /> Fond supprimé
            </div>
          </motion.div>
        )}

        {(status === 'removing-bg' || status === 'saving') && (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="rounded-xl border border-border bg-secondary flex flex-col items-center justify-center gap-3"
            style={{ height: '140px' }}
          >
            <Loader2 className="text-primary animate-spin" size={28} />
            <p className="text-sm font-medium text-muted-foreground">{statusLabel[status]}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {errorMsg && status === 'error' && (
        <p className="text-xs text-destructive font-medium px-1">{errorMsg}</p>
      )}

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
