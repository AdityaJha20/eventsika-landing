import { logger } from "../logger/logger";
import { ILeadRepository, SavedLeadRecord } from "../repositories/lead-repository.interface";
import { getDefaultLeadRepository } from "./lead-service";

export interface AdminLeadsMetrics {
  totalLeads: number;
  newLeadsLast7Days: number;
  upcomingCelebrations: number;
}

export interface AdminLeadsData {
  leads: SavedLeadRecord[];
  metrics: AdminLeadsMetrics;
}

export type AdminLeadsResult =
  | { success: true; data: AdminLeadsData }
  | { success: false; error: string };

/**
 * Admin Lead Service
 *
 * Coordinates business logic and metric derivations for celebration inquiry management.
 * Strictly calculates metrics from real database records with zero CRM fabrication.
 */
export class AdminLeadService {
  private repository?: ILeadRepository;

  constructor(repository?: ILeadRepository) {
    if (repository) {
      this.repository = repository;
    }
  }

  /**
   * Retrieves all celebration inquiries and calculates operational queue metrics.
   */
  async getLeads(): Promise<AdminLeadsResult> {
    try {
      const repo = this.repository || getDefaultLeadRepository();
      const leads = await repo.getAllLeads();

      const sevenDaysAgoMs = Date.now() - 7 * 24 * 60 * 60 * 1000;
      const todayDate = new Date().toISOString().split("T")[0];

      let newLeadsLast7Days = 0;
      let upcomingCelebrations = 0;

      for (const lead of leads) {
        if (new Date(lead.createdAt).getTime() >= sevenDaysAgoMs) {
          newLeadsLast7Days++;
        }
        if (lead.eventDate >= todayDate) {
          upcomingCelebrations++;
        }
      }

      return {
        success: true,
        data: {
          leads,
          metrics: {
            totalLeads: leads.length,
            newLeadsLast7Days,
            upcomingCelebrations,
          },
        },
      };
    } catch (error) {
      logger.error("Failed to retrieve admin leads operational data", error);
      return {
        success: false,
        error: "Unable to load celebration inquiries. Please try again or check database connectivity.",
      };
    }
  }
}

export const adminLeadService = new AdminLeadService();
