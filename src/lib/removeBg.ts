// Fix: unified env var name VITE_REMOVE_BG_API_KEY (was VITE_REMOVEBG_API_KEY in some files)
export async function removeBackground(file: File): Promise<Blob> {
  const apiKey = import.meta.env.VITE_REMOVE_BG_API_KEY;

  if (apiKey && apiKey !== '') {
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
      console.warn('remove.bg failed, using original image:', err);
    }
  } else {
    console.warn('VITE_REMOVE_BG_API_KEY not set — add it to .env for automatic background removal');
  }

  // Fallback: return original file as Blob
  return file;
}
