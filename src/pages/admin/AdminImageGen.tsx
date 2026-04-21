import { useState, useEffect, useRef } from 'react';
import { Sparkles, Key, Zap, Download, Loader2, AlertCircle, CheckCircle2, Copy, Check } from 'lucide-react';
import {
  generateImage,
  getStoredProvider,
  getStoredApiKey,
  getPromptLimit,
  saveProviderConfig,
  clearProviderConfig,
  type ImageProvider,
  type GeneratedImage,
} from '@/lib/imageGen';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';

const HISTORY_STORAGE_KEY = 'va:image-gen-history';
const HISTORY_MAX = 10;

// Persist only the fields we actually re-render in "Récents". Keeping the
// payload minimal avoids quota pressure (DALL-E URLs are short but base64
// bodies would blow the 5MB budget fast) and limits what an attacker with
// XSS on another page can lift out of localStorage.
interface StoredHistoryEntry {
  prompt: string;
  imageUrl: string;
  createdAt: string;
  provider?: ImageProvider;
}

function readStoredHistory(): StoredHistoryEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(HISTORY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (e): e is StoredHistoryEntry =>
          e &&
          typeof e === 'object' &&
          typeof (e as StoredHistoryEntry).prompt === 'string' &&
          typeof (e as StoredHistoryEntry).imageUrl === 'string' &&
          typeof (e as StoredHistoryEntry).createdAt === 'string',
      )
      .slice(0, HISTORY_MAX);
  } catch {
    return [];
  }
}

function writeStoredHistory(entries: StoredHistoryEntry[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(entries.slice(0, HISTORY_MAX)));
  } catch {
    // Ignore quota / private-mode errors — persistence is best-effort.
  }
}

const PRESET_PROMPTS = [
  {
    label: 'Hero banner — team in Vision hoodies at Québec office',
    prompt: 'A professional corporate photo of a diverse team of 4 young professionals wearing navy blue Vision Affichage hoodies with clean logo prints, standing in a modern Québec office with large windows showing downtown Montréal, natural daylight, editorial style, Canon R5 look, premium corporate branding',
  },
  {
    label: 'Lifestyle — folded merch stack on wooden desk',
    prompt: 'A premium flat-lay of folded custom apparel — navy hoodie, white t-shirt, beige cap — on a warm oak desk with a notebook and espresso cup, soft natural window light, top-down view, minimalist, editorial quality, matte texture',
  },
  {
    label: 'Production — screen printing in progress',
    prompt: 'Cinematic close-up of a modern screen-printing press running navy ink onto a white t-shirt in a bright Québec workshop, warm industrial lighting, craftsmanship detail, shallow depth of field, premium photography',
  },
  {
    label: 'Product shot — hoodie on invisible mannequin',
    prompt: 'Professional ghost mannequin product photo of a navy blue zip-up hoodie with small chest logo, pristine white studio background, soft even lighting, 3/4 angle, commercial e-commerce quality, sharp details',
  },
  {
    label: 'Delivery — boxes stacked at client reception',
    prompt: 'Clean corporate delivery scene: 3 premium Vision Affichage branded shipping boxes stacked at a modern office reception desk, warm professional lighting, wide angle, shallow depth of field, welcoming atmosphere',
  },
];

export default function AdminImageGen() {
  useDocumentTitle('Génération d\'images — Admin Vision Affichage');
  const [provider, setProvider] = useState<ImageProvider>('none');
  const [apiKey, setApiKey] = useState('');
  const [keyVisible, setKeyVisible] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  // Track the "saved!" toast timeout so navigating away mid-countdown
  // doesn't leave setSavedMsg firing on an unmounted component.
  const savedMsgTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [prompt, setPrompt] = useState('');
  const [aspect, setAspect] = useState<'1:1' | '16:9' | '3:4'>('1:1');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<GeneratedImage[]>([]);
  // 2s "Copié" flag on the prompt copy button. Separate from savedMsg so
  // the provider-config toast and the prompt-copy feedback don't clobber
  // each other when an admin saves-then-copies in quick succession.
  const [promptCopied, setPromptCopied] = useState(false);
  const promptCopiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Polite screen-reader announcement for each freshly generated image.
  // Without this, a SR user clicks "Générer", hears nothing for 8-12s
  // while the provider works, and gets no confirmation that the new
  // thumbnail landed at the top of the grid. The button label flips
  // back to "Générer" but focus stays on it, so the state change goes
  // unannounced.
  const [announce, setAnnounce] = useState('');
  // Guard setState against a navigate-away mid-generation (DALL-E HD
  // calls commonly take 8-12s; an admin who clicks away in that window
  // would otherwise trigger React's unmounted-setState dev warning
  // and waste the generated image on a dead component's history).
  const isMountedRef = useRef(true);

  useEffect(() => {
    const p = getStoredProvider();
    setProvider(p);
    if (p !== 'none') {
      const k = getStoredApiKey(p) ?? '';
      setApiKey(k);
    }
    // Hydrate past generations from localStorage. Map the stored
    // {prompt, imageUrl, createdAt} shape onto the in-memory
    // GeneratedImage shape so the existing grid renders them without a
    // second code path.
    const stored = readStoredHistory();
    if (stored.length > 0) {
      setHistory(
        stored.map(e => ({
          url: e.imageUrl,
          prompt: e.prompt,
          provider: e.provider ?? 'none',
          generatedAt: e.createdAt,
        })),
      );
    }
    return () => {
      if (savedMsgTimerRef.current) clearTimeout(savedMsgTimerRef.current);
      if (promptCopiedTimerRef.current) clearTimeout(promptCopiedTimerRef.current);
      isMountedRef.current = false;
    };
  }, []);

  const handleSaveKey = () => {
    saveProviderConfig(provider, apiKey.trim());
    setSavedMsg('Configuration sauvegardée');
    if (savedMsgTimerRef.current) clearTimeout(savedMsgTimerRef.current);
    savedMsgTimerRef.current = setTimeout(() => {
      setSavedMsg(null);
      savedMsgTimerRef.current = null;
    }, 2500);
  };

  const handleClear = () => {
    clearProviderConfig();
    setProvider('none');
    setApiKey('');
    // Kill the "Configuration sauvegardée" toast + its pending timer so
    // it doesn't linger after an immediate Save → Clear. Without this,
    // clearing right after saving leaves a stale green success message
    // reading "Configuration sauvegardée" next to a now-empty key field,
    // implying the cleared state is what got saved. Reset the error too
    // in case a prior save failed and left the rose banner visible.
    if (savedMsgTimerRef.current) {
      clearTimeout(savedMsgTimerRef.current);
      savedMsgTimerRef.current = null;
    }
    setSavedMsg(null);
    setError(null);
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setError(null);
    setLoading(true);
    try {
      const img = await generateImage({ prompt: prompt.trim(), aspect });
      if (!isMountedRef.current) return;
      setHistory(h => {
        const next = [img, ...h].slice(0, HISTORY_MAX);
        writeStoredHistory(
          next.map(e => ({
            prompt: e.prompt,
            imageUrl: e.url,
            createdAt: e.generatedAt,
            provider: e.provider,
          })),
        );
        return next;
      });
      setAnnounce(`Image générée : ${img.prompt.slice(0, 80)}${img.prompt.length > 80 ? '…' : ''}`);
    } catch (err) {
      if (!isMountedRef.current) return;
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      if (isMountedRef.current) setLoading(false);
    }
  };

  const handleCopyPrompt = async () => {
    if (!prompt.trim()) return;
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(prompt);
      } else if (typeof document !== 'undefined') {
        // Fallback for older Safari/iOS where clipboard API is gated
        // behind HTTPS or user-gesture quirks. execCommand is deprecated
        // but still works in every browser we care about.
        const ta = document.createElement('textarea');
        ta.value = prompt;
        ta.setAttribute('readonly', '');
        ta.style.position = 'absolute';
        ta.style.left = '-9999px';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      setPromptCopied(true);
      if (promptCopiedTimerRef.current) clearTimeout(promptCopiedTimerRef.current);
      promptCopiedTimerRef.current = setTimeout(() => {
        setPromptCopied(false);
        promptCopiedTimerRef.current = null;
      }, 2000);
    } catch {
      // Silent failure — copying is a convenience, not critical. The
      // prompt is still visible and selectable in the textarea.
    }
  };

  const handleDownloadImage = async (img: GeneratedImage) => {
    try {
      const resp = await fetch(img.url);
      if (!resp.ok) throw new Error('fetch-failed');
      const blob = await resp.blob();
      // Content-type dictates the extension — OpenAI returns image/png,
      // Replicate/Flux returns image/jpeg. Fall back to png when the
      // mime is missing or unrecognized rather than inventing an
      // extension that would confuse the OS file-type mapping.
      const ext = blob.type === 'image/jpeg' ? 'jpg' : 'png';
      const d = new Date(img.generatedAt);
      const pad = (n: number) => String(n).padStart(2, '0');
      const stamp =
        `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
        `-${pad(d.getHours())}${pad(d.getMinutes())}`;
      const filename = `vision-image-${stamp}.${ext}`;
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      // Revoke on the next tick so Safari has time to kick off the
      // download before the URL disappears under it.
      setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    } catch {
      // If the blob fetch fails (CORS on provider CDN, network), fall
      // back to opening the raw URL in a new tab so the user can
      // right-click save. Better than a silent no-op.
      if (typeof window !== 'undefined') window.open(img.url, '_blank', 'noopener,noreferrer');
    }
  };

  const handleRecallPrompt = (entryPrompt: string) => {
    setPrompt(entryPrompt);
    // Focus the prompt textarea so keyboard users immediately see their
    // recalled prompt is editable, not a read-only repeat of history.
    if (typeof document !== 'undefined') {
      const ta = document.querySelector<HTMLTextAreaElement>('textarea[aria-label="Prompt de génération"]');
      ta?.focus();
    }
  };

  const handleClearHistory = () => {
    if (typeof window === 'undefined') return;
    if (!window.confirm('Effacer tout l\'historique des images générées ?')) return;
    try {
      localStorage.removeItem(HISTORY_STORAGE_KEY);
    } catch {
      // Already-cleared or storage denied — state reset below still runs.
    }
    setHistory([]);
  };

  const configured = provider !== 'none' && Boolean(apiKey);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-extrabold tracking-tight flex items-center gap-2">
          <Sparkles size={22} className="text-[#E8A838]" aria-hidden="true" />
          Génération d'images
        </h1>
        <p className="text-sm text-zinc-500 mt-1">
          Génère des visuels premium pour ta boutique, tes emails, tes réseaux sociaux.
        </p>
      </header>

      {/* Provider config */}
      <section className="bg-white border border-zinc-200 rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <Key size={16} className="text-zinc-400" aria-hidden="true" />
          <h2 className="font-bold text-sm">Clé API</h2>
          {configured && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-700 flex items-center gap-1">
              <CheckCircle2 size={10} aria-hidden="true" />
              Configurée
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[200px_1fr_auto] gap-2">
          <select
            value={provider}
            onChange={e => {
              // Swap the API key field to whatever's stored for the
              // newly-selected provider. Without this, an admin
              // switching replicate -> openai would see the old
              // replicate token in the input and could accidentally
              // save it under the openai storage slot.
              const next = e.target.value as ImageProvider;
              setProvider(next);
              setApiKey(next === 'none' ? '' : (getStoredApiKey(next) ?? ''));
            }}
            aria-label="Fournisseur de génération d'images"
            className="border border-zinc-200 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:border-[#0052CC] focus-visible:ring-2 focus-visible:ring-[#0052CC]/25"
          >
            <option value="none">— Choisir un fournisseur —</option>
            <option value="replicate">Replicate (Flux) · recommandé</option>
            <option value="openai">OpenAI DALL-E 3</option>
          </select>
          <div className="relative">
            <input
              type={keyVisible ? 'text' : 'password'}
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              placeholder={provider === 'replicate' ? 'r8_...' : provider === 'openai' ? 'sk-...' : 'Sélectionne un fournisseur d\'abord'}
              disabled={provider === 'none'}
              aria-label="Clé API"
              autoComplete="off"
              className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#0052CC] focus-visible:ring-2 focus-visible:ring-[#0052CC]/25 disabled:bg-zinc-50"
            />
            {provider !== 'none' && apiKey && (
              <button
                type="button"
                onClick={() => setKeyVisible(v => !v)}
                aria-label={keyVisible ? 'Cacher la clé API' : 'Afficher la clé API'}
                aria-pressed={keyVisible}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-[#0052CC] hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC] focus-visible:ring-offset-1 rounded px-1"
              >
                {keyVisible ? 'Cacher' : 'Voir'}
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={handleSaveKey}
            disabled={provider === 'none' || !apiKey.trim()}
            className="px-5 py-2 bg-[#0052CC] text-white rounded-lg text-sm font-bold hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC] focus-visible:ring-offset-2"
          >
            Sauvegarder
          </button>
        </div>

        {savedMsg && (
          <p className="text-xs text-emerald-700 font-semibold mt-2 flex items-center gap-1" role="status">
            <CheckCircle2 size={12} aria-hidden="true" />
            {savedMsg}
          </p>
        )}
        {configured && (
          <button
            type="button"
            onClick={handleClear}
            className="text-xs text-rose-600 hover:underline font-semibold mt-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-1 rounded"
          >
            Effacer la configuration
          </button>
        )}

        <div className="text-[11px] text-zinc-500 mt-3 space-y-1">
          <div><strong>Replicate</strong> : 5 $ crédit gratuit à l'inscription · <a href="https://replicate.com/account/api-tokens" target="_blank" rel="noopener noreferrer" className="text-[#0052CC] hover:underline">replicate.com/account/api-tokens</a></div>
          <div><strong>OpenAI</strong> : ~0,04 $/image HD · <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-[#0052CC] hover:underline">platform.openai.com/api-keys</a></div>
        </div>
      </section>

      {/* Preset prompts */}
      <section className="bg-white border border-zinc-200 rounded-2xl p-5">
        <h2 className="font-bold text-sm mb-3">Prompts suggérés</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {PRESET_PROMPTS.map((p, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setPrompt(p.prompt)}
              aria-label={`Utiliser le prompt : ${p.label}`}
              className="text-left p-3 border border-zinc-200 rounded-lg hover:border-[#0052CC] hover:bg-[#0052CC]/5 transition-colors bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC] focus-visible:ring-offset-1"
            >
              <div className="text-sm font-bold">{p.label}</div>
              <div className="text-[11px] text-zinc-500 mt-1 line-clamp-2">{p.prompt.slice(0, 120)}…</div>
            </button>
          ))}
        </div>
      </section>

      {/* Generate */}
      <section className="bg-white border border-zinc-200 rounded-2xl p-5">
        <h2 className="font-bold text-sm mb-3 flex items-center gap-1.5">
          <Zap size={14} className="text-[#E8A838]" aria-hidden="true" />
          Générer une image
        </h2>

        <div className="relative">
          <textarea
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            rows={4}
            maxLength={getPromptLimit(provider)}
            placeholder="Décris l'image que tu veux générer. Soit précis : style, cadrage, éclairage, ambiance…"
            aria-label="Prompt de génération"
            aria-describedby="imagegen-prompt-count"
            aria-invalid={prompt.length > getPromptLimit(provider) || undefined}
            className={`w-full border rounded-lg px-3 py-2.5 pr-24 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC]/25 resize-none ${
              prompt.length > getPromptLimit(provider) * 0.9
                ? 'border-amber-300 focus:border-amber-500'
                : 'border-zinc-200 focus:border-[#0052CC]'
            }`}
          />
          <button
            type="button"
            onClick={handleCopyPrompt}
            disabled={!prompt.trim()}
            aria-label={promptCopied ? 'Prompt copié' : 'Copier le prompt'}
            aria-live="polite"
            className="absolute top-2 right-2 inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold rounded-md border border-zinc-200 bg-white/90 hover:bg-white hover:border-[#0052CC] text-zinc-600 hover:text-[#0052CC] disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC] focus-visible:ring-offset-1 transition-colors"
          >
            {promptCopied ? (
              <>
                <Check size={12} aria-hidden="true" />
                Copié
              </>
            ) : (
              <>
                <Copy size={12} aria-hidden="true" />
                Copier
              </>
            )}
          </button>
        </div>
        <div
          id="imagegen-prompt-count"
          className={`text-[10px] mt-1 text-right font-mono ${
            prompt.length > getPromptLimit(provider) * 0.9 ? 'text-amber-600' : 'text-zinc-400'
          }`}
          aria-live="polite"
        >
          <span className="sr-only">Caractères utilisés : </span>
          {prompt.length}/{getPromptLimit(provider)}
          {provider !== 'none' && prompt.length > getPromptLimit(provider) * 0.9 && (
            <span className="ml-2">
              · limite {provider === 'replicate' ? 'Replicate/Flux' : 'OpenAI/DALL-E'}
            </span>
          )}
        </div>

        <div className="mt-3 flex items-center gap-3 flex-wrap">
          <label className="flex items-center gap-2 text-sm">
            <span className="text-zinc-500">Format :</span>
            <select
              value={aspect}
              onChange={e => setAspect(e.target.value as '1:1' | '16:9' | '3:4')}
              aria-label="Format de l'image"
              className="border border-zinc-200 rounded-lg px-2 py-1 text-sm bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC]/25"
            >
              <option value="1:1">Carré (1:1)</option>
              <option value="16:9">Large (16:9)</option>
              <option value="3:4">Portrait (3:4)</option>
            </select>
          </label>

          <button
            type="button"
            onClick={handleGenerate}
            disabled={!configured || loading || !prompt.trim()}
            className="ml-auto inline-flex items-center gap-2 px-5 py-2 bg-gradient-to-br from-[#E8A838] to-[#B37D10] text-white rounded-lg text-sm font-bold hover:shadow-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-[#E8A838] focus-visible:ring-offset-2"
          >
            {loading ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <Sparkles size={14} aria-hidden="true" />}
            {loading ? 'Génération en cours…' : 'Générer'}
          </button>
        </div>

        {!configured && (
          <p className="text-[11px] text-zinc-500 mt-2 flex items-center gap-1">
            <AlertCircle size={12} aria-hidden="true" />
            Configure une clé API pour activer la génération.
          </p>
        )}

        {error && (
          <div role="alert" className="mt-3 p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs flex items-start gap-2">
            <AlertCircle size={13} className="flex-shrink-0 mt-0.5" aria-hidden="true" />
            {error}
          </div>
        )}
      </section>

      {/* Visually hidden live region — lets screen-reader users hear
          "Image générée" when a new thumbnail prepends to the history
          grid. Kept outside the conditional section so the node exists
          in the DOM before the first generation finishes (SRs don't
          reliably announce live regions that appear at the same time
          as their content). */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {announce}
      </div>

      {history.length > 0 && (
        <section className="bg-white border border-zinc-200 rounded-2xl p-5">
          <h2 className="font-bold text-sm mb-3">Récents ({history.length})</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {history.map(img => (
              // Key on a stable identifier instead of array index. New
              // images prepend to history, so index-keyed nodes got their
              // src/alt swapped under them — the browser re-fetched each
              // surviving image and any per-card focus state was lost.
              // URL+generatedAt is unique enough for the 10-item cap.
              <div key={`${img.url}-${img.generatedAt}`} className="border border-zinc-200 rounded-xl overflow-hidden">
                <div className="aspect-square bg-zinc-100 relative group">
                  {/* Click-to-recall — tapping the thumbnail reloads the
                      prompt into the input so an admin can tweak a few
                      words and re-run rather than retyping from scratch.
                      The Download button below stops propagation so it
                      doesn't double-fire recall + download. */}
                  <button
                    type="button"
                    onClick={() => handleRecallPrompt(img.prompt)}
                    aria-label={`Réutiliser le prompt : ${img.prompt.length > 80 ? img.prompt.slice(0, 77) + '…' : img.prompt}`}
                    className="absolute inset-0 w-full h-full focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC] focus-visible:ring-offset-2 focus-visible:ring-inset"
                  >
                    <img
                      src={img.url}
                      // Cap the alt at ~120 chars — prompts can run to 4000
                      // and SR users were getting a 30-second prompt readout
                      // for what should be a glanceable thumbnail. Full
                      // prompt still lives below the image.
                      alt={img.prompt.length > 120 ? `${img.prompt.slice(0, 117)}…` : img.prompt}
                      loading="lazy"
                      decoding="async"
                      className="w-full h-full object-cover"
                      onError={e => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden'; }}
                    />
                  </button>
                  <button
                    type="button"
                    onClick={e => { e.stopPropagation(); handleDownloadImage(img); }}
                    className="absolute top-2 right-2 w-8 h-8 bg-white/95 rounded-lg shadow-md opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC] focus-visible:ring-offset-1 hover:bg-white"
                    aria-label="Télécharger l'image"
                  >
                    <Download size={14} aria-hidden="true" />
                  </button>
                </div>
                <div className="p-3">
                  <p className="text-xs text-zinc-700 line-clamp-3">{img.prompt}</p>
                  <div className="text-[10px] text-zinc-400 mt-1 uppercase tracking-wider">
                    {img.provider} · {new Date(img.generatedAt).toLocaleTimeString('fr-CA')}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 flex justify-end">
            <button
              type="button"
              onClick={handleClearHistory}
              className="text-xs text-rose-600 hover:underline font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-1 rounded px-1 py-0.5"
            >
              Effacer l'historique
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
