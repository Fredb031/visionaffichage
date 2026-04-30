'use client';

import { useCallback, useId, useRef, useState } from 'react';
import { UploadCloud, FileText, Image as ImageIcon, RefreshCcw } from 'lucide-react';

import {
  ACCEPTED_EXTENSIONS,
  MAX_BYTES,
  detectFileKind,
  formatBytes,
} from '@/lib/customizer';

type UploadError = 'tooLarge' | 'wrongFormat' | 'generic';

type Props = {
  file: File | null;
  onFileSelected: (file: File) => void;
  onReplace: () => void;
  labels: {
    dropzoneTitle: string;
    dropzoneSubtitle: string;
    replaceButton: string;
    errorTooLarge: string;
    errorWrongFormat: string;
    errorGeneric: string;
    fileLabel: string;
  };
};

export function UploadDropzone({ file, onFileSelected, onReplace, labels }: Props) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<UploadError | null>(null);

  const validateAndSelect = useCallback(
    (candidate: File) => {
      setError(null);
      if (candidate.size > MAX_BYTES) {
        setError('tooLarge');
        return;
      }
      const kind = detectFileKind(candidate);
      if (kind === 'unknown') {
        setError('wrongFormat');
        return;
      }
      try {
        onFileSelected(candidate);
      } catch {
        setError('generic');
      }
    },
    [onFileSelected],
  );

  const onDrop = useCallback(
    (e: React.DragEvent<HTMLLabelElement>) => {
      e.preventDefault();
      setDragOver(false);
      const dropped = e.dataTransfer?.files?.[0];
      if (dropped) validateAndSelect(dropped);
    },
    [validateAndSelect],
  );

  const onChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const picked = e.target.files?.[0];
      if (picked) validateAndSelect(picked);
    },
    [validateAndSelect],
  );

  const errorMessage =
    error === 'tooLarge'
      ? labels.errorTooLarge
      : error === 'wrongFormat'
        ? labels.errorWrongFormat
        : error === 'generic'
          ? labels.errorGeneric
          : null;

  if (file) {
    const kind = detectFileKind(file);
    const Icon = kind === 'raster' ? ImageIcon : FileText;
    return (
      <div className="rounded-md border border-sand-300 bg-canvas-000 p-5 shadow-xs">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-sm bg-sand-100 text-slate-700">
            <Icon aria-hidden className="h-6 w-6" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-meta-xs uppercase text-stone-500">{labels.fileLabel}</p>
            <p className="mt-0.5 truncate text-body-md font-medium text-ink-950">
              {file.name}
            </p>
            <p className="mt-0.5 text-body-sm text-stone-600">
              {formatBytes(file.size)} · {kind === 'raster' ? 'raster' : 'vector'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              onReplace();
              if (inputRef.current) inputRef.current.value = '';
            }}
            className="inline-flex items-center gap-1.5 rounded-sm border border-ink-950 bg-canvas-000 px-3 py-2 text-body-sm font-medium text-ink-950 transition-colors duration-base ease-standard hover:bg-sand-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-700"
          >
            <RefreshCcw aria-hidden className="h-3.5 w-3.5" />
            {labels.replaceButton}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <label
        htmlFor={inputId}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={[
          'flex cursor-pointer flex-col items-center justify-center gap-3 rounded-md border-2 border-dashed bg-canvas-000 px-6 py-12 text-center transition-colors duration-base ease-standard',
          dragOver
            ? 'border-slate-700 bg-sand-100'
            : 'border-sand-300 hover:border-slate-700 hover:bg-sand-100',
        ].join(' ')}
      >
        <UploadCloud aria-hidden className="h-10 w-10 text-slate-700" />
        <div>
          <p className="text-body-md font-medium text-ink-950">{labels.dropzoneTitle}</p>
          <p className="mt-1 text-body-sm text-stone-600">{labels.dropzoneSubtitle}</p>
        </div>
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept={ACCEPTED_EXTENSIONS}
          onChange={onChange}
          className="sr-only"
        />
      </label>
      {errorMessage ? (
        <p
          role="status"
          aria-live="polite"
          className="mt-2 rounded-sm border border-error-200 bg-error-50 px-3 py-2 text-body-sm text-error-700"
        >
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
}
