/**
 * Edge function: sanmar-force-refresh-style
 *
 * Operator-initiated single-style refresh. The daily cron jobs
 * (sanmar-sync-catalog Sunday, sanmar-sync-inventory daily) keep the
 * full catalogue fresh, but when an operator on /admin/sanmar spots a
 * SanMar price change or a stock surprise on a single style they want
 * the dashboard to reflect reality NOW — not at 06:00 tomorrow.
 *
 * This function refetches product metadata + inventory + pricing for
 * one style and upserts the rows back into `sanmar_catalog`. Auth gate
 * mirrors `admin-invite-vendor`: caller-scoped client validates the
 * Authorization JWT, then a SELECT on `profiles.role` ensures the user
 * is `admin` or `president`. CRON_SECRET is intentionally NOT required —
 * this is JWT-protected, not unattended.
 *
 * Rate-limit posture: capped by admin click frequency vs the unattended
 * sync. Three SOAP calls per click (product/inventory/pricing) is well
 * within the SanMar customer quota.
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { handleCors, jsonResponse } from '../_shared/cors.ts';
import { getProduct } from '../_shared/sanmar/products.ts';
import { getInventoryLevels } from '../_shared/sanmar/inventory.ts';
import { getPricing } from '../_shared/sanmar/pricing.ts';

interface RefreshBody {
  style_id?: string;
}

Deno.serve(async (req) => {
  const pre = handleCors(req);
  if (pre) return pre;

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'POST only' }, 405);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!supabaseUrl || !anonKey || !serviceKey) {
    console.error('[sanmar-force-refresh-style] Supabase env vars not configured');
    return jsonResponse({ error: 'Server misconfigured' }, 500);
  }

  // ── Auth gate (mirror admin-invite-vendor) ───────────────────────────────
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return jsonResponse({ error: 'Missing auth' }, 401);

  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userResult } = await callerClient.auth.getUser();
  const user = userResult?.user;
  if (!user) return jsonResponse({ error: 'Not authenticated' }, 401);

  const { data: profile } = await callerClient
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();
  if (!profile || (profile.role !== 'admin' && profile.role !== 'president')) {
    return jsonResponse({ error: 'Forbidden — admin role required' }, 403);
  }

  // ── Parse + validate body ────────────────────────────────────────────────
  let body: RefreshBody;
  try {
    body = (await req.json()) as RefreshBody;
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }
  const styleId = (body.style_id ?? '').trim();
  if (!styleId) {
    return jsonResponse({ error: 'style_id required' }, 400);
  }

  // ── Refetch from SanMar (product + inventory + pricing in parallel) ──────
  const adminClient = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    const [product, inventory, pricing] = await Promise.all([
      getProduct(styleId),
      getInventoryLevels(styleId),
      getPricing(styleId),
    ]);

    /** Map<partId, lowest-tier price> — same semantic as sanmar-sync-catalog. */
    const priceByPart = new Map<string, number>();
    {
      const grouped = new Map<string, { minQuantity: number; price: number }>();
      for (const r of pricing) {
        const cur = grouped.get(r.partId);
        if (!cur || r.minQuantity < cur.minQuantity) {
          grouped.set(r.partId, { minQuantity: r.minQuantity, price: r.price });
        }
      }
      for (const [pid, v] of grouped.entries()) {
        priceByPart.set(pid, v.price);
      }
    }

    /** Map<partId, inventory part> for fast lookup when assembling rows. */
    const invByPart = new Map(inventory.map((p) => [p.partId, p]));

    const nowIso = new Date().toISOString();
    const rows = product.parts
      .filter((part) => !!part.partId)
      .map((part) => {
        const inv = invByPart.get(part.partId);
        return {
          style_id: product.productId,
          part_id: part.partId,
          product_name: product.productName || null,
          brand: product.brand || null,
          category: product.category || null,
          color_name: part.colorName || null,
          size: part.size || null,
          price: priceByPart.get(part.partId) ?? null,
          quantity_available: inv?.totalQty ?? 0,
          quantity_by_warehouse: inv?.locations ?? null,
          is_active: true,
          last_synced_at: nowIso,
        };
      });

    if (rows.length === 0) {
      // No parts came back — refuse to wipe a real style on an empty payload.
      return jsonResponse(
        {
          error: 'SanMar returned no parts for this style',
          style_id: styleId,
        },
        404,
      );
    }

    const { error: upsertErr } = await adminClient
      .from('sanmar_catalog')
      .upsert(rows, { onConflict: 'part_id' });
    if (upsertErr) {
      console.error('[sanmar-force-refresh-style] upsert failed:', upsertErr);
      return jsonResponse(
        { error: `Upsert failed: ${upsertErr.message}` },
        500,
      );
    }

    return jsonResponse({
      success: true,
      style_id: styleId,
      parts_updated: rows.length,
      refreshed_at: nowIso,
      fields_updated: ['quantity_available', 'price_cad'],
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error('[sanmar-force-refresh-style] fatal:', e);
    return jsonResponse({ error: message }, 500);
  }
});
