import { describe, it, expect, vi, beforeEach } from "vitest";
import { AdminVendorService } from "../admin-vendor-service";
import { IVendorRepository, SavedVendorRecord } from "../../repositories/vendor-repository.interface";
import { VendorCategoryOption, VendorExperienceTier } from "../../constants/allowlists";

describe("AdminVendorService Suite", () => {
  let mockRepo: IVendorRepository;
  let service: AdminVendorService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockRepo = {
      saveVendorApplication: vi.fn(),
      getAllVendorApplications: vi.fn(),
    };
    service = new AdminVendorService(mockRepo);
  });

  it("returns zeroed metrics and empty array when repository is empty", async () => {
    vi.mocked(mockRepo.getAllVendorApplications).mockResolvedValueOnce([]);

    const result = await service.getVendors();

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.vendors).toEqual([]);
      expect(result.data.metrics).toEqual({
        totalApplications: 0,
        newApplicationsLast7Days: 0,
        experiencedApplicationsCount: 0,
        portfolioLinkedCount: 0,
      });
    }
  });

  it("correctly derives metrics from real vendor application records and omits isBot", async () => {
    const now = new Date();
    const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString();
    const tenDaysAgo = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000).toISOString();

    const mockRecords: SavedVendorRecord[] = [
      {
        id: "vnd-1",
        businessName: "Royal Mandap Concepts",
        contactName: "Aarav Mehta",
        phone: "9876543210",
        email: "aarav@royalmandap.in",
        city: "Delhi",
        experience: "5–10 Years" as VendorExperienceTier,
        portfolioUrl: "https://instagram.com/royalmandap",
        categories: ["Decor & Styling" as VendorCategoryOption],
        isBot: false,
        createdAt: twoDaysAgo,
        requestId: "req-1",
      },
      {
        id: "vnd-2",
        businessName: "Studio Lenscraft",
        contactName: "Pooja Hegde",
        phone: "9876543211",
        email: "pooja@lenscraft.in",
        city: "Mumbai",
        experience: "10+ Years" as VendorExperienceTier,
        portfolioUrl: "https://lenscraft.in",
        categories: ["Photography & Films" as VendorCategoryOption],
        isBot: false,
        createdAt: tenDaysAgo,
        requestId: "req-2",
      },
      {
        id: "vnd-3",
        businessName: "Vedic Pujas & Rituals",
        contactName: "Pandit Ji",
        phone: "9876543212",
        email: "pandit@vedicpujas.in",
        city: "Kolkata",
        experience: "1–2 Years" as VendorExperienceTier,
        portfolioUrl: "", // No portfolio
        categories: ["Pandit / Vedic Services" as VendorCategoryOption],
        isBot: false,
        createdAt: twoDaysAgo,
        requestId: null,
      },
    ];

    vi.mocked(mockRepo.getAllVendorApplications).mockResolvedValueOnce(mockRecords);

    const result = await service.getVendors();

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.vendors).toHaveLength(3);
      expect(result.data.metrics.totalApplications).toBe(3);
      expect(result.data.metrics.newApplicationsLast7Days).toBe(2); // vnd-1 and vnd-3 (two days ago)
      expect(result.data.metrics.experiencedApplicationsCount).toBe(2); // vnd-1 (5-10 Yrs) and vnd-2 (10+ Yrs)
      expect(result.data.metrics.portfolioLinkedCount).toBe(2); // vnd-1 and vnd-2

      // Verify client data minimization: isBot must NOT be present on items
      for (const item of result.data.vendors) {
        expect("isBot" in item).toBe(false);
      }
    }
  });

  it("handles repository failure gracefully without throwing unhandled rejection", async () => {
    vi.mocked(mockRepo.getAllVendorApplications).mockRejectedValueOnce(
      new Error("Database connection timeout")
    );

    const result = await service.getVendors();

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("Unable to load vendor applications");
    }
  });
});
