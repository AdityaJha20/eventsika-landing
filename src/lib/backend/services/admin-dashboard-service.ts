import { logger } from "../logger/logger";
import {
  DashboardData,
  IDashboardRepository,
} from "../repositories/dashboard-repository.interface";
import { SupabaseDashboardRepository } from "../repositories/supabase-dashboard-repository";

export type DashboardSummaryResult =
  | { success: true; data: DashboardData }
  | { success: false; error: string };

/**
 * Admin Dashboard Service
 *
 * Orchestrates business logic for administrative dashboard reporting.
 * Strictly avoids fake fallbacks; logs technical errors safely and
 * returns safe user-facing error messages on database failure.
 */
export class AdminDashboardService {
  private repository: IDashboardRepository;

  constructor(repository?: IDashboardRepository) {
    this.repository = repository || new SupabaseDashboardRepository();
  }

  async getDashboardSummary(): Promise<DashboardSummaryResult> {
    try {
      const data = await this.repository.getDashboardData();
      return {
        success: true,
        data,
      };
    } catch (error) {
      logger.error("Failed to retrieve admin dashboard operational data", error);
      return {
        success: false,
        error: "Unable to load dashboard metrics. Database service is temporarily unavailable.",
      };
    }
  }

  /**
   * Helper to format an ISO timestamp into human-readable relative time (e.g. "12m ago", "2h ago")
   */
  static formatRelativeTime(isoDate: string): string {
    try {
      const diffMs = Date.now() - new Date(isoDate).getTime();
      const diffMins = Math.floor(diffMs / (1000 * 60));
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      if (diffMins < 1) return "Just now";
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays === 1) return "Yesterday";
      if (diffDays < 7) return `${diffDays}d ago`;

      return new Date(isoDate).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
      });
    } catch {
      return "Recently";
    }
  }

  /**
   * Helper to format a YYYY-MM-DD date string into editorial display format (e.g. "05 Sep 2026")
   */
  static formatEventDate(dateString: string): string {
    try {
      const [year, month, day] = dateString.split("-").map(Number);
      const date = new Date(Date.UTC(year, month - 1, day));
      return date.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        timeZone: "UTC",
      });
    } catch {
      return dateString;
    }
  }
}

export const adminDashboardService = new AdminDashboardService();
