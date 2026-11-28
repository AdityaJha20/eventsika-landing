import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { PaymentNotificationService, MAX_NOTIFICATION_ATTEMPTS, type EmailSender } from "../payment-notification-service";
import { buildConsultationIcs } from "../../notifications/payment-email-templates";
import {
  aConsultation,
  aRefund,
  anOrder,
  CONSULTATION_ID,
  mockConsultationRepo,
  mockLedger,
  mockOrderRepo,
  mockRefundRepo,
  mockSlotRepo,
  mockTransactionRepo,
  ORDER_ID,
  TOKEN,
} from "./payment-test-doubles";

describe("PaymentNotificationService", () => {
  let ledger: ReturnType<typeof mockLedger>;
  let send: Mock<EmailSender>;
  let consultations: ReturnType<typeof mockConsultationRepo>;
  let orders: ReturnType<typeof mockOrderRepo>;
  let service: PaymentNotificationService;

  const build = () =>
    new PaymentNotificationService({
      ledger,
      consultations,
      slots: mockSlotRepo(),
      orders,
      transactions: mockTransactionRepo(),
      refunds: mockRefundRepo([aRefund({ status: "succeeded" })]),
      send,
      siteUrl: () => "https://eventsika.in",
    });

  beforeEach(() => {
    ledger = mockLedger();
    send = vi.fn<EmailSender>().mockResolvedValue({ delivered: true, channel: "resend", providerMessageId: "msg_1" });
    consultations = mockConsultationRepo();
    orders = mockOrderRepo();
    service = build();
  });

  it("maps outcomes to notifications: receipt + confirmation when confirmed, receipt + action-required on slot conflict, nothing otherwise", () => {
    expect(service.requestsForPaymentOutcome("confirmed", ORDER_ID, CONSULTATION_ID).map((r) => r.kind)).toEqual(["payment_receipt", "booking_confirmed"]);
    expect(service.requestsForPaymentOutcome("slot_conflict", ORDER_ID, CONSULTATION_ID).map((r) => r.kind)).toEqual(["payment_receipt", "slot_conflict_action_required"]);
    for (const outcome of ["payment_failed", "payment_pending", "user_dropped", "duplicate_payment", "paid_inactive_consultation"] as const) {
      expect(service.requestsForPaymentOutcome(outcome, ORDER_ID, CONSULTATION_ID)).toEqual([]);
    }
  });

  it("uses stable dedupe keys so replays cannot send twice", () => {
    const a = service.requestsForPaymentOutcome("confirmed", ORDER_ID, CONSULTATION_ID);
    const b = service.requestsForPaymentOutcome("already_confirmed", ORDER_ID, CONSULTATION_ID);
    expect(a.map((r) => r.dedupeKey)).toEqual(b.map((r) => r.dedupeKey));
  });

  it("sends a confirmed booking email with an .ics invite and records delivery", async () => {
    const outcome = await service.dispatch({ kind: "booking_confirmed", dedupeKey: `booking_confirmed:${CONSULTATION_ID}`, consultationId: CONSULTATION_ID, paymentOrderId: ORDER_ID });
    expect(outcome).toBe("sent");
    const email = send.mock.calls[0][0];
    expect(email.to).toBe("asha@example.com");
    expect(email.subject).toContain("Confirmed");
    expect(email.text).toContain("60 minutes");
    expect(email.attachments?.[0].filename).toBe("eventsika-consultation.ics");
    expect(ledger.completeNotification).toHaveBeenCalledWith(expect.any(String), { sent: true, error: null, providerMessageId: "msg_1" });
  });

  it("skips sending when the ledger claim says it was already sent (duplicate event)", async () => {
    vi.mocked(ledger.claimNotification).mockResolvedValueOnce(null);
    expect(await service.dispatch({ kind: "payment_receipt", dedupeKey: `payment_receipt:${ORDER_ID}`, consultationId: CONSULTATION_ID, paymentOrderId: ORDER_ID })).toBe("skipped");
    expect(send).not.toHaveBeenCalled();
  });

  it("never sends a receipt before the order is authoritatively paid", async () => {
    orders = mockOrderRepo(anOrder({ status: "attempted" }));
    service = build();
    expect(await service.dispatch({ kind: "payment_receipt", dedupeKey: "k", consultationId: CONSULTATION_ID, paymentOrderId: ORDER_ID })).toBe("skipped");
    expect(send).not.toHaveBeenCalled();
  });

  it("does not send a confirmation (or calendar invite) unless the consultation is confirmed", async () => {
    consultations = mockConsultationRepo(aConsultation({ status: "slot_conflict_pending_reschedule" }));
    service = build();
    expect(await service.dispatch({ kind: "booking_confirmed", dedupeKey: "k", consultationId: CONSULTATION_ID, paymentOrderId: ORDER_ID })).toBe("skipped");
    expect(send).not.toHaveBeenCalled();
  });

  it("slot-conflict email says payment received, appointment NOT confirmed, no second payment, and links via fragment", async () => {
    consultations = mockConsultationRepo(aConsultation({ status: "slot_conflict_pending_reschedule" }));
    service = build();
    await service.dispatch({ kind: "slot_conflict_action_required", dedupeKey: "k", consultationId: CONSULTATION_ID, paymentOrderId: ORDER_ID });
    const email = send.mock.calls[0][0];
    expect(email.text).toContain("NOT confirmed");
    expect(email.text).toContain("will not be charged again");
    expect(email.text).toContain(`https://eventsika.in/consultation/status#c=${CONSULTATION_ID}&t=${TOKEN}`);
    expect(email.attachments).toBeUndefined();
  });

  it("marks delivery failure for retry without throwing or touching payment state", async () => {
    send.mockResolvedValueOnce({ delivered: false, channel: "resend", error: "Resend HTTP 500" });
    expect(await service.dispatch({ kind: "payment_receipt", dedupeKey: "k", consultationId: CONSULTATION_ID, paymentOrderId: ORDER_ID })).toBe("failed");
    expect(ledger.completeNotification).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ sent: false, error: "Resend HTTP 500" }));
    expect(orders.updateOrderStatus).not.toHaveBeenCalled();
    expect(consultations.updateConsultationStatus).not.toHaveBeenCalled();
    expect(ledger.recordIssue).not.toHaveBeenCalled();
  });

  it("raises a notification_failed issue once attempts are exhausted", async () => {
    vi.mocked(ledger.claimNotification).mockResolvedValueOnce({ id: "n1", dedupeKey: "k", kind: "payment_receipt", attempts: MAX_NOTIFICATION_ATTEMPTS });
    send.mockResolvedValueOnce({ delivered: false, channel: "unconfigured", error: "No transactional email provider configured" });
    await service.dispatch({ kind: "payment_receipt", dedupeKey: "k", consultationId: CONSULTATION_ID, paymentOrderId: ORDER_ID });
    expect(ledger.recordIssue).toHaveBeenCalledWith(expect.objectContaining({ kind: "notification_failed" }));
  });

  it("survives a throwing email provider", async () => {
    send.mockRejectedValueOnce(new Error("boom"));
    expect(await service.dispatch({ kind: "payment_receipt", dedupeKey: "k", consultationId: CONSULTATION_ID, paymentOrderId: ORDER_ID })).toBe("failed");
  });

  it("sends refund-processed only for a succeeded refund", async () => {
    expect(await service.dispatch({ kind: "refund_processed", dedupeKey: "k", consultationId: CONSULTATION_ID, refundId: aRefund().id })).toBe("sent");
    expect(send.mock.calls[0][0].subject).toContain("refund has been processed");
  });

  it("escapes customer-controlled values in HTML", async () => {
    consultations = mockConsultationRepo(aConsultation({ customerFirstName: "<script>x</script>" }));
    service = build();
    await service.dispatch({ kind: "payment_receipt", dedupeKey: "k", consultationId: CONSULTATION_ID, paymentOrderId: ORDER_ID });
    expect(send.mock.calls[0][0].html).not.toContain("<script>");
  });

  it("retryPending re-dispatches ledger rows", async () => {
    vi.mocked(ledger.listRetryableNotifications).mockResolvedValueOnce([
      { dedupeKey: `payment_receipt:${ORDER_ID}`, kind: "payment_receipt", consultationId: CONSULTATION_ID, paymentOrderId: ORDER_ID, refundId: null },
    ]);
    expect(await service.retryPending()).toEqual({ sent: 1, failed: 0, skipped: 0 });
  });
});

describe("buildConsultationIcs", () => {
  it("produces an RFC 5545 event with a stable UID and a revision sequence", () => {
    const ics = buildConsultationIcs({
      consultationId: CONSULTATION_ID,
      customerFirstName: "Asha",
      meetingChannel: "phone",
      slotStartIso: "2026-10-05T04:30:00.000Z",
      slotEndIso: "2026-10-05T05:30:00.000Z",
      amountInPaise: 299900,
      paymentReference: "rcpt_x",
      gatewayPaymentId: null,
      sequence: 2,
    });
    expect(ics).toContain(`UID:consultation-${CONSULTATION_ID}@eventsika.in`);
    expect(ics).toContain("DTSTART:20261005T043000Z");
    expect(ics).toContain("DTEND:20261005T053000Z");
    expect(ics).toContain("SEQUENCE:2");
    expect(ics.split("\r\n")[0]).toBe("BEGIN:VCALENDAR");
  });
});
