import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function uploadLogo(file: File, userId?: string): Promise<string | null> {
  const fileName = `${userId ?? 'anon'}/${Date.now()}-${file.name}`;
  const { error } = await supabase.storage.from('logos').upload(fileName, file);
  if (error) {
    console.error('Upload failed:', error);
    return null;
  }
  const { data } = supabase.storage.from('logos').getPublicUrl(fileName);
  return data.publicUrl;
}
