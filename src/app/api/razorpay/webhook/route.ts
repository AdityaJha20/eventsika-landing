import { after, NextRequest, NextResponse } from "next/server";
import { getServerConfig } from "@/lib/backend/config/env";
import { logger } from "@/lib/backend/logger/logger";
import { getOrCreateRequestId } from "@/lib/backend/utils/request-id";
import { MAX_WEBHOOK_SIZE } from "@/lib/backend/domain/webhook-types";
import { parseRazorpayWebhook } from "@/lib/backend/domain/razorpay-webhook";
import { verifyRazorpayWebhookSignature } from "@/lib/backend/security/razorpay-signature";
import { SupabaseWebhookEventRepository } from "@/lib/backend/repositories/supabase-webhook-event-repository";
import { IWebhookEventRepository } from "@/lib/backend/repositories/webhook-event-repository.interface";
import { SupabasePaymentLedgerRepository } from "@/lib/backend/repositories/payment-ledger-repository";
import { razorpayWebhookProcessor } from "@/lib/backend/services/razorpay-webhook-processor";
import { paymentNotificationService } from "@/lib/backend/services/payment-notification-service";
import { WebhookEventRecord } from "@/lib/backend/types/payment-and-consultation";

export const dynamic = "force-dynamic";

const WEBHOOK_LEASE_SECONDS = 60;
const WEBHOOK_MAX_ATTEMPTS = 10;
const EVENT_ID_PATTERN = /^[A-Za-z0-9_-]{1,100}$/;
const TERMINAL = new Set(["processed", "ignored", "rejected"]);

function isUniqueConflict(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return message.includes("23505") || message.includes("duplicate key");
}

/**
 * POST /api/razorpay/webhook
 *
 * 1. Raw body (<= 64 KB) verified against X-Razorpay-Signature with
 *    RAZORPAY_WEBHOOK_SECRET BEFORE parsing. Forged/unverifiable -> 4xx, nothing stored.
 * 2. Durable, provider-scoped receipt keyed by x-razorpay-event-id (minimal payload).
 * 3. Lease-based processing: duplicates and concurrent deliveries cause one financial
 *    effect; an event whose worker crashed is reclaimed after its lease expires
 *    (never acknowledged-and-forgotten).
 * 4. 2xx only after the outcome is durable. Transient failures -> 5xx so Razorpay
 *    retries. Emails are sent after the response (`after`), never in the ack path.
 */
export async function POST(request: NextRequest) {
  const requestId = getOrCreateRequestId(request);
  const headers = { "X-Request-Id": requestId, "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
  const reply = (status: number, body: Record<string, unknown>) => NextResponse.json(body, { status, headers });

  const declared = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declared) && declared > MAX_WEBHOOK_SIZE) return reply(413, { error: "Payload too large." });

  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    return reply(400, { error: "Unreadable body." });
  }
  if (Buffer.byteLength(rawBody, "utf8") > MAX_WEBHOOK_SIZE) return reply(413, { error: "Payload too large." });

  const verification = verifyRazorpayWebhookSignature({
    rawBody,
    signature: request.headers.get("x-razorpay-signature"),
    webhookSecret: getServerConfig().razorpay.webhookSecret,
  });
  if (!verification.isValid) {
    if (verification.code === "MISSING_SECRET") {
      logger.error("Razorpay webhook secret not configured", undefined, { requestId });
      return reply(503, { error: "Webhook temporarily unavailable." });
    }
    logger.warn("Rejected unverifiable Razorpay webhook", { requestId, code: verification.code });
    return reply(verification.code === "MISSING_SIGNATURE" ? 400 : 401, { error: "Invalid signature." });
  }

  const eventId = request.headers.get("x-razorpay-event-id")?.trim() ?? "";
  if (!EVENT_ID_PATTERN.test(eventId)) {
    logger.warn("Verified Razorpay webhook without a usable event id", { requestId });
    return reply(400, { error: "Missing event id." });
  }

  let envelope: unknown;
  try {
    envelope = JSON.parse(rawBody);
  } catch {
    return reply(400, { error: "Malformed JSON." });
  }
  const parsed = parseRazorpayWebhook(envelope);
  if (!parsed.success) {
    logger.warn("Verified Razorpay webhook with malformed payload", { requestId, eventId, error: parsed.error });
    return reply(400, { error: "Malformed payload." });
  }

  const repo: IWebhookEventRepository = new SupabaseWebhookEventRepository();

  // Durable receipt (idempotent on (provider, event_id)).
  let event: WebhookEventRecord | null;
  try {
    event = await repo.recordWebhookEvent({
      provider: "razorpay",
      eventId,
      eventType: parsed.data.eventType,
      payload: parsed.data.minimalPayload,
      signature: request.headers.get("x-razorpay-signature")!.trim(),
      status: parsed.data.kind === "ignored" ? "ignored" : "received",
    });
  } catch (err) {
    if (!isUniqueConflict(err)) {
      logger.error("Failed to persist Razorpay webhook", err, { requestId, eventId });
      return reply(500, { error: "Temporary failure." });
    }
    try {
      event = await repo.getWebhookEvent("razorpay", eventId);
    } catch (fetchErr) {
      logger.error("Failed to load duplicate Razorpay webhook", fetchErr, { requestId, eventId });
      return reply(500, { error: "Temporary failure." });
    }
  }
  if (!event) return reply(500, { error: "Temporary failure." });
  if (TERMINAL.has(event.status)) return reply(200, { received: true, status: event.status });

  // Lease the event: concurrent deliveries cannot both apply it.
  let claimed: WebhookEventRecord | null;
  try {
    claimed = await repo.claimWebhookEvent(event.id, WEBHOOK_LEASE_SECONDS, WEBHOOK_MAX_ATTEMPTS);
  } catch (err) {
    logger.error("Failed to lease Razorpay webhook", err, { requestId, eventId });
    return reply(500, { error: "Temporary failure." });
  }

  if (!claimed) {
    const current = await repo.getWebhookEvent("razorpay", eventId).catch(() => null);
    if (current && TERMINAL.has(current.status)) return reply(200, { received: true, status: current.status });
    if (current && current.attempts >= WEBHOOK_MAX_ATTEMPTS) {
      await new SupabasePaymentLedgerRepository()
        .recordIssue({
          provider: "razorpay",
          kind: "webhook_retries_exhausted",
          gatewayReference: eventId,
          detail: `${current.eventType}: ${current.processingError ?? "unknown error"}`,
        })
        .catch(() => undefined);
      return reply(200, { received: true, status: "needs_attention" });
    }
    // Another worker holds a live lease. Ask Razorpay to retry later; if that worker
    // crashed, the lease expires and the retry (or reconciliation) reclaims it.
    return reply(503, { error: "Event is being processed." });
  }

  const result = await razorpayWebhookProcessor.process(claimed);
  try {
    await repo.updateWebhookEventStatus(claimed.id, result.status, {
      processingError: result.error ?? null,
      processedAt: result.status === "failed" ? null : new Date().toISOString(),
    });
  } catch (err) {
    logger.error("Failed to record Razorpay webhook outcome", err, { requestId, eventId, status: result.status });
    return reply(500, { error: "Temporary failure." });
  }

  if (result.paymentOutcome) {
    const { outcome, orderId, consultationId } = result.paymentOutcome;
    after(() => paymentNotificationService.notifyPaymentOutcome(outcome, orderId, consultationId));
  }

  logger.info("Razorpay webhook handled", { requestId, eventId, eventType: claimed.eventType, status: result.status });
  return result.status === "failed"
    ? reply(500, { error: "Temporary failure." })
    : reply(200, { received: true, status: result.status });
}
