import { useCallback, useEffect, useRef, useState } from 'react';
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

  // Track the current blob URL in a ref so the unmount cleanup doesn't
  // stale-close over an earlier value of `preview`. Without this,
  // dropping the dropzone mid-upload (e.g. modal close) leaked the URL
  // because the cleanup saw `preview=null` at first render.
  const previewUrlRef = useRef<string | null>(null);
  useEffect(() => () => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
  }, []);

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
            ? `File too large (max ${maxSizeMB} MB)`
            : `Fichier trop volumineux (max ${maxSizeMB}\u00A0Mo)`,
        );
        return;
      }
      const url = URL.createObjectURL(f);
      // Free the previous blob URL if the user is swapping files so we
      // don't leak object URLs for every re-upload attempt.
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = url;
      setPreview(url);
      setFile(f);
      onFileReady(f, url);
    },
    [acceptedFormats, lang, maxSizeMB, onFileReady],
  );

  const remove = () => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = null;
    setFile(null);
    setPreview(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = '';
    onRemove?.();
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounterRef.current = 0;
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) {
      handleFile(f);
      return;
    }
    // User dropped something that isn't a file (text, URL, image-from-
    // page). Without this feedback they got no indication the drop
    // failed and assumed our dropzone was broken. Surface a clear
    // error explaining we need an actual file.
    setError(
      lang === 'en'
        ? 'Drop a file here, not a link or text. Drag a PNG/JPG/SVG/PDF/AI from your desktop.'
        : 'Glisse un fichier ici, pas un lien ou du texte. Dépose un PNG/JPG/SVG/PDF/AI depuis ton bureau.',
    );
  };

  // Drag counter: dragenter/dragleave fire on every child element the
  // cursor passes over (the upload icon + the two text divs inside the
  // dropzone), so a naive setDragOver(false) on dragleave used to make
  // the highlight flicker as the user dragged over the inner content.
  // Increment on enter, decrement on leave, and only flip the visual
  // state when the counter returns to zero.
  const dragCounterRef = useRef(0);

  if (preview && file) {
    const isImage = file.type.startsWith('image/');
    return (
      <div className="relative border-2 border-emerald-300 bg-emerald-50/40 rounded-2xl p-4 flex items-center gap-4">
        <div className="w-16 h-16 rounded-xl bg-white flex items-center justify-center flex-shrink-0 overflow-hidden border border-emerald-200">
          {isImage ? (
            <img src={preview} alt="" className="w-full h-full object-contain" onError={e => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden'; }} />
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
          className="w-8 h-8 rounded-full bg-white hover:bg-rose-50 hover:text-rose-600 text-zinc-500 flex items-center justify-center border-none cursor-pointer transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 focus-visible:ring-offset-1"
          aria-label={lang === 'en' ? 'Remove file' : 'Retirer le fichier'}
        >
          <X size={16} aria-hidden="true" />
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
        }}
        onDragEnter={e => {
          e.preventDefault();
          dragCounterRef.current += 1;
          if (dragCounterRef.current === 1) setDragOver(true);
        }}
        onDragLeave={() => {
          dragCounterRef.current = Math.max(0, dragCounterRef.current - 1);
          if (dragCounterRef.current === 0) setDragOver(false);
        }}
        onDrop={onDrop}
        aria-invalid={!!error}
        aria-describedby={error ? 'logo-upload-error' : undefined}
        className={`w-full border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center gap-3 transition-all bg-transparent cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${
          error
            ? 'border-rose-400 bg-rose-50/40'
            : dragOver
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
            {acceptedFormats.join(' · ')} · max {maxSizeMB}{'\u00A0'}Mo
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
          // Reset the input value so re-selecting the same file (e.g. after
          // a format/size error) re-fires onChange. Without this the input
          // silently ignores picks of the same filename and users think
          // the dropzone is frozen.
          e.target.value = '';
          if (f) handleFile(f);
        }}
      />

      {error && (
        <p id="logo-upload-error" className="text-xs text-rose-600 font-semibold mt-2 text-center" role="alert">
          {error}
        </p>
      )}
    </>
  );
}
