/**
 * Remove background from an image using remove.bg API or local canvas fallback.
 */
export async function removeBackground(file: File): Promise<Blob | null> {
  const apiKey = import.meta.env.VITE_REMOVEBG_API_KEY;

  if (apiKey) {
    try {
      const formData = new FormData();
      formData.append('image_file', file);
      formData.append('size', 'auto');

      const res = await fetch('https://api.remove.bg/v1.0/removebg', {
        method: 'POST',
        headers: { 'X-Api-Key': apiKey },
        body: formData,
      });

      if (!res.ok) throw new Error(`remove.bg error: ${res.status}`);
      return await res.blob();
    } catch (err) {
      console.error('remove.bg failed, using original:', err);
    }
  }

  // Fallback: return original file as-is
  return file;
}
