import { describe, it, expect } from "vitest";
import { getOrCreateRequestId } from "../request-id";
import { NextRequest } from "next/server";

describe("getOrCreateRequestId", () => {
  it("should generate a valid request ID when no request is provided", () => {
    const id = getOrCreateRequestId();
    expect(id).toMatch(/^req_[a-z0-9]+_[a-f0-9]{6}$/);
  });

  it("should generate unique IDs", () => {
    const id1 = getOrCreateRequestId();
    const id2 = getOrCreateRequestId();
    expect(id1).not.toBe(id2);
  });

  it("should use existing x-request-id header if it is valid", () => {
    const mockRequest = new NextRequest("http://localhost", {
      headers: new Headers({
        "x-request-id": "valid_existing_id_123",
      }),
    });

    const id = getOrCreateRequestId(mockRequest);
    expect(id).toBe("valid_existing_id_123");
  });

  it("should generate a new ID if existing x-request-id is invalid (too long)", () => {
    const mockRequest = new NextRequest("http://localhost", {
      headers: new Headers({
        "x-request-id": "a".repeat(65),
      }),
    });

    const id = getOrCreateRequestId(mockRequest);
    expect(id).toMatch(/^req_[a-z0-9]+_[a-f0-9]{6}$/);
    expect(id).not.toBe("a".repeat(65));
  });

  it("should generate a new ID if existing x-request-id is invalid (invalid characters)", () => {
    const mockRequest = new NextRequest("http://localhost", {
      headers: new Headers({
        "x-request-id": "invalid!@#id",
      }),
    });

    const id = getOrCreateRequestId(mockRequest);
    expect(id).toMatch(/^req_[a-z0-9]+_[a-f0-9]{6}$/);
    expect(id).not.toBe("invalid!@#id");
  });
});
