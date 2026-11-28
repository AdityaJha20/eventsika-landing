"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import type { AdminPaymentOverview, AdminPaymentRow } from "@/lib/backend/services/admin-payment-service";
import styles from "./payments.module.css";

const REFUND_REASONS = [
  { value: "customer_cancellation", label: "Customer cancellation (≥2h before start)" },
  { value: "eventsika_cancellation_alternative_rejected", label: "Eventsika cancelled, alternative rejected" },
  { value: "duplicate_payment", label: "Duplicate payment" },
  { value: "goodwill", label: "Goodwill (explicit amount)" },
];

function inr(paise: number): string {
  return `₹${(paise / 100).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
}

function ist(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

function newRequestKey(): string {
  return crypto.randomUUID().replace(/-/g, "");
}

async function postJson(url: string, body: unknown): Promise<{ ok: boolean; message: string }> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = (await res.json().catch(() => ({}))) as { message?: string };
    return { ok: res.ok, message: json.message ?? (res.ok ? "Done." : `Request failed (${res.status}).`) };
  } catch {
    return { ok: false, message: "Network error. Nothing was changed; please retry." };
  }
}

function RefundForm({ row, onDone }: { row: AdminPaymentRow; onDone: (msg: string) => void }) {
  const [reason, setReason] = useState(REFUND_REASONS[0].value);
  const [note, setNote] = useState("");
  const [amount, setAmount] = useState("");
  // One key per form instance: a double submit maps to the same refund.
  const [requestKey] = useState(newRequestKey);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const rupees = amount.trim() ? Number(amount) : null;
    if (rupees !== null && (!Number.isFinite(rupees) || rupees <= 0)) {
      onDone("Enter a positive amount or leave it empty for the full remaining balance.");
      return;
    }
    if (!window.confirm(`Refund ${rupees === null ? inr(row.refundableInPaise) : `₹${rupees}`} for ${row.customerName}?`)) return;
    setBusy(true);
    const result = await postJson("/api/admin/payments/refunds", {
      paymentOrderId: row.orderId,
      reason,
      note,
      clientRequestKey: requestKey,
      amountInPaise: rupees === null ? undefined : Math.round(rupees * 100),
    });
    setBusy(false);
    onDone(result.message);
  };

  return (
    <form className={styles.refundForm} onSubmit={submit}>
      <select value={reason} onChange={(e) => setReason(e.target.value)} aria-label="Refund reason">
        {REFUND_REASONS.map((r) => (
          <option key={r.value} value={r.value}>
            {r.label}
          </option>
        ))}
      </select>
      <input
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        placeholder={`Amount ₹ (max ${inr(row.refundableInPaise)})`}
        inputMode="decimal"
        aria-label="Refund amount in rupees"
      />
      <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Reason note (required)" minLength={5} maxLength={300} required aria-label="Refund note" />
      <button type="submit" disabled={busy}>
        {busy ? "Submitting…" : "Request refund"}
      </button>
    </form>
  );
}

export function PaymentsWorkspace({ data, canManageFinance }: { data: AdminPaymentOverview; canManageFinance: boolean }) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [openRefund, setOpenRefund] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const done = (msg: string) => {
    setMessage(msg);
    setOpenRefund(null);
    router.refresh();
  };

  const reconcile = async () => {
    setBusy(true);
    const r = await postJson("/api/admin/payments/reconcile", {});
    setBusy(false);
    done(r.ok ? "Reconciliation finished. Review open issues below." : r.message);
  };

  const resolveIssue = async (issueId: string) => {
    const note = window.prompt("Resolution note (what was done and why):");
    if (!note) return;
    const r = await postJson("/api/admin/payments/issues/resolve", { issueId, note });
    done(r.message);
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Payments</h1>
          <p className={styles.subtitle}>
            Payment attempts, refunds and reconciliation cases. Paid status comes only from verified provider events.
          </p>
        </div>
        {canManageFinance ? (
          <button className={styles.primary} onClick={reconcile} disabled={busy}>
            {busy ? "Reconciling…" : "Run reconciliation"}
          </button>
        ) : (
          <p className={styles.muted}>Read-only: refunds and reconciliation need finance administrator access.</p>
        )}
      </header>

      {message && (
        <p className={styles.notice} role="status">
          {message}
        </p>
      )}

      <section aria-labelledby="issues-heading">
        <h2 id="issues-heading" className={styles.sectionTitle}>
          Open issues ({data.openIssues.length}){data.failedNotifications > 0 && ` · ${data.failedNotifications} undelivered notifications`}
        </h2>
        {data.openIssues.length === 0 ? (
          <p className={styles.muted}>No open payment issues.</p>
        ) : (
          <ul className={styles.issueList}>
            {data.openIssues.map((issue) => (
              <li key={issue.id} className={styles.issue}>
                <strong>{issue.kind.replace(/_/g, " ")}</strong> · {issue.provider} · {ist(issue.createdAt)}
                <div className={styles.muted}>{issue.detail}</div>
                {issue.gatewayReference && <code>{issue.gatewayReference}</code>}
                {canManageFinance && (
                  <button className={styles.link} onClick={() => resolveIssue(issue.id)}>
                    Resolve
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="payments-heading">
        <h2 id="payments-heading" className={styles.sectionTitle}>
          Recent payment orders
        </h2>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Created</th>
                <th>Customer</th>
                <th>Consultation</th>
                <th>Payment</th>
                <th>Attempts</th>
                <th>Refunds</th>
                {canManageFinance && <th />}
              </tr>
            </thead>
            <tbody>
              {data.payments.map((row) => (
                <React.Fragment key={row.orderId}>
                  <tr>
                    <td>{ist(row.createdAt)}</td>
                    <td>
                      {row.customerName}
                      <div className={styles.muted}>{row.customerEmail}</div>
                    </td>
                    <td>
                      {row.consultationStatus.replace(/_/g, " ")}
                      <div className={styles.muted}>{ist(row.slotStartTime)}</div>
                    </td>
                    <td>
                      <span className={styles.badge} data-status={row.orderStatus}>
                        {row.orderStatus}
                      </span>{" "}
                      {inr(row.amountInPaise)}
                      <div className={styles.muted}>
                        {row.provider} · {row.receipt ?? row.gatewayOrderId ?? "—"}
                      </div>
                    </td>
                    <td>
                      {row.transactions.length === 0
                        ? "—"
                        : row.transactions.map((t) => (
                            <div key={t.id} className={styles.muted}>
                              {t.status} · {t.method ?? "?"} · {t.gatewayPaymentId ?? "no id"}
                            </div>
                          ))}
                    </td>
                    <td>
                      {row.refunds.length === 0
                        ? "—"
                        : row.refunds.map((r) => (
                            <div key={r.id} className={styles.muted}>
                              {r.status} · {inr(r.amountInPaise)}
                            </div>
                          ))}
                    </td>
                    {canManageFinance && (
                      <td>
                        {row.orderStatus === "paid" && row.refundableInPaise > 0 && (
                          <button className={styles.link} onClick={() => setOpenRefund(openRefund === row.orderId ? null : row.orderId)}>
                            Refund…
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                  {openRefund === row.orderId && (
                    <tr>
                      <td colSpan={7}>
                        <RefundForm row={row} onDone={done} />
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
