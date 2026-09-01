import { deduplicator, generateLeadDeduplicationKey } from "../deduplication/deduplicator";
import { defaultDeliveryNotifier } from "../integrations/mailer-delivery-notifier";
import { IDeliveryNotifier } from "../integrations/delivery-notifier.interface";
import { logger, maskPhone } from "../logger/logger";
import { defaultLeadRepository } from "../repositories/in-memory-lead-repository";
import { ILeadRepository } from "../repositories/lead-repository.interface";
import { ValidatedLeadInput } from "../validation/lead-schema";

export interface LeadServiceResult {
  success: boolean;
  message: string;
  isBot?: boolean;
  isDuplicate?: boolean;
  leadId?: string;
}

export class LeadService {
  private repository: ILeadRepository;
  private notifier: IDeliveryNotifier;

  constructor(
    repository: ILeadRepository = defaultLeadRepository,
    notifier: IDeliveryNotifier = defaultDeliveryNotifier
  ) {
    this.repository = repository;
    this.notifier = notifier;
  }

  /**
   * Processes a validated celebration lead submission.
   * Handles honeypot detection, rapid deduplication, persistence boundary, and notification dispatch.
   */
  async processLead(
    lead: ValidatedLeadInput,
    context?: { requestId?: string; clientIp?: string }
  ): Promise<LeadServiceResult> {
    const requestId = context?.requestId;

    // 1. Honeypot Bot Trap: drop silently without sending notification
    if (lead.isBot) {
      logger.info("Honeypot bot lead dropped silently", {
        requestId,
        clientIp: context?.clientIp,
      });
      return {
        success: true,
        message: "Lead processed.",
        isBot: true,
      };
    }

    // 2. Rapid Duplicate Protection
    const dedupKey = generateLeadDeduplicationKey(
      lead.userPhone,
      lead.eventType,
      lead.eventDate,
      lead.city
    );

    if (deduplicator.isDuplicate(dedupKey)) {
      logger.info("Duplicate lead submission suppressed within sliding window", {
        requestId,
        maskedPhone: maskPhone(lead.userPhone),
        city: lead.city,
        eventType: lead.eventType,
      });
      return {
        success: true,
        message: "Celebration details submitted successfully.",
        isDuplicate: true,
      };
    }

    // 3. Persistence Boundary (In-Memory for Day 2; DB in Day 7)
    let savedRecord;
    try {
      savedRecord = await this.repository.saveLead(lead);
    } catch (err) {
      logger.error("Failed to persist lead record to repository boundary", err, { requestId });
      // Non-fatal for Day 2 fallback; proceed to notification
    }

    // 4. External Delivery / Notification Boundary
    try {
      await this.notifier.notifyLead(lead, { requestId });
    } catch (err) {
      logger.error("Notification dispatch error during lead processing", err, { requestId });
      // Proceed gracefully so client receives positive confirmation if submission was accepted
    }

    logger.info("Lead submission processed and recorded successfully", {
      requestId,
      leadId: savedRecord?.id,
      maskedPhone: maskPhone(lead.userPhone),
      city: lead.city,
      eventType: lead.eventType,
      servicesCount: lead.selectedServices.length,
    });

    return {
      success: true,
      message: "Celebration details submitted successfully.",
      leadId: savedRecord?.id,
    };
  }
}

export const leadService = new LeadService();
