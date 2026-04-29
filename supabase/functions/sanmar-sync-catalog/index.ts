/**
 * Edge function: sanmar-sync-catalog
 *
 * Full SanMar catalogue rebuild. Triggered either by pg_cron (Step 6) or
 * by the AdminSanMar "Synchroniser maintenant" button (Step 4). Authenticated
 * via the shared `x-cron-secret` header — there is no per-user JWT involved.
 *
 * Pipeline:
 *   1. getProductSellable('ACTIVE') → list of all sellable style+color+size combos
 *   2. For each unique styleId (concurrency 4): getProduct(styleId)
 *   3. For each unique styleId (concurrency 4): getPricing(styleId)
 *   4. For each unique styleId (concurrency 4): getProductImages(styleId)
 *   5. Assemble per-part rows merging metadata + price + images
 *   6. Upsert into public.sanmar_catalog (onConflict: 'part_id')
 *      Then mark anything not touched in this run (last_synced_at < startOfRun)
 *      as is_active = false — cheap and safe soft-delete.
 *   7. Insert sanmar_sync_log row with totals + duration + errors.
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { handleCors, jsonResponse } from '../_shared/cors.ts';
import { errorBody } from '../_shared/sanmar-http.ts';
import { getProduct, getProductSellable } from '../_shared/sanmar/products.ts';
import { getPricing } from '../_shared/sanmar/pricing.ts';
import { getProductImages } from '../_shared/sanmar/media.ts';
import {
  CronAuthError,
  logSyncRun,
  requireCronSecret,
  simplePool,
  summariseError,
} from '../_shared/sanmar/sync.ts';

interface CatalogRow {
  style_id: string;
  part_id: string;
  product_name: string | null;
  brand: string | null;
  category: string | null;
  color_name: string | null;
  size: string | null;
  price: number | null;
  image_urls: string[] | null;
  is_active: true;
  last_synced_at: string;
}

const CONCURRENCY = 4;

Deno.serve(async (req) => {
  const pre = handleCors(req);
  if (pre) return pre;

  if (req.method !== 'POST') {
    return new Response(JSON.stringify(errorBody(140, 'Method not allowed')), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // ── Cron secret gate ──────────────────────────────────────────────────
  try {
    requireCronSecret(req);
  } catch (e) {
    if (e instanceof CronAuthError) {
      return jsonResponse(errorBody(300, e.message, 'Error'), 401);
    }
    throw e;
  }

  // ── Supabase admin client ─────────────────────────────────────────────
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!supabaseUrl || !serviceKey) {
    console.error('[sanmar-sync-catalog] Supabase env vars not configured');
    return jsonResponse(errorBody(999, 'Internal error', 'Error'), 500);
  }
  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const startedAtMs = Date.now();
  const startOfRunIso = new Date(startedAtMs).toISOString();
  const errors: Array<{ item: unknown; message: string }> = [];

  try {
    // ── Step 1: pull every sellable part (style+color+size) ─────────────
    const sellable = await getProductSellable('ACTIVE');
    const activeEntries = sellable.filter((s) => !s.discontinued);
    const styleIds = Array.from(new Set(activeEntries.map((s) => s.styleId))).filter(Boolean);

    // ── Step 2: getProduct for each style (parts metadata) ──────────────
    const productPool = await simplePool(styleIds, CONCURRENCY, (s) => getProduct(s));
    productPool.errors.forEach(({ item, error }) =>
      errors.push(summariseError({ phase: 'getProduct', styleId: item }, error)),
    );
    const productByStyle = new Map(productPool.ok.map((p) => [p.productId, p]));

    // ── Step 3: getPricing for each style ────────────────────────────────
    const pricingPool = await simplePool(styleIds, CONCURRENCY, async (s) => ({
      styleId: s,
      rows: await getPricing(s),
    }));
    pricingPool.errors.forEach(({ item, error }) =>
      errors.push(summariseError({ phase: 'getPricing', styleId: item }, error)),
    );
    /** Map<partId, lowest-tier price> — we use the minQuantity=1 (or
     * smallest minQuantity) row per part as the storefront sticker price. */
    const priceByPart = new Map<string, number>();
    for (const { rows } of pricingPool.ok) {
      // Group rows by partId, keep the row with the smallest minQuantity.
      const grouped = new Map<string, { minQuantity: number; price: number }>();
      for (const r of rows) {
        const cur = grouped.get(r.partId);
        if (!cur || r.minQuantity < cur.minQuantity) {
          grouped.set(r.partId, { minQuantity: r.minQuantity, price: r.price });
        }
      }
      for (const [pid, v] of grouped.entries()) {
        priceByPart.set(pid, v.price);
      }
    }

    // ── Step 4: getProductImages for each style ──────────────────────────
    const imagesPool = await simplePool(styleIds, CONCURRENCY, async (s) => ({
      styleId: s,
      media: await getProductImages(s),
    }));
    imagesPool.errors.forEach(({ item, error }) =>
      errors.push(summariseError({ phase: 'getProductImages', styleId: item }, error)),
    );
    const imagesByStyle = new Map(imagesPool.ok.map((i) => [i.styleId, i.media.urls]));

    // ── Step 5: assemble rows ────────────────────────────────────────────
    const rows: CatalogRow[] = [];
    for (const product of productByStyle.values()) {
      const styleImages = imagesByStyle.get(product.productId) ?? null;
      for (const part of product.parts) {
        if (!part.partId) continue;
        rows.push({
          style_id: product.productId,
          part_id: part.partId,
          product_name: product.productName || null,
          brand: product.brand || null,
          category: product.category || null,
          color_name: part.colorName || null,
          size: part.size || null,
          price: priceByPart.get(part.partId) ?? null,
          image_urls: styleImages && styleImages.length ? styleImages : null,
          is_active: true,
          last_synced_at: new Date().toISOString(),
        });
      }
    }

    // ── Step 6: upsert in chunks (Supabase rejects very large payloads) ──
    const CHUNK = 500;
    for (let i = 0; i < rows.length; i += CHUNK) {
      const chunk = rows.slice(i, i + CHUNK);
      const { error: upsertErr } = await supabase
        .from('sanmar_catalog')
        .upsert(chunk, { onConflict: 'part_id' });
      if (upsertErr) {
        errors.push(summariseError({ phase: 'upsert', chunkStart: i, chunkSize: chunk.length }, upsertErr));
      }
    }

    // Mark stale rows inactive — anything we didn't touch this run.
    const { error: deactivateErr } = await supabase
      .from('sanmar_catalog')
      .update({ is_active: false })
      .lt('last_synced_at', startOfRunIso);
    if (deactivateErr) {
      errors.push(summariseError({ phase: 'deactivate-stale' }, deactivateErr));
    }

    const durationMs = Date.now() - startedAtMs;

    // ── Step 7: log the run ──────────────────────────────────────────────
    await logSyncRun(supabase, 'catalog', {
      totalProcessed: rows.length,
      errors,
      durationMs,
    });

    return jsonResponse({
      ok: true,
      totalStyles: styleIds.length,
      totalParts: rows.length,
      errorCount: errors.length,
      durationMs,
    });
  } catch (e) {
    const durationMs = Date.now() - startedAtMs;
    errors.push(summariseError({ phase: 'fatal' }, e));
    // Best-effort log even on fatal failure so an operator sees the run.
    await logSyncRun(supabase, 'catalog', {
      totalProcessed: 0,
      errors,
      durationMs,
    });
    console.error('[sanmar-sync-catalog] fatal error:', e);
    return jsonResponse(
      {
        ok: false,
        totalStyles: 0,
        totalParts: 0,
        errorCount: errors.length,
        durationMs,
        message: e instanceof Error ? e.message : String(e),
      },
      500,
    );
  }
});
