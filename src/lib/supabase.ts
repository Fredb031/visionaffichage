import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
// IMPORTANT: this must match the env var name exposed in `.env` and used by
// the canonical client at src/integrations/supabase/client.ts —
// `VITE_SUPABASE_PUBLISHABLE_KEY`. Reading `VITE_SUPABASE_ANON_KEY`
// resolved to undefined in every build, leaving `supabase` null, so
// `uploadLogo()` always returned null and customer logos never made it
// to Supabase Storage. We also accept the legacy `VITE_SUPABASE_ANON_KEY`
// as a fallback so older `.env.local` overrides keep working without a
// forced rename.
const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
  import.meta.env.VITE_SUPABASE_ANON_KEY;

// Only create client when both env vars are present
export const supabase: SupabaseClient | null =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null;

export const LOGO_BUCKET = 'vision-logos';

// Path-shaping constants. Lifted from inline magic numbers so the
// limits are obvious at the top of the file and tunable without
// hunting through string-builder code.
const MAX_BASENAME_LEN = 60;        // cap so a pathological filename can't
                                    // blow Supabase's storage path length limit
const RANDOM_SUFFIX_LEN = 6;        // collision-avoidance for same-ms writes
const FALLBACK_BASENAME = 'logo';   // used when the sanitised base is empty
const PNG_CONTENT_TYPE = 'image/png';

export async function uploadLogo(blob: Blob, filename: string): Promise<string | null> {
  if (!supabase) {
    return null;
  }
  // Defensive validation: callers pass `file.name` from a File object,
  // but a non-File code path (drag-drop with a synthetic blob, paste-
  // from-clipboard handlers we may add later) could supply null/undefined
  // or a non-string. Without this guard, the .replace() chain below
  // throws TypeError and the upload silently dies inside whatever
  // try/catch wraps the caller (LogoUploader has none on this path).
  const safeFilename = typeof filename === 'string' ? filename : '';
  // Empty blobs are almost certainly a bug upstream (failed canvas
  // export, aborted fetch). Surface as a clean null return so the
  // caller's "upload failed" UI path runs instead of writing a 0-byte
  // file to the bucket.
  if (!blob || blob.size === 0) {
    return null;
  }
  // Strip the original extension before we append .png — otherwise
  // "logo.png" landed as "logo.png.png" in the bucket and the admin
  // saw double-extension files when browsing Supabase Storage. Also
  // cap the base name so a pathological filename can't blow Supabase's
  // path length limit, and add a random suffix so two same-ms uploads
  // of the same file don't collide on the upsert:false write.
  const base = safeFilename
    .replace(/\.[a-z0-9]+$/i, '')       // drop trailing extension
    .replace(/[^a-z0-9.]/gi, '-')       // sanitize
    .slice(0, MAX_BASENAME_LEN) || FALLBACK_BASENAME;
  // Math.random().toString(36) can return a short string when the random
  // value has trailing zeros in base-36 (e.g. 0.5 → "0.i"), so .slice(2,8)
  // would yield fewer than RANDOM_SUFFIX_LEN chars and weaken the
  // collision-avoidance guarantee. padEnd with a deterministic fill
  // keeps every suffix exactly RANDOM_SUFFIX_LEN chars.
  const suffix = Math.random()
    .toString(36)
    .slice(2, 2 + RANDOM_SUFFIX_LEN)
    .padEnd(RANDOM_SUFFIX_LEN, '0');
  const path = `logos/${Date.now()}-${suffix}-${base}.png`;
  // Wrap the upload in try/catch: supabase-js can REJECT (not just return
  // { error }) on raw network failures (offline, DNS, CORS preflight
  // blocked by an extension). Without this wrapper an offline upload
  // surfaces as an "Uncaught (in promise)" in the customizer instead
  // of the clean null return the caller's UI is wired to handle.
  try {
    const { error } = await supabase.storage
      .from(LOGO_BUCKET)
      .upload(path, blob, { contentType: PNG_CONTENT_TYPE, upsert: false });

    if (error) {
      return null;
    }

    const { data } = supabase.storage.from(LOGO_BUCKET).getPublicUrl(path);
    // getPublicUrl shouldn't fail for a public bucket, but defending
    // against an undefined publicUrl avoids returning the string
    // "undefined" downstream (which would then be persisted as a logo
    // src and render a broken image on the customizer canvas).
    return data?.publicUrl ?? null;
  } catch (e) {
    console.error('Logo upload threw:', e);
    return null;
  }
}
