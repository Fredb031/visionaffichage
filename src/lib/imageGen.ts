// Image generation adapter — ready to wire with Replicate or OpenAI DALL-E 3.
//
// Flow:
//   1. User saves API key in /admin/settings → stored in localStorage
//      (move to a secure Supabase edge function + vault when wiring for real)
//   2. Admin/vendor calls generateImage({ prompt, size, style })
//   3. Returned URL can be downloaded, uploaded to Shopify CDN or Supabase Storage

export type ImageProvider = 'replicate' | 'openai' | 'none';

// Provider-specific prompt length caps, derived from each vendor's docs:
//   - OpenAI DALL-E 3: 4000 chars (their documented hard cap)
//   - Replicate Flux Schnell: ~512 token context; ~2000 chars is a safe
//     cap where the model doesn't start dropping content silently
// Before this, the UI used a blanket 4000 limit regardless of provider
// and Replicate silently truncated long prompts without telling the
// admin, producing images that ignored the tail of the instructions.
export const PROMPT_LIMITS: Record<Exclude<ImageProvider, 'none'>, number> = {
  openai: 4000,
  replicate: 2000,
};

export function getPromptLimit(provider: ImageProvider): number {
  return provider === 'none' ? 4000 : PROMPT_LIMITS[provider];
}

export interface GenerateImageParams {
  prompt: string;
  size?: '1024x1024' | '1024x1792' | '1792x1024';
  style?: 'vivid' | 'natural';
  aspect?: '1:1' | '3:4' | '4:3' | '16:9' | '9:16';
}

export interface GeneratedImage {
  url: string;
  prompt: string;
  provider: ImageProvider;
  generatedAt: string;
}

export function getStoredProvider(): ImageProvider {
  if (typeof window === 'undefined') return 'none';
  // Safari private browsing throws SecurityError on localStorage access.
  // The iter-152 setters already try/catch — mirror that on the readers
  // so calling getStoredProvider() during render doesn't crash the page.
  let provider: string | null = null;
  try { provider = localStorage.getItem('vision-image-provider'); } catch { return 'none'; }
  if (provider === 'replicate' || provider === 'openai') return provider;
  return 'none';
}

export function getStoredApiKey(provider: ImageProvider): string | null {
  if (typeof window === 'undefined' || provider === 'none') return null;
  try { return localStorage.getItem(`vision-image-key-${provider}`); }
  catch { return null; }
}

export function saveProviderConfig(provider: ImageProvider, apiKey: string) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem('vision-image-provider', provider);
    if (provider !== 'none' && apiKey) {
      localStorage.setItem(`vision-image-key-${provider}`, apiKey);
    }
  } catch (e) {
    // Quota / private mode — caller (admin UI) already uses a visible
    // 'Configuration sauvegardée' toast that shouldn't flash success
    // when we failed, but surfacing the throw crashes the admin page.
    // Warn to console + swallow so the UI stays functional.
    console.warn('[imageGen] saveProviderConfig failed:', e);
  }
}

export function clearProviderConfig() {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem('vision-image-provider');
    localStorage.removeItem('vision-image-key-replicate');
    localStorage.removeItem('vision-image-key-openai');
  } catch (e) {
    console.warn('[imageGen] clearProviderConfig failed:', e);
  }
}

export async function generateImage(params: GenerateImageParams): Promise<GeneratedImage> {
  const provider = getStoredProvider();
  const key = getStoredApiKey(provider);

  if (provider === 'none' || !key) {
    throw new Error(
      'Aucun fournisseur d\'images configuré. Ajoute une clé API Replicate ou OpenAI dans les paramètres admin.',
    );
  }

  if (provider === 'openai') return callOpenAI(params, key);
  if (provider === 'replicate') return callReplicate(params, key);
  throw new Error(`Fournisseur non supporté : ${provider}`);
}

// Hard timeout on image-gen calls. DALL-E HD typically returns in 8-12s
// and Replicate Flux in 3-6s, but a hung connection (network blip,
// provider degradation, captive portal swallowing the request) used to
// leave the AdminImageGen 'Génération en cours…' spinner spinning
// indefinitely with no way to recover short of a page reload. 60s is
// well above the slowest expected response, short enough to surface a
// useful error.
const IMAGE_GEN_TIMEOUT_MS = 60_000;

function withTimeout(): { signal: AbortSignal; cancel: () => void } {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), IMAGE_GEN_TIMEOUT_MS);
  return { signal: controller.signal, cancel: () => clearTimeout(timer) };
}

// DALL-E 3 only accepts three fixed sizes. AdminImageGen passes the
// UX-friendly `aspect` (1:1 / 16:9 / 3:4) without a `size`, so without
// this mapping the "Large" + "Portrait" selects silently fell back to
// 1024x1024 and the admin got a square image from a wide/portrait pick.
function aspectToOpenAISize(
  aspect: GenerateImageParams['aspect'],
): NonNullable<GenerateImageParams['size']> {
  switch (aspect) {
    case '16:9':
    case '4:3':
      return '1792x1024';
    case '3:4':
    case '9:16':
      return '1024x1792';
    case '1:1':
    default:
      return '1024x1024';
  }
}

async function callOpenAI(params: GenerateImageParams, apiKey: string): Promise<GeneratedImage> {
  const { signal, cancel } = withTimeout();
  let res: Response;
  try {
    res = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'dall-e-3',
        prompt: params.prompt,
        size: params.size ?? aspectToOpenAISize(params.aspect),
        style: params.style ?? 'natural',
        quality: 'hd',
        n: 1,
      }),
      signal,
    });
  } catch (err) {
    cancel();
    if ((err as Error)?.name === 'AbortError') {
      throw new Error(`OpenAI request timed out after ${IMAGE_GEN_TIMEOUT_MS / 1000}s`);
    }
    throw err;
  }
  cancel();
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`OpenAI error ${res.status}: ${body}`);
  }
  const data = await res.json();
  return {
    url: data.data[0].url,
    prompt: params.prompt,
    provider: 'openai',
    generatedAt: new Date().toISOString(),
  };
}

async function callReplicate(params: GenerateImageParams, apiKey: string): Promise<GeneratedImage> {
  // Use Flux Schnell for fast + affordable; swap to Flux Pro for higher quality.
  const model = 'black-forest-labs/flux-schnell';
  const { signal, cancel } = withTimeout();
  let res: Response;
  try {
    res = await fetch(`https://api.replicate.com/v1/models/${model}/predictions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        Prefer: 'wait',
      },
      body: JSON.stringify({
        input: {
          prompt: params.prompt,
          aspect_ratio: params.aspect ?? '1:1',
          output_format: 'webp',
          output_quality: 90,
        },
      }),
      signal,
    });
  } catch (err) {
    cancel();
    if ((err as Error)?.name === 'AbortError') {
      throw new Error(`Replicate request timed out after ${IMAGE_GEN_TIMEOUT_MS / 1000}s`);
    }
    throw err;
  }
  cancel();
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Replicate error ${res.status}: ${body}`);
  }
  const data = await res.json();
  const url = Array.isArray(data.output) ? data.output[0] : data.output;
  if (!url) throw new Error('Replicate returned no output URL');
  return {
    url,
    prompt: params.prompt,
    provider: 'replicate',
    generatedAt: new Date().toISOString(),
  };
}
