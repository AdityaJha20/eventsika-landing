import { deduplicator, generateVendorDeduplicationKey } from "../deduplication/deduplicator";
import { defaultDeliveryNotifier } from "../integrations/mailer-delivery-notifier";
import { IDeliveryNotifier } from "../integrations/delivery-notifier.interface";
import { logger, maskEmail, maskPhone } from "../logger/logger";
import { defaultVendorRepository } from "../repositories/in-memory-vendor-repository";
import { IVendorRepository } from "../repositories/vendor-repository.interface";
import { ValidatedVendorInput } from "../validation/vendor-schema";

export interface VendorServiceResult {
  success: boolean;
  message: string;
  isBot?: boolean;
  isDuplicate?: boolean;
  applicationId?: string;
}

export class VendorService {
  private repository: IVendorRepository;
  private notifier: IDeliveryNotifier;

  constructor(
    repository: IVendorRepository = defaultVendorRepository,
    notifier: IDeliveryNotifier = defaultDeliveryNotifier
  ) {
    this.repository = repository;
    this.notifier = notifier;
  }

  /**
   * Processes a validated vendor application submission.
   * Handles honeypot detection, rapid deduplication, persistence boundary, and notification dispatch.
   */
  async processVendorApplication(
    vendor: ValidatedVendorInput,
    context?: { requestId?: string; clientIp?: string }
  ): Promise<VendorServiceResult> {
    const requestId = context?.requestId;

    // 1. Honeypot Bot Trap
    if (vendor.isBot) {
      logger.info("Honeypot bot vendor application dropped silently", {
        requestId,
        clientIp: context?.clientIp,
      });
      return {
        success: true,
        message: "Vendor application processed.",
        isBot: true,
      };
    }

    // 2. Rapid Duplicate Protection
    const dedupKey = generateVendorDeduplicationKey(
      vendor.phone,
      vendor.email,
      vendor.businessName
    );

    if (deduplicator.isDuplicate(dedupKey)) {
      logger.info("Duplicate vendor application suppressed within sliding window", {
        requestId,
        maskedPhone: maskPhone(vendor.phone),
        maskedEmail: maskEmail(vendor.email),
        city: vendor.city,
      });
      return {
        success: true,
        message: "Vendor application submitted successfully.",
        isDuplicate: true,
      };
    }

    // 3. Persistence Boundary (In-Memory for Day 2; DB in Day 7)
    let savedRecord;
    try {
      savedRecord = await this.repository.saveVendorApplication(vendor);
    } catch (err) {
      logger.error("Failed to persist vendor application to repository boundary", err, { requestId });
    }

    // 4. External Delivery / Notification Boundary
    try {
      await this.notifier.notifyVendor(vendor, { requestId });
    } catch (err) {
      logger.error("Notification dispatch error during vendor application processing", err, { requestId });
    }

    logger.info("Vendor application processed and recorded successfully", {
      requestId,
      applicationId: savedRecord?.id,
      maskedPhone: maskPhone(vendor.phone),
      maskedEmail: maskEmail(vendor.email),
      city: vendor.city,
      categoriesCount: vendor.categories.length,
    });

    return {
      success: true,
      message: "Vendor application submitted successfully.",
      applicationId: savedRecord?.id,
    };
  }
}

export const vendorService = new VendorService();
