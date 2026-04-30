'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { CheckCircle2, Loader2 } from 'lucide-react';

import {
  PLACEMENT_GEOMETRY,
  STORAGE_PREFIX,
  analyzeFile,
  contrastVerdict,
  detectFileKind,
  lightnessFromHex,
  makeShortId,
  type FileChecks as Checks,
  type Placement,
  type SavedCustomizer,
} from '@/lib/customizer';

import { UploadDropzone } from '@/components/customizer/UploadDropzone';
import { FileChecks } from '@/components/customizer/FileChecks';
import { PlacementSelector } from '@/components/customizer/PlacementSelector';
import { ContrastGuide } from '@/components/customizer/ContrastGuide';
import { ProofTimeline } from '@/components/customizer/ProofTimeline';

type Props = {
  locale: 'fr-ca' | 'en-ca';
  productSlug: string | null;
  productMockupSrc: string | null;
  productLabel: string | null;
  garmentHex: string;
  size: string | null;
};

const STEP_COUNT = 7;
const NOTES_MAX = 500;

function invertHex(hex: string): string {
  const m = hex.replace('#', '').match(/.{2}/g);
  if (!m || m.length < 3) return '#FFFFFF';
  const inv = m
    .slice(0, 3)
    .map((c) => (255 - parseInt(c, 16)).toString(16).padStart(2, '0'))
    .join('');
  return `#${inv}`;
}

export function CustomiserClient({
  locale,
  productSlug,
  productMockupSrc,
  productLabel,
  garmentHex,
  size,
}: Props) {
  const t = useTranslations('customizer');
  const router = useRouter();

  const [file, setFile] = useState<File | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [checks, setChecks] = useState<Checks | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [placement, setPlacement] = useState<Placement>('heart');
  const [contrastInverted, setContrastInverted] = useState(false);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedToast, setSavedToast] = useState(false);

  // Revoke preview object URL on unmount / replace.
  const prevUrlRef = useRef<string | null>(null);
  useEffect(() => {
    return () => {
      if (prevUrlRef.current) URL.revokeObjectURL(prevUrlRef.current);
    };
  }, []);

  const handleFileSelected = useCallback(async (next: File) => {
    setAnalyzing(true);
    setChecks(null);

    if (prevUrlRef.current) {
      URL.revokeObjectURL(prevUrlRef.current);
      prevUrlRef.current = null;
    }
    setLogoUrl(null);

    setFile(next);

    try {
      const result = await analyzeFile(next);
      setChecks(result);
      // Preview only for raster (vectors don't render reliably as <img>
      // for AI/PDF, and we don't want a broken icon).
      if (detectFileKind(next) === 'raster' || next.name.toLowerCase().endsWith('.svg')) {
        const url = URL.createObjectURL(next);
        prevUrlRef.current = url;
        setLogoUrl(url);
      }
    } catch {
      setChecks({ kind: detectFileKind(next) });
    } finally {
      setAnalyzing(false);
    }
  }, []);

  const handleReplace = useCallback(() => {
    if (prevUrlRef.current) {
      URL.revokeObjectURL(prevUrlRef.current);
      prevUrlRef.current = null;
    }
    setFile(null);
    setChecks(null);
    setLogoUrl(null);
    setContrastInverted(false);
  }, []);

  const garmentLightness = useMemo(() => lightnessFromHex(garmentHex), [garmentHex]);
  const invertedGarmentHex = useMemo(() => invertHex(garmentHex), [garmentHex]);
  const activeGarmentHex = contrastInverted ? invertedGarmentHex : garmentHex;

  const lowContrast = useMemo(() => {
    if (!checks || typeof checks.avgLightness !== 'number') return false;
    return contrastVerdict(checks.avgLightness, garmentLightness) === 'low';
  }, [checks, garmentLightness]);

  const onSave = useCallback(async () => {
    if (!file || !checks) return;
    setSaving(true);

    try {
      const token = makeShortId();
      const payload: SavedCustomizer = {
        productSlug,
        color: garmentHex,
        size,
        fileName: file.name,
        fileSize: file.size,
        kind: checks.kind,
        placement,
        notes,
        thumbnailDataUrl: checks.thumbnailDataUrl,
        width: checks.width,
        height: checks.height,
        dpi: checks.dpi,
        colorCount: checks.colorCount,
        savedAt: Date.now(),
      };
      try {
        sessionStorage.setItem(`${STORAGE_PREFIX}${token}`, JSON.stringify(payload));
      } catch {
        // Storage full or unavailable — proceed anyway, server review still works.
      }
      setSavedToast(true);
      // Brief pause so the toast registers before we navigate.
      setTimeout(() => {
        router.push(`/${locale}/panier?customizer=saved&token=${token}`);
      }, 700);
    } finally {
      setSaving(false);
    }
  }, [file, checks, productSlug, garmentHex, size, placement, notes, locale, router]);

  const placementOptions: { id: Placement; label: string; description: string }[] = [
    {
      id: 'heart',
      label: t('placement.heart.label'),
      description: t('placement.heart.description'),
    },
    {
      id: 'centerChest',
      label: t('placement.centerChest.label'),
      description: t('placement.centerChest.description'),
    },
    {
      id: 'fullBack',
      label: t('placement.fullBack.label'),
      description: t('placement.fullBack.description'),
    },
  ];

  const stepStates = useMemo(() => {
    const fileSelected = !!file;
    const checksReady = !!checks;
    return [
      true, // 1: always active
      fileSelected, // 2: file checks
      checksReady, // 3: placement preview
      checksReady, // 4: contrast guidance
      checksReady, // 5: notes
      checksReady, // 6: save & continue
      true, // 7: proof timeline always visible
    ];
  }, [file, checks]);

  return (
    <div className="grid gap-10 lg:grid-cols-[2fr_3fr]">
      <ProgressRail
        currentStep={
          file ? (checks ? (saving ? 6 : 5) : 2) : 1
        }
        steps={[
          t('step.1.label'),
          t('step.2.label'),
          t('step.3.label'),
          t('step.4.label'),
          t('step.5.label'),
          t('step.6.label'),
          t('step.7.label'),
        ]}
        active={stepStates}
      />

      <div className="space-y-8">
        {/* Step 1 */}
        <StepBlock index={1} title={t('step.1.label')}>
          <UploadDropzone
            file={file}
            onFileSelected={handleFileSelected}
            onReplace={handleReplace}
            labels={{
              dropzoneTitle: t('upload.dropzoneTitle'),
              dropzoneSubtitle: t('upload.dropzoneSubtitle'),
              replaceButton: t('upload.replaceButton'),
              errorTooLarge: t('upload.error.tooLarge'),
              errorWrongFormat: t('upload.error.wrongFormat'),
              errorGeneric: t('upload.error.generic'),
              fileLabel: t('upload.fileLabel'),
            }}
          />
        </StepBlock>

        {/* Step 2 */}
        {file ? (
          <StepBlock index={2} title={t('step.2.label')}>
            {analyzing ? (
              <div className="flex items-center gap-2 text-body-sm text-stone-600">
                <Loader2 aria-hidden className="h-4 w-4 animate-spin" />
                {t('checks.loading')}
              </div>
            ) : (
              <FileChecks
                checks={checks}
                labels={{
                  vector: {
                    pass: {
                      label: t('checks.vector.pass.label'),
                      recommendation: t('checks.vector.pass.recommendation'),
                    },
                  },
                  dpi: {
                    pass: {
                      label: t('checks.dpi.pass.label'),
                      recommendation: t('checks.dpi.pass.recommendation'),
                    },
                    warn: {
                      label: t('checks.dpi.warn.label'),
                      recommendation: t('checks.dpi.warn.recommendation'),
                    },
                    fail: {
                      label: t('checks.dpi.fail.label'),
                      recommendation: t('checks.dpi.fail.recommendation'),
                    },
                  },
                  colorCount: {
                    pass: {
                      label: t('checks.colorCount.pass.label'),
                      recommendation: t('checks.colorCount.pass.recommendation'),
                    },
                    warn: {
                      label: t('checks.colorCount.warn.label'),
                      recommendation: t('checks.colorCount.warn.recommendation'),
                    },
                  },
                }}
              />
            )}
          </StepBlock>
        ) : null}

        {/* Step 3 */}
        {checks ? (
          <StepBlock index={3} title={t('step.3.label')}>
            <PlacementPreview
              productMockupSrc={productMockupSrc}
              logoUrl={logoUrl}
              placement={placement}
              garmentHex={activeGarmentHex}
              productLabel={productLabel ?? ''}
            />
            <div className="mt-4">
              <PlacementSelector
                value={placement}
                onChange={setPlacement}
                options={placementOptions}
                legend={t('placement.legend')}
              />
            </div>
          </StepBlock>
        ) : null}

        {/* Step 4 */}
        {checks ? (
          <StepBlock index={4} title={t('step.4.label')}>
            {lowContrast ? (
              <ContrastGuide
                show
                warningText={t('contrast.warning')}
                toggleLabel={t('contrast.toggleInverted')}
                inverted={contrastInverted}
                onToggle={() => setContrastInverted((v) => !v)}
                garmentHex={garmentHex}
                invertedHex={invertedGarmentHex}
              />
            ) : (
              <p className="rounded-sm border border-success-200 bg-success-50 px-3 py-2 text-body-sm text-success-700">
                {t('contrast.ok')}
              </p>
            )}
          </StepBlock>
        ) : null}

        {/* Step 5 */}
        {checks ? (
          <StepBlock index={5} title={t('step.5.label')}>
            <label htmlFor="customizer-notes" className="block text-body-sm font-semibold text-ink-950">
              {t('notes.label')}
            </label>
            <textarea
              id="customizer-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value.slice(0, NOTES_MAX))}
              maxLength={NOTES_MAX}
              rows={3}
              placeholder={t('notes.placeholder')}
              className="mt-2 w-full rounded-sm border border-sand-300 bg-canvas-000 px-3 py-2 text-body-md text-ink-950 placeholder:text-stone-500 focus:border-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-700/20"
            />
            <p className="mt-1 text-body-sm text-stone-600">
              {t('notes.charCount', { used: notes.length, max: NOTES_MAX })}
            </p>
          </StepBlock>
        ) : null}

        {/* Step 7 (always visible above CTA) */}
        <ProofTimeline
          heading={t('proofTimeline.heading')}
          steps={{
            1: t('proofTimeline.1'),
            2: t('proofTimeline.2'),
            3: t('proofTimeline.3'),
            4: t('proofTimeline.4'),
          }}
        />

        {/* Step 6 */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-body-sm text-stone-600">{t('cta.continue')}</p>
          <button
            type="button"
            disabled={!file || !checks || saving}
            onClick={onSave}
            className="inline-flex items-center justify-center gap-2 rounded-md bg-ink-950 px-6 py-3 text-body-md font-medium text-canvas-000 transition-colors duration-base ease-standard hover:bg-ink-800 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-700"
          >
            {saving ? <Loader2 aria-hidden className="h-4 w-4 animate-spin" /> : null}
            {t('cta.save')}
          </button>
        </div>

        {savedToast ? (
          <div
            role="status"
            aria-live="polite"
            className="flex items-center gap-2 rounded-md border border-success-200 bg-success-50 px-4 py-3 text-body-sm text-success-700"
          >
            <CheckCircle2 aria-hidden className="h-4 w-4" />
            {t('cta.success')}
          </div>
        ) : null}

        <noscript>
          <p className="text-body-sm text-stone-600">{t('noscript')}</p>
        </noscript>
      </div>
    </div>
  );
}

function StepBlock({
  index,
  title,
  children,
}: {
  index: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section
      aria-label={`Étape ${index} sur ${STEP_COUNT}: ${title}`}
      className="rounded-lg border border-sand-300 bg-canvas-050 p-6"
    >
      <header className="mb-4 flex items-center gap-3">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-ink-950 text-meta-xs font-semibold text-canvas-000">
          {index}
        </span>
        <h2 className="text-title-md text-ink-950">{title}</h2>
      </header>
      {children}
    </section>
  );
}

function ProgressRail({
  currentStep,
  steps,
  active,
}: {
  currentStep: number;
  steps: string[];
  active: boolean[];
}) {
  return (
    <nav
      aria-label={`Étape ${currentStep} sur ${STEP_COUNT}`}
      className="lg:sticky lg:top-24 lg:self-start"
    >
      <ol className="flex flex-wrap gap-3 lg:flex-col">
        {steps.map((label, idx) => {
          const num = idx + 1;
          const isActive = active[idx] ?? false;
          const isCurrent = num === currentStep;
          return (
            <li key={num} className="flex items-center gap-3">
              <span
                aria-hidden
                className={[
                  'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-meta-xs font-semibold',
                  isCurrent
                    ? 'bg-ink-950 text-canvas-000'
                    : isActive
                      ? 'bg-slate-700 text-canvas-000'
                      : 'bg-sand-100 text-stone-600',
                ].join(' ')}
              >
                {num}
              </span>
              <span
                className={[
                  'text-body-sm',
                  isCurrent ? 'font-semibold text-ink-950' : 'text-stone-600',
                ].join(' ')}
              >
                {label}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function PlacementPreview({
  productMockupSrc,
  logoUrl,
  placement,
  garmentHex,
  productLabel,
}: {
  productMockupSrc: string | null;
  logoUrl: string | null;
  placement: Placement;
  garmentHex: string;
  productLabel: string;
}) {
  const geometry = PLACEMENT_GEOMETRY[placement];

  return (
    <div className="relative mx-auto aspect-square w-full max-w-md overflow-hidden rounded-md border border-sand-300 bg-canvas-000">
      {/* Garment color tint band so the user can feel the contrast */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{ backgroundColor: garmentHex, opacity: 0.12 }}
      />
      {productMockupSrc ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={productMockupSrc}
          alt={productLabel}
          className="absolute inset-0 h-full w-full object-contain"
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center text-body-sm text-stone-500">
          {productLabel}
        </div>
      )}
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logoUrl}
          alt=""
          aria-hidden
          className="pointer-events-none absolute"
          style={{
            top: geometry.top,
            left: geometry.left,
            width: geometry.width,
            transform: geometry.transform,
          }}
        />
      ) : null}
    </div>
  );
}
