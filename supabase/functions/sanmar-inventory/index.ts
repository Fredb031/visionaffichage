/**
 * Edge function: sanmar-inventory
 *
 * Body: { productId: string }
 * Returns the per-part inventory array from the Inventory 2.0 service.
 */

import { handleCors } from '../_shared/cors.ts';
import { runSanmar, errorBody } from '../_shared/sanmar-http.ts';
// Phase 11: cache-aware dispatcher. Falls back to SOAP when the FastAPI
// cache is disabled or returns 404 / 5xx / timeout.
import { getInventory } from '../_shared/sanmar/router.ts';

interface RequestBody {
  productId: string;
}

Deno.serve(async (req) => {
  const pre = handleCors(req);
  if (pre) return pre;

  if (req.method !== 'POST') {
    return new Response(JSON.stringify(errorBody(140, 'Method not allowed')), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify(errorBody(140, 'Invalid JSON body')), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return runSanmar(async () => {
    if (!body.productId) {
      throw new Error('productId is required');
    }
    return await getInventory(body.productId);
  });
});
