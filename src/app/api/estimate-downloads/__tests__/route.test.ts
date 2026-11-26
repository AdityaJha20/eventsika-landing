import { readFileSync } from "node:fs";
import path from "node:path";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { calculatePackageEstimate } from "@/lib/packages-config";
import { buildPackageEstimateSnapshot } from "@/lib/package-quote-summary";
import { ESTIMATE_DOWNLOAD_CONSENT_VERSION } from "@/lib/estimate-download-contact";
import { validateEstimateDownloadInput } from "@/lib/backend/validation/estimate-download-schema";

// --- Mocks: no real database, controllable rate limiter -----------------------
const db = vi.hoisted(() => ({ client: null as unknown }));
vi.mock("@/lib/backend/supabase/client", () => ({
  getSupabaseAdminClient: () => db.client,
  isSupabaseConfigured: () => Boolean(db.client),
}));

const rateLimitOverride = vi.hoisted(() => ({ value: null as null | Record<string, unknown> }));
vi.mock("@/lib/rate-limit", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/rate-limit")>();
  return {
    ...actual,
    checkRateLimit: async (...args: Parameters<typeof actual.checkRateLimit>) =>
      rateLimitOverride.value ?? actual.checkRateLimit(...args),
  };
});

import { POST } from "../route";

type Row = Record<string, unknown> & { id: string };
type DbError = { code: string; message: string; details?: string };

/** In-memory stand-in for the table, enforcing the unique idempotency key. */
function fakeClient(options: { insertError?: DbError } = {}) {
  const rows: Row[] = [];
  const inserts: Record<string, unknown>[] = [];
  const client = {
    rows,
    inserts,
    from(table: string) {
      if (table !== "estimate_download_leads") throw new Error(`unexpected table ${table}`);
      return {
        insert(row: Record<string, unknown>) {
          inserts.push(row);
          return {
            select: () => ({
              single: async () => {
                if (options.insertError) return { data: null, error: options.insertError };
                if (rows.some((r) => r.idempotency_key === row.idempotency_key)) {
                  return {
                    data: null,
                    error: {
                      code: "23505",
                      message: "duplicate key value violates unique constraint",
                      details: `Failing row contains (${String(row.contact_value)})`,
                    },
                  };
                }
                const saved = { ...row, id: `cap-${rows.length + 1}` };
                rows.push(saved);
                return { data: { id: saved.id }, error: null };
              },
            }),
          };
        },
        select: () => ({
          eq: (column: string, value: unknown) => ({
            single: async () => {
              const row = rows.find((r) => r[column] === value);
              return row ? { data: row, error: null } : { data: null, error: { code: "PGRST116", message: "none" } };
            },
          }),
        }),
      };
    },
  };
  return client;
}

const KEY = "3f2b8c1e-4d5a-4b6c-8d7e-9f0a1b2c3d4e";
const PHONE = "9876543210";
const EMAIL = "test.visitor@example.com";

const validBody = (overrides: Record<string, unknown> = {}) => ({
  contact: `+91 ${PHONE.slice(0, 5)} ${PHONE.slice(5)}`,
  packageTier: "premium",
  guestCount: 40,
  serviceIds: ["food", "photography"],
  consentToContact: true,
  consentTextVersion: ESTIMATE_DOWNLOAD_CONSENT_VERSION,
  idempotencyKey: KEY,
  ...overrides,
});

let ipCounter = 0;
function request(body: unknown, headers: Record<string, string> = {}) {
  ipCounter += 1;
  return new NextRequest("http://localhost:3000/api/estimate-downloads", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      host: "localhost:3000",
      origin: "http://localhost:3000",
      "sec-fetch-site": "same-origin",
      "x-real-ip": `203.0.113.${ipCounter % 250}`,
      ...headers,
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

let logs: string[] = [];
beforeEach(() => {
  logs = [];
  for (const method of ["log", "info", "warn", "error"] as const) {
    vi.spyOn(console, method).mockImplementation((...args: unknown[]) => {
      logs.push(args.map(String).join(" "));
    });
  }
  db.client = fakeClient();
  rateLimitOverride.value = null;
});
afterEach(() => vi.restoreAllMocks());

// ------------------------------------------------------------------------------

describe("validateEstimateDownloadInput", () => {
  it("normalizes the contact and calculates the estimate on the server", () => {
    const result = validateEstimateDownloadInput(validBody());
    expect(result.success).toBe(true);
    if (!result.success) return;
    const expected = calculatePackageEstimate(40, "premium", ["food", "photography"]);
    expect(result.data).toMatchObject({
      contactType: "phone",
      contactValue: PHONE,
      packageTier: "premium",
      guestCount: 40,
      serviceIds: ["food", "photography"],
      totalEstimateRupees: expected.total,
      snapshot: buildPackageEstimateSnapshot(expected),
    });
  });

  it("lowercases email from any provider", () => {
    const result = validateEstimateDownloadInput(validBody({ contact: "  Test.Visitor@Example.COM " }));
    expect(result.success && result.data).toMatchObject({ contactType: "email", contactValue: EMAIL });
  });

  it.each([
    ["missing consent", { consentToContact: undefined }],
    ["consent false", { consentToContact: false }],
    ["consent as string", { consentToContact: "true" }],
    ["stale consent version", { consentTextVersion: "old" }],
    ["invalid phone", { contact: "12345" }],
    ["invalid email", { contact: "name@" }],
    ["empty contact", { contact: "" }],
    ["unknown package", { packageTier: "gold" }],
    ["guest count below min", { guestCount: 9 }],
    ["guest count above max", { guestCount: 10001 }],
    ["guest count as string", { guestCount: "40" }],
    ["fractional guest count", { guestCount: 40.5 }],
    ["unknown service", { serviceIds: ["food", "fireworks"] }],
    ["duplicate services", { serviceIds: ["food", "food"] }],
    ["services not an array", { serviceIds: "food" }],
    ["malformed idempotency key", { idempotencyKey: "abc" }],
    ["client-sent total", { totalEstimateRupees: 1 }],
    ["client-sent snapshot", { estimateSnapshot: { totalEstimateRupees: 1 } }],
  ])("rejects %s", (_label, overrides) => {
    const body = validBody(overrides);
    for (const [key, value] of Object.entries(overrides)) if (value === undefined) delete (body as Record<string, unknown>)[key];
    expect(validateEstimateDownloadInput(body).success).toBe(false);
  });

  it("error messages never echo the contact value", () => {
    const result = validateEstimateDownloadInput(validBody({ contact: "98765@bad" }));
    expect(!result.success && result.error).not.toContain("98765");
  });
});

describe("POST /api/estimate-downloads", () => {
  it("stores a server-priced record and returns its id (201)", async () => {
    const res = await POST(request(validBody()));
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ success: true, captureId: "cap-1" });

    const client = db.client as ReturnType<typeof fakeClient>;
    const expected = calculatePackageEstimate(40, "premium", ["food", "photography"]);
    expect(client.rows).toHaveLength(1);
    const row = client.rows[0];
    expect(row).toMatchObject({
      contact_type: "phone",
      contact_value: PHONE,
      package_tier: "premium",
      guest_count: 40,
      selected_service_ids: ["food", "photography"],
      estimate_snapshot: buildPackageEstimateSnapshot(expected),
      total_estimate_rupees: expected.total,
      consent_to_contact: true,
      consent_text_version: ESTIMATE_DOWNLOAD_CONSENT_VERSION,
      idempotency_key: KEY,
    });
    expect(Number.isNaN(Date.parse(String(row.consented_at)))).toBe(false);
    // No IP address or user agent is stored.
    expect(Object.keys(row).sort()).toEqual(
      [
        "consent_text_version",
        "consent_to_contact",
        "consented_at",
        "contact_type",
        "contact_value",
        "estimate_snapshot",
        "guest_count",
        "id",
        "idempotency_key",
        "package_tier",
        "selected_service_ids",
        "total_estimate_rupees",
      ].sort(),
    );
  });

  it("repeated request with the same key returns the same record without a duplicate", async () => {
    const first = await POST(request(validBody()));
    const second = await POST(request(validBody()));
    expect(first.status).toBe(201);
    expect(second.status).toBe(200);
    expect((await second.json()).captureId).toBe("cap-1");
    expect((db.client as ReturnType<typeof fakeClient>).rows).toHaveLength(1);
  });

  it("concurrent duplicate submissions create one record", async () => {
    const responses = await Promise.all([POST(request(validBody())), POST(request(validBody()))]);
    const ids = await Promise.all(responses.map(async (r) => (await r.json()).captureId));
    expect(new Set(ids)).toEqual(new Set(["cap-1"]));
    expect((db.client as ReturnType<typeof fakeClient>).rows).toHaveLength(1);
  });

  it("same key with different data is rejected (409), not merged", async () => {
    await POST(request(validBody()));
    const res = await POST(request(validBody({ contact: EMAIL })));
    expect(res.status).toBe(409);
    expect((db.client as ReturnType<typeof fakeClient>).rows).toHaveLength(1);
  });

  it("invalid payloads are rejected before the database is touched", async () => {
    for (const body of [
      validBody({ consentToContact: false }),
      validBody({ packageTier: "gold" }),
      validBody({ guestCount: 5 }),
      validBody({ serviceIds: ["food", "food"] }),
      validBody({ idempotencyKey: "nope" }),
      "not json",
    ]) {
      const res = await POST(request(body));
      expect(res.status).toBe(400);
    }
    expect((db.client as ReturnType<typeof fakeClient>).inserts).toHaveLength(0);
  });

  it("returns 503 with no fallback when Supabase is not configured", async () => {
    db.client = null;
    const res = await POST(request(validBody()));
    expect(res.status).toBe(503);
    expect((await res.json()).success).toBe(false);
  });

  it("returns 500 on a database error", async () => {
    db.client = fakeClient({
      insertError: { code: "23514", message: "check violation", details: `Failing row contains (${PHONE})` },
    });
    const res = await POST(request(validBody()));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(JSON.stringify(body)).not.toContain(PHONE);
  });

  it("rejects cross-origin requests without touching the database", async () => {
    const res = await POST(request(validBody(), { origin: "https://evil.example", "sec-fetch-site": "cross-site" }));
    expect(res.status).toBe(403);
    expect((db.client as ReturnType<typeof fakeClient>).inserts).toHaveLength(0);
  });

  it("rate limits repeated requests from one client (429)", async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 11; i++) {
      const res = await POST(
        request(validBody({ idempotencyKey: `3f2b8c1e-4d5a-4b6c-8d7e-9f0a1b2c3d${String(i).padStart(2, "0")}` }), {
          "x-real-ip": "198.51.100.77",
        }),
      );
      statuses.push(res.status);
    }
    expect(statuses.slice(0, 10).every((s) => s === 201)).toBe(true);
    expect(statuses[10]).toBe(429);
  });

  it("fails closed (503) when the rate limiter is unavailable", async () => {
    rateLimitOverride.value = { isAllowed: false, isUnavailable: true, remaining: 0, retryAfterSeconds: 60 };
    const res = await POST(request(validBody()));
    expect(res.status).toBe(503);
    expect((db.client as ReturnType<typeof fakeClient>).inserts).toHaveLength(0);
  });

  it("rejects oversized payloads (413)", async () => {
    const res = await POST(request(validBody({ contact: "x".repeat(5000) })));
    expect(res.status).toBe(413);
  });

  it("never logs the contact value or client IP", async () => {
    await POST(request(validBody()));
    await POST(request(validBody({ contact: EMAIL, idempotencyKey: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee" })));
    await POST(request(validBody({ contact: EMAIL })));
    db.client = fakeClient({
      insertError: { code: "23514", message: `bad row ${PHONE}`, details: `Failing row contains (${PHONE})` },
    });
    await POST(request(validBody({ idempotencyKey: "bbbbbbbb-bbbb-4ccc-8ddd-eeeeeeeeeeee" })));
    db.client = null;
    await POST(request(validBody()));
    await POST(request(validBody(), { origin: "https://evil.example", "sec-fetch-site": "cross-site" }));

    expect(logs.length).toBeGreaterThan(0);
    const output = logs.join("\n");
    expect(output).not.toContain(PHONE);
    expect(output).not.toContain(EMAIL);
    expect(output).not.toMatch(/203\.0\.113\.|198\.51\.100\./);
  });
});

describe("migration security review", () => {
  const sql = readFileSync(
    path.resolve("supabase/migrations/20261126110500_create_estimate_download_leads.sql"),
    "utf8",
  );

  it("enables RLS, creates no policies and grants only SELECT/INSERT to service_role", () => {
    expect(sql).toMatch(/ALTER TABLE public\.estimate_download_leads ENABLE ROW LEVEL SECURITY;/);
    expect(sql).not.toMatch(/CREATE POLICY/i);
    for (const role of ["PUBLIC", "anon", "authenticated"]) {
      expect(sql).toContain(`REVOKE ALL ON TABLE public.estimate_download_leads FROM ${role};`);
    }
    const grants = sql.match(/^GRANT .*$/gm) ?? [];
    expect(grants).toEqual(["GRANT SELECT, INSERT ON TABLE public.estimate_download_leads TO service_role;"]);
  });

  it("has a unique idempotency key, consent and snapshot constraints, and no IP/user-agent columns", () => {
    expect(sql).toMatch(/UNIQUE \(idempotency_key\)/);
    expect(sql).toMatch(/CHECK \(consent_to_contact = TRUE\)/);
    expect(sql).toMatch(/estimate_snapshot -> 'totalEstimateRupees' = to_jsonb\(total_estimate_rupees\)/);
    expect(sql).not.toMatch(/\b(ip_address|client_ip|user_agent)\b/i);
  });
});
