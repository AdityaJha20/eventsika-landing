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

  /**
   * Leases an event for processing; null when terminal, leased elsewhere or exhausted.
   */
  claimWebhookEvent(id: string, leaseSeconds?: number, maxAttempts?: number): Promise<WebhookEventRecord | null>;

  /**
   * Non-terminal events whose lease has expired, oldest first.
   */
  listRetryableEvents(provider: string, createdBefore: string, limit: number): Promise<WebhookEventRecord[]>;
}
