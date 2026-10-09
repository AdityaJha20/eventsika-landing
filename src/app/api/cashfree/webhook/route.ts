import { NextRequest, NextResponse } from "next/server";
import { getServerConfig } from "@/lib/backend/config/env";
import { logger } from "@/lib/backend/logger/logger";
import { getOrCreateRequestId } from "@/lib/backend/utils/request-id";
import { verifyCashfreeWebhookSignature } from "@/lib/backend/security/webhook-signature-verifier";
import {
  parseCashfreeWebhookPayload,
  NormalizedCashfreePaymentWebhook,
} from "@/lib/backend/domain/webhook-types";
import { paymentConfirmationService } from "@/lib/backend/services/payment-confirmation-service";
import { SupabaseWebhookEventRepository } from "@/lib/backend/repositories/supabase-webhook-event-repository";
import { IWebhookEventRepository } from "@/lib/backend/repositories/webhook-event-repository.interface";
import { WebhookEventRecord } from "@/lib/backend/types/payment-and-consultation";

export const dynamic = "force-dynamic";

/**
 * Maximum allowable webhook payload size: 64 KB (65,536 bytes).
 */
export const MAX_WEBHOOK_SIZE = 65536;

/**
 * Checks whether an error represents a PostgreSQL unique constraint violation (code 23505).
 */
function isUniqueConflictError(err: unknown): boolean {
  if (!err) return false;
  const errObj = err as { code?: string; message?: string };
  return (
    errObj.code === "23505" ||
    String(errObj.message || err).includes("23505") ||
    String(errObj.message || err).includes("duplicate key")
  );
}

/**
 * Safely resolves a unique provider event ID from the payload envelope.
 *
 * Precedence:
 * 1. Raw top-level event_id
 * 2. Raw nested data.event_id
 * 3. Deterministic fallback: evt_${orderId}_${gatewayPaymentId || "nopay"}_${eventType}
 */
function resolveEventId(
  envelope: Record<string, unknown>,
  orderId: string | null,
  gatewayPaymentId: string | null,
  eventType: string
): string | null {
  if (typeof envelope.event_id === "string" && envelope.event_id.trim()) {
    return envelope.event_id.trim().slice(0, 100);
  }

  if (
    envelope.data &&
    typeof envelope.data === "object" &&
    !Array.isArray(envelope.data)
  ) {
    const dataObj = envelope.data as Record<string, unknown>;
    if (typeof dataObj.event_id === "string" && dataObj.event_id.trim()) {
      return dataObj.event_id.trim().slice(0, 100);
    }
  }

  const resolvedOrderId =
    orderId ||
    (() => {
      const dataObj =
        envelope.data && typeof envelope.data === "object" && !Array.isArray(envelope.data)
          ? (envelope.data as Record<string, unknown>)
          : envelope;
      const orderObj =
        dataObj.order && typeof dataObj.order === "object" && !Array.isArray(dataObj.order)
          ? (dataObj.order as Record<string, unknown>)
          : undefined;
      const rawOrderId =
        orderObj?.order_id ?? orderObj?.orderId ?? dataObj.order_id ?? dataObj.orderId ?? envelope.order_id;
      return typeof rawOrderId === "string" && rawOrderId.trim() ? rawOrderId.trim() : null;
    })();

  const resolvedPaymentId =
    gatewayPaymentId ||
    (() => {
      const dataObj =
        envelope.data && typeof envelope.data === "object" && !Array.isArray(envelope.data)
          ? (envelope.data as Record<string, unknown>)
          : envelope;
      const paymentObj =
        dataObj.payment && typeof dataObj.payment === "object" && !Array.isArray(dataObj.payment)
          ? (dataObj.payment as Record<string, unknown>)
          : undefined;
      const rawPaymentId =
        paymentObj?.cf_payment_id ?? paymentObj?.payment_id ?? dataObj.cf_payment_id ?? dataObj.payment_id ?? envelope.cf_payment_id;
      return rawPaymentId !== undefined && rawPaymentId !== null && String(rawPaymentId).trim()
        ? String(rawPaymentId).trim()
        : null;
    })();

  if (resolvedOrderId) {
    const fallback = `evt_${resolvedOrderId}_${resolvedPaymentId || "nopay"}_${eventType}`;
    return fallback.slice(0, 100);
  }

  return null;
}

/**
 * POST /api/cashfree/webhook
 *
 * Public Cashfree payment gateway webhook ingress endpoint (Step 6C).
 *
 * Sequence:
 * 1. Payload size pre-check (Content-Length header)
 * 2. Read raw request body as unparsed text
 * 3. Actual body byte-length verification (64 KB ceiling)
 * 4. Extract signature & timestamp headers
 * 5. Verify HMAC-SHA256 signature & enforce replay freshness window (5 minutes)
 * 6. Parse JSON strictly after signature verification
 * 7. Normalize payload or handle unsupported event types as 'ignored'
 * 8. Resolve deterministic event identifier
 * 9. Idempotency & deduplication check in webhook_events ledger
 * 10. Record event in webhook_events as 'received' (with 23505 race resolution)
 * 11. Invoke PaymentConfirmationService
 * 12. Update event status to 'processed' or 'failed'
 * 13. Emit minimal, deterministic, and safe HTTP response
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const requestId = getOrCreateRequestId(request);

  const baseHeaders: Record<string, string> = {
    "X-Request-Id": requestId,
    "Cache-Control": "no-store, private",
    "X-Content-Type-Options": "nosniff",
  };

  // 1. Content-Length Pre-Check
  const contentLength = request.headers.get("content-length");
  if (contentLength) {
    const parsedLength = parseInt(contentLength, 10);
    if (!Number.isNaN(parsedLength) && parsedLength > MAX_WEBHOOK_SIZE) {
      logger.warn("Webhook Content-Length exceeds ceiling", {
        requestId,
        contentLength: parsedLength,
      });
      return NextResponse.json(
        { success: false, error: "Payload too large. Maximum allowed size is 64 KB." },
        { status: 413, headers: baseHeaders }
      );
    }
  }

  // 2. Read Raw Request Body as Text
  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch (err) {
    logger.error("Failed to read webhook request stream", err, { requestId });
    return NextResponse.json(
      { success: false, error: "Failed to read request body." },
      { status: 400, headers: baseHeaders }
    );
  }

  // 3. Actual Byte Length Check
  if (Buffer.byteLength(rawBody, "utf8") > MAX_WEBHOOK_SIZE) {
    logger.warn("Webhook body byte length exceeds ceiling", {
      requestId,
      byteLength: Buffer.byteLength(rawBody, "utf8"),
    });
    return NextResponse.json(
      { success: false, error: "Payload too large. Maximum allowed size is 64 KB." },
      { status: 413, headers: baseHeaders }
    );
  }

  // 4. Extract Signature and Timestamp Headers
  const signature = request.headers.get("x-webhook-signature");
  const timestamp = request.headers.get("x-webhook-timestamp");

  // 5. Resolve Secret Key and Verify HMAC Signature & Freshness
  let secretKey: string | undefined;
  try {
    secretKey = getServerConfig().cashfree.secretKey;
  } catch {
    secretKey = undefined;
  }

  const verification = verifyCashfreeWebhookSignature({
    rawBody,
    signature,
    timestamp,
    secretKey,
  });

  if (!verification.isValid) {
    switch (verification.code) {
      case "MISSING_SIGNATURE":
        return NextResponse.json(
          { success: false, error: "Missing x-webhook-signature header." },
          { status: 400, headers: baseHeaders }
        );
      case "MISSING_TIMESTAMP":
        return NextResponse.json(
          { success: false, error: "Missing x-webhook-timestamp header." },
          { status: 400, headers: baseHeaders }
        );
      case "INVALID_TIMESTAMP":
        return NextResponse.json(
          { success: false, error: "Malformed or unparseable webhook timestamp." },
          { status: 400, headers: baseHeaders }
        );
      case "TIMESTAMP_OUT_OF_WINDOW":
        return NextResponse.json(
          { success: false, error: "Webhook timestamp expired or outside replay tolerance window." },
          { status: 401, headers: baseHeaders }
        );
      case "INVALID_SIGNATURE":
        return NextResponse.json(
          { success: false, error: "Invalid webhook signature." },
          { status: 401, headers: baseHeaders }
        );
      case "MISSING_SECRET":
        logger.error("Cashfree secret key missing on server", undefined, { requestId });
        return NextResponse.json(
          { success: false, error: "Server configuration error." },
          { status: 500, headers: baseHeaders }
        );
      default:
        return NextResponse.json(
          { success: false, error: "Invalid webhook request." },
          { status: 400, headers: baseHeaders }
        );
    }
  }

  // 6. JSON Parse ONLY AFTER Cryptographic Signature Verification
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(rawBody);
  } catch {
    logger.warn("Malformed JSON in signed webhook body", { requestId });
    return NextResponse.json(
      { success: false, error: "Malformed JSON payload." },
      { status: 400, headers: baseHeaders }
    );
  }

  if (!parsedJson || typeof parsedJson !== "object" || Array.isArray(parsedJson)) {
    logger.warn("Malformed JSON envelope in signed webhook body", { requestId });
    return NextResponse.json(
      { success: false, error: "Malformed JSON envelope." },
      { status: 400, headers: baseHeaders }
    );
  }

  const envelope = parsedJson as Record<string, unknown>;
  const trimmedSignature = signature!.trim();
  const webhookEventRepo: IWebhookEventRepository = new SupabaseWebhookEventRepository();

  // 7. Parse and Validate Payment Webhook Payload
  const parseResult = parseCashfreeWebhookPayload(parsedJson);

  // 8. Handle Unsupported Event Types as 'ignored'
  if (!parseResult.success) {
    if (parseResult.code === "UNSUPPORTED_OR_MISSING_EVENT_TYPE") {
      const rawType = envelope.type ?? envelope.event_type;
      if (typeof rawType === "string" && rawType.trim()) {
        const eventType = rawType.trim();
        const eventId = resolveEventId(envelope, null, null, eventType);

        if (!eventId) {
          logger.warn("Unsupported event missing determinable event ID", { requestId, eventType });
          return NextResponse.json(
            { success: false, error: parseResult.error },
            { status: 400, headers: baseHeaders }
          );
        }

        // Deduplication check for unsupported event
        try {
          const existing = await webhookEventRepo.getWebhookEvent("cashfree", eventId);
          if (existing) {
            return NextResponse.json(
              {
                received: true,
                status: existing.status === "ignored" ? "already_ignored" : "already_processed",
              },
              { status: 200, headers: baseHeaders }
            );
          }
        } catch (dbErr) {
          logger.error("Database error querying existing webhook event", dbErr, { requestId, eventId });
          return NextResponse.json(
            { success: false, error: "Internal processing error." },
            { status: 500, headers: baseHeaders }
          );
        }

        try {
          await webhookEventRepo.recordWebhookEvent({
            provider: "cashfree",
            eventId,
            eventType,
            payload: envelope,
            signature: trimmedSignature,
            status: "ignored",
          });
        } catch (err) {
          if (isUniqueConflictError(err)) {
            return NextResponse.json(
              { received: true, status: "duplicate_concurrent" },
              { status: 200, headers: baseHeaders }
            );
          }
          logger.error("Database error recording ignored webhook event", err, { requestId, eventId, eventType });
          return NextResponse.json(
            { success: false, error: "Internal processing error." },
            { status: 500, headers: baseHeaders }
          );
        }

        logger.info("Persisted unsupported webhook event as ignored", {
          requestId,
          eventId,
          eventType,
        });

        return NextResponse.json(
          { received: true, status: "ignored" },
          { status: 200, headers: baseHeaders }
        );
      }
    }

    logger.warn("Invalid webhook payload structure", {
      requestId,
      errorCode: parseResult.code,
    });
    return NextResponse.json(
      { success: false, error: parseResult.error },
      { status: 400, headers: baseHeaders }
    );
  }

  // 9. Supported Event Processing
  const normalizedEvent: NormalizedCashfreePaymentWebhook = parseResult.data;
  const eventId = resolveEventId(
    envelope,
    normalizedEvent.orderId,
    normalizedEvent.gatewayPaymentId,
    normalizedEvent.eventType
  );

  if (!eventId) {
    logger.warn("Webhook missing determinable event identifier", {
      requestId,
      orderId: normalizedEvent.orderId,
    });
    return NextResponse.json(
      { success: false, error: "Could not determine unique event identifier." },
      { status: 400, headers: baseHeaders }
    );
  }

  // 10. Query Deduplication Ledger
  let existingEvent: WebhookEventRecord | null = null;
  try {
    existingEvent = await webhookEventRepo.getWebhookEvent("cashfree", eventId);
  } catch (dbErr) {
    logger.error("Database error checking existing webhook event", dbErr, {
      requestId,
      eventId,
      orderId: normalizedEvent.orderId,
    });
    return NextResponse.json(
      { success: false, error: "Internal processing error." },
      { status: 500, headers: baseHeaders }
    );
  }

  // CASE B: Event already processed
  if (existingEvent && existingEvent.status === "processed") {
    logger.info("Ignoring duplicate webhook event (already processed)", {
      requestId,
      eventId,
      orderId: normalizedEvent.orderId,
    });
    return NextResponse.json(
      { received: true, status: "already_processed", orderId: normalizedEvent.orderId },
      { status: 200, headers: baseHeaders }
    );
  }

  // CASE C: Event already ignored
  if (existingEvent && existingEvent.status === "ignored") {
    logger.info("Ignoring duplicate webhook event (already ignored)", {
      requestId,
      eventId,
      orderId: normalizedEvent.orderId,
    });
    return NextResponse.json(
      { received: true, status: "already_ignored" },
      { status: 200, headers: baseHeaders }
    );
  }

  // CASE D: Event already received (in-flight duplicate)
  if (existingEvent && existingEvent.status === "received") {
    logger.warn("Duplicate webhook event currently in-flight", {
      requestId,
      eventId,
      orderId: normalizedEvent.orderId,
    });
    return NextResponse.json(
      { received: true, status: "duplicate_in_flight", orderId: normalizedEvent.orderId },
      { status: 200, headers: baseHeaders }
    );
  }

  // CASE A or CASE E: New event or retry of previously failed event
  let activeEventRecordId: string;

  if (existingEvent && existingEvent.status === "failed") {
    // CASE E: Retry of previously failed event
    logger.info("Retrying processing for previously failed webhook event", {
      requestId,
      eventId,
      orderId: normalizedEvent.orderId,
    });
    activeEventRecordId = existingEvent.id;
  } else {
    // CASE A: New event -> record with status 'received'
    try {
      const recorded = await webhookEventRepo.recordWebhookEvent({
        provider: "cashfree",
        eventId,
        eventType: normalizedEvent.eventType,
        payload: envelope,
        signature: trimmedSignature,
        status: "received",
      });
      activeEventRecordId = recorded.id;
    } catch (insertErr) {
      if (isUniqueConflictError(insertErr)) {
        logger.info("Concurrent webhook event insert detected; suppressing duplicate", {
          requestId,
          eventId,
          orderId: normalizedEvent.orderId,
        });
        return NextResponse.json(
          { received: true, status: "duplicate_concurrent" },
          { status: 200, headers: baseHeaders }
        );
      }
      logger.error("Database error recording webhook event", insertErr, {
        requestId,
        eventId,
        orderId: normalizedEvent.orderId,
      });
      return NextResponse.json(
        { success: false, error: "Internal processing error." },
        { status: 500, headers: baseHeaders }
      );
    }
  }

  // 11. Execute Payment Confirmation Domain Service
  let confirmationResult;
  try {
    confirmationResult = await paymentConfirmationService.processPaymentWebhook(normalizedEvent);
  } catch (serviceErr) {
    logger.error("Payment confirmation service threw unexpectedly", serviceErr, {
      requestId,
      eventId,
      orderId: normalizedEvent.orderId,
    });
    try {
      await webhookEventRepo.updateWebhookEventStatus(activeEventRecordId, "failed", {
        processingError: serviceErr instanceof Error ? serviceErr.message : "Service execution threw unexpectedly",
      });
    } catch {}
    return NextResponse.json(
      { success: false, error: "Internal processing error." },
      { status: 500, headers: baseHeaders }
    );
  }

  // 12. Evaluate Service Outcome and Update Webhook Event Status
  if (confirmationResult.success) {
    try {
      await webhookEventRepo.updateWebhookEventStatus(activeEventRecordId, "processed", {
        processedAt: new Date().toISOString(),
      });
    } catch (statusUpdateErr) {
      logger.error("Failed to update webhook event status to processed", statusUpdateErr, {
        requestId,
        eventId,
        orderId: normalizedEvent.orderId,
      });
    }

    logger.info("Cashfree payment webhook processed successfully", {
      requestId,
      eventId,
      orderId: confirmationResult.orderId,
      outcome: confirmationResult.outcome,
      durationMs: Date.now() - startTime,
    });

    return NextResponse.json(
      {
        received: true,
        status: "processed",
        outcome: confirmationResult.outcome,
        orderId: confirmationResult.orderId,
      },
      { status: 200, headers: baseHeaders }
    );
  } else {
    const isTransient = confirmationResult.error === "DATABASE_ERROR";

    try {
      await webhookEventRepo.updateWebhookEventStatus(activeEventRecordId, "failed", {
        processingError: confirmationResult.message,
      });
    } catch (statusUpdateErr) {
      logger.error("Failed to update webhook event status to failed", statusUpdateErr, {
        requestId,
        eventId,
        orderId: normalizedEvent.orderId,
      });
    }

    if (isTransient) {
      logger.error("Transient error during payment webhook confirmation", undefined, {
        requestId,
        eventId,
        orderId: normalizedEvent.orderId,
        errorCode: confirmationResult.error,
        durationMs: Date.now() - startTime,
      });
      return NextResponse.json(
        { success: false, error: "Internal processing error." },
        { status: 500, headers: baseHeaders }
      );
    } else {
      logger.warn("Business validation failure during payment confirmation", {
        requestId,
        eventId,
        orderId: normalizedEvent.orderId,
        errorCode: confirmationResult.error,
        durationMs: Date.now() - startTime,
      });
      return NextResponse.json(
        {
          received: true,
          status: "failed",
          error: confirmationResult.error,
          orderId: confirmationResult.orderId,
        },
        { status: 200, headers: baseHeaders }
      );
    }
  }
}
