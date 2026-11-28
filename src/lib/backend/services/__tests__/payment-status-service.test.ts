import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import type { PaymentConfirmationService } from "../payment-confirmation-service";
import type { PaymentNotificationService } from "../payment-notification-service";
import { PaymentStatusService, derivePaymentState, deriveBookingState } from "../payment-status-service";
import {
  aConsultation,
  aRefund,
  aSlot,
  aTransaction,
  anOrder,
  CONSULTATION_ID,
  mockConsultationRepo,
  mockLedger,
  mockOrderRepo,
  mockRefundRepo,
  mockSlotRepo,
  mockTransactionRepo,
  TOKEN,
} from "./payment-test-doubles";

describe("derivePaymentState", () => {
  const paid = anOrder({ status: "paid" });
  it.each([
    ["paid, no refunds", paid, [], [], "paid"],
    ["refund pending", paid, [], [aRefund({ status: "initiated" })], "refund_processing"],
    ["partially refunded", paid, [], [aRefund({ status: "succeeded", amountInPaise: 1000 })], "partially_refunded"],
    ["fully refunded", paid, [], [aRefund({ status: "succeeded" })], "refunded"],
    ["failed refund ignored", paid, [], [aRefund({ status: "failed" })], "paid"],
    ["authorized not captured", anOrder({ status: "attempted" }), [aTransaction({ status: "pending" })], [], "verifying"],
    ["last attempt failed", anOrder({ status: "attempted" }), [aTransaction({ status: "failed" })], [], "failed"],
    ["nothing yet", anOrder({ status: "created" }), [], [], "awaiting_payment"],
  ] as const)("%s", (_l, order, txns, refunds, expected) => {
    expect(derivePaymentState(order, [...txns], [...refunds])).toBe(expected);
  });

  it("keeps payment and booking state independent (paid + slot conflict)", () => {
    expect(derivePaymentState(paid, [], [])).toBe("paid");
    expect(deriveBookingState("slot_conflict_pending_reschedule")).toBe("action_required");
  });
});

describe("PaymentStatusService", () => {
  let orders: ReturnType<typeof mockOrderRepo>;
  let confirmation: { syncOrderWithProvider: Mock<PaymentConfirmationService["syncOrderWithProvider"]> };
  let notifications: { dispatch: Mock<PaymentNotificationService["dispatch"]> };
  let ledger: ReturnType<typeof mockLedger>;
  let service: PaymentStatusService;

  const make = (opts: { order?: ReturnType<typeof anOrder>; consultation?: ReturnType<typeof aConsultation>; slot?: ReturnType<typeof aSlot>; txns?: ReturnType<typeof aTransaction>[] } = {}) => {
    orders = mockOrderRepo(opts.order ?? anOrder());
    service = new PaymentStatusService({
      orders,
      transactions: mockTransactionRepo(opts.txns ?? [aTransaction()]),
      refunds: mockRefundRepo([]),
      consultations: mockConsultationRepo(opts.consultation ?? aConsultation()),
      slots: mockSlotRepo(opts.slot ?? aSlot()),
      ledger,
      confirmation,
      notifications,
    });
  };

  beforeEach(() => {
    confirmation = { syncOrderWithProvider: vi.fn<PaymentConfirmationService["syncOrderWithProvider"]>().mockResolvedValue(null) };
    notifications = { dispatch: vi.fn<PaymentNotificationService["dispatch"]>().mockResolvedValue("sent") };
    ledger = mockLedger();
    make();
  });

  it("returns only customer-safe fields for the right token", async () => {
    const result = await service.getStatus({ consultationId: CONSULTATION_ID, reservationToken: TOKEN, syncWithProvider: true });
    expect(result).toEqual({
      success: true,
      data: {
        payment: "paid",
        booking: "confirmed",
        slotStartTime: aSlot().startTime,
        amountInPaise: 299900,
        reference: anOrder().receipt,
        canRetryPayment: false,
      },
    });
    expect(JSON.stringify(result)).not.toContain(TOKEN);
    expect(JSON.stringify(result)).not.toContain("pay_TestPayment01");
  });

  it("answers NOT_FOUND for a wrong token (no cross-customer disclosure)", async () => {
    const result = await service.getStatus({ consultationId: CONSULTATION_ID, reservationToken: "b".repeat(64), syncWithProvider: true });
    expect(result).toEqual({ success: false, error: "NOT_FOUND" });
  });

  it("asks Razorpay only while the order is unpaid", async () => {
    await service.getStatus({ consultationId: CONSULTATION_ID, reservationToken: TOKEN, syncWithProvider: true });
    expect(confirmation.syncOrderWithProvider).not.toHaveBeenCalled();

    make({ order: anOrder({ status: "attempted" }), txns: [aTransaction({ status: "pending" })], consultation: aConsultation({ status: "awaiting_payment" }) });
    const r = await service.getStatus({ consultationId: CONSULTATION_ID, reservationToken: TOKEN, syncWithProvider: true });
    expect(confirmation.syncOrderWithProvider).toHaveBeenCalledTimes(1);
    expect(r.success && r.data.payment).toBe("verifying");
  });

  it("keeps answering from the database when the provider lookup fails", async () => {
    make({ order: anOrder({ status: "created" }), txns: [], consultation: aConsultation({ status: "awaiting_payment" }) });
    confirmation.syncOrderWithProvider.mockRejectedValueOnce(new Error("razorpay down"));
    const r = await service.getStatus({ consultationId: CONSULTATION_ID, reservationToken: TOKEN, syncWithProvider: true });
    expect(r.success && r.data.payment).toBe("awaiting_payment");
  });

  it("offers a retry after a failed attempt only while the hold is still valid", async () => {
    const holdSlot = aSlot({ status: "reserved", reservationToken: TOKEN, reservedUntil: "2026-10-01T10:15:00.000Z" });
    make({ order: anOrder({ status: "attempted" }), txns: [aTransaction({ status: "failed" })], consultation: aConsultation({ status: "awaiting_payment" }), slot: holdSlot });
    const valid = await service.getStatus({ consultationId: CONSULTATION_ID, reservationToken: TOKEN, syncWithProvider: false, now: new Date("2026-10-01T10:05:00.000Z") });
    expect(valid.success && valid.data.canRetryPayment).toBe(true);
    const late = await service.getStatus({ consultationId: CONSULTATION_ID, reservationToken: TOKEN, syncWithProvider: false, now: new Date("2026-10-01T10:14:00.000Z") });
    expect(late.success && late.data.canRetryPayment).toBe(false);
  });

  it("does not reveal the slot time unless the booking is confirmed", async () => {
    make({ consultation: aConsultation({ status: "slot_conflict_pending_reschedule" }) });
    const r = await service.getStatus({ consultationId: CONSULTATION_ID, reservationToken: TOKEN, syncWithProvider: false });
    expect(r.success && r.data).toMatchObject({ payment: "paid", booking: "action_required", slotStartTime: null });
  });

  describe("rebookConflict", () => {
    it("rebooks atomically and sends the confirmation (no second payment)", async () => {
      const code = await service.rebookConflict({ consultationId: CONSULTATION_ID, reservationToken: TOKEN, newSlotId: "77777777-7777-4777-8777-777777777777" });
      expect(code).toBe("REBOOKED");
      expect(ledger.rebookConflictedConsultation).toHaveBeenCalledWith(CONSULTATION_ID, "77777777-7777-4777-8777-777777777777");
      expect(notifications.dispatch).toHaveBeenCalledWith(expect.objectContaining({ kind: "booking_confirmed" }));
    });

    it("refuses with a wrong token", async () => {
      expect(await service.rebookConflict({ consultationId: CONSULTATION_ID, reservationToken: "c".repeat(64), newSlotId: "x" })).toBe("NOT_FOUND");
      expect(ledger.rebookConflictedConsultation).not.toHaveBeenCalled();
    });

    it.each([
      ["slot_unavailable", "SLOT_UNAVAILABLE"],
      ["not_in_conflict", "NOT_IN_CONFLICT"],
      ["not_paid", "NOT_PAID"],
    ] as const)("maps RPC result %s to %s without notifying", async (rpc, code) => {
      vi.mocked(ledger.rebookConflictedConsultation).mockResolvedValueOnce(rpc);
      expect(await service.rebookConflict({ consultationId: CONSULTATION_ID, reservationToken: TOKEN, newSlotId: "x" })).toBe(code);
      expect(notifications.dispatch).not.toHaveBeenCalled();
    });
  });
});
