/**
 * Static safety checks on the Razorpay migration SQL. These do NOT execute SQL;
 * they guard invariants a reviewer would otherwise check by eye. Executing the
 * migration against a disposable Postgres is still required (see delivery report).
 */
import fs from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";

const sql = fs.readFileSync(
  path.resolve("supabase/migrations/20261126120000_add_razorpay_payment_gateway_support.sql"),
  "utf8"
);

const functionBlocks = [...sql.matchAll(/CREATE OR REPLACE FUNCTION public\.(\w+)\(([\s\S]*?)\$\$;/g)].map((m) => ({
  name: m[1],
  body: m[0],
}));

describe("Razorpay migration (static)", () => {
  it("defines the expected RPCs and guard functions", () => {
    const names = functionBlocks.map((f) => f.name).sort();
    expect(names).toEqual(
      [
        "apply_payment_event",
        "claim_payment_notification",
        "claim_webhook_event",
        "create_payment_refund_intent",
        "forbid_audit_mutation",
        "forbid_financial_delete",
        "guard_payment_order_update",
        "guard_payment_refund_update",
        "guard_payment_transaction_update",
        "rebook_conflicted_consultation",
      ].sort()
    );
  });

  it("pins search_path on every function and never uses SECURITY DEFINER", () => {
    for (const f of functionBlocks) {
      expect(f.body, f.name).toContain("SET search_path = ''");
    }
    expect(sql).not.toMatch(/SECURITY\s+DEFINER/i);
  });

  it("revokes every function from browser roles and grants RPCs to service_role only", () => {
    for (const f of functionBlocks) {
      expect(sql, f.name).toMatch(new RegExp(`REVOKE ALL ON FUNCTION public\\.${f.name}\\([^)]*\\) FROM PUBLIC, anon, authenticated`));
    }
    for (const rpc of ["apply_payment_event", "claim_payment_notification", "claim_webhook_event", "create_payment_refund_intent", "rebook_conflicted_consultation"]) {
      expect(sql, rpc).toMatch(new RegExp(`GRANT EXECUTE ON FUNCTION public\\.${rpc}\\([^)]*\\) TO service_role`));
    }
    expect(sql).not.toMatch(/GRANT [^;]* TO (anon|authenticated)/);
  });

  it("enables RLS on every new table and revokes browser-role table access", () => {
    for (const table of ["payment_issues", "payment_notifications", "payment_audit_log"]) {
      expect(sql).toContain(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY`);
    }
    expect(sql).toMatch(/REVOKE ALL ON public\.payment_orders,[\s\S]*public\.payment_audit_log FROM anon, authenticated/);
    expect(sql).not.toMatch(/CREATE POLICY/i);
  });

  it("backfills historical rows as Cashfree and then requires an explicit provider", () => {
    for (const table of ["payment_orders", "payment_transactions", "payment_refunds"]) {
      expect(sql).toContain(`ALTER TABLE public.${table}\n    ADD COLUMN IF NOT EXISTS provider VARCHAR(20) NOT NULL DEFAULT 'cashfree';`);
      expect(sql).toContain(`ALTER TABLE public.${table} ALTER COLUMN provider DROP DEFAULT;`);
    }
  });

  it("never rewrites or deletes historical financial rows", () => {
    const code = sql.replace(/--.*$/gm, ""); // the header documents a manual rollback in comments
    expect(code).not.toMatch(/^\s*DELETE FROM/im);
    expect(code).not.toMatch(/UPDATE public\.payment_(orders|transactions|refunds)\s+SET\s+(amount_in_paise|gateway_order_id|gateway_payment_id|provider)/i);
    expect(code).not.toMatch(/DROP TABLE/i);
  });

  it("makes captured payments terminal and allows the documented failed -> captured order", () => {
    const guard = functionBlocks.find((f) => f.name === "guard_payment_transaction_update")!.body;
    expect(guard).toContain("(OLD.status = 'failed'       AND NEW.status = 'success')");
    expect(guard).not.toMatch(/OLD\.status = 'success'\s+AND/);
  });

  it("keeps paid + slot conflict as recovery (no automatic refund in the confirmation RPC)", () => {
    const apply = functionBlocks.find((f) => f.name === "apply_payment_event")!.body;
    expect(apply).toContain("slot_conflict_pending_reschedule");
    expect(apply).not.toMatch(/payment_refunds/);
  });

  it("checks the refundable balance under a row lock", () => {
    const refund = functionBlocks.find((f) => f.name === "create_payment_refund_intent")!.body;
    expect(refund).toMatch(/FROM public\.payment_orders WHERE id = p_payment_order_id FOR UPDATE/);
    expect(refund).toContain("REFUND_EXCEEDS_BALANCE");
    expect(refund).toContain("status <> 'failed'");
  });
});
