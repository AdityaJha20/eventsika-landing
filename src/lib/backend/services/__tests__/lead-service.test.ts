import { describe, it, expect, vi, beforeEach } from "vitest";
import { LeadService } from "../lead-service";
import { ILeadRepository, SavedLeadRecord } from "../../repositories/lead-repository.interface";
import { IDeliveryNotifier, DeliveryResult } from "../../integrations/delivery-notifier.interface";
import { ValidatedLeadInput } from "../../validation/lead-schema";

describe("LeadService", () => {
  let mockRepo: ILeadRepository;
  let mockNotifier: IDeliveryNotifier;
  let leadService: LeadService;

  const validLeadInput: ValidatedLeadInput = {
    userName: "Aditi Rao",
    userPhone: "9876543210",
    city: "Delhi",
    eventType: "Birthday",
    eventDate: "2026-11-20",
    guestCount: "30–50 guests",
    venueType: "Indoor",
    selectedServices: ["Decor & Styling"],
    budgetRange: "₹50,000 – ₹1,00,000",
    whatsappConsent: true,
    isBot: false,
  };

  beforeEach(() => {
    mockRepo = {
      saveLead: vi.fn().mockImplementation(async (lead: ValidatedLeadInput): Promise<SavedLeadRecord> => ({
        ...lead,
        id: "mock-lead-uuid-1234",
        createdAt: "2026-09-02T12:00:00.000Z",
      })),
    };

    mockNotifier = {
      notifyLead: vi.fn().mockResolvedValue({ delivered: true, channel: "noop" } as DeliveryResult),
      notifyVendor: vi.fn().mockResolvedValue({ delivered: true, channel: "noop" } as DeliveryResult),
    };

    leadService = new LeadService(mockRepo, mockNotifier);
  });

  describe("Happy path and persistence", () => {
    it("persists valid lead to repository, dispatches notification, and returns success with leadId", async () => {
      const result = await leadService.processLead(validLeadInput, { requestId: "req-001" });

      expect(result.success).toBe(true);
      expect(result.leadId).toBe("mock-lead-uuid-1234");
      expect(mockRepo.saveLead).toHaveBeenCalledTimes(1);
      expect(mockRepo.saveLead).toHaveBeenCalledWith(validLeadInput, { requestId: "req-001" });
      expect(mockNotifier.notifyLead).toHaveBeenCalledTimes(1);
    });
  });

  describe("Bot and spam defense", () => {
    it("silently drops bot submissions without repository write or external notification", async () => {
      const botLead: ValidatedLeadInput = {
        ...validLeadInput,
        isBot: true,
      };

      const result = await leadService.processLead(botLead, { requestId: "req-bot" });

      expect(result.success).toBe(true);
      expect(result.isBot).toBe(true);
      expect(mockRepo.saveLead).not.toHaveBeenCalled();
      expect(mockNotifier.notifyLead).not.toHaveBeenCalled();
    });
  });

  describe("Duplicate protection", () => {
    it("suppresses duplicate submissions and avoids duplicate database persistence", async () => {
      const leadA = { ...validLeadInput, userPhone: "9999911111" };

      // First submission
      const firstResult = await leadService.processLead(leadA, { requestId: "req-dup-1" });
      expect(firstResult.success).toBe(true);
      expect(mockRepo.saveLead).toHaveBeenCalledTimes(1);

      // Rapid duplicate submission with same lead details
      const secondResult = await leadService.processLead(leadA, { requestId: "req-dup-2" });
      expect(secondResult.success).toBe(true);
      expect(secondResult.isDuplicate).toBe(true);
      // saveLead should still only have been called once
      expect(mockRepo.saveLead).toHaveBeenCalledTimes(1);
    });
  });

  describe("Failure handling and resilience", () => {
    it("returns success: false when repository persistence fails, preventing false positive success", async () => {
      mockRepo.saveLead = vi.fn().mockRejectedValue(new Error("Supabase connection timeout"));
      const failingService = new LeadService(mockRepo, mockNotifier);

      const result = await failingService.processLead(
        { ...validLeadInput, userPhone: "9111122222" },
        { requestId: "req-fail" }
      );

      expect(result.success).toBe(false);
      expect(result.message).toBeDefined();
      expect(result.leadId).toBeUndefined();
    });

    it("gracefully succeeds even if external notification delivery fails", async () => {
      mockNotifier.notifyLead = vi.fn().mockRejectedValue(new Error("Email provider network error"));
      const resilientService = new LeadService(mockRepo, mockNotifier);

      const result = await resilientService.processLead(
        { ...validLeadInput, userPhone: "9222233333" },
        { requestId: "req-resilient" }
      );

      expect(result.success).toBe(true);
      expect(result.leadId).toBe("mock-lead-uuid-1234");
      expect(mockRepo.saveLead).toHaveBeenCalledTimes(1);
    });
  });
});
