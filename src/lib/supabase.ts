import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Only create client when both env vars are present
export const supabase: SupabaseClient | null =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null;

export const LOGO_BUCKET = 'vision-logos';

export async function uploadLogo(blob: Blob, filename: string): Promise<string | null> {
  if (!supabase) {
    console.warn('Supabase not configured — add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env');
    return null;
  }
  const path = `logos/${Date.now()}-${filename.replace(/[^a-z0-9.]/gi, '-')}.png`;
  const { error } = await supabase.storage
    .from(LOGO_BUCKET)
    .upload(path, blob, { contentType: 'image/png', upsert: false });

  if (error) {
    console.error('Logo upload failed:', error.message);
    return null;
  }

  const { data } = supabase.storage.from(LOGO_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
