import { describe, it, expect, vi } from "vitest";
import { SupabaseClient } from "@supabase/supabase-js";
import { SupabaseConsultationSlotRepository } from "../supabase-consultation-slot-repository";
import { SupabaseConsultationRepository } from "../supabase-consultation-repository";
import { SupabasePaymentOrderRepository } from "../supabase-payment-order-repository";
import { SupabasePaymentTransactionRepository } from "../supabase-payment-transaction-repository";
import { SupabasePaymentRefundRepository } from "../supabase-payment-refund-repository";
import { SupabaseWebhookEventRepository } from "../supabase-webhook-event-repository";

describe("Payment Foundation Repositories Suite (Step 1)", () => {
  // ============================================================================
  // 1. Consultation Slot Repository Tests
  // ============================================================================
  describe("SupabaseConsultationSlotRepository", () => {
    it("creates a consultation slot and maps fields correctly", async () => {
      const mockSlotRow = {
        id: "slot-uuid-1",
        start_time: "2026-10-01T10:00:00.000Z",
        end_time: "2026-10-01T11:00:00.000Z",
        status: "available",
        reserved_until: null,
        reservation_token: null,
        created_at: "2026-09-14T10:00:00.000Z",
        updated_at: "2026-09-14T10:00:00.000Z",
      };

      const mockClient = {
        from: vi.fn().mockReturnValue({
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: mockSlotRow, error: null }),
            }),
          }),
        }),
      } as unknown as SupabaseClient;

      const repo = new SupabaseConsultationSlotRepository(mockClient);
      const slot = await repo.createSlot({
        startTime: "2026-10-01T10:00:00.000Z",
        endTime: "2026-10-01T11:00:00.000Z",
      });

      expect(slot.id).toBe("slot-uuid-1");
      expect(slot.status).toBe("available");
      expect(slot.startTime).toBe("2026-10-01T10:00:00.000Z");
      expect(slot.endTime).toBe("2026-10-01T11:00:00.000Z");
    });

    it("retrieves slot by ID or returns null when missing", async () => {
      const mockClient = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
        }),
      } as unknown as SupabaseClient;

      const repo = new SupabaseConsultationSlotRepository(mockClient);
      const slot = await repo.getSlotById("non-existent-id");
      expect(slot).toBeNull();
    });

    it("updates slot status and reservation metadata", async () => {
      const updatedRow = {
        id: "slot-uuid-1",
        start_time: "2026-10-01T10:00:00.000Z",
        end_time: "2026-10-01T11:00:00.000Z",
        status: "reserved",
        reserved_until: "2026-10-01T09:45:00.000Z",
        reservation_token: "token-nonce-123",
        created_at: "2026-09-14T10:00:00.000Z",
        updated_at: "2026-09-14T10:05:00.000Z",
      };

      const mockClient = {
        from: vi.fn().mockReturnValue({
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: updatedRow, error: null }),
              }),
            }),
          }),
        }),
      } as unknown as SupabaseClient;

      const repo = new SupabaseConsultationSlotRepository(mockClient);
      const slot = await repo.updateSlotStatus("slot-uuid-1", "reserved", {
        reservedUntil: "2026-10-01T09:45:00.000Z",
        reservationToken: "token-nonce-123",
      });

      expect(slot.status).toBe("reserved");
      expect(slot.reservationToken).toBe("token-nonce-123");
    });
  });

  // ============================================================================
  // 2. Consultation Repository Tests
  // ============================================================================
  describe("SupabaseConsultationRepository", () => {
    it("persists a consultation with denormalized customer snapshot and nullable slotId", async () => {
      const mockConsultationRow = {
        id: "consultation-uuid-1",
        slot_id: null,
        customer_first_name: "Priya",
        customer_last_name: "Kapoor",
        customer_phone: "9876543210",
        customer_email: "priya@example.com",
        customer_city: "Mumbai",
        event_type: "Diwali Special",
        event_type_other: null,
        guest_count: "10–30 guests",
        event_date_approx: "November 2026",
        meeting_channel: "video",
        status: "draft",
        cancellation_reason: null,
        rescheduled_from_id: null,
        reschedule_count: 0,
        request_id: "req_test_123",
        created_at: "2026-09-14T10:00:00.000Z",
        updated_at: "2026-09-14T10:00:00.000Z",
      };

      const mockClient = {
        from: vi.fn().mockReturnValue({
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: mockConsultationRow, error: null }),
            }),
          }),
        }),
      } as unknown as SupabaseClient;

      const repo = new SupabaseConsultationRepository(mockClient);
      const record = await repo.createConsultation({
        customerFirstName: "Priya",
        customerLastName: "Kapoor",
        customerPhone: "9876543210",
        customerEmail: "priya@example.com",
        customerCity: "Mumbai",
        eventType: "Diwali Special",
        meetingChannel: "video",
        guestCount: "10–30 guests",
        eventDateApprox: "November 2026",
        requestId: "req_test_123",
      });

      expect(record.id).toBe("consultation-uuid-1");
      expect(record.slotId).toBeNull();
      expect(record.customerFirstName).toBe("Priya");
      expect(record.status).toBe("draft");
      expect(record.meetingChannel).toBe("video");
    });

    it("updates consultation status to slot_conflict_pending_reschedule", async () => {
      const updatedRow = {
        id: "consultation-uuid-1",
        slot_id: null,
        customer_first_name: "Priya",
        customer_last_name: "Kapoor",
        customer_phone: "9876543210",
        customer_email: "priya@example.com",
        customer_city: "Mumbai",
        event_type: "Diwali Special",
        event_type_other: null,
        guest_count: null,
        event_date_approx: null,
        meeting_channel: "video",
        status: "slot_conflict_pending_reschedule",
        cancellation_reason: "Slot expired before payment confirmed",
        rescheduled_from_id: null,
        reschedule_count: 0,
        request_id: null,
        created_at: "2026-09-14T10:00:00.000Z",
        updated_at: "2026-09-14T10:15:00.000Z",
      };

      const mockClient = {
        from: vi.fn().mockReturnValue({
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: updatedRow, error: null }),
              }),
            }),
          }),
        }),
      } as unknown as SupabaseClient;

      const repo = new SupabaseConsultationRepository(mockClient);
      const record = await repo.updateConsultationStatus(
        "consultation-uuid-1",
        "slot_conflict_pending_reschedule",
        { cancellationReason: "Slot expired before payment confirmed" }
      );

      expect(record.status).toBe("slot_conflict_pending_reschedule");
      expect(record.cancellationReason).toBe("Slot expired before payment confirmed");
    });
  });

  // ============================================================================
  // 3. Payment Order Repository Tests
  // ============================================================================
  describe("SupabasePaymentOrderRepository", () => {
    it("strictly rejects non-positive or non-integer amount in paise", async () => {
      const mockClient = {} as SupabaseClient;
      const repo = new SupabasePaymentOrderRepository(mockClient);

      await expect(
        repo.createOrder({
          consultationId: "c-1",
          amountInPaise: 0,
        })
      ).rejects.toThrow("strictly positive integer");

      await expect(
        repo.createOrder({
          consultationId: "c-1",
          amountInPaise: 2999.5, // floating-point money forbidden!
        })
      ).rejects.toThrow("strictly positive integer");
    });

    it("creates an internal payment order with integer paise and nullable gateway_order_id", async () => {
      const mockOrderRow = {
        id: "order-uuid-1",
        consultation_id: "c-uuid-1",
        gateway_order_id: null,
        amount_in_paise: 299900, // ₹2,999
        currency: "INR",
        status: "created",
        expires_at: "2026-09-14T10:30:00.000Z",
        paid_at: null,
        request_id: "req_order_123",
        created_at: "2026-09-14T10:15:00.000Z",
        updated_at: "2026-09-14T10:15:00.000Z",
      };

      const mockClient = {
        from: vi.fn().mockReturnValue({
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: mockOrderRow, error: null }),
            }),
          }),
        }),
      } as unknown as SupabaseClient;

      const repo = new SupabasePaymentOrderRepository(mockClient);
      const order = await repo.createOrder({
        consultationId: "c-uuid-1",
        amountInPaise: 299900,
        requestId: "req_order_123",
      });

      expect(order.id).toBe("order-uuid-1");
      expect(order.amountInPaise).toBe(299900);
      expect(order.currency).toBe("INR");
      expect(order.gatewayOrderId).toBeNull();
      expect(order.status).toBe("created");
    });
  });

  // ============================================================================
  // 4. Payment Transaction Repository Tests
  // ============================================================================
  describe("SupabasePaymentTransactionRepository", () => {
    it("strictly rejects non-positive or non-integer transaction amount", async () => {
      const mockClient = {} as SupabaseClient;
      const repo = new SupabasePaymentTransactionRepository(mockClient);

      await expect(
        repo.recordTransaction({
          paymentOrderId: "order-1",
          amountInPaise: -100,
        })
      ).rejects.toThrow("strictly positive integer");
    });

    it("appends an immutable transaction record", async () => {
      const mockTransRow = {
        id: "trans-uuid-1",
        payment_order_id: "order-uuid-1",
        gateway_payment_id: "cf_pay_12345",
        amount_in_paise: 299900,
        fee_in_paise: 5998,
        tax_in_paise: 1080,
        status: "success",
        payment_method: "upi",
        bank_reference: "123456789012",
        error_code: null,
        error_description: null,
        created_at: "2026-09-14T10:20:00.000Z",
      };

      const mockClient = {
        from: vi.fn().mockReturnValue({
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: mockTransRow, error: null }),
            }),
          }),
        }),
      } as unknown as SupabaseClient;

      const repo = new SupabasePaymentTransactionRepository(mockClient);
      const trans = await repo.recordTransaction({
        paymentOrderId: "order-uuid-1",
        gatewayPaymentId: "cf_pay_12345",
        amountInPaise: 299900,
        feeInPaise: 5998,
        taxInPaise: 1080,
        status: "success",
        paymentMethod: "upi",
        bankReference: "123456789012",
      });

      expect(trans.id).toBe("trans-uuid-1");
      expect(trans.amountInPaise).toBe(299900);
      expect(trans.feeInPaise).toBe(5998);
      expect(trans.paymentMethod).toBe("upi");
      expect(trans.status).toBe("success");
    });
  });

  // ============================================================================
  // 5. Payment Refund Repository Tests
  // ============================================================================
  describe("SupabasePaymentRefundRepository", () => {
    it("creates a refund record with integer paise and initiator audit", async () => {
      const mockRefundRow = {
        id: "refund-uuid-1",
        payment_order_id: "order-uuid-1",
        payment_transaction_id: "trans-uuid-1",
        consultation_id: "c-uuid-1",
        gateway_refund_id: null,
        amount_in_paise: 299900,
        status: "pending",
        reason: "Customer cancelled prior to 2h cutoff",
        initiated_by: "customer",
        processed_at: null,
        created_at: "2026-09-14T11:00:00.000Z",
        updated_at: "2026-09-14T11:00:00.000Z",
      };

      const mockClient = {
        from: vi.fn().mockReturnValue({
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: mockRefundRow, error: null }),
            }),
          }),
        }),
      } as unknown as SupabaseClient;

      const repo = new SupabasePaymentRefundRepository(mockClient);
      const refund = await repo.createRefund({
        paymentOrderId: "order-uuid-1",
        paymentTransactionId: "trans-uuid-1",
        consultationId: "c-uuid-1",
        amountInPaise: 299900,
        reason: "Customer cancelled prior to 2h cutoff",
        initiatedBy: "customer",
      });

      expect(refund.id).toBe("refund-uuid-1");
      expect(refund.amountInPaise).toBe(299900);
      expect(refund.status).toBe("pending");
      expect(refund.initiatedBy).toBe("customer");
    });
  });

  // ============================================================================
  // 6. Webhook Event Repository Tests
  // ============================================================================
  describe("SupabaseWebhookEventRepository", () => {
    it("records an inbound webhook event for idempotency and audit", async () => {
      const mockWebhookRow = {
        id: "event-uuid-1",
        provider: "cashfree",
        event_id: "evt_123456789",
        event_type: "PAYMENT_SUCCESS_WEBHOOK",
        payload: { order_id: "cf_order_99", status: "SUCCESS" },
        signature: "sig_abc123xyz",
        status: "received",
        processing_error: null,
        processed_at: null,
        created_at: "2026-09-14T10:22:00.000Z",
      };

      const mockClient = {
        from: vi.fn().mockReturnValue({
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: mockWebhookRow, error: null }),
            }),
          }),
        }),
      } as unknown as SupabaseClient;

      const repo = new SupabaseWebhookEventRepository(mockClient);
      const event = await repo.recordWebhookEvent({
        provider: "cashfree",
        eventId: "evt_123456789",
        eventType: "PAYMENT_SUCCESS_WEBHOOK",
        payload: { order_id: "cf_order_99", status: "SUCCESS" },
        signature: "sig_abc123xyz",
      });

      expect(event.id).toBe("event-uuid-1");
      expect(event.eventId).toBe("evt_123456789");
      expect(event.eventType).toBe("PAYMENT_SUCCESS_WEBHOOK");
      expect(event.status).toBe("received");
    });

    it("retrieves a webhook event by provider and event ID", async () => {
      const mockWebhookRow = {
        id: "event-uuid-1",
        provider: "cashfree",
        event_id: "evt_123456789",
        event_type: "PAYMENT_SUCCESS_WEBHOOK",
        payload: {},
        signature: "sig",
        status: "processed",
        processing_error: null,
        processed_at: "2026-09-14T10:23:00.000Z",
        created_at: "2026-09-14T10:22:00.000Z",
      };

      const mockClient = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: mockWebhookRow, error: null }),
              }),
            }),
          }),
        }),
      } as unknown as SupabaseClient;

      const repo = new SupabaseWebhookEventRepository(mockClient);
      const event = await repo.getWebhookEvent("cashfree", "evt_123456789");

      expect(event).not.toBeNull();
      expect(event?.status).toBe("processed");
    });
  });
});
