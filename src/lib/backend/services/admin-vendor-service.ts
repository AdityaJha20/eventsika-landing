import { logger } from "../logger/logger";
import { IVendorRepository } from "../repositories/vendor-repository.interface";
import { getDefaultVendorRepository } from "./vendor-service";
import { VendorCategoryOption, VendorExperienceTier } from "../constants/allowlists";

export interface AdminVendorItem {
  id: string;
  businessName: string;
  contactName: string;
  phone: string;
  email: string;
  city: string;
  experience: VendorExperienceTier;
  portfolioUrl: string;
  categories: VendorCategoryOption[];
  createdAt: string;
  requestId?: string | null;
}

export interface AdminVendorsMetrics {
  totalApplications: number;
  newApplicationsLast7Days: number;
  experiencedApplicationsCount: number;
  portfolioLinkedCount: number;
}

export interface AdminVendorsData {
  vendors: AdminVendorItem[];
  metrics: AdminVendorsMetrics;
}

export type AdminVendorsResult =
  | { success: true; data: AdminVendorsData }
  | { success: false; error: string };

/**
 * Admin Vendor Service
 *
 * Coordinates operational retrieval and metric calculations for partner applications.
 * Phase 1 loads the full current intake dataset for fast in-memory client interaction.
 */
export class AdminVendorService {
  private repository?: IVendorRepository;

  constructor(repository?: IVendorRepository) {
    if (repository) {
      this.repository = repository;
    }
  }

  /**
   * Retrieves all vendor partner applications and computes operational intake metrics.
   */
  async getVendors(): Promise<AdminVendorsResult> {
    try {
      const repo = this.repository || getDefaultVendorRepository();
      const records = await repo.getAllVendorApplications();

      const sevenDaysAgoMs = Date.now() - 7 * 24 * 60 * 60 * 1000;

      let newApplicationsLast7Days = 0;
      let experiencedApplicationsCount = 0;
      let portfolioLinkedCount = 0;

      const vendors: AdminVendorItem[] = records.map((r) => {
        if (new Date(r.createdAt).getTime() >= sevenDaysAgoMs) {
          newApplicationsLast7Days++;
        }
        if (r.experience === "5–10 Years" || r.experience === "10+ Years") {
          experiencedApplicationsCount++;
        }
        if (typeof r.portfolioUrl === "string" && r.portfolioUrl.trim().length > 0) {
          portfolioLinkedCount++;
        }

        return {
          id: r.id,
          businessName: r.businessName,
          contactName: r.contactName,
          phone: r.phone,
          email: r.email,
          city: r.city,
          experience: r.experience,
          portfolioUrl: r.portfolioUrl,
          categories: r.categories,
          createdAt: r.createdAt,
          requestId: r.requestId || null,
        };
      });

      return {
        success: true,
        data: {
          vendors,
          metrics: {
            totalApplications: vendors.length,
            newApplicationsLast7Days,
            experiencedApplicationsCount,
            portfolioLinkedCount,
          },
        },
      };
    } catch (error) {
      logger.error("Failed to retrieve admin vendor applications operational data", error);
      return {
        success: false,
        error: "Unable to load vendor applications. Please try again or check database connectivity.",
      };
    }
  }
}

export const adminVendorService = new AdminVendorService();
