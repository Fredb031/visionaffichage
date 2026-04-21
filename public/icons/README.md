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

## Apple touch icon

`index.html` references `/apple-touch-icon.png` (180x180, opaque background,
no transparency — iOS ignores the alpha channel and renders black behind it).
Drop that PNG directly in `/public/` (NOT in `/public/icons/`).

## Export tips

- Background: `#1B3A6B` (brand navy) or transparent for `any`-purpose icons.
- Maskable: solid background, logo centered at ~80% scale, no rounded
  corners (Android applies its own mask).
- Export as PNG-24 with no metadata to keep file size low.
- Run through `pngcrush` or `oxipng -o 4` before committing.

Until these files land, the manifest references will 404 and the install
prompt on Chrome will show a generic icon. Everything else (theme color,
standalone display, start URL) already works.
