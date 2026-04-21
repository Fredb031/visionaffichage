// Client-side raster → SVG fallback.
//
// Phase B2 of QUOTE-ORDER-WORKFLOW.md calls for a Supabase edge
// function to run a proper vectorizer (potrace-wasm / imagetracer-wasm
// / Replicate). This module is the client-side shim that plugs into the
// same interface so the admin UI can render conversion state *today*
// without waiting on the worker.
//
// If `imagetracerjs` is on the dependency list we fall through to a
// dynamic import and trace in the browser. It isn't (package.json has
// no vectorizer yet, and the task spec forbids adding one in this
// commit), so the function short-circuits to the queued stub. The shape
// of the return value is stable either way: callers read
// `.svg` / `.queued` / `.error` and branch on which is populated.
//
// IMPORTANT: do NOT add a static `import` for imagetracerjs — that
// would break the build when the package isn't installed. Guard the
// dynamic import in a try/catch and let the failure fall through to
// the queued path.

export interface VectorizeResult {
  /** SVG markup when vectorization succeeded. */
  svg: string | null;
  /** True when the pipeline fell back to "queued for the worker". */
  queued: boolean;
  /** Human-readable reason the SVG isn't here yet. */
  error?: string;
}

/** Attempt to vectorize a raster file in the browser. Returns
 * `{ svg: null, queued: true }` as the safe fallback — the UI then
 * surfaces a "Conversion en file" state and offers the raw raster
 * download while the real worker catches up. */
export async function vectorizeInBrowser(file: File): Promise<VectorizeResult> {
  // Already an SVG — nothing to trace, just read the text.
  if (file.type === 'image/svg+xml' || file.name.toLowerCase().endsWith('.svg')) {
    try {
      const text = await file.text();
      return { svg: text, queued: false };
    } catch (e) {
      return { svg: null, queued: true, error: e instanceof Error ? e.message : 'read-failed' };
    }
  }

  // Only raster formats pass this point. Try the in-browser tracer if
  // it's installed. The dynamic import is wrapped so an uninstalled
  // package throws at runtime (bundler resolution failure) and we fall
  // through to the queued stub — no hard dependency in package.json.
  try {
    // @vite-ignore — the string is deliberately hidden from Vite's
    // static analyzer. Without this the build fails when the package
    // isn't installed, defeating the "ship the UI without the worker"
    // part of the plan. Once imagetracerjs lands in package.json the
    // dynamic path resolves and this returns real SVG markup.
    const moduleName = /* @vite-ignore */ 'imagetrace' + 'rjs';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mod: any = await import(/* @vite-ignore */ moduleName).catch(() => null);
    if (!mod) {
      return { svg: null, queued: true, error: 'vectorizer-not-installed' };
    }
    // Happy path stub — the real imagetracerjs API takes an ImageData
    // buffer. Wiring that up is worth its own commit (it needs a
    // canvas, quantization options, color palette picker, etc.); for
    // now we still return queued so the UI stays in the stub state
    // even if the dep is present but unconfigured.
    return { svg: null, queued: true, error: 'vectorizer-unconfigured' };
  } catch (e) {
    return {
      svg: null,
      queued: true,
      error: e instanceof Error ? e.message : 'vectorize-threw',
    };
  }
}

/** Download any Blob as a file. Centralised so the admin page and
 * future callers stay consistent about createObjectURL revocation. */
export function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoke on a short timeout — some browsers (Safari) race the
  // download start against an immediate revoke and cancel the
  // transfer. 1s is enough to clear the click handler.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Build a filename like `vision-logo-1570.svg` from an order name +
 * mime/extension. Keeps the admin's Downloads folder tidy — no more
 * `IMG_4821.png` landing in production's inbox with no context. */
export function buildLogoFilename(orderName: string, ext: string): string {
  const safeOrder = orderName.replace(/[^a-z0-9_-]/gi, '').replace(/^#/, '') || 'order';
  const safeExt = ext.replace(/^\./, '').toLowerCase() || 'bin';
  return `vision-logo-${safeOrder}.${safeExt}`;
}
