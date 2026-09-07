import { describe, it, expect, vi } from "vitest";
import { SupabaseVendorRepository } from "../supabase-vendor-repository";
import { InMemoryVendorRepository } from "../in-memory-vendor-repository";
import { SupabaseClient } from "@supabase/supabase-js";
import { ValidatedVendorInput } from "../../validation/vendor-schema";

describe("Vendor Repositories Contract Suite", () => {
  describe("InMemoryVendorRepository", () => {
    it("returns stored vendor applications and maintains array isolation", async () => {
      const repo = new InMemoryVendorRepository();
      const mockVendor: ValidatedVendorInput = {
        businessName: "Royal Mandap Decor",
        contactName: "Rajesh Kumar",
        phone: "9876543210",
        email: "rajesh@royalmandap.in",
        city: "Delhi",
        experience: "5–10 Years",
        portfolioUrl: "https://instagram.com/royalmandap",
        categories: ["Decor & Styling"],
        isBot: false,
      };

      await repo.saveVendorApplication(mockVendor);
      const records = await repo.getAllVendorApplications();

      expect(records).toHaveLength(1);
      expect(records[0].businessName).toBe("Royal Mandap Decor");

      // Verify array immutability: mutating returned array does not corrupt repo
      records.pop();
      const recordsAfterPop = await repo.getAllVendorApplications();
      expect(recordsAfterPop).toHaveLength(1);
    });
  });

  describe("SupabaseVendorRepository", () => {
    it("queries vendor_applications with exact explicit columns, created_at descending, and maps fields", async () => {
      const mockRawRows = [
        {
          id: "mock-uuid-1",
          business_name: "Shahi Catering Co",
          contact_name: "Anita Sharma",
          phone: "9876543211",
          email: "anita@shahicatering.in",
          city: "Jaipur",
          experience: "3–5 Years",
          portfolio_url: "https://shahicatering.in",
          categories: ["Catering & Live Food"],
          created_at: "2026-09-07T10:00:00.000Z",
          request_id: "req-abc-123",
        },
      ];

      const orderMock = vi.fn().mockResolvedValue({ data: mockRawRows, error: null });
      const selectMock = vi.fn().mockReturnValue({ order: orderMock });
      const fromMock = vi.fn().mockReturnValue({ select: selectMock });

      const mockSupabaseClient = {
        from: fromMock,
      } as unknown as SupabaseClient;

      const repo = new SupabaseVendorRepository(mockSupabaseClient);
      const results = await repo.getAllVendorApplications();

      // Assert table name
      expect(fromMock).toHaveBeenCalledWith("vendor_applications");

      // Assert exact explicit column selection (no select *)
      expect(selectMock).toHaveBeenCalledWith(
        "id, business_name, contact_name, phone, email, city, experience, portfolio_url, categories, created_at, request_id"
      );

      // Assert descending order
      expect(orderMock).toHaveBeenCalledWith("created_at", { ascending: false });

      // Assert mapping
      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({
        id: "mock-uuid-1",
        businessName: "Shahi Catering Co",
        contactName: "Anita Sharma",
        phone: "9876543211",
        email: "anita@shahicatering.in",
        city: "Jaipur",
        experience: "3–5 Years",
        portfolioUrl: "https://shahicatering.in",
        categories: ["Catering & Live Food"],
        isBot: false,
        requestId: "req-abc-123",
        createdAt: "2026-09-07T10:00:00.000Z",
      });
    });

    it("propagates database errors cleanly without masking", async () => {
      const orderMock = vi.fn().mockResolvedValue({
        data: null,
        error: { message: "Connection reset by peer" },
      });
      const selectMock = vi.fn().mockReturnValue({ order: orderMock });
      const fromMock = vi.fn().mockReturnValue({ select: selectMock });

      const mockSupabaseClient = {
        from: fromMock,
      } as unknown as SupabaseClient;

      const repo = new SupabaseVendorRepository(mockSupabaseClient);

      await expect(repo.getAllVendorApplications()).rejects.toThrow(
        "Database error retrieving vendor applications: Connection reset by peer"
      );
    });
  });
});
