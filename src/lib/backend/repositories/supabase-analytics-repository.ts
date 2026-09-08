import { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdminClient } from "../supabase/client";
import {
  AnalyticsData,
  AnalyticsDateRange,
  CityMarkerItem,
  DATE_RANGE_PRESETS,
  EventTrendItem,
  IAnalyticsRepository,
  LeadJourneyStage,
} from "./analytics-repository.interface";

/**
 * Supabase Analytics Repository
 *
 * Implements IAnalyticsRepository by querying real records from `public.leads`
 * and `public.vendor_applications`.
 * Strictly executes four independent Supabase queries concurrently using Promise.all().
 */
export class SupabaseAnalyticsRepository implements IAnalyticsRepository {
  private client: SupabaseClient | null;

  constructor(client?: SupabaseClient | null) {
    this.client = client !== undefined ? client : getSupabaseAdminClient();
  }

  async getAnalyticsData(range: AnalyticsDateRange = "30d"): Promise<AnalyticsData> {
    const client = this.client || getSupabaseAdminClient();
    if (!client) {
      throw new Error("Supabase client is not configured or unavailable.");
    }

    const now = new Date();
    const todayDate = now.toISOString().split("T")[0];

    // Compute date boundaries
    let startDate: string | null = null;
    let priorStartDate: string | null = null;
    let priorEndDate: string | null = null;

    if (range === "7d") {
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
      priorStartDate = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString();
      priorEndDate = startDate;
    } else if (range === "30d") {
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
      priorStartDate = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000).toISOString();
      priorEndDate = startDate;
    } else if (range === "year") {
      const currentYear = now.getFullYear();
      startDate = new Date(Date.UTC(currentYear, 0, 1, 0, 0, 0)).toISOString();
      priorStartDate = new Date(Date.UTC(currentYear - 1, 0, 1, 0, 0, 0)).toISOString();
      priorEndDate = new Date(Date.UTC(currentYear - 1, 11, 31, 23, 59, 59)).toISOString();
    }

    // Build independent query promises executed concurrently using Promise.all()
    let currentLeadsQuery = client
      .from("leads")
      .select("id, city, event_type, created_at");

    if (startDate) {
      currentLeadsQuery = currentLeadsQuery.gte("created_at", startDate);
    }

    let priorLeadsQuery = client
      .from("leads")
      .select("id", { count: "exact", head: true });

    if (priorStartDate && priorEndDate) {
      priorLeadsQuery = priorLeadsQuery
        .gte("created_at", priorStartDate)
        .lt("created_at", priorEndDate);
    } else {
      // For all time, there is no prior period comparison
      priorLeadsQuery = priorLeadsQuery.eq("id", "00000000-0000-0000-0000-000000000000");
    }

    const totalLeadsQuery = client
      .from("leads")
      .select("id", { count: "exact", head: true });

    const upcomingEventsQuery = client
      .from("leads")
      .select("id", { count: "exact", head: true })
      .gte("event_date", todayDate);

    let currentVendorsQuery = client
      .from("vendor_applications")
      .select("id, categories, created_at");

    if (startDate) {
      currentVendorsQuery = currentVendorsQuery.gte("created_at", startDate);
    }

    let priorVendorsQuery = client
      .from("vendor_applications")
      .select("id", { count: "exact", head: true });

    if (priorStartDate && priorEndDate) {
      priorVendorsQuery = priorVendorsQuery
        .gte("created_at", priorStartDate)
        .lt("created_at", priorEndDate);
    } else {
      priorVendorsQuery = priorVendorsQuery.eq("id", "00000000-0000-0000-0000-000000000000");
    }

    // Execute all queries concurrently via Promise.all()
    const [
      currentLeadsRes,
      priorLeadsRes,
      totalLeadsRes,
      upcomingEventsRes,
      currentVendorsRes,
      priorVendorsRes,
    ] = await Promise.all([
      currentLeadsQuery,
      priorLeadsQuery,
      totalLeadsQuery,
      upcomingEventsQuery,
      currentVendorsQuery,
      priorVendorsQuery,
    ]);

    if (currentLeadsRes.error) {
      throw new Error(`Database error querying leads: ${currentLeadsRes.error.message}`);
    }
    if (currentVendorsRes.error) {
      throw new Error(`Database error querying vendors: ${currentVendorsRes.error.message}`);
    }

    const currentLeads = currentLeadsRes.data || [];
    const currentVendors = currentVendorsRes.data || [];

    const totalLeads = totalLeadsRes.count || 0;
    const periodLeadsCount = currentLeads.length;
    const priorPeriodLeadsCount = priorLeadsRes.count || 0;

    const periodVendorAppsCount = currentVendors.length;
    const priorPeriodVendorAppsCount = priorVendorsRes.count || 0;
    const upcomingEventsCount = upcomingEventsRes.count || 0;

    // Growth derivations
    const calculateGrowth = (current: number, prior: number): number | null => {
      if (!priorStartDate) return null;
      if (prior === 0) return current > 0 ? 100 : 0;
      return Math.round(((current - prior) / prior) * 100);
    };

    const leadGrowthPercent = calculateGrowth(periodLeadsCount, priorPeriodLeadsCount);
    const vendorGrowthPercent = calculateGrowth(periodVendorAppsCount, priorPeriodVendorAppsCount);

    // City distribution aggregation
    const cityCounts: Record<string, number> = {
      "Delhi NCR": 0,
      Mumbai: 0,
      Kolkata: 0,
      Bengaluru: 0,
      Others: 0,
    };

    for (const lead of currentLeads) {
      const city = (lead.city || "").trim().toLowerCase();
      if (city === "delhi" || city === "gurgaon" || city === "noida" || city.includes("ncr")) {
        cityCounts["Delhi NCR"]++;
      } else if (city === "mumbai") {
        cityCounts["Mumbai"]++;
      } else if (city === "kolkata") {
        cityCounts["Kolkata"]++;
      } else if (city === "bengaluru" || city === "bangalore") {
        cityCounts["Bengaluru"]++;
      } else {
        cityCounts["Others"]++;
      }
    }

    const totalCitySample = periodLeadsCount > 0 ? periodLeadsCount : 1;
    const sortedCities = Object.entries(cityCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([name, count], index) => ({
        city: name,
        count,
        percentage: Math.round((count / totalCitySample) * 100),
        rank: index + 1,
      }));

    const topCity = sortedCities[0] || { city: "Delhi NCR", count: 0, percentage: 0, rank: 1 };

    // City markers calibrated for India visual map
    const cityMarkers: CityMarkerItem[] = [
      {
        name: "Delhi NCR",
        count: cityCounts["Delhi NCR"],
        percentage: Math.round((cityCounts["Delhi NCR"] / totalCitySample) * 100),
        top: "22%",
        left: "49%",
        isPrimary: true,
      },
      {
        name: "Mumbai",
        count: cityCounts["Mumbai"],
        percentage: Math.round((cityCounts["Mumbai"] / totalCitySample) * 100),
        top: "56%",
        left: "32%",
      },
      {
        name: "Kolkata",
        count: cityCounts["Kolkata"],
        percentage: Math.round((cityCounts["Kolkata"] / totalCitySample) * 100),
        top: "46%",
        left: "70%",
      },
      {
        name: "Bengaluru",
        count: cityCounts["Bengaluru"],
        percentage: Math.round((cityCounts["Bengaluru"] / totalCitySample) * 100),
        top: "75%",
        left: "44%",
      },
    ];

    // Event Trends aggregation
    const eventCounts: Record<string, number> = {
      Birthday: 0,
      Wedding: 0,
      Anniversary: 0,
      Corporate: 0,
      Other: 0,
    };

    for (const lead of currentLeads) {
      const type = (lead.event_type || "").trim().toLowerCase();
      if (type.includes("birthday")) {
        eventCounts["Birthday"]++;
      } else if (type.includes("wedding") || type.includes("festive")) {
        eventCounts["Wedding"]++;
      } else if (type.includes("anniversary")) {
        eventCounts["Anniversary"]++;
      } else if (type.includes("corporate") || type.includes("house party") || type.includes("dinner")) {
        eventCounts["Corporate"]++;
      } else {
        eventCounts["Other"]++;
      }
    }

    const eventTrends: EventTrendItem[] = [
      {
        key: "birthday",
        label: "Birthday",
        count: eventCounts["Birthday"],
        percentage: Math.round((eventCounts["Birthday"] / totalCitySample) * 100),
        icon: "cake",
      },
      {
        key: "wedding",
        label: "Wedding",
        count: eventCounts["Wedding"],
        percentage: Math.round((eventCounts["Wedding"] / totalCitySample) * 100),
        icon: "favorite",
      },
      {
        key: "anniversary",
        label: "Anniversary",
        count: eventCounts["Anniversary"],
        percentage: Math.round((eventCounts["Anniversary"] / totalCitySample) * 100),
        icon: "wine_bar",
      },
      {
        key: "corporate",
        label: "Corporate",
        count: eventCounts["Corporate"],
        percentage: Math.round((eventCounts["Corporate"] / totalCitySample) * 100),
        icon: "business_center",
      },
      {
        key: "other",
        label: "Other",
        count: eventCounts["Other"],
        percentage: Math.round((eventCounts["Other"] / totalCitySample) * 100),
        icon: "celebration",
      },
    ];

    // Lead Journey Funnel (Real intake, Phase 2 downstream)
    const journeyStages: LeadJourneyStage[] = [
      {
        step: 1,
        label: "Total Leads",
        count: periodLeadsCount,
        isReal: true,
      },
      {
        step: 2,
        label: "Contacted",
        count: 0,
        isReal: false,
        statusNote: "Phase 2 Pipeline",
      },
      {
        step: 3,
        label: "Qualified",
        count: 0,
        isReal: false,
        statusNote: "Phase 2 Pipeline",
      },
      {
        step: 4,
        label: "Converted",
        count: 0,
        isReal: false,
        statusNote: "Phase 2 Pipeline",
      },
    ];

    // Date range label
    const activePreset = DATE_RANGE_PRESETS.find((p) => p.id === range);
    const dateRangeLabel = activePreset ? activePreset.label : "Last 30 Days";

    return {
      range,
      dateRangeLabel,
      metrics: {
        totalLeads,
        periodLeadsCount,
        priorPeriodLeadsCount,
        leadGrowthPercent,
        upcomingEventsCount,
        periodVendorAppsCount,
        priorPeriodVendorAppsCount,
        vendorGrowthPercent,
      },
      topCities: sortedCities,
      cityMarkers,
      keyTakeaway: {
        topCityName: topCity.city,
        topCityPercentage: topCity.percentage,
        summary: `${topCity.city} accounts for ${topCity.percentage}% of all inquiries in this period. Focus marketing and vendor partner outreach in this hub to maximize conversion.`,
      },
      eventTrends,
      journeyStages,
      leadSources: {
        totalLeadsInPeriod: periodLeadsCount,
        sources: [
          {
            channel: "Website",
            percentage: 100,
            color: "var(--primary, #7f1010)",
            count: periodLeadsCount,
          },
          {
            channel: "Instagram",
            percentage: 0,
            color: "var(--gold, #b99a67)",
            count: 0,
          },
          {
            channel: "Direct Inquiry",
            percentage: 0,
            color: "var(--primary-dark, #5f0808)",
            count: 0,
          },
          {
            channel: "Referrals",
            percentage: 0,
            color: "#e3c28b",
            count: 0,
          },
          {
            channel: "Others",
            percentage: 0,
            color: "var(--border, #dfd2c3)",
            count: 0,
          },
        ],
        attributionNotice:
          "100% of currently recorded leads originate from the Eventsika website intake form; acquisition/source attribution is not currently captured.",
      },
    };
  }
}
