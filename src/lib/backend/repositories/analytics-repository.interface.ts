/**
 * Eventsika Admin Analytics Repository Interface
 *
 * Defines contracts and data transfer objects for operational celebration analytics.
 */

export type AnalyticsDateRange = "7d" | "30d" | "year" | "all";

export interface DateRangePreset {
  id: AnalyticsDateRange;
  label: string;
}

export const DATE_RANGE_PRESETS: DateRangePreset[] = [
  { id: "7d", label: "Last 7 Days" },
  { id: "30d", label: "Last 30 Days" },
  { id: "year", label: "This Year" },
  { id: "all", label: "All Time" },
];

export interface AnalyticsMetrics {
  totalLeads: number;
  periodLeadsCount: number;
  priorPeriodLeadsCount: number;
  leadGrowthPercent: number | null;
  upcomingEventsCount: number;
  periodVendorAppsCount: number;
  priorPeriodVendorAppsCount: number;
  vendorGrowthPercent: number | null;
}

export interface CityDemandItem {
  city: string;
  count: number;
  percentage: number;
  rank: number;
}

export interface CityMarkerItem {
  name: string;
  count: number;
  percentage: number;
  top: string;
  left: string;
  isPrimary?: boolean;
}

export interface EventTrendItem {
  key: string;
  label: string;
  count: number;
  percentage: number;
  icon: string;
}

export interface LeadJourneyStage {
  step: number;
  label: string;
  count: number;
  isReal: boolean;
  statusNote?: string;
}

export interface LeadSourceItem {
  channel: string;
  percentage: number;
  color: string;
  count: number;
}

export interface AnalyticsData {
  range: AnalyticsDateRange;
  dateRangeLabel: string;
  metrics: AnalyticsMetrics;
  topCities: CityDemandItem[];
  cityMarkers: CityMarkerItem[];
  keyTakeaway: {
    topCityName: string;
    topCityPercentage: number;
    summary: string;
  };
  eventTrends: EventTrendItem[];
  journeyStages: LeadJourneyStage[];
  leadSources: {
    totalLeadsInPeriod: number;
    sources: LeadSourceItem[];
    attributionNotice: string;
  };
}

export interface IAnalyticsRepository {
  /**
   * Retrieves aggregated operational analytics for the specified date range.
   * Runs queries concurrently via Promise.all() and aggregates in application memory.
   */
  getAnalyticsData(range: AnalyticsDateRange): Promise<AnalyticsData>;
}
