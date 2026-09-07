import { describe, it, expect, vi, beforeEach } from "vitest";
import { AdminLeadService } from "../admin-lead-service";
import { ILeadRepository, SavedLeadRecord } from "../../repositories/lead-repository.interface";
import { EventTypeOption, GuestCountOption } from "../../constants/allowlists";

describe("AdminLeadService Suite", () => {
  let mockRepo: ILeadRepository;
  let service: AdminLeadService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockRepo = {
      saveLead: vi.fn(),
      getAllLeads: vi.fn(),
    };
    service = new AdminLeadService(mockRepo);
  });

  it("returns zeroed metrics and empty array when repository is empty", async () => {
    vi.mocked(mockRepo.getAllLeads).mockResolvedValueOnce([]);

    const result = await service.getLeads();

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.leads).toEqual([]);
      expect(result.data.metrics).toEqual({
        totalLeads: 0,
        newLeadsLast7Days: 0,
        upcomingCelebrations: 0,
      });
    }
  });

  it("correctly derives metrics from real lead records", async () => {
    const now = new Date();
    const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString();
    const tenDaysAgo = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000).toISOString();

    const futureDate = "2026-12-25";
    const pastDate = "2024-01-01";

    const mockLeads: SavedLeadRecord[] = [
      {
        id: "lead-1",
        userName: "Aarav Sharma",
        userPhone: "9876543210",
        city: "Delhi",
        eventType: "House Party" as EventTypeOption,
        eventDate: futureDate,
        guestCount: "100–200 guests" as GuestCountOption,
        venueType: "Indoor",
        selectedServices: ["Decor & Styling"],
        budgetRange: "₹1,00,000 – ₹2,00,000",
        whatsappConsent: true,
        isBot: false,
        createdAt: twoDaysAgo,
        updatedAt: twoDaysAgo,
      },
      {
        id: "lead-2",
        userName: "Diya Patel",
        userPhone: "9876543211",
        city: "Mumbai",
        eventType: "Anniversary" as EventTypeOption,
        eventDate: pastDate,
        guestCount: "30–50 guests" as GuestCountOption,
        venueType: "Outdoor",
        selectedServices: ["Food & Catering"],
        budgetRange: "₹50,000 – ₹1,00,000",
        whatsappConsent: true,
        isBot: false,
        createdAt: tenDaysAgo,
        updatedAt: tenDaysAgo,
      },
      {
        id: "lead-3",
        userName: "Rohan Verma",
        userPhone: "9876543212",
        city: "Kolkata",
        eventType: "Diwali Special" as EventTypeOption,
        eventDate: futureDate,
        guestCount: "10–30 guests" as GuestCountOption,
        venueType: "Indoor",
        selectedServices: ["Music & Entertainment"],
        budgetRange: "₹25,000 – ₹50,000",
        whatsappConsent: true,
        isBot: false,
        createdAt: twoDaysAgo,
        updatedAt: twoDaysAgo,
      },
    ];

    vi.mocked(mockRepo.getAllLeads).mockResolvedValueOnce(mockLeads);

    const result = await service.getLeads();

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.leads).toHaveLength(3);
      expect(result.data.metrics.totalLeads).toBe(3);
      expect(result.data.metrics.newLeadsLast7Days).toBe(2); // lead-1 and lead-3
      expect(result.data.metrics.upcomingCelebrations).toBe(2); // lead-1 and lead-3 (futureDate)
    }
  });

  it("handles repository failure gracefully without throwing", async () => {
    vi.mocked(mockRepo.getAllLeads).mockRejectedValueOnce(new Error("Database connection timeout"));

    const result = await service.getLeads();

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("Unable to load celebration inquiries");
    }
  });
});
