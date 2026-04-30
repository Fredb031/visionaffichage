/**
 * Unit tests for cache_api.ts — the FastAPI cache HTTP client.
 *
 * Coverage:
 *   - 200 returns parsed body
 *   - 404 returns null (caller falls back to SOAP)
 *   - 5xx throws (caller logs + falls back)
 *   - timeout aborts with a clear error message
 *   - cron_secret is forwarded as `Authorization: Bearer <token>`
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

beforeAll(() => {
  // Deno.env shim — cache_api.ts itself doesn't read env, but other
  // modules under test do, and the products.ts client does at import.
  (globalThis as any).Deno = {
    env: {
      get: (k: string) => {
        const map: Record<string, string> = {
          SANMAR_CUSTOMER_ID: "test-customer",
          SANMAR_PASSWORD: "test-pw",
          SANMAR_ENV: "UAT",
        };
        return map[k];
      },
    },
  };
});

async function loadCacheApi() {
  return await import("../cache_api.ts");
}

describe("cache_api.fetchProductFromCache", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("200 returns parsed body", async () => {
    const { fetchProductFromCache } = await loadCacheApi();
    const payload = { style: "ATC1000", title: "Test Tee", variants: [] };
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(payload), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    ) as unknown as typeof fetch;

    const out = await fetchProductFromCache(
      { baseUrl: "https://cache.example.com" },
      "ATC1000",
    );
    expect(out).toEqual(payload);

    // URL is built with /products/{style} and trailing-slash-tolerant.
    const calls = (globalThis.fetch as unknown as { mock: { calls: any[][] } }).mock.calls;
    expect(calls[0][0]).toBe("https://cache.example.com/products/ATC1000");
  });

  it("strips trailing slash from baseUrl", async () => {
    const { fetchProductFromCache } = await loadCacheApi();
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ style: "X" }), { status: 200 }),
    ) as unknown as typeof fetch;

    await fetchProductFromCache(
      { baseUrl: "https://cache.example.com/" },
      "X",
    );
    const calls = (globalThis.fetch as unknown as { mock: { calls: any[][] } }).mock.calls;
    expect(calls[0][0]).toBe("https://cache.example.com/products/X");
  });

  it("404 returns null (cache miss)", async () => {
    const { fetchProductFromCache } = await loadCacheApi();
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response("not found", { status: 404 }),
    ) as unknown as typeof fetch;

    const out = await fetchProductFromCache(
      { baseUrl: "https://cache.example.com" },
      "MISSING",
    );
    expect(out).toBeNull();
  });

  it("5xx throws", async () => {
    const { fetchProductFromCache } = await loadCacheApi();
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response("oops", { status: 503 }),
    ) as unknown as typeof fetch;

    await expect(
      fetchProductFromCache({ baseUrl: "https://cache.example.com" }, "X"),
    ).rejects.toThrow(/upstream 503/);
  });

  it("timeout aborts after configured ms", async () => {
    const { fetchProductFromCache } = await loadCacheApi();
    // Mock fetch to reject with an AbortError when the signal fires.
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

    await expect(
      fetchProductFromCache(
        { baseUrl: "https://cache.example.com", timeout_ms: 50 },
        "X",
      ),
    ).rejects.toThrow(/aborted after 50ms/);
  });

  it("forwards cron_secret as Authorization: Bearer", async () => {
    const { fetchInventoryFromCache } = await loadCacheApi();
    const seen: Record<string, string> = {};
    globalThis.fetch = vi.fn().mockImplementation((_url, init: RequestInit) => {
      const headers = new Headers(init.headers);
      headers.forEach((v, k) => {
        seen[k.toLowerCase()] = v;
      });
      return Promise.resolve(new Response(JSON.stringify({ style: "X" }), { status: 200 }));
    }) as unknown as typeof fetch;

    await fetchInventoryFromCache(
      { baseUrl: "https://cache.example.com", cron_secret: "shh" },
      "X",
    );
    expect(seen["authorization"]).toBe("Bearer shh");
  });

  it("network error throws with descriptive message", async () => {
    const { fetchPricingFromCache } = await loadCacheApi();
    globalThis.fetch = vi
      .fn()
      .mockRejectedValue(new Error("ECONNREFUSED")) as unknown as typeof fetch;

    await expect(
      fetchPricingFromCache({ baseUrl: "https://cache.example.com" }, "X"),
    ).rejects.toThrow(/network error.*ECONNREFUSED/);
  });
});
