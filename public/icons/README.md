# PWA Icons — owner uploads required

The PWA manifest (`/public/manifest.json`) references three PNG icons that
must live in this directory. They are NOT committed to the repo because
generating them requires image tooling (ImageMagick / Sharp / Figma export)
that the codegen agent doesn't have access to. The manifest install flow
works the instant the owner drops these files in.

## Required files

| File                         | Size      | Purpose   | Notes                                                                     |
| ---------------------------- | --------- | --------- | ------------------------------------------------------------------------- |
| `icon-192.png`               | 192x192   | `any`     | Standard home-screen icon on Android / Chrome PWA install.                |
| `icon-512.png`               | 512x512   | `any`     | High-res icon used for splash screens + app drawer.                       |
| `icon-maskable-512.png`      | 512x512   | `maskable`| Safe-zone padded icon so Android can crop to circle/squircle without clipping. Keep the logo inside the inner 80% (410x410). |

## Favicon set (Task 16.3)

`index.html` references the canonical favicon set below. `.ico` and `.svg`
live at `/public/` root; the PNGs live in this `/public/icons/` folder.

| File                          | Size      | Location          | Purpose                                                                    |
| ----------------------------- | --------- | ----------------- | -------------------------------------------------------------------------- |
| `favicon.ico`                 | multi     | `/public/`        | Legacy browser tab icon (IE, older Edge). Currently 0-byte placeholder — needs real multi-res .ico upload. |
| `favicon.svg`                 | vector    | `/public/`        | Modern browsers + Safari `mask-icon` (brand navy `#1B3A6B`). Already present. |
| `favicon-16.png`              | 16x16     | `/public/icons/`  | Discrete small size for browsers that skip SVG.                            |
| `favicon-32.png`              | 32x32     | `/public/icons/`  | Discrete retina tab/bookmark size.                                         |
| `apple-touch-icon.png`        | 180x180   | `/public/icons/`  | iOS home-screen icon. Opaque background (iOS renders black behind alpha).  |

Until these files land, the corresponding `<link>` refs in `index.html` will
404 but browsers fall back gracefully to the SVG / .ico.

## Export tips

- Background: `#1B3A6B` (brand navy) or transparent for `any`-purpose icons.
- Maskable: solid background, logo centered at ~80% scale, no rounded
  corners (Android applies its own mask).
- Export as PNG-24 with no metadata to keep file size low.
- Run through `pngcrush` or `oxipng -o 4` before committing.

Until these files land, the manifest references will 404 and the install
prompt on Chrome will show a generic icon. Everything else (theme color,
standalone display, start URL) already works.

## Open Graph default image (Task 8.5)

`useDocumentTitle` writes per-page `og:image` + `twitter:image` meta tags
on every top-level route. Pages that don't carry a page-specific image
(Index, Products, Contact, About) fall back to `/og-default.png` at the
site root. ProductDetail passes its own product photo (front view) so
sharing a PDP link renders the actual garment instead of the generic
branded card.

| File             | Size     | Location     | Purpose                                                                    |
| ---------------- | -------- | ------------ | -------------------------------------------------------------------------- |
| `og-default.png` | 1200x630 | `/public/`   | Fallback Open Graph / Twitter-card preview image. Branded hero shot on navy background — appears when a non-PDP URL is shared to Facebook, Slack, LinkedIn, X, SMS link preview, etc. |

Facebook's scraper caches the image URL for ~30 days, so until this
file lands (or after it's replaced) existing shared links will keep
showing the previous crawl. Use the Facebook Sharing Debugger to force
a re-fetch. The meta tags themselves are already wired — visitors
inspecting `<head>` will see `og:image` pointing at this path as soon
as the route mounts.
