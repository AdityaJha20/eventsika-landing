import { describe, it, expect } from "vitest";
import { validatePaymentOrderInput } from "../payment-order-schema";

describe("Payment Order Schema Validation Suite", () => {
  const validConsultationId = "c7c88b90-d461-4fa3-a75d-f152d113ba4c";
  const validReservationToken =
    "a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90"; // 64 hex chars

  it("successfully validates correct consultationId and reservationToken", () => {
    const result = validatePaymentOrderInput({
      consultationId: validConsultationId,
      reservationToken: validReservationToken,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.consultationId).toBe(validConsultationId);
      expect(result.data.reservationToken).toBe(validReservationToken);
    }
  });

  it("rejects null or non-object payloads", () => {
    expect(validatePaymentOrderInput(null).success).toBe(false);
    expect(validatePaymentOrderInput(undefined).success).toBe(false);
    expect(validatePaymentOrderInput("string").success).toBe(false);
    expect(validatePaymentOrderInput(12345).success).toBe(false);
    expect(validatePaymentOrderInput([]).success).toBe(false);
  });

  it("rejects missing or empty consultationId", () => {
    const missing = validatePaymentOrderInput({
      reservationToken: validReservationToken,
    });
    expect(missing.success).toBe(false);
    if (!missing.success) {
      expect(missing.error).toContain("consultation identifier");
    }

    const empty = validatePaymentOrderInput({
      consultationId: "   ",
      reservationToken: validReservationToken,
    });
    expect(empty.success).toBe(false);
  });

  it("rejects malformed consultationId UUID format", () => {
    const invalidUuids = [
      "not-a-uuid",
      "12345",
      "c7c88b90-d461-4fa3-a75d-f152d113ba4", // too short (35 chars)
      "c7c88b90-d461-4fa3-a75d-f152d113ba4c-extra",
      "c7c88b90_d461_4fa3_a75d_f152d113ba4c",
    ];

    for (const badUuid of invalidUuids) {
      const result = validatePaymentOrderInput({
        consultationId: badUuid,
        reservationToken: validReservationToken,
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("Invalid consultation identifier format");
      }
    }
  });

  it("rejects missing or empty reservationToken", () => {
    const missing = validatePaymentOrderInput({
      consultationId: validConsultationId,
    });
    expect(missing.success).toBe(false);
    if (!missing.success) {
      expect(missing.error).toContain("reservation token");
    }

    const empty = validatePaymentOrderInput({
      consultationId: validConsultationId,
      reservationToken: "   ",
    });
    expect(empty.success).toBe(false);
  });

  it("rejects reservation tokens with invalid length or non-hex characters", () => {
    const invalidTokens = [
      "short_token", // < 64 chars
      "a".repeat(63), // 63 chars (too short)
      "a".repeat(65), // 65 chars (too long)
      "z".repeat(64), // 'z' is not a hexadecimal character!
      "a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f9!", // special char
      "a1b2c3d4 e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90", // space
    ];

    for (const badToken of invalidTokens) {
      const result = validatePaymentOrderInput({
        consultationId: validConsultationId,
        reservationToken: badToken,
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("64-character hexadecimal");
      }
    }
  });

  it("strictly enforces UUIDv4 and rejects non-v4 UUIDs (v1, v2, v3, v5)", () => {
    const nonV4Uuids = [
      "c7c88b90-d461-1fa3-a75d-f152d113ba4c", // UUIDv1
      "c7c88b90-d461-2fa3-a75d-f152d113ba4c", // UUIDv2
      "c7c88b90-d461-3fa3-a75d-f152d113ba4c", // UUIDv3
      "c7c88b90-d461-5fa3-a75d-f152d113ba4c", // UUIDv5
    ];

    for (const badVersionUuid of nonV4Uuids) {
      const result = validatePaymentOrderInput({
        consultationId: badVersionUuid,
        reservationToken: validReservationToken,
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("Invalid consultation identifier format");
      }
    }
  });

  it("strictly rejects uppercase characters in reservationToken (enforcing lowercase hexadecimal)", () => {
    const uppercaseTokens = [
      validReservationToken.toUpperCase(),
      "A" + validReservationToken.slice(1),
      validReservationToken.slice(0, 63) + "F",
    ];

    for (const upperToken of uppercaseTokens) {
      const result = validatePaymentOrderInput({
        consultationId: validConsultationId,
        reservationToken: upperToken,
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("64-character hexadecimal");
      }
    }
  });

  it("strictly rejects client attempts to override pricing or payment parameters", () => {
    const tamperingAttempts = [
      { amount: 100 },
      { amountInPaise: 100 },
      { currency: "USD" },
      { status: "paid" },
      { gatewayOrderId: "ord_hacked" },
      { paymentSessionId: "session_fake" },
    ];

    for (const attempt of tamperingAttempts) {
      const result = validatePaymentOrderInput({
        consultationId: validConsultationId,
        reservationToken: validReservationToken,
        ...attempt,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("forbidden");
        expect(result.error).toContain("server-authoritative");
      }
    }
  });

  it("rejects non-string field types", () => {
    expect(
      validatePaymentOrderInput({
        consultationId: 12345,
        reservationToken: validReservationToken,
      }).success
    ).toBe(false);

    expect(
      validatePaymentOrderInput({
        consultationId: validConsultationId,
        reservationToken: true,
      }).success
    ).toBe(false);
  });
});
