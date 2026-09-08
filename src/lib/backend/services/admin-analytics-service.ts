import { logger } from "../logger/logger";
import {
  AnalyticsData,
  AnalyticsDateRange,
  IAnalyticsRepository,
} from "../repositories/analytics-repository.interface";
import { SupabaseAnalyticsRepository } from "../repositories/supabase-analytics-repository";

export type AdminAnalyticsResult =
  | { success: true; data: AnalyticsData }
  | { success: false; error: string };

/**
 * Admin Analytics Service
 *
 * Coordinates operational analytics retrieval, metric derivations,
 * and error boundaries for executive celebration insights.
 */
export class AdminAnalyticsService {
  private repository?: IAnalyticsRepository;

  constructor(repository?: IAnalyticsRepository) {
    if (repository) {
      this.repository = repository;
    }
  }

  private getRepository(): IAnalyticsRepository {
    if (!this.repository) {
      this.repository = new SupabaseAnalyticsRepository();
    }
    return this.repository;
  }

  /**
   * Retrieves operational analytics for the selected date range preset.
   */
  async getAnalyticsData(rawRange?: string): Promise<AdminAnalyticsResult> {
    try {
      const validRanges: AnalyticsDateRange[] = ["7d", "30d", "year", "all"];
      const range: AnalyticsDateRange = validRanges.includes(rawRange as AnalyticsDateRange)
        ? (rawRange as AnalyticsDateRange)
        : "30d";

      const repo = this.getRepository();
      const data = await repo.getAnalyticsData(range);

      return {
        success: true,
        data,
      };
    } catch (error) {
      logger.error("Failed to retrieve admin analytics operational data", error);
      return {
        success: false,
        error: "Unable to load operational analytics. Please try again or check database connectivity.",
      };
    }
  }
}

export const adminAnalyticsService = new AdminAnalyticsService();
