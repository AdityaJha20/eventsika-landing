import { describe, it, expect, vi, beforeEach } from "vitest";
import { AdminAnalyticsService } from "../admin-analytics-service";
import {
  AnalyticsData,
  IAnalyticsRepository,
} from "../../repositories/analytics-repository.interface";

describe("AdminAnalyticsService Suite", () => {
  let mockRepo: IAnalyticsRepository;
  let service: AdminAnalyticsService;

  const mockAnalyticsData: AnalyticsData = {
    range: "30d",
    dateRangeLabel: "Last 30 Days",
    metrics: {
      totalLeads: 45,
      periodLeadsCount: 28,
      priorPeriodLeadsCount: 20,
      leadGrowthPercent: 40,
      upcomingEventsCount: 12,
      periodVendorAppsCount: 8,
      priorPeriodVendorAppsCount: 6,
      vendorGrowthPercent: 33,
    },
    topCities: [
      { city: "Delhi NCR", count: 14, percentage: 50, rank: 1 },
      { city: "Mumbai", count: 8, percentage: 29, rank: 2 },
      { city: "Kolkata", count: 4, percentage: 14, rank: 3 },
      { city: "Others", count: 2, percentage: 7, rank: 4 },
    ],
    cityMarkers: [
      { name: "Delhi NCR", count: 14, percentage: 50, top: "22%", left: "49%", isPrimary: true },
      { name: "Mumbai", count: 8, percentage: 29, top: "56%", left: "32%" },
      { name: "Kolkata", count: 4, percentage: 14, top: "46%", left: "70%" },
      { name: "Bengaluru", count: 0, percentage: 0, top: "75%", left: "44%" },
    ],
    keyTakeaway: {
      topCityName: "Delhi NCR",
      topCityPercentage: 50,
      summary: "Delhi NCR accounts for 50% of all inquiries in this period.",
    },
    eventTrends: [
      { key: "birthday", label: "Birthday", count: 10, percentage: 36, icon: "cake" },
      { key: "wedding", label: "Wedding", count: 8, percentage: 29, icon: "favorite" },
      { key: "anniversary", label: "Anniversary", count: 5, percentage: 18, icon: "wine_bar" },
      { key: "corporate", label: "Corporate", count: 3, percentage: 11, icon: "business_center" },
      { key: "other", label: "Other", count: 2, percentage: 7, icon: "celebration" },
    ],
    journeyStages: [
      { step: 1, label: "Total Leads", count: 28, isReal: true },
      { step: 2, label: "Contacted", count: 0, isReal: false, statusNote: "Phase 2 Pipeline" },
      { step: 3, label: "Qualified", count: 0, isReal: false, statusNote: "Phase 2 Pipeline" },
      { step: 4, label: "Converted", count: 0, isReal: false, statusNote: "Phase 2 Pipeline" },
    ],
    leadSources: {
      totalLeadsInPeriod: 28,
      sources: [
        { channel: "Website", percentage: 100, color: "var(--primary, #7f1010)", count: 28 },
        { channel: "Instagram", percentage: 0, color: "var(--gold, #b99a67)", count: 0 },
        { channel: "Direct Inquiry", percentage: 0, color: "var(--primary-dark, #5f0808)", count: 0 },
        { channel: "Referrals", percentage: 0, color: "#e3c28b", count: 0 },
        { channel: "Others", percentage: 0, color: "var(--border, #dfd2c3)", count: 0 },
      ],
      attributionNotice:
        "100% of currently recorded leads originate from the Eventsika website intake form; acquisition/source attribution is not currently captured.",
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockRepo = {
      getAnalyticsData: vi.fn(),
    };
    service = new AdminAnalyticsService(mockRepo);
  });

  it("successfully returns analytics data for a valid range preset", async () => {
    vi.mocked(mockRepo.getAnalyticsData).mockResolvedValueOnce(mockAnalyticsData);

    const result = await service.getAnalyticsData("30d");

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.range).toBe("30d");
      expect(result.data.metrics.periodLeadsCount).toBe(28);
      expect(result.data.metrics.vendorGrowthPercent).toBe(33);
      expect(result.data.topCities[0].city).toBe("Delhi NCR");
    }
    expect(mockRepo.getAnalyticsData).toHaveBeenCalledWith("30d");
  });

  it("normalizes unknown or invalid range presets to 30d", async () => {
    vi.mocked(mockRepo.getAnalyticsData).mockResolvedValueOnce(mockAnalyticsData);

    const result = await service.getAnalyticsData("invalid-range-123");

    expect(result.success).toBe(true);
    expect(mockRepo.getAnalyticsData).toHaveBeenCalledWith("30d");
  });

  it("handles repository failure gracefully without throwing unhandled rejection", async () => {
    vi.mocked(mockRepo.getAnalyticsData).mockRejectedValueOnce(
      new Error("PostgreSQL connection timeout")
    );

    const result = await service.getAnalyticsData("7d");

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("Unable to load operational analytics");
    }
  });

  it("strictly preserves Phase 2 pipeline placeholders without fabricating status data", async () => {
    vi.mocked(mockRepo.getAnalyticsData).mockResolvedValueOnce(mockAnalyticsData);

    const result = await service.getAnalyticsData("year");

    expect(result.success).toBe(true);
    if (result.success) {
      const stages = result.data.journeyStages;
      expect(stages[0].isReal).toBe(true);
      expect(stages[1].isReal).toBe(false);
      expect(stages[1].statusNote).toBe("Phase 2 Pipeline");
      expect(stages[2].isReal).toBe(false);
      expect(stages[3].isReal).toBe(false);
    }
  });
});
