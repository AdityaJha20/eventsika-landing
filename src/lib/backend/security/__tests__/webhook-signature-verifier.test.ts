import { describe, expect, it } from "vitest";
import {
  computeCashfreeWebhookSignature,
  normalizeWebhookTimestamp,
  verifyCashfreeWebhookSignature,
  DEFAULT_WEBHOOK_TOLERANCE_MS,
} from "../webhook-signature-verifier";

describe("Cashfree Webhook Signature Verifier (Step 6A)", () => {
  const TEST_SECRET = "test_cashfree_secret_key_1234567890abcdef";
  const BASE_TIME_MS = 1770000000000; // Fixed deterministic baseline timestamp
  const RAW_PAYLOAD = JSON.stringify({
    data: {
      order: { order_id: "ord_12345" },
      payment: { cf_payment_id: "987654" },
    },
    type: "PAYMENT_SUCCESS_WEBHOOK",
  });

  // ============================================================================
  // 1. Signature Computation & Verification Tests
  // ============================================================================

  it("test 1: accepts a valid signature matching payload and timestamp", () => {
    const rawTimestamp = String(BASE_TIME_MS);
    const validSignature = computeCashfreeWebhookSignature(
      RAW_PAYLOAD,
      rawTimestamp,
      TEST_SECRET
    );

    const result = verifyCashfreeWebhookSignature({
      rawBody: RAW_PAYLOAD,
      signature: validSignature,
      timestamp: rawTimestamp,
      secretKey: TEST_SECRET,
      currentTimestampMs: BASE_TIME_MS,
    });

    expect(result.isValid).toBe(true);
    expect(result.code).toBe("VALID");
    expect(result.timestampMs).toBe(BASE_TIME_MS);
    expect(result.error).toBeUndefined();
  });

  it("test 2: rejects an incorrect/tampered signature", () => {
    const rawTimestamp = String(BASE_TIME_MS);
    const validSignature = computeCashfreeWebhookSignature(
      RAW_PAYLOAD,
      rawTimestamp,
      TEST_SECRET
    );
    // Tamper with the last character of Base64 signature
    const tamperedSignature =
      validSignature.slice(0, -2) + (validSignature.endsWith("A=") ? "B=" : "A=");

    const result = verifyCashfreeWebhookSignature({
      rawBody: RAW_PAYLOAD,
      signature: tamperedSignature,
      timestamp: rawTimestamp,
      secretKey: TEST_SECRET,
      currentTimestampMs: BASE_TIME_MS,
    });

    expect(result.isValid).toBe(false);
    expect(result.code).toBe("INVALID_SIGNATURE");
    expect(result.error).toContain("Webhook signature verification failed");
  });

  it("test 3: rejects when raw body has been modified after signature calculation", () => {
    const rawTimestamp = String(BASE_TIME_MS);
    const signature = computeCashfreeWebhookSignature(
      RAW_PAYLOAD,
      rawTimestamp,
      TEST_SECRET
    );

    // Tampered body (extra space or changed byte)
    const tamperedBody = RAW_PAYLOAD + " ";

    const result = verifyCashfreeWebhookSignature({
      rawBody: tamperedBody,
      signature,
      timestamp: rawTimestamp,
      secretKey: TEST_SECRET,
      currentTimestampMs: BASE_TIME_MS,
    });

    expect(result.isValid).toBe(false);
    expect(result.code).toBe("INVALID_SIGNATURE");
  });

  it("test 4: rejects missing signature header (null, undefined, empty, whitespace)", () => {
    const rawTimestamp = String(BASE_TIME_MS);

    const cases = [null, undefined, "", "   "];
    for (const invalidSig of cases) {
      const result = verifyCashfreeWebhookSignature({
        rawBody: RAW_PAYLOAD,
        signature: invalidSig,
        timestamp: rawTimestamp,
        secretKey: TEST_SECRET,
        currentTimestampMs: BASE_TIME_MS,
      });

      expect(result.isValid).toBe(false);
      expect(result.code).toBe("MISSING_SIGNATURE");
    }
  });

  it("test 5: rejects missing timestamp header (null, undefined, empty, whitespace)", () => {
    const validSignature = computeCashfreeWebhookSignature(
      RAW_PAYLOAD,
      String(BASE_TIME_MS),
      TEST_SECRET
    );

    const cases = [null, undefined, "", "   "];
    for (const invalidTs of cases) {
      const result = verifyCashfreeWebhookSignature({
        rawBody: RAW_PAYLOAD,
        signature: validSignature,
        timestamp: invalidTs,
        secretKey: TEST_SECRET,
        currentTimestampMs: BASE_TIME_MS,
      });

      expect(result.isValid).toBe(false);
      expect(result.code).toBe("MISSING_TIMESTAMP");
    }
  });

  it("test 6: rejects invalid or unparseable timestamps (NaN, negative, malformed string)", () => {
    const validSignature = computeCashfreeWebhookSignature(
      RAW_PAYLOAD,
      "invalid_timestamp",
      TEST_SECRET
    );

    const invalidTimestamps = ["invalid_str", "NaN", -1000, 0, "2026-99-99T99:99:99Z"];
    for (const invalidTs of invalidTimestamps) {
      const result = verifyCashfreeWebhookSignature({
        rawBody: RAW_PAYLOAD,
        signature: validSignature,
        timestamp: invalidTs,
        secretKey: TEST_SECRET,
        currentTimestampMs: BASE_TIME_MS,
      });

      expect(result.isValid).toBe(false);
      expect(result.code).toBe("INVALID_TIMESTAMP");
    }
  });

  it("test 7: rejects timestamps outside the 5-minute replay window", () => {
    const tolerance = DEFAULT_WEBHOOK_TOLERANCE_MS; // 300,000 ms

    // Case A: 300,001 ms in the past (too old)
    const oldTimestampMs = BASE_TIME_MS - (tolerance + 1);
    const oldSig = computeCashfreeWebhookSignature(
      RAW_PAYLOAD,
      String(oldTimestampMs),
      TEST_SECRET
    );

    const oldResult = verifyCashfreeWebhookSignature({
      rawBody: RAW_PAYLOAD,
      signature: oldSig,
      timestamp: String(oldTimestampMs),
      secretKey: TEST_SECRET,
      currentTimestampMs: BASE_TIME_MS,
    });

    expect(oldResult.isValid).toBe(false);
    expect(oldResult.code).toBe("TIMESTAMP_OUT_OF_WINDOW");

    // Case B: 300,001 ms in the future (future clock drift too large)
    const futureTimestampMs = BASE_TIME_MS + (tolerance + 1);
    const futureSig = computeCashfreeWebhookSignature(
      RAW_PAYLOAD,
      String(futureTimestampMs),
      TEST_SECRET
    );

    const futureResult = verifyCashfreeWebhookSignature({
      rawBody: RAW_PAYLOAD,
      signature: futureSig,
      timestamp: String(futureTimestampMs),
      secretKey: TEST_SECRET,
      currentTimestampMs: BASE_TIME_MS,
    });

    expect(futureResult.isValid).toBe(false);
    expect(futureResult.code).toBe("TIMESTAMP_OUT_OF_WINDOW");
  });

  it("test 8: accepts timestamps exactly at the allowed 5-minute boundary", () => {
    const tolerance = DEFAULT_WEBHOOK_TOLERANCE_MS; // 300,000 ms

    // Exact past boundary (exactly 300,000 ms ago)
    const exactPastMs = BASE_TIME_MS - tolerance;
    const pastSig = computeCashfreeWebhookSignature(
      RAW_PAYLOAD,
      String(exactPastMs),
      TEST_SECRET
    );

    const pastResult = verifyCashfreeWebhookSignature({
      rawBody: RAW_PAYLOAD,
      signature: pastSig,
      timestamp: String(exactPastMs),
      secretKey: TEST_SECRET,
      currentTimestampMs: BASE_TIME_MS,
    });

    expect(pastResult.isValid).toBe(true);
    expect(pastResult.code).toBe("VALID");

    // Exact future boundary (exactly 300,000 ms ahead)
    const exactFutureMs = BASE_TIME_MS + tolerance;
    const futureSig = computeCashfreeWebhookSignature(
      RAW_PAYLOAD,
      String(exactFutureMs),
      TEST_SECRET
    );

    const futureResult = verifyCashfreeWebhookSignature({
      rawBody: RAW_PAYLOAD,
      signature: futureSig,
      timestamp: String(exactFutureMs),
      secretKey: TEST_SECRET,
      currentTimestampMs: BASE_TIME_MS,
    });

    expect(futureResult.isValid).toBe(true);
    expect(futureResult.code).toBe("VALID");
  });

  it("test 9: timing-safe byte comparison path compares equal-length buffers securely", () => {
    const rawTimestamp = String(BASE_TIME_MS);
    const validSignature = computeCashfreeWebhookSignature(
      RAW_PAYLOAD,
      rawTimestamp,
      TEST_SECRET
    );

    // Signature with exact same buffer length (44 bytes base64) but 1 character flipped
    const charToSwap = validSignature[10] === "a" ? "b" : "a";
    const sameLengthInvalidSig =
      validSignature.slice(0, 10) + charToSwap + validSignature.slice(11);

    expect(Buffer.from(sameLengthInvalidSig).length).toBe(
      Buffer.from(validSignature).length
    );

    const result = verifyCashfreeWebhookSignature({
      rawBody: RAW_PAYLOAD,
      signature: sameLengthInvalidSig,
      timestamp: rawTimestamp,
      secretKey: TEST_SECRET,
      currentTimestampMs: BASE_TIME_MS,
    });

    expect(result.isValid).toBe(false);
    expect(result.code).toBe("INVALID_SIGNATURE");
  });

  it("test 10: different signature lengths do not crash or throw RangeError", () => {
    const rawTimestamp = String(BASE_TIME_MS);

    // Completely different length signatures (short, long, empty bytes)
    const arbitrarySignatures = [
      "a",
      "short",
      "dG9vX3Nob3J0",
      "a".repeat(128),
      "not_even_base64!@#$%",
    ];

    for (const arbitrarySig of arbitrarySignatures) {
      expect(() => {
        const result = verifyCashfreeWebhookSignature({
          rawBody: RAW_PAYLOAD,
          signature: arbitrarySig,
          timestamp: rawTimestamp,
          secretKey: TEST_SECRET,
          currentTimestampMs: BASE_TIME_MS,
        });
        expect(result.isValid).toBe(false);
        expect(result.code).toBe("INVALID_SIGNATURE");
      }).not.toThrow();
    }
  });

  it("test 11: empty body and UTF-8 payloads hash and verify correctly", () => {
    const rawTimestamp = String(BASE_TIME_MS);

    // Empty body
    const emptySig = computeCashfreeWebhookSignature("", rawTimestamp, TEST_SECRET);
    const emptyResult = verifyCashfreeWebhookSignature({
      rawBody: "",
      signature: emptySig,
      timestamp: rawTimestamp,
      secretKey: TEST_SECRET,
      currentTimestampMs: BASE_TIME_MS,
    });
    expect(emptyResult.isValid).toBe(true);

    // Unicode body with ₹ symbol and Hindi characters
    const unicodeBody = JSON.stringify({ note: "भुगतान ₹2,999 सफल रहा" });
    const unicodeSig = computeCashfreeWebhookSignature(unicodeBody, rawTimestamp, TEST_SECRET);
    const unicodeResult = verifyCashfreeWebhookSignature({
      rawBody: unicodeBody,
      signature: unicodeSig,
      timestamp: rawTimestamp,
      secretKey: TEST_SECRET,
      currentTimestampMs: BASE_TIME_MS,
    });
    expect(unicodeResult.isValid).toBe(true);
  });

  it("test 12: verifier never leaks the secret key or signature in return values", () => {
    const result = verifyCashfreeWebhookSignature({
      rawBody: RAW_PAYLOAD,
      signature: "invalid_signature",
      timestamp: String(BASE_TIME_MS),
      secretKey: TEST_SECRET,
      currentTimestampMs: BASE_TIME_MS,
    });

    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain(TEST_SECRET);
    expect(serialized).not.toContain("invalid_signature");
  });

  it("test 13: correct Base64 output handling and formatting", () => {
    const rawTimestamp = String(BASE_TIME_MS);
    const sig = computeCashfreeWebhookSignature(RAW_PAYLOAD, rawTimestamp, TEST_SECRET);

    // Base64 HMAC-SHA256 is 32 bytes binary -> exactly 44 Base64 characters (including padding)
    expect(sig).toHaveLength(44);
    expect(sig).toMatch(/^[A-Za-z0-9+/]{43}=$/);

    // Verifier accepts correctly formatted base64 signature with surrounding whitespace trimmed
    const paddedSig = `  ${sig}  `;
    const result = verifyCashfreeWebhookSignature({
      rawBody: RAW_PAYLOAD,
      signature: paddedSig,
      timestamp: rawTimestamp,
      secretKey: TEST_SECRET,
      currentTimestampMs: BASE_TIME_MS,
    });
    expect(result.isValid).toBe(true);
    expect(result.code).toBe("VALID");
  });

  it("test 14: normalizes epoch seconds, epoch milliseconds, and ISO-8601 timestamps", () => {
    // 10-digit epoch seconds (~1.77 billion seconds)
    const secondsNum = 1770000000;
    expect(normalizeWebhookTimestamp(secondsNum)).toBe(1770000000000);
    expect(normalizeWebhookTimestamp(String(secondsNum))).toBe(1770000000000);

    // 13-digit epoch milliseconds
    const msNum = 1770000000000;
    expect(normalizeWebhookTimestamp(msNum)).toBe(1770000000000);
    expect(normalizeWebhookTimestamp(String(msNum))).toBe(1770000000000);

    // ISO-8601 String
    const isoString = "2026-10-06T12:00:00.000Z";
    const expectedIsoMs = Date.parse(isoString);
    expect(normalizeWebhookTimestamp(isoString)).toBe(expectedIsoMs);

    // Invalid timestamps return null
    expect(normalizeWebhookTimestamp("")).toBeNull();
    expect(normalizeWebhookTimestamp("   ")).toBeNull();
    expect(normalizeWebhookTimestamp("abc")).toBeNull();
    expect(normalizeWebhookTimestamp(-100)).toBeNull();
    expect(normalizeWebhookTimestamp(0)).toBeNull();
    expect(normalizeWebhookTimestamp(Number.NaN)).toBeNull();
  });

  it("test 15: rejects when secret key is completely missing or empty", () => {
    const rawTimestamp = String(BASE_TIME_MS);
    const sig = computeCashfreeWebhookSignature(RAW_PAYLOAD, rawTimestamp, TEST_SECRET);

    const emptySecrets = ["", "   ", undefined];
    for (const secret of emptySecrets) {
      const result = verifyCashfreeWebhookSignature({
        rawBody: RAW_PAYLOAD,
        signature: sig,
        timestamp: rawTimestamp,
        secretKey: secret,
        currentTimestampMs: BASE_TIME_MS,
      });

      expect(result.isValid).toBe(false);
      expect(result.code).toBe("MISSING_SECRET");
    }
  });

  it("test 16: rejects missing or non-string rawBody with MISSING_RAW_BODY", () => {
    const rawTimestamp = String(BASE_TIME_MS);
    const validSignature = computeCashfreeWebhookSignature(
      RAW_PAYLOAD,
      rawTimestamp,
      TEST_SECRET
    );

    const invalidBodies = [null, undefined, 12345, {}, true];
    for (const badBody of invalidBodies) {
      const result = verifyCashfreeWebhookSignature({
        rawBody: badBody as unknown as string,
        signature: validSignature,
        timestamp: rawTimestamp,
        secretKey: TEST_SECRET,
        currentTimestampMs: BASE_TIME_MS,
      });

      expect(result.isValid).toBe(false);
      expect(result.code).toBe("MISSING_RAW_BODY");
      expect(result.error).toContain("Missing or invalid rawBody");
    }
  });
});

