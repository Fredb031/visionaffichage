import { useCallback, useRef, useState } from 'react';
import { Upload, X, CheckCircle2, FileImage } from 'lucide-react';
import { useLang } from '@/lib/langContext';

interface Props {
  onFileReady: (file: File, previewUrl: string) => void;
  onRemove?: () => void;
  maxSizeMB?: number;
  acceptedFormats?: string[];
}

export function LogoUploadDropzone({ onFileReady, onRemove, maxSizeMB = 20, acceptedFormats = ['png', 'jpg', 'jpeg', 'svg', 'pdf', 'ai'] }: Props) {
  const { lang } = useLang();
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    (f: File) => {
      setError(null);
      const ext = f.name.split('.').pop()?.toLowerCase() ?? '';
      if (!acceptedFormats.includes(ext)) {
        setError(
          lang === 'en'
            ? `Invalid format. Accepted: ${acceptedFormats.join(', ').toUpperCase()}`
            : `Format invalide. Accepté : ${acceptedFormats.join(', ').toUpperCase()}`,
        );
        return;
      }
      if (f.size > maxSizeMB * 1024 * 1024) {
        setError(
          lang === 'en'
            ? `File too large (max ${maxSizeMB}MB)`
            : `Fichier trop volumineux (max ${maxSizeMB}Mo)`,
        );
        return;
      }
      const url = URL.createObjectURL(f);
      setFile(f);
      setPreview(url);
      onFileReady(f, url);
    },
    [acceptedFormats, lang, maxSizeMB, onFileReady],
  );

  const remove = () => {
    setFile(null);
    setPreview(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = '';
    onRemove?.();
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  if (preview && file) {
    const isImage = file.type.startsWith('image/');
    return (
      <div className="relative border-2 border-emerald-300 bg-emerald-50/40 rounded-2xl p-4 flex items-center gap-4">
        <div className="w-16 h-16 rounded-xl bg-white flex items-center justify-center flex-shrink-0 overflow-hidden border border-emerald-200">
          {isImage ? (
            <img src={preview} alt="" className="w-full h-full object-contain" />
          ) : (
            <FileImage size={28} className="text-emerald-600" aria-hidden="true" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 mb-0.5">
            <CheckCircle2 size={13} aria-hidden="true" />
            {lang === 'en' ? 'Logo ready' : 'Logo prêt'}
          </div>
          <div className="text-sm font-semibold truncate">{file.name}</div>
          <div className="text-[11px] text-muted-foreground">{(file.size / 1024).toFixed(0)} KB</div>
        </div>
        <button
          type="button"
          onClick={remove}
          className="w-8 h-8 rounded-full bg-white hover:bg-rose-50 hover:text-rose-600 text-zinc-500 flex items-center justify-center border-none cursor-pointer transition-colors"
          aria-label={lang === 'en' ? 'Remove file' : 'Retirer le fichier'}
        >
          <X size={16} />
        </button>
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={e => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={`w-full border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center gap-3 transition-all bg-transparent cursor-pointer ${
          dragOver
            ? 'border-[#0052CC] bg-[#0052CC]/5 scale-[1.01]'
            : 'border-border hover:border-[#0052CC]/50 hover:bg-secondary/30'
        }`}
      >
        <div className="w-12 h-12 rounded-full bg-[#0052CC]/10 flex items-center justify-center">
          <Upload size={20} className="text-[#0052CC]" aria-hidden="true" />
        </div>
        <div className="text-center">
          <div className="text-sm font-extrabold text-foreground">
            {lang === 'en' ? 'Upload your logo' : 'Téléverse ton logo'}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            {lang === 'en' ? 'Drag & drop or click to browse' : 'Glisse-dépose ou clique pour choisir'}
          </div>
          <div className="text-[10px] text-muted-foreground/70 mt-1.5 uppercase tracking-wider">
            {acceptedFormats.join(' · ')} · max {maxSizeMB}Mo
          </div>
        </div>
      </button>

      <input
        ref={inputRef}
        type="file"
        accept={acceptedFormats.map(f => `.${f}`).join(',')}
        className="hidden"
        onChange={e => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
        }}
      />

      {error && (
        <p className="text-xs text-rose-600 font-semibold mt-2 text-center" role="alert">
          {error}
        </p>
      )}
    </>
  );
}
