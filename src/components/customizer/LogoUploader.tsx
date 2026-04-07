import { useCallback, useState } from 'react';
import { Upload, Loader2, Sparkles } from 'lucide-react';
import { removeBackground } from '@/lib/removeBg';

interface LogoUploaderProps {
  onLogoReady: (url: string, originalUrl: string) => void;
}

export function LogoUploader({ onLogoReady }: LogoUploaderProps) {
  const [isProcessing, setIsProcessing] = useState(false);

  const handleFile = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) return;
    setIsProcessing(true);

    const originalUrl = URL.createObjectURL(file);

    try {
      const processed = await removeBackground(file);
      const processedUrl = processed ? URL.createObjectURL(processed) : originalUrl;
      onLogoReady(processedUrl, originalUrl);
    } catch {
      onLogoReady(originalUrl, originalUrl);
    } finally {
      setIsProcessing(false);
    }
  }, [onLogoReady]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  return (
    <div className="p-5">
      <h3 className="text-sm font-bold text-foreground mb-1">Ton logo</h3>
      <p className="text-xs text-muted-foreground mb-4">PNG, SVG ou JPG — le fond sera retiré automatiquement</p>

      <label
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        className="flex flex-col items-center gap-3 border-2 border-dashed border-border rounded-xl p-8 cursor-pointer hover:border-navy hover:bg-secondary/50 transition-all"
      >
        {isProcessing ? (
          <>
            <Loader2 className="w-8 h-8 text-navy animate-spin" />
            <span className="text-xs font-semibold text-foreground">Traitement en cours…</span>
          </>
        ) : (
          <>
            <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center">
              <Upload className="w-5 h-5 text-navy" />
            </div>
            <span className="text-xs font-bold text-foreground">Glisse ton logo ici ou clique</span>
            <span className="text-[11px] text-muted-foreground">PNG, SVG, JPG — max 5MB</span>
            <span className="flex items-center gap-1 text-[11px] text-green-600 font-semibold">
              <Sparkles className="w-3 h-3" /> Retrait du fond automatique
            </span>
          </>
        )}
        <input
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
        />
      </label>
    </div>
  );
}
