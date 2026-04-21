import { useEffect, useMemo, useRef, useState } from 'react';
import { Mail, Copy, Check, Pencil, RotateCcw, Save, Eye, X } from 'lucide-react';
import {
  quoteSentEmail,
  paymentConfirmationEmail,
  orderShippedEmail,
  orderDeliveredEmail,
} from '@/lib/emailTemplates';
import { readLS, writeLS } from '@/lib/storage';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';

type TemplateId = 'quote-sent' | 'payment' | 'shipped' | 'delivered';
type Lang = 'fr' | 'en';

// localStorage key for admin-edited template overrides. Stored shape:
//   { [templateKey]: { subject: string, html: string } }
// Where templateKey is `${TemplateId}:${Lang}` so FR + EN customizations
// don't clobber each other. Missing keys fall through to the built-in
// function output in emailTemplates.ts.
const OVERRIDES_KEY = 'vision-email-templates-overrides';

type OverrideEntry = { subject: string; html: string };
type OverrideMap = Partial<Record<string, OverrideEntry>>;

function overrideKey(id: TemplateId, lang: Lang): string {
  return `${id}:${lang}`;
}

// Defensive parse — devtools edits, partial writes, or a schema change
// could leave this in a shape we can't trust. readLS handles the
// JSON.parse + corrupted-entry failure modes; the field-shape validation
// below is still our responsibility since readLS is schema-agnostic.
function readOverrides(): OverrideMap {
  const parsed = readLS<unknown>(OVERRIDES_KEY, {});
  if (!parsed || typeof parsed !== 'object') return {};
  const out: OverrideMap = {};
  for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
    if (v && typeof v === 'object') {
      const entry = v as Record<string, unknown>;
      if (typeof entry.subject === 'string' && typeof entry.html === 'string') {
        out[k] = { subject: entry.subject, html: entry.html };
      }
    }
  }
  return out;
}

function writeOverrides(map: OverrideMap): void {
  // writeLS returns false on quota/private-mode failure; surface to
  // the console so the admin knows the save didn't persist rather than
  // silently pretending everything is fine.
  if (!writeLS(OVERRIDES_KEY, map)) {
    console.warn('[AdminEmails] failed to persist overrides (quota exceeded or storage disabled)');
  }
}

interface TemplateMeta {
  id: TemplateId;
  label: string;
  subtitle: string;
  description: string;
}

const TEMPLATES: TemplateMeta[] = [
  {
    id: 'quote-sent',
    label: 'Soumission envoyée',
    subtitle: 'Client reçoit le lien pour accepter',
    description: 'Envoyé automatiquement au client quand un vendeur publie une nouvelle soumission. Inclut montant, date d\'expiration et lien vers le portail d\'acceptation.',
  },
  {
    id: 'payment',
    label: 'Paiement confirmé',
    subtitle: 'Production commence',
    description: 'Envoyé après qu\'un paiement Shopify/Stripe est capturé. Confirme le montant, le numéro de commande et la date de livraison estimée.',
  },
  {
    id: 'shipped',
    label: 'Commande expédiée',
    subtitle: 'Avec numéro de suivi',
    description: 'Déclenché par le webhook fulfillments/create de Shopify. Inclut transporteur, numéro de suivi et URL de suivi.',
  },
  {
    id: 'delivered',
    label: 'Commande livrée',
    subtitle: 'Demande d\'avis',
    description: 'Envoyé quand le statut de livraison bascule à « delivered ». Demande un avis Google et invite à recommander.',
  },
];

// Sample context used both for (a) rendering the default preview and
// (b) substituting placeholders in edited overrides. The values match
// the task spec — `clientName="Acme Corp"` etc. — plus enough extras
// to cover every template's required fields.
interface SampleContext {
  clientName: string;
  clientEmail: string;
  vendorName: string;
  quoteNumber: string;
  quoteUrl: string;
  orderNumber: string;
  total: number;
  etaDate: string;
  expiresAt: string;
  trackingNumber: string;
  trackingUrl: string;
  carrier: string;
  reviewUrl: string;
}

const SAMPLE: SampleContext = {
  clientName: 'Acme Corp',
  clientEmail: 'contact@acmecorp.ca',
  vendorName: 'Sophie Tremblay',
  quoteNumber: 'VA-2341',
  quoteUrl: 'https://visionaffichage.com/quote/va-2341',
  orderNumber: '#10052',
  total: 1840,
  etaDate: '2026-04-28',
  expiresAt: '2026-04-24',
  trackingNumber: 'PUR-1Z999AA10123456784',
  trackingUrl: 'https://tools.purolator.com/track/PUR-1Z999AA10123456784',
  carrier: 'Purolator',
  reviewUrl: 'https://g.page/r/vision-affichage/review',
};

function defaultOutputOf(id: TemplateId, lang: Lang) {
  switch (id) {
    case 'quote-sent':
      return quoteSentEmail({
        clientName: SAMPLE.clientName,
        clientEmail: SAMPLE.clientEmail,
        vendorName: SAMPLE.vendorName,
        quoteNumber: SAMPLE.quoteNumber,
        quoteUrl: SAMPLE.quoteUrl,
        total: SAMPLE.total,
        expiresAt: SAMPLE.expiresAt,
        lang,
      });
    case 'payment':
      return paymentConfirmationEmail({
        clientName: SAMPLE.clientName,
        orderNumber: SAMPLE.orderNumber,
        total: SAMPLE.total,
        etaDate: SAMPLE.etaDate,
        trackingUrl: SAMPLE.trackingUrl,
        lang,
      });
    case 'shipped':
      return orderShippedEmail({
        clientName: SAMPLE.clientName,
        orderNumber: SAMPLE.orderNumber,
        trackingNumber: SAMPLE.trackingNumber,
        trackingUrl: SAMPLE.trackingUrl,
        carrier: SAMPLE.carrier,
        etaDate: SAMPLE.etaDate,
        lang,
      });
    case 'delivered':
      return orderDeliveredEmail({
        clientName: SAMPLE.clientName,
        orderNumber: SAMPLE.orderNumber,
        reviewUrl: SAMPLE.reviewUrl,
        lang,
      });
  }
}

// Variables exposed to the template editor per template. The Variables
// reference panel also parses the editor content for `{{name}}` usage,
// but listing known-supported names here gives the admin a canonical
// roster — otherwise they'd have to guess what's safe to reference.
const AVAILABLE_VARS: Record<TemplateId, Array<keyof SampleContext>> = {
  'quote-sent': ['clientName', 'clientEmail', 'vendorName', 'quoteNumber', 'quoteUrl', 'total', 'expiresAt'],
  payment: ['clientName', 'orderNumber', 'total', 'etaDate', 'trackingUrl'],
  shipped: ['clientName', 'orderNumber', 'trackingNumber', 'trackingUrl', 'carrier', 'etaDate'],
  delivered: ['clientName', 'orderNumber', 'reviewUrl'],
};

// Minimal HTML-escape for substituted sample values. The default
// templates already escape user input before interpolating — when an
// admin edits the HTML, the stored body may inline `{{clientName}}`
// verbatim without the esc() wrapper, so we escape here to preserve
// the same XSS posture in the preview.
function escHtml(s: string | number): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function substituteVars(template: string, id: TemplateId): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_match, name: string) => {
    const known = AVAILABLE_VARS[id];
    if (!(known as string[]).includes(name)) {
      // Leave unknown placeholders visible so the admin spots the
      // typo in the preview instead of getting a silent empty string.
      return `{{${name}}}`;
    }
    const raw = SAMPLE[name as keyof SampleContext];
    return escHtml(raw);
  });
}

function extractVars(html: string): string[] {
  const found = new Set<string>();
  for (const m of html.matchAll(/\{\{(\w+)\}\}/g)) {
    found.add(m[1]);
  }
  return Array.from(found).sort();
}

// Auto-sizing preview frame. Measures the rendered email's scrollHeight
// and resizes the iframe to match, so admins don't have to scroll a
// nested scrollbar inside the preview panel (the old min-h:600px
// behaviour cut off long order-shipped templates). Uses allow-same-origin
// so we can read contentDocument — safe because we author the HTML
// source ourselves via emailTemplates.
function EmailPreviewFrame({ html, title, minHeight = 400 }: { html: string; title: string; minHeight?: number }) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [height, setHeight] = useState(minHeight);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    let observer: ResizeObserver | null = null;
    let cancelled = false;
    const measure = () => {
      const doc = iframe.contentDocument;
      if (!doc?.body) return;
      const h = Math.max(doc.body.scrollHeight, doc.documentElement.scrollHeight, minHeight);
      if (!cancelled) setHeight(h + 32);
    };
    const onLoad = () => {
      measure();
      const doc = iframe.contentDocument;
      if (doc?.body && typeof ResizeObserver !== 'undefined') {
        // Disconnect the previous observer before reassigning — otherwise
        // a second 'load' (synchronous readyState==='complete' path firing
        // alongside the real load event, or an iframe reload without the
        // parent effect re-running) would leak a ResizeObserver bound to
        // the old body. Over a long admin session of switching templates
        // these pile up and tick measure() once per resize.
        observer?.disconnect();
        observer = new ResizeObserver(measure);
        observer.observe(doc.body);
      }
    };
    iframe.addEventListener('load', onLoad);
    if (iframe.contentDocument?.readyState === 'complete') onLoad();
    return () => {
      cancelled = true;
      iframe.removeEventListener('load', onLoad);
      observer?.disconnect();
    };
  }, [html, minHeight]);

  return (
    <iframe
      ref={iframeRef}
      srcDoc={html}
      className="w-full border-none rounded-lg bg-white shadow-lg transition-[height] duration-200"
      style={{ height: `${height}px` }}
      title={title}
      sandbox="allow-same-origin"
    />
  );
}

interface EditorDrawerProps {
  templateId: TemplateId;
  lang: Lang;
  defaultSubject: string;
  defaultHtml: string;
  override: OverrideEntry | undefined;
  onSave: (entry: OverrideEntry) => void;
  onReset: () => void;
  onClose: () => void;
}

function TemplateEditorDrawer(props: EditorDrawerProps) {
  const { templateId, lang, defaultSubject, defaultHtml, override, onSave, onReset, onClose } = props;

  // Seed the form with the current override if one exists, else with
  // the defaults. Using the default HTML as the starting point lets an
  // admin tweak copy without rewriting the full template from scratch.
  const [subject, setSubject] = useState<string>(override?.subject ?? defaultSubject);
  const [html, setHtml] = useState<string>(override?.html ?? defaultHtml);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  // If the parent switches which override we're editing (should rarely
  // happen — the drawer normally re-mounts — but keep state honest).
  useEffect(() => {
    setSubject(override?.subject ?? defaultSubject);
    setHtml(override?.html ?? defaultHtml);
    setSavedAt(null);
  }, [templateId, lang, override, defaultSubject, defaultHtml]);

  const previewHtml = useMemo(() => substituteVars(html, templateId), [html, templateId]);
  const referencedVars = useMemo(() => extractVars(html), [html]);
  const availableVars = AVAILABLE_VARS[templateId];
  const isDirty = subject !== (override?.subject ?? defaultSubject) || html !== (override?.html ?? defaultHtml);
  const hasOverride = !!override;

  // Close on Escape — matches the rest of the admin UI's drawer/modal
  // affordances, and lets keyboard-first users bail without hunting
  // for the X button.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const templateLabel = TEMPLATES.find(t => t.id === templateId)?.label ?? templateId;

  return (
    <div
      className="fixed inset-0 z-50 flex"
      role="dialog"
      aria-modal="true"
      aria-labelledby={`editor-title-${templateId}`}
    >
      {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="relative ml-auto h-full w-full max-w-6xl bg-zinc-50 shadow-2xl overflow-y-auto">
        <header className="sticky top-0 z-10 bg-white border-b border-zinc-200 px-6 py-4 flex items-center gap-4">
          <div className="flex-1">
            <h2 id={`editor-title-${templateId}`} className="text-lg font-extrabold tracking-tight text-[#0F2341]">
              Éditer : {templateLabel} <span className="text-xs font-normal text-zinc-500">({lang.toUpperCase()})</span>
            </h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              {hasOverride
                ? 'Personnalisé — les modifications remplacent le modèle par défaut.'
                : 'Par défaut — sauvegarde pour créer une version personnalisée.'}
            </p>
          </div>
          {hasOverride && (
            <button
              type="button"
              onClick={onReset}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-rose-50 text-rose-700 hover:bg-rose-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
            >
              <RotateCcw size={13} aria-hidden="true" />
              Réinitialiser
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              onSave({ subject, html });
              setSavedAt(Date.now());
            }}
            disabled={!isDirty}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-[#0052CC] text-white hover:bg-[#003D99] disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC] focus-visible:ring-offset-1"
          >
            <Save size={13} aria-hidden="true" />
            Sauvegarder
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer l'éditeur"
            className="p-1.5 rounded-lg hover:bg-zinc-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC]"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </header>

        {savedAt !== null && (
          <div className="mx-6 mt-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg px-4 py-2 text-xs font-bold flex items-center gap-2">
            <Check size={13} aria-hidden="true" />
            Modifications enregistrées dans le navigateur.
          </div>
        )}

        <div className="p-6 grid grid-cols-1 xl:grid-cols-[1fr_1fr] gap-6">
          <section className="space-y-4">
            <div>
              <label htmlFor={`editor-subject-${templateId}`} className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1.5">
                Sujet
              </label>
              <input
                id={`editor-subject-${templateId}`}
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-zinc-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#0052CC] focus:border-transparent"
                placeholder="Ex : Ta soumission personnalisée — {{quoteNumber}}"
              />
            </div>

            <div>
              <label htmlFor={`editor-html-${templateId}`} className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1.5">
                Corps HTML
              </label>
              <textarea
                id={`editor-html-${templateId}`}
                value={html}
                onChange={(e) => setHtml(e.target.value)}
                spellCheck={false}
                className="w-full px-3 py-3 rounded-lg border border-zinc-300 bg-white font-mono text-xs leading-relaxed focus:outline-none focus:ring-2 focus:ring-[#0052CC] focus:border-transparent"
                style={{ height: '480px', resize: 'vertical' }}
              />
            </div>

            <div className="bg-white border border-zinc-200 rounded-xl p-4">
              <h3 className="font-bold text-xs text-zinc-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                Variables disponibles
              </h3>
              <div className="flex flex-wrap gap-1.5 mb-3">
                {availableVars.map(v => {
                  const inUse = referencedVars.includes(v);
                  return (
                    <code
                      key={v}
                      className={`inline-block px-2 py-1 rounded text-[11px] font-mono border ${
                        inUse
                          ? 'bg-[#0052CC]/10 border-[#0052CC]/30 text-[#0F2341]'
                          : 'bg-zinc-50 border-zinc-200 text-zinc-600'
                      }`}
                      title={inUse ? 'Utilisée dans ce modèle' : 'Disponible mais pas utilisée'}
                    >
                      {`{{${v}}}`}
                    </code>
                  );
                })}
              </div>
              {referencedVars.some(v => !(availableVars as string[]).includes(v)) && (
                <div className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-2 py-1.5">
                  <strong>Attention :</strong> ton modèle référence des variables inconnues —{' '}
                  {referencedVars
                    .filter(v => !(availableVars as string[]).includes(v))
                    .map(v => `{{${v}}}`)
                    .join(', ')}
                  . Elles resteront affichées telles quelles dans l'aperçu.
                </div>
              )}
              <p className="text-[11px] text-zinc-500 mt-2">
                Insère une variable en tapant <code className="font-mono">{`{{nomDeVariable}}`}</code>. Les valeurs
                réelles seront substituées à l'envoi.
              </p>
            </div>
          </section>

          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <Eye size={14} className="text-[#0052CC]" aria-hidden="true" />
              <h3 className="font-bold text-sm text-[#0F2341]">Aperçu en direct</h3>
              <span className="text-[11px] text-zinc-500">
                Avec des valeurs d'exemple
              </span>
            </div>
            <div className="bg-white border border-zinc-200 rounded-xl px-4 py-3">
              <div className="text-[11px] uppercase tracking-wider text-zinc-500 font-bold">Sujet</div>
              <div className="text-sm font-bold mt-0.5">{substituteVars(subject, templateId)}</div>
            </div>
            <div className="bg-zinc-100 rounded-xl p-4">
              <EmailPreviewFrame
                html={previewHtml}
                title={`Aperçu édité — ${templateLabel}`}
                minHeight={500}
              />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

export default function AdminEmails() {
  useDocumentTitle('Modèles de courriels — Admin Vision Affichage');
  const [active, setActive] = useState<TemplateId>('quote-sent');
  const [lang, setLang] = useState<Lang>('fr');
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');
  // Track the "Copied!" indicator timer so navigating away mid-countdown
  // doesn't fire setCopied on an unmounted component.
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [overrides, setOverrides] = useState<OverrideMap>(() => readOverrides());
  const [editing, setEditing] = useState<{ id: TemplateId; lang: Lang } | null>(null);

  useEffect(() => () => {
    if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
  }, []);

  // Re-read overrides when the window regains focus — admins sometimes
  // have two tabs open, and an edit in one shouldn't be silently
  // overwritten by the stale state in the other.
  useEffect(() => {
    const onFocus = () => setOverrides(readOverrides());
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, []);

  const defaultEmail = defaultOutputOf(active, lang);
  const activeOverride = overrides[overrideKey(active, lang)];
  const displayedEmail = activeOverride
    ? {
        subject: substituteVars(activeOverride.subject, active),
        html: substituteVars(activeOverride.html, active),
        text: defaultEmail.text,
      }
    : defaultEmail;

  const saveOverride = (id: TemplateId, l: Lang, entry: OverrideEntry) => {
    setOverrides(prev => {
      const next = { ...prev, [overrideKey(id, l)]: entry };
      writeOverrides(next);
      return next;
    });
  };

  const resetOverride = (id: TemplateId, l: Lang) => {
    setOverrides(prev => {
      const next = { ...prev };
      delete next[overrideKey(id, l)];
      writeOverrides(next);
      return next;
    });
  };

  const copyHtml = async () => {
    let ok = false;
    try {
      // navigator.clipboard is undefined in iframes / non-secure contexts —
      // accessing .writeText on undefined throws TypeError, so guard first.
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(displayedEmail.html);
        ok = true;
      }
    } catch (err) {
      // Clipboard API can also reject under denied permissions or
      // iframe restrictions — log + fall through to the failed state
      // so the user knows to try the textarea below instead of
      // re-clicking a button that will never work.
      console.warn('[AdminEmails] clipboard write failed:', err);
    }
    setCopyState(ok ? 'copied' : 'failed');
    if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
    copiedTimerRef.current = setTimeout(() => {
      setCopyState('idle');
      copiedTimerRef.current = null;
    }, ok ? 1500 : 2500);
  };
  const copied = copyState === 'copied';
  const copyFailed = copyState === 'failed';

  const editingDefault = editing ? defaultOutputOf(editing.id, editing.lang) : null;
  const editingOverride = editing ? overrides[overrideKey(editing.id, editing.lang)] : undefined;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-extrabold tracking-tight flex items-center gap-2">
          <Mail size={22} className="text-[#0052CC]" aria-hidden="true" />
          Modèles de courriels
        </h1>
        <p className="text-sm text-zinc-500 mt-1">
          Templates HTML prêts à brancher avec Resend, Postmark ou Shopify Email. Clique sur un modèle
          pour éditer le sujet et le corps HTML — les modifications sont enregistrées localement.
        </p>
      </header>

      {/* Template cards grid — one per template, shows default subject + customization indicator. */}
      <section aria-label="Catalogue des modèles">
        <h2 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">
          Catalogue ({TEMPLATES.length}) · {lang.toUpperCase()}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
          {TEMPLATES.map(t => {
            const out = defaultOutputOf(t.id, lang);
            const override = overrides[overrideKey(t.id, lang)];
            const customized = !!override;
            const effectiveSubject = override ? substituteVars(override.subject, t.id) : out.subject;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setEditing({ id: t.id, lang })}
                className="group text-left bg-white border border-zinc-200 rounded-2xl p-4 hover:border-[#0052CC] hover:shadow-md transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC] focus-visible:ring-offset-1"
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div className="font-bold text-sm text-[#0F2341]">{t.label}</div>
                  {customized && (
                    <span className="shrink-0 inline-block px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#E8A838]/20 text-[#8A5E00] uppercase tracking-wider">
                      Édité
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-zinc-500 mb-2">{t.subtitle}</div>
                <p className="text-[11px] text-zinc-600 leading-relaxed mb-3 line-clamp-3">{t.description}</p>
                <div className="border-t border-zinc-100 pt-2">
                  <div className="text-[10px] uppercase tracking-wider text-zinc-400 font-bold">Sujet</div>
                  <div className="text-xs text-zinc-800 mt-0.5 line-clamp-2">{effectiveSubject}</div>
                </div>
                <div className="mt-3 inline-flex items-center gap-1 text-[11px] font-bold text-[#0052CC] opacity-0 group-hover:opacity-100 transition-opacity">
                  <Pencil size={11} aria-hidden="true" />
                  Éditer
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Preview panel — retained from the original admin UI so the
          non-edit workflow (copy HTML, switch lang, read plaintext)
          still works exactly as before. */}
      <section className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-5">
        <aside className="space-y-1.5" role="tablist" aria-label="Modèles de courriels">
          <h2 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2 px-1">Aperçu</h2>
          {TEMPLATES.map(t => {
            const override = overrides[overrideKey(t.id, lang)];
            const customized = !!override;
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={active === t.id}
                aria-controls={`email-preview-${t.id}`}
                id={`email-tab-${t.id}`}
                onClick={() => setActive(t.id)}
                className={`w-full text-left p-3 rounded-xl transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC] focus-visible:ring-offset-1 ${
                  active === t.id
                    ? 'bg-[#0052CC] text-white'
                    : 'bg-white border border-zinc-200 hover:border-[#0052CC]'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="font-bold text-sm">{t.label}</div>
                  {customized && (
                    <span className={`shrink-0 inline-block px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                      active === t.id ? 'bg-white/25 text-white' : 'bg-[#E8A838]/20 text-[#8A5E00]'
                    }`}>
                      Édité
                    </span>
                  )}
                </div>
                <div className={`text-[11px] mt-0.5 ${active === t.id ? 'text-white/80' : 'text-zinc-500'}`}>
                  {t.subtitle}
                </div>
              </button>
            );
          })}
        </aside>

        <main className="space-y-4">
          <div className="bg-white border border-zinc-200 rounded-2xl p-4 flex items-center gap-3 flex-wrap">
            <div className="text-sm">
              <span className="text-zinc-500">Sujet :</span>{' '}
              <span className="font-bold">{displayedEmail.subject}</span>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <button
                type="button"
                onClick={() => setEditing({ id: active, lang })}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-[#0F2341] text-white hover:bg-[#1B3A6B] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC] focus-visible:ring-offset-1"
              >
                <Pencil size={13} aria-hidden="true" />
                Éditer
              </button>
              <div className="inline-flex border border-zinc-200 rounded-lg overflow-hidden" role="radiogroup" aria-label="Langue du courriel">
                <button
                  type="button"
                  role="radio"
                  aria-checked={lang === 'fr'}
                  onClick={() => setLang('fr')}
                  className={`px-3 py-1.5 text-xs font-bold focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC] focus-visible:ring-inset ${lang === 'fr' ? 'bg-zinc-900 text-white' : 'bg-white text-zinc-600'}`}
                >
                  FR
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={lang === 'en'}
                  onClick={() => setLang('en')}
                  className={`px-3 py-1.5 text-xs font-bold focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC] focus-visible:ring-inset ${lang === 'en' ? 'bg-zinc-900 text-white' : 'bg-white text-zinc-600'}`}
                >
                  EN
                </button>
              </div>
              <button
                type="button"
                onClick={copyHtml}
                aria-label={copied ? 'HTML copié' : copyFailed ? 'Copie indisponible — utilise le bloc texte ci-dessous' : 'Copier le HTML du courriel'}
                aria-live="polite"
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC] focus-visible:ring-offset-1 ${
                  copyFailed
                    ? 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                    : 'bg-zinc-100 hover:bg-zinc-200'
                }`}
              >
                {copied ? <Check size={13} aria-hidden="true" /> : <Copy size={13} aria-hidden="true" />}
                {copied ? 'Copié' : copyFailed ? 'Copie indisponible' : 'Copier HTML'}
              </button>
            </div>
          </div>

          <div
            className="bg-zinc-100 rounded-2xl p-6 md:p-10 min-h-[400px]"
            role="tabpanel"
            id={`email-preview-${active}`}
            aria-labelledby={`email-tab-${active}`}
          >
            <EmailPreviewFrame
              html={displayedEmail.html}
              title={`Aperçu du courriel — ${TEMPLATES.find(t => t.id === active)?.label ?? ''}`}
            />
          </div>

          <div className="bg-white border border-zinc-200 rounded-2xl p-4">
            <h3 className="font-bold text-xs text-zinc-500 uppercase tracking-wider mb-2">Version texte</h3>
            <pre className="text-xs text-zinc-700 whitespace-pre-wrap font-sans leading-relaxed">{displayedEmail.text}</pre>
          </div>
        </main>
      </section>

      {editing && editingDefault && (
        <TemplateEditorDrawer
          templateId={editing.id}
          lang={editing.lang}
          defaultSubject={editingDefault.subject}
          defaultHtml={editingDefault.html}
          override={editingOverride}
          onSave={(entry) => saveOverride(editing.id, editing.lang, entry)}
          onReset={() => resetOverride(editing.id, editing.lang)}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
