/**
 * Unit tests for the SanMar SOAP client (client.ts).
 *
 * Coverage:
 *   - xmlEscape() handles all 5 XML-significant characters
 *   - SOAP envelope wrapping (response shape only — no live calls)
 *   - ServiceMessage codes in {100,104,105,110,115,999} all throw
 *   - severity='Error' even with code 200 still throws
 *   - 30s timeout aborts the fetch and surfaces an AbortError
 *
 * These tests run in Vitest's Node env; Deno.env is shimmed below so the
 * imported module's getSanmarConfig() succeeds without a real Deno runtime.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Stub the Deno global before any module imports run getSanmarConfig().
beforeAll(() => {
  (globalThis as any).Deno = {
    env: {
      get: (k: string) => {
        const map: Record<string, string> = {
          SANMAR_CUSTOMER_ID: "test-customer",
          SANMAR_PASSWORD: "test-pw",
          SANMAR_MEDIA_PASSWORD: "test-media-pw",
          SANMAR_ENV: "UAT",
        };
        return map[k];
      },
    },
  };
});

// Dynamic import so the Deno shim is in place first.
async function loadClient() {
  return await import("../client.ts");
}

const FIXTURES = join(__dirname, "fixtures");
const readFixture = (name: string) => readFileSync(join(FIXTURES, name), "utf-8");

describe("client.xmlEscape", () => {
  it("escapes the five XML-significant characters", async () => {
    const { xmlEscape } = await loadClient();
    expect(xmlEscape("Smith & Sons")).toBe("Smith &amp; Sons");
    expect(xmlEscape("<tag>")).toBe("&lt;tag&gt;");
    expect(xmlEscape('say "hi"')).toBe("say &quot;hi&quot;");
    expect(xmlEscape("it's me")).toBe("it&apos;s me");
    expect(xmlEscape("a&b<c>d\"e'f")).toBe("a&amp;b&lt;c&gt;d&quot;e&apos;f");
  });

  it("treats null/undefined as empty string", async () => {
    const { xmlEscape } = await loadClient();
    expect(xmlEscape(null)).toBe("");
    expect(xmlEscape(undefined)).toBe("");
    expect(xmlEscape("plain text 123")).toBe("plain text 123");
  });
});

describe("client.soapCall — envelope shape (no network)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("POSTs a SOAP 1.1 envelope with text/xml content type", async () => {
    const { soapCall } = await loadClient();
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(readFixture("getProduct.NF0A529K.xml"), { status: 200 }),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await soapCall({
      endpoint: "test/endpoint.php",
      body: '<Foo xmlns="urn:test"><wsVersion>1.0</wsVersion></Foo>',
      parseResult: () => ({ ok: true }),
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("test/endpoint.php");
    expect((init.headers as Record<string, string>)["Content-Type"]).toMatch(/text\/xml/);
    expect((init.headers as Record<string, string>)["SOAPAction"]).toBeDefined();
    expect(init.body).toContain("<?xml");
    expect(init.body).toContain("<Envelope");
    expect(init.body).toContain("<Body>");
    expect(init.body).toContain("<Foo");
  });

  it("throws SanmarApiError on ServiceMessage code 100 (auth)", async () => {
    const { soapCall, SanmarApiError } = await loadClient();
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(readFixture("error.code100.xml"), { status: 200 }),
    ) as unknown as typeof fetch;

    await expect(
      soapCall({ endpoint: "x", body: "<X/>", parseResult: () => null }),
    ).rejects.toBeInstanceOf(SanmarApiError);
  });

  it("throws SanmarApiError on ServiceMessage code 999 (general)", async () => {
    const { soapCall, SanmarApiError } = await loadClient();
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(readFixture("error.code999.xml"), { status: 200 }),
    ) as unknown as typeof fetch;

    try {
      await soapCall({ endpoint: "x", body: "<X/>", parseResult: () => null });
      throw new Error("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(SanmarApiError);
      expect((e as InstanceType<typeof SanmarApiError>).code).toBe("999");
    }
  });

  it.each([100, 104, 105, 110, 115, 999])(
    "throws on ServiceMessage error code %i",
    async (code) => {
      const { soapCall, SanmarApiError } = await loadClient();
      const xml = `<?xml version="1.0"?><Envelope xmlns="http://schemas.xmlsoap.org/soap/envelope/"><Body><Resp><ServiceMessage><code>${code}</code><description>Synthetic</description><severity>Error</severity></ServiceMessage></Resp></Body></Envelope>`;
      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response(xml, { status: 200 }),
      ) as unknown as typeof fetch;

      await expect(
        soapCall({ endpoint: "x", body: "<X/>", parseResult: () => null }),
      ).rejects.toBeInstanceOf(SanmarApiError);
    },
  );

  it("throws when severity='Error' even if code is 200", async () => {
    const { soapCall, SanmarApiError } = await loadClient();
    const xml = `<?xml version="1.0"?><Envelope xmlns="http://schemas.xmlsoap.org/soap/envelope/"><Body><Resp><ServiceMessage><code>200</code><description>Soft fail</description><severity>Error</severity></ServiceMessage></Resp></Body></Envelope>`;
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(xml, { status: 200 }),
    ) as unknown as typeof fetch;

    await expect(
      soapCall({ endpoint: "x", body: "<X/>", parseResult: () => null }),
    ).rejects.toBeInstanceOf(SanmarApiError);
  });

  it("does NOT throw on Information severity with code 200", async () => {
    const { soapCall } = await loadClient();
    const xml = `<?xml version="1.0"?><Envelope xmlns="http://schemas.xmlsoap.org/soap/envelope/"><Body><Resp><ok>1</ok><ServiceMessage><code>200</code><description>OK</description><severity>Information</severity></ServiceMessage></Resp></Body></Envelope>`;
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(xml, { status: 200 }),
    ) as unknown as typeof fetch;

    const result = await soapCall({
      endpoint: "x",
      body: "<X/>",
      parseResult: () => "ok",
    });
    expect(result).toBe("ok");
  });

  it("aborts after the configured timeout", async () => {
    const { soapCall, SanmarApiError } = await loadClient();
    vi.useFakeTimers();

    // Fetch that never resolves but listens to AbortSignal.
    globalThis.fetch = vi.fn().mockImplementation((_url, init) => {
      return new Promise((_resolve, reject) => {
        const signal = (init as RequestInit | undefined)?.signal;
        signal?.addEventListener("abort", () => {
          const err = new Error("aborted") as Error & { name: string };
          err.name = "AbortError";
          reject(err);
        });
      });
    }) as unknown as typeof fetch;

    const promise = soapCall({
      endpoint: "x",
      body: "<X/>",
      parseResult: () => null,
      timeoutMs: 30_000,
    });
    // Prevent unhandled rejection warning while we tick the clock.
    promise.catch(() => {});

    await vi.advanceTimersByTimeAsync(30_001);

    await expect(promise).rejects.toBeInstanceOf(SanmarApiError);
    await expect(promise).rejects.toMatchObject({ code: "network" });
  });

  it("throws SanmarApiError(code='parse') when SanMar returns malformed XML", async () => {
    // SanMar's edge gateway has been observed to occasionally return a
    // truncated or corrupted XML body — usually under load or behind a
    // misbehaving proxy. fast-xml-parser raises a structured exception in
    // that case; the client must catch it and surface a typed error so
    // upstream callers can distinguish a parse failure from a SanMar
    // service error (which would carry a numeric code) or a network error
    // (code='network').
    const { soapCall, SanmarApiError } = await loadClient();
    // Garbage that fast-xml-parser cannot handle. Verified locally that
    // `new XMLParser().parse("<<<broken")` throws.
    const malformed = "<<<broken";
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(malformed, { status: 200 }),
    ) as unknown as typeof fetch;

    try {
      await soapCall({ endpoint: "x", body: "<X/>", parseResult: () => null });
      throw new Error("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(SanmarApiError);
      const err = e as InstanceType<typeof SanmarApiError>;
      expect(err.code).toBe("parse");
      expect(err.severity).toBe("Error");
      // Message includes the underlying parser error for debugging.
      expect(err.message).toMatch(/Failed to parse SanMar response/);
      // raw body snippet preserved for triage (capped at 500 chars).
      expect(typeof err.raw).toBe("string");
      expect((err.raw as string).length).toBeLessThanOrEqual(500);
    }
  });
});
