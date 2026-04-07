"""
sync_images.py — Downloads product images from Google Drive → uploads to Supabase
"""
import os, re, json, sys, mimetypes
from pathlib import Path

# ── Validate environment ──────────────────────────────────────────────────────
SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("❌ ERROR: SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in GitHub Secrets")
    print(f"   SUPABASE_URL set: {'YES' if SUPABASE_URL else 'NO'}")
    print(f"   SUPABASE_SERVICE_KEY set: {'YES' if SUPABASE_KEY else 'NO'}")
    sys.exit(1)

print(f"✅ Supabase URL: {SUPABASE_URL[:40]}...")
print(f"✅ Supabase Key: {SUPABASE_KEY[:20]}...")

BUCKET           = "product-images"
PRODUCTS_TS_PATH = Path("src/data/products.ts")
TMP_DIR          = Path("/tmp/drive_images")

# ── Google Drive folder IDs ───────────────────────────────────────────────────
PRODUCT_FOLDERS = {
    "atcf2500": "1ug9KoBm1g7Qp3Bnd_M_N4zRxuA9v6ubB",
    "atcf2600": "1jmFEtlcRVC150Obn8r--UfcDUwYJmjdT",
    "atcf2400": "1R4-FbfD14uR183s1pmy3DPv8T2PbG-xo",
    "atcy2500": "1PaJPHsNtVtLFtycqw0wk2jhs64fddIVj",
    "atc1000":  "1F-SJonFdlNOpJhUYTQwh7IsTgnkxFWYN",
    "atc1000l": "1T66Vj6T5pkWBIODlUeGSEcgFOmkeIOtl",
    "atc1000y": "1BDFkbuG6Gkekq1X7zXn8eSogKPoeYnoJ",
    "atc1015":  "1nR18fqIK_UKcjnAGLXXcz2H8wZNQVPts",
    "werk250":  "1H5OzaLv5vtz5NauuzMCuKJheAgaGbWdv",
    "s445":     "1Jov-de_OCnewGWTGQ2OG-f0BC9OyZfCI",
    "l445":     "11xHvIC0Yb7uBmsNvxOfaefuyFQeUskvv",
    "s445ls":   "13O98yPR4H0WPhN_idBgcIEQbhnPnzVWq",
    "s350":     "1JVPzWj7W9cgbUWTgEIlnr1SxIprMUxYK",
    "l350":     "1mGCBVFodq1X6AAJk20Tb2lI_4xoCCGQB",
    "y350":     "1E9d5s06mGeWBAFbbmZqsVDrndjdjc3v2",
    "atc6606":  "1TK15w47LhRwJivHH7smGF5sBT5NiHgle",
    "6245cm":   "1BBH-wTBosry8_DP627MF-A3ylQYDz-nJ",
    "atc6277":  "1MoaY_HMKQLU6VTs2IHqSjhk7EGQULHBo",
    "c100":     "13rOMQ2KSG7P9p1iMM9ufX3LQdwrnh-Nm",
    "c105":     "1MiQiq0k5epzTK9pIev6ug6xXQ7X7zV3u",
}

# ── Colour name normalisation ─────────────────────────────────────────────────
COLOR_MAP = {
    "black":"black","noir":"black",
    "white":"white","blanc":"white",
    "navy":"navy","marine":"navy",
    "steel grey":"steel-grey","steel-grey":"steel-grey","gris acier":"steel-grey",
    "dark heather":"dark-heather","dark heather grey":"dark-heather","dark hthr":"dark-heather",
    "light heather":"light-heather","ath hthr":"athletic-heather","athletic heather":"athletic-heather",
    "red":"red","rouge":"red","true red":"true-red",
    "true royal":"true-royal","royal":"true-royal","bleu royal":"true-royal",
    "forest green":"forest-green","forest":"forest-green","vert foret":"forest-green",
    "burgundy":"burgundy","bourgogne":"burgundy",
    "purple":"purple","mauve":"purple",
    "gold":"gold","or":"gold",
    "charcoal":"charcoal","charbon":"charcoal","carbon":"charcoal",
    "military green":"military-green","vert militaire":"military-green",
    "cardinal":"cardinal","orange":"orange",
    "maroon":"maroon","bordeaux":"maroon",
    "khaki":"khaki","kaki":"khaki",
    "natural":"natural","naturel":"natural",
    "grey":"grey","gray":"grey","gris":"grey",
    "lime shock":"lime-shock","vert lime":"lime-shock",
    "light blue":"light-blue","bleu pale":"light-blue",
    "black heather":"black-heather",
    "heather grey":"heather-grey","hthr grey":"heather-grey",
    "dark red":"dark-red",
}

FRONT_KW = ["front","devant","avant"]
BACK_KW  = ["back","dos","arriere","arrière","rear"]

def parse_filename(name: str):
    stem = Path(name).stem.lower()
    # Remove product SKU prefix
    for sku in sorted(PRODUCT_FOLDERS.keys(), key=len, reverse=True):
        stem = re.sub(rf"\b{re.escape(sku)}\b", "", stem)
    stem = re.sub(r"[_\-]+", " ", stem).strip()

    view = None
    for kw in FRONT_KW:
        if kw in stem:
            view = "front"
            stem = stem.replace(kw, "").strip()
            break
    if not view:
        for kw in BACK_KW:
            if kw in stem:
                view = "back"
                stem = stem.replace(kw, "").strip()
                break

    stem = re.sub(r"\s+", " ", stem).strip()
    color_id = COLOR_MAP.get(stem, stem.replace(" ", "-") if stem else "unknown")
    return color_id, view

def download_folder(folder_id: str, dest: Path):
    import gdown
    dest.mkdir(parents=True, exist_ok=True)
    url = f"https://drive.google.com/drive/folders/{folder_id}"
    print(f"    Downloading from: {url}")
    try:
        result = gdown.download_folder(
            url, output=str(dest),
            quiet=False, use_cookies=False,
            remaining_ok=True
        )
        print(f"    gdown result: {result}")
    except Exception as e:
        print(f"    ⚠️ gdown error: {type(e).__name__}: {e}")

    exts = {".jpg", ".jpeg", ".png", ".webp"}
    found = [f for f in dest.rglob("*") if f.suffix.lower() in exts]
    print(f"    Found {len(found)} image files")
    return found

def upload_to_supabase(client, local: Path, storage_path: str) -> str:
    mime = mimetypes.guess_type(str(local))[0] or "image/jpeg"
    with open(local, "rb") as f:
        data = f.read()
    client.storage.from_(BUCKET).upload(
        storage_path, data,
        file_options={"content-type": mime, "upsert": "true"}
    )
    return client.storage.from_(BUCKET).get_public_url(storage_path)

def patch_products_ts(url_map: dict):
    """Add real imageDevant/imageDos URLs to each color in products.ts"""
    if not PRODUCTS_TS_PATH.exists():
        print(f"⚠️ {PRODUCTS_TS_PATH} not found, skipping patch")
        return

    content = PRODUCTS_TS_PATH.read_text(encoding="utf-8")
    patches = 0

    for product_id, colors in url_map.items():
        for color_id, views in colors.items():
            front = views.get("front", "")
            back  = views.get("back",  "")
            if not front:
                continue

            # Match: { id: 'black', name: ... and inject imageDevant/imageDos
            pattern = rf"(\{{\s*id:\s*['\"]){re.escape(color_id)}(['\"][^}}]*?)(\}},?)"

            def make_replacement(f=front, b=back):
                def replacer(m):
                    block = m.group(0)
                    # Remove existing image fields if present
                    block = re.sub(r",?\s*imageDevant:\s*`[^`]*`", "", block)
                    block = re.sub(r",?\s*imageDos:\s*`[^`]*`", "", block)
                    block = re.sub(r",?\s*imageDevant:\s*'[^']*'", "", block)
                    block = re.sub(r",?\s*imageDos:\s*'[^']*'", "", block)
                    # Find closing brace and insert before it
                    inject = f"\n    imageDevant: '{f}',"
                    if b:
                        inject += f"\n    imageDos: '{b}',"
                    block = re.sub(r"(\s*\},?)\s*$", inject + r"\1", block)
                    return block
                return replacer

            new_content = re.sub(pattern, make_replacement(), content, count=1, flags=re.DOTALL)
            if new_content != content:
                content = new_content
                patches += 1

    PRODUCTS_TS_PATH.write_text(content, encoding="utf-8")
    print(f"✅ products.ts patched — {patches} colors updated with real image URLs")

def main():
    from supabase import create_client

    print("\n🔗 Connecting to Supabase...")
    try:
        client = create_client(SUPABASE_URL, SUPABASE_KEY)
        print("✅ Supabase connected")
    except Exception as e:
        print(f"❌ Supabase connection failed: {e}")
        sys.exit(1)

    # Create bucket
    try:
        client.storage.create_bucket(BUCKET, options={"public": True})
        print(f"✅ Bucket '{BUCKET}' created")
    except Exception as e:
        print(f"ℹ️  Bucket '{BUCKET}': {e}")

    url_map = {}
    total_ok = 0
    total_err = 0

    for product_id, folder_id in PRODUCT_FOLDERS.items():
        print(f"\n📦 {product_id.upper()}")
        dest = TMP_DIR / product_id
        images = download_folder(folder_id, dest)

        if not images:
            print(f"  ⚠️ No images downloaded — skipping")
            continue

        url_map[product_id] = {}

        for img in sorted(images):
            color_id, view = parse_filename(img.name)
            if color_id not in url_map[product_id]:
                url_map[product_id][color_id] = {}

            storage_path = f"{product_id}/{color_id}-{view or 'unknown'}{img.suffix.lower()}"
            try:
                url = upload_to_supabase(client, img, storage_path)
                url_map[product_id][color_id][view or "unknown"] = url
                print(f"  ✅ {img.name} → {color_id} / {view}")
                total_ok += 1
            except Exception as e:
                print(f"  ❌ {img.name}: {e}")
                total_err += 1

    # Save JSON
    with open("products_images.json", "w") as f:
        json.dump(url_map, f, indent=2)
    print(f"\n📄 products_images.json saved")

    # Patch products.ts
    if url_map:
        patch_products_ts(url_map)
    else:
        print("\n⚠️ No images were downloaded — check that your Google Drive folder is public")
        print("   Go to: drive.google.com → your folder → Share → Anyone with the link → Viewer")

    print(f"\n{'='*50}")
    print(f"{'✅' if total_ok > 0 else '⚠️'} Done: {total_ok} uploaded, {total_err} errors")

    if total_ok == 0:
        print("\n❌ No images were uploaded. Possible reasons:")
        print("   1. Google Drive folder is not public")
        print("   2. gdown could not access the folder")
        print("   3. No image files found in the folders")
        sys.exit(1)

if __name__ == "__main__":
    main()
