/* eslint-disable no-console */
// Validate JSON-LD on the PDP. Spins http://localhost:3000/fr-ca/produits/<slug>,
// parses every <script type="application/ld+json">, asserts shape.

const URL = process.env.PDP_URL || 'http://localhost:3000/fr-ca/produits/atc1015-tshirt-pre-retreci';

async function main() {
  const res = await fetch(URL);
  if (!res.ok) {
    console.error(`Fetch failed: HTTP ${res.status} ${URL}`);
    process.exit(1);
  }
  const html = await res.text();

  const re = /<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g;
  const blocks = [];
  let m;
  while ((m = re.exec(html)) !== null) {
    const raw = m[1].trim();
    try {
      blocks.push(JSON.parse(raw));
    } catch (e) {
      console.error('Invalid JSON-LD block:', e.message);
      console.error('Raw:', raw.slice(0, 200));
      process.exit(1);
    }
  }

  if (blocks.length === 0) {
    console.error('No JSON-LD blocks found.');
    process.exit(1);
  }

  const findByType = (type) =>
    blocks.find((b) => b && b['@type'] === type);

  const errors = [];

  // Product
  const product = findByType('Product');
  if (!product) {
    errors.push('Missing @type=Product');
  } else {
    for (const k of ['name', 'image', 'description', 'sku', 'brand', 'offers']) {
      if (!product[k]) errors.push(`Product missing field: ${k}`);
    }
    if (product.offers) {
      for (const k of ['priceCurrency', 'price', 'availability']) {
        if (!product.offers[k]) errors.push(`Product.offers missing field: ${k}`);
      }
    }
  }

  // BreadcrumbList
  const bc = findByType('BreadcrumbList');
  if (!bc) {
    errors.push('Missing @type=BreadcrumbList');
  } else if (!Array.isArray(bc.itemListElement) || bc.itemListElement.length === 0) {
    errors.push('BreadcrumbList missing or empty itemListElement');
  }

  // FAQPage (if FAQ section exists in HTML)
  const hasFaqSection = /id="faq"|>FAQ</.test(html);
  if (hasFaqSection) {
    const faq = findByType('FAQPage');
    if (!faq) {
      errors.push('FAQ section detected in DOM but no @type=FAQPage JSON-LD');
    } else if (!Array.isArray(faq.mainEntity) || faq.mainEntity.length === 0) {
      errors.push('FAQPage missing or empty mainEntity');
    }
  }

  if (errors.length) {
    console.error('FAIL — JSON-LD validation errors:');
    for (const e of errors) console.error(' -', e);
    process.exit(1);
  }

  console.log(`OK — ${blocks.length} JSON-LD blocks found at ${URL}`);
  console.log(' -', blocks.map((b) => b['@type']).join(', '));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
