import { describe, it, expect, vi, beforeEach } from "vitest";
import { VendorService } from "../vendor-service";
import { IVendorRepository, SavedVendorRecord } from "../../repositories/vendor-repository.interface";
import { IDeliveryNotifier, DeliveryResult } from "../../integrations/delivery-notifier.interface";
import { ValidatedVendorInput } from "../../validation/vendor-schema";

describe("VendorService", () => {
  let mockRepo: IVendorRepository;
  let mockNotifier: IDeliveryNotifier;
  let vendorService: VendorService;

  const validVendorInput: ValidatedVendorInput = {
    businessName: "Test Event Solutions",
    contactName: "Arjun Verma",
    phone: "9876543210",
    email: "arjun@testevents.in",
    city: "Mumbai",
    experience: "5–10 Years",
    portfolioUrl: "https://testevents.in",
    categories: ["Decor & Styling"],
    isBot: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockRepo = {
      saveVendorApplication: vi.fn().mockImplementation(async (vendor: ValidatedVendorInput): Promise<SavedVendorRecord> => ({
        ...vendor,
        id: "mock-vendor-uuid-5678",
        createdAt: "2026-10-06T12:00:00.000Z",
      })),
      getAllVendorApplications: vi.fn().mockResolvedValue([]),
    };

    mockNotifier = {
      notifyLead: vi.fn().mockResolvedValue({ delivered: true, channel: "noop" } as DeliveryResult),
      notifyVendor: vi.fn().mockResolvedValue({ delivered: true, channel: "noop" } as DeliveryResult),
    };

    vendorService = new VendorService(mockRepo, mockNotifier);
  });

  describe("Happy path and persistence", () => {
    it("persists valid vendor application, dispatches notification, and returns success with applicationId", async () => {
      const result = await vendorService.processVendorApplication(validVendorInput, { requestId: "req-001" });

      expect(result.success).toBe(true);
      expect(result.applicationId).toBe("mock-vendor-uuid-5678");
      expect(mockRepo.saveVendorApplication).toHaveBeenCalledTimes(1);
      expect(mockRepo.saveVendorApplication).toHaveBeenCalledWith(validVendorInput, { requestId: "req-001" });
      expect(mockNotifier.notifyVendor).toHaveBeenCalledTimes(1);
    });
  });

  describe("Bot and spam defense", () => {
    it("silently drops bot submissions without repository write or external notification", async () => {
      const botVendor: ValidatedVendorInput = {
        ...validVendorInput,
        isBot: true,
      };

      const result = await vendorService.processVendorApplication(botVendor, { requestId: "req-bot" });

      expect(result.success).toBe(true);
      expect(result.isBot).toBe(true);
      expect(mockRepo.saveVendorApplication).not.toHaveBeenCalled();
      expect(mockNotifier.notifyVendor).not.toHaveBeenCalled();
    });
  });

  describe("Duplicate protection", () => {
    it("suppresses duplicate submissions and avoids duplicate database persistence", async () => {
      const vendorA = { ...validVendorInput, phone: "9999922222", email: "dup@test.in", businessName: "Dup Biz" };

      // First submission
      const firstResult = await vendorService.processVendorApplication(vendorA, { requestId: "req-dup-1" });
      expect(firstResult.success).toBe(true);
      expect(mockRepo.saveVendorApplication).toHaveBeenCalledTimes(1);

      // Rapid duplicate submission with same details
      const secondResult = await vendorService.processVendorApplication(vendorA, { requestId: "req-dup-2" });
      expect(secondResult.success).toBe(true);
      expect(secondResult.isDuplicate).toBe(true);

      // saveVendorApplication should still only have been called once
      expect(mockRepo.saveVendorApplication).toHaveBeenCalledTimes(1);
    });
  });

  describe("Failure handling and resilience", () => {
    it("throws an internal error when repository persistence fails", async () => {
      mockRepo.saveVendorApplication = vi.fn().mockRejectedValue(new Error("Database connection timeout"));
      const failingService = new VendorService(mockRepo, mockNotifier);

      await expect(
        failingService.processVendorApplication(
          { ...validVendorInput, phone: "9111133333", email: "fail@test.in", businessName: "Fail Biz" },
          { requestId: "req-fail" }
        )
      ).rejects.toThrow("Database connection timeout");
    });

    it("gracefully succeeds even if external notification delivery fails", async () => {
      mockNotifier.notifyVendor = vi.fn().mockRejectedValue(new Error("Email provider network error"));
      const resilientService = new VendorService(mockRepo, mockNotifier);

      const result = await resilientService.processVendorApplication(
        { ...validVendorInput, phone: "9222244444", email: "res@test.in", businessName: "Res Biz" },
        { requestId: "req-resilient" }
      );

      expect(result.success).toBe(true);
      expect(result.applicationId).toBe("mock-vendor-uuid-5678");
      expect(mockRepo.saveVendorApplication).toHaveBeenCalledTimes(1);
    });
  });
});
