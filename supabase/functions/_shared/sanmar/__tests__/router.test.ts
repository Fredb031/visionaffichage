/**
 * Unit tests for router.ts — feature-flag aware dispatcher between the
 * FastAPI cache and the SOAP origin.
 *
 * Coverage:
 *   - SANMAR_CACHE_API_URL unset → SOAP, _source='soap'
 *   - set + route enabled + cache 200 → cache, _source='cache'
 *   - set + route enabled + cache 404 → SOAP fallback, _source='soap'
 *   - set + route DISABLED → cache never called
 *   - set + cache 5xx → warn + SOAP fallback
 *   - set + cache timeout → abort + SOAP fallback
 *   - inventory + pricing follow the same pattern (sanity)
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ── Env mock with per-test mutability ──────────────────────────────────────
const ENV_STATE: Record<string, string | undefined> = {
  SANMAR_CUSTOMER_ID: "test-customer",
  SANMAR_PASSWORD: "test-pw",
  SANMAR_ENV: "UAT",
};

(globalThis as any).Deno = {
  env: {
    get: (k: string) => ENV_STATE[k],
  },
};

function setEnv(patch: Record<string, string | undefined>) {
  for (const k of Object.keys(patch)) {
    ENV_STATE[k] = patch[k];
  }
}

function clearCacheEnv() {
  delete ENV_STATE.SANMAR_CACHE_API_URL;
  delete ENV_STATE.SANMAR_CACHE_ROUTES;
  delete ENV_STATE.SANMAR_CACHE_API_SECRET;
  delete ENV_STATE.SANMAR_CACHE_API_TIMEOUT_MS;
}

// ── SOAP module mocks ──────────────────────────────────────────────────────
// We mock the three service modules so the router tests don't have to wire
// up SOAP fixtures. Each mock returns a deterministic shape we can identify.

vi.mock("../products.ts", () => ({
  getProduct: vi.fn(async (productId: string) => ({
    productId,
    productName: "SOAP Product",
    description: "",
    brand: "B",
    category: "C",
    parts: [],
  })),
  getProductSellable: vi.fn(async () => []),
  getAllActiveParts: vi.fn(async () => []),
}));

vi.mock("../inventory.ts", () => ({
  getInventoryLevels: vi.fn(async (_productId: string) => [
    { partId: "X-1", color: "Red", size: "M", totalQty: 10, locations: [] },
  ]),
}));

vi.mock("../pricing.ts", () => ({
  getPricing: vi.fn(async (_productId: string) => [
    {
      partId: "X-1",
      minQuantity: 1,
      price: 9.99,
      priceUom: "EA",
      currency: "CAD",
      priceEffectiveDate: "2026-01-01",
      fobLocations: [1, 2, 4],
    },
  ]),
}));

async function loadRouter() {
  return await import("../router.ts");
}

async function loadProductsMock() {
  return await import("../products.ts");
}
async function loadInventoryMock() {
  return await import("../inventory.ts");
}
async function loadPricingMock() {
  return await import("../pricing.ts");
}

describe("router.getProduct — feature flag matrix", () => {
  beforeEach(() => {
    clearCacheEnv();
    vi.clearAllMocks();
    // Reset fetch mock between tests.
    globalThis.fetch = vi.fn() as unknown as typeof fetch;
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("falls through to SOAP when SANMAR_CACHE_API_URL is unset", async () => {
    const { getProduct } = await loadRouter();
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    const out = await getProduct("ATC1000");

    expect(out._source).toBe("soap");
    expect(fetchSpy).not.toHaveBeenCalled();
    const { getProduct: soapGet } = await loadProductsMock();
    expect(soapGet).toHaveBeenCalledWith("ATC1000", {});
  });

  it("returns cached body with _source='cache' when cache hits 200", async () => {
    setEnv({
      SANMAR_CACHE_API_URL: "https://cache.example.com",
      SANMAR_CACHE_ROUTES: "products,inventory,pricing",
    });
    const { getProduct } = await loadRouter();
    const cachedBody = { style: "ATC1000", title: "From Cache" };
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify(cachedBody), { status: 200 }),
      ) as unknown as typeof fetch;

    const out = await getProduct("ATC1000");
    expect(out._source).toBe("cache");
    expect((out as Record<string, unknown>).title).toBe("From Cache");

    const { getProduct: soapGet } = await loadProductsMock();
    expect(soapGet).not.toHaveBeenCalled();
  });

  it("falls back to SOAP with _source='soap' when cache 404s", async () => {
    setEnv({
      SANMAR_CACHE_API_URL: "https://cache.example.com",
      SANMAR_CACHE_ROUTES: "products",
    });
    const { getProduct } = await loadRouter();
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(new Response("nope", { status: 404 })) as unknown as typeof fetch;

    const out = await getProduct("MISSING");
    expect(out._source).toBe("soap");
    const { getProduct: soapGet } = await loadProductsMock();
    expect(soapGet).toHaveBeenCalledOnce();
  });

  it("skips cache entirely when route NOT in SANMAR_CACHE_ROUTES", async () => {
    setEnv({
      SANMAR_CACHE_API_URL: "https://cache.example.com",
      SANMAR_CACHE_ROUTES: "inventory,pricing", // products excluded
    });
    const { getProduct } = await loadRouter();
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    const out = await getProduct("ATC1000");
    expect(out._source).toBe("soap");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("logs warning + falls back to SOAP when cache 5xx", async () => {
    setEnv({
      SANMAR_CACHE_API_URL: "https://cache.example.com",
      SANMAR_CACHE_ROUTES: "products",
    });
    const { getProduct } = await loadRouter();
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(new Response("boom", { status: 503 })) as unknown as typeof fetch;

    const out = await getProduct("ATC1000");
    expect(out._source).toBe("soap");
    expect(warnSpy).toHaveBeenCalled();
    const warnMsg = (warnSpy.mock.calls[0] || []).join(" ");
    expect(warnMsg).toMatch(/cache miss/);
    expect(warnMsg).toMatch(/products/);
  });

  it("aborts on cache timeout + falls back to SOAP", async () => {
    setEnv({
      SANMAR_CACHE_API_URL: "https://cache.example.com",
      SANMAR_CACHE_ROUTES: "products",
      SANMAR_CACHE_API_TIMEOUT_MS: "50",
    });
    const { getProduct } = await loadRouter();
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    globalThis.fetch = vi.fn().mockImplementation((_url, init: RequestInit) => {
      return new Promise((_resolve, reject) => {
        const signal = init.signal;
        if (signal) {
          signal.addEventListener("abort", () => {
            const err = new Error("aborted");
            err.name = "AbortError";
            reject(err);
          });
        }
      });
    }) as unknown as typeof fetch;

    const out = await getProduct("ATC1000");
    expect(out._source).toBe("soap");
    expect(warnSpy).toHaveBeenCalled();
    const warnMsg = (warnSpy.mock.calls[0] || []).join(" ");
    expect(warnMsg).toMatch(/aborted/);
  });
});

describe("router.getInventory — same matrix, sanity", () => {
  beforeEach(() => {
    clearCacheEnv();
    vi.clearAllMocks();
    globalThis.fetch = vi.fn() as unknown as typeof fetch;
  });

  it("cache 200 → _source='cache'", async () => {
    setEnv({
      SANMAR_CACHE_API_URL: "https://cache.example.com",
      SANMAR_CACHE_ROUTES: "inventory",
    });
    const { getInventory } = await loadRouter();
    const cached = { style: "ATC1000", parts: [{ partId: "x" }] };
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify(cached), { status: 200 })) as unknown as typeof fetch;

    const out = await getInventory("ATC1000");
    expect((out as { _source: string })._source).toBe("cache");

    const { getInventoryLevels } = await loadInventoryMock();
    expect(getInventoryLevels).not.toHaveBeenCalled();
  });

  it("flag off → cache never called, _source='soap'", async () => {
    setEnv({
      SANMAR_CACHE_API_URL: "https://cache.example.com",
      SANMAR_CACHE_ROUTES: "products,pricing", // inventory excluded
    });
    const { getInventory } = await loadRouter();
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    const out = await getInventory("ATC1000");
    expect((out as unknown as { _source: string })._source).toBe("soap");
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("router.getPricing — same matrix, sanity", () => {
  beforeEach(() => {
    clearCacheEnv();
    vi.clearAllMocks();
    globalThis.fetch = vi.fn() as unknown as typeof fetch;
  });

  it("cache 404 → SOAP fallback", async () => {
    setEnv({
      SANMAR_CACHE_API_URL: "https://cache.example.com",
      SANMAR_CACHE_ROUTES: "pricing",
    });
    const { getPricing } = await loadRouter();
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(new Response("missing", { status: 404 })) as unknown as typeof fetch;

    const out = await getPricing("ATC1000");
    expect((out as unknown as { _source: string })._source).toBe("soap");
    const { getPricing: soapPricing } = await loadPricingMock();
    expect(soapPricing).toHaveBeenCalledOnce();
  });
});
