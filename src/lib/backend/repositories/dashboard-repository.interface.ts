/**
 * Dashboard Repository Interface & Types
 *
 * Defines the contract for aggregating operational dashboard metrics,
 * recent activity records, and upcoming celebration dates from persistence.
 */

export interface DashboardMetrics {
  totalLeads: number;
  newLeadsLast7Days: number;
  totalVendors: number;
}

export type RecentActivityType = "lead_received" | "vendor_application_received";

export interface RecentActivityItem {
  id: string;
  type: RecentActivityType;
  title: string;
  subtitle: string;
  timestamp: string; // ISO string
}

export interface UpcomingCelebrationItem {
  id: string;
  clientName: string;
  eventType: string;
  eventDate: string; // YYYY-MM-DD
  city: string;
  guestCount: string;
  budgetRange: string;
  selectedServices: string[];
}

export interface DashboardData {
  metrics: DashboardMetrics;
  recentActivity: RecentActivityItem[];
  upcomingCelebrations: UpcomingCelebrationItem[];
}

export interface IDashboardRepository {
  /**
   * Fetches real operational summary data from persistence.
   * Throws an error if the database is unreachable (no fake fallback).
   */
  getDashboardData(): Promise<DashboardData>;
}
