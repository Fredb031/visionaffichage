import { useState, useEffect } from 'react';
import { Sparkles, Key, Zap, Download, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import {
  generateImage,
  getStoredProvider,
  getStoredApiKey,
  saveProviderConfig,
  clearProviderConfig,
  type ImageProvider,
  type GeneratedImage,
} from '@/lib/imageGen';

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
  const [provider, setProvider] = useState<ImageProvider>('none');
  const [apiKey, setApiKey] = useState('');
  const [keyVisible, setKeyVisible] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  const [prompt, setPrompt] = useState('');
  const [aspect, setAspect] = useState<'1:1' | '16:9' | '3:4'>('1:1');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<GeneratedImage[]>([]);

  useEffect(() => {
    const p = getStoredProvider();
    setProvider(p);
    if (p !== 'none') {
      const k = getStoredApiKey(p) ?? '';
      setApiKey(k);
    }
  }, []);

  const handleSaveKey = () => {
    saveProviderConfig(provider, apiKey.trim());
    setSavedMsg('Configuration sauvegardée');
    setTimeout(() => setSavedMsg(null), 2500);
  };

  const handleClear = () => {
    clearProviderConfig();
    setProvider('none');
    setApiKey('');
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setError(null);
    setLoading(true);
    try {
      const img = await generateImage({ prompt: prompt.trim(), aspect });
      setHistory(h => [img, ...h].slice(0, 12));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setLoading(false);
    }
  };

  const configured = provider !== 'none' && Boolean(apiKey);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-extrabold tracking-tight flex items-center gap-2">
          <Sparkles size={22} className="text-[#E8A838]" />
          Génération d'images
        </h1>
        <p className="text-sm text-zinc-500 mt-1">
          Génère des visuels premium pour ta boutique, tes emails, tes réseaux sociaux.
        </p>
      </header>

      {/* Provider config */}
      <section className="bg-white border border-zinc-200 rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <Key size={16} className="text-zinc-400" />
          <h2 className="font-bold text-sm">Clé API</h2>
          {configured && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-700 flex items-center gap-1">
              <CheckCircle2 size={10} />
              Configurée
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[200px_1fr_auto] gap-2">
          <select
            value={provider}
            onChange={e => setProvider(e.target.value as ImageProvider)}
            className="border border-zinc-200 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:border-[#0052CC]"
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
              className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#0052CC] disabled:bg-zinc-50"
            />
            {provider !== 'none' && apiKey && (
              <button
                type="button"
                onClick={() => setKeyVisible(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-[#0052CC] hover:underline"
              >
                {keyVisible ? 'Cacher' : 'Voir'}
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={handleSaveKey}
            disabled={provider === 'none' || !apiKey.trim()}
            className="px-5 py-2 bg-[#0052CC] text-white rounded-lg text-sm font-bold hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Sauvegarder
          </button>
        </div>

        {savedMsg && (
          <p className="text-xs text-emerald-700 font-semibold mt-2 flex items-center gap-1">
            <CheckCircle2 size={12} />
            {savedMsg}
          </p>
        )}
        {configured && (
          <button
            type="button"
            onClick={handleClear}
            className="text-xs text-rose-600 hover:underline font-semibold mt-2"
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
              className="text-left p-3 border border-zinc-200 rounded-lg hover:border-[#0052CC] hover:bg-[#0052CC]/5 transition-colors bg-white"
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
          <Zap size={14} className="text-[#E8A838]" />
          Générer une image
        </h2>

        <textarea
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          rows={4}
          placeholder="Décris l'image que tu veux générer. Soit précis : style, cadrage, éclairage, ambiance…"
          className="w-full border border-zinc-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[#0052CC] resize-none"
        />

        <div className="mt-3 flex items-center gap-3 flex-wrap">
          <label className="flex items-center gap-2 text-sm">
            <span className="text-zinc-500">Format :</span>
            <select
              value={aspect}
              onChange={e => setAspect(e.target.value as '1:1' | '16:9' | '3:4')}
              className="border border-zinc-200 rounded-lg px-2 py-1 text-sm bg-white"
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
            className="ml-auto inline-flex items-center gap-2 px-5 py-2 bg-gradient-to-br from-[#E8A838] to-[#B37D10] text-white rounded-lg text-sm font-bold hover:shadow-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            {loading ? 'Génération en cours…' : 'Générer'}
          </button>
        </div>

        {!configured && (
          <p className="text-[11px] text-zinc-500 mt-2 flex items-center gap-1">
            <AlertCircle size={12} />
            Configure une clé API pour activer la génération.
          </p>
        )}

        {error && (
          <div className="mt-3 p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs flex items-start gap-2">
            <AlertCircle size={13} className="flex-shrink-0 mt-0.5" />
            {error}
          </div>
        )}
      </section>

      {history.length > 0 && (
        <section className="bg-white border border-zinc-200 rounded-2xl p-5">
          <h2 className="font-bold text-sm mb-3">Images générées ({history.length})</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {history.map((img, i) => (
              <div key={i} className="border border-zinc-200 rounded-xl overflow-hidden">
                <div className="aspect-square bg-zinc-100 relative group">
                  <img src={img.url} alt={img.prompt} className="w-full h-full object-cover" />
                  <a
                    href={img.url}
                    download
                    target="_blank"
                    rel="noopener noreferrer"
                    className="absolute top-2 right-2 w-8 h-8 bg-white/95 rounded-lg shadow-md opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                    aria-label="Download"
                  >
                    <Download size={14} />
                  </a>
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
        </section>
      )}
    </div>
  );
}
