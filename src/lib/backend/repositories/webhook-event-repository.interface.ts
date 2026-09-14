import {
  CreateWebhookEventInput,
  WebhookEventRecord,
  WebhookEventStatus,
} from "../types/payment-and-consultation";

export interface IWebhookEventRepository {
  /**
   * Persists a raw inbound webhook event for idempotency and audit.
   */
  recordWebhookEvent(event: CreateWebhookEventInput): Promise<WebhookEventRecord>;

  /**
   * Retrieves a webhook event by provider and provider event ID.
   */
  getWebhookEvent(provider: string, eventId: string): Promise<WebhookEventRecord | null>;

  /**
   * Updates processing status and optional error notes for an event.
   */
  updateWebhookEventStatus(
    id: string,
    status: WebhookEventStatus,
    details?: {
      processingError?: string | null;
      processedAt?: string | null;
    }
  ): Promise<WebhookEventRecord>;
}
