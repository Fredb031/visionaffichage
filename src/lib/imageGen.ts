// Image generation adapter — ready to wire with Replicate or OpenAI DALL-E 3.
//
// Flow:
//   1. User saves API key in /admin/settings → stored in localStorage
//      (move to a secure Supabase edge function + vault when wiring for real)
//   2. Admin/vendor calls generateImage({ prompt, size, style })
//   3. Returned URL can be downloaded, uploaded to Shopify CDN or Supabase Storage

export type ImageProvider = 'replicate' | 'openai' | 'none';

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
  const provider = localStorage.getItem('vision-image-provider');
  if (provider === 'replicate' || provider === 'openai') return provider;
  return 'none';
}

export function getStoredApiKey(provider: ImageProvider): string | null {
  if (typeof window === 'undefined' || provider === 'none') return null;
  return localStorage.getItem(`vision-image-key-${provider}`);
}

export function saveProviderConfig(provider: ImageProvider, apiKey: string) {
  if (typeof window === 'undefined') return;
  localStorage.setItem('vision-image-provider', provider);
  if (provider !== 'none' && apiKey) {
    localStorage.setItem(`vision-image-key-${provider}`, apiKey);
  }
}

export function clearProviderConfig() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('vision-image-provider');
  localStorage.removeItem('vision-image-key-replicate');
  localStorage.removeItem('vision-image-key-openai');
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

async function callOpenAI(params: GenerateImageParams, apiKey: string): Promise<GeneratedImage> {
  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'dall-e-3',
      prompt: params.prompt,
      size: params.size ?? '1024x1024',
      style: params.style ?? 'natural',
      quality: 'hd',
      n: 1,
    }),
  });
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
  const res = await fetch(`https://api.replicate.com/v1/models/${model}/predictions`, {
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
  });
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
