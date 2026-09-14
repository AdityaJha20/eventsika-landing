import { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdminClient } from "../supabase/client";
import {
  CreateWebhookEventInput,
  WebhookEventRecord,
  WebhookEventStatus,
} from "../types/payment-and-consultation";
import { IWebhookEventRepository } from "./webhook-event-repository.interface";

export class SupabaseWebhookEventRepository implements IWebhookEventRepository {
  private client: SupabaseClient | null;

  constructor(client?: SupabaseClient | null) {
    this.client = client !== undefined ? client : getSupabaseAdminClient();
  }

  private getClient(): SupabaseClient {
    const client = this.client || getSupabaseAdminClient();
    if (!client) {
      throw new Error("Supabase client is not configured or unavailable.");
    }
    return client;
  }

  private mapRowToRecord(row: Record<string, unknown>): WebhookEventRecord {
    return {
      id: String(row.id),
      provider: String(row.provider ?? ""),
      eventId: String(row.event_id ?? ""),
      eventType: String(row.event_type ?? ""),
      payload: row.payload && typeof row.payload === "object" ? (row.payload as Record<string, unknown>) : {},
      signature: String(row.signature ?? ""),
      status: row.status as WebhookEventStatus,
      processingError: typeof row.processing_error === "string" ? row.processing_error : null,
      processedAt: typeof row.processed_at === "string" ? row.processed_at : null,
      createdAt: String(row.created_at),
    };
  }

  async recordWebhookEvent(event: CreateWebhookEventInput): Promise<WebhookEventRecord> {
    const client = this.getClient();
    const { data, error } = await client
      .from("webhook_events")
      .insert({
        provider: event.provider || "cashfree",
        event_id: event.eventId,
        event_type: event.eventType,
        payload: event.payload,
        signature: event.signature,
        status: event.status || "received",
      })
      .select("*")
      .single();

    if (error || !data) {
      throw new Error(`Database error recording webhook event: ${error?.message || "Unknown error"}`);
    }

    return this.mapRowToRecord(data);
  }

  async getWebhookEvent(provider: string, eventId: string): Promise<WebhookEventRecord | null> {
    const client = this.getClient();
    const { data, error } = await client
      .from("webhook_events")
      .select("*")
      .eq("provider", provider)
      .eq("event_id", eventId)
      .maybeSingle();

    if (error) {
      throw new Error(`Database error fetching webhook event: ${error.message}`);
    }

    return data ? this.mapRowToRecord(data) : null;
  }

  async updateWebhookEventStatus(
    id: string,
    status: WebhookEventStatus,
    details?: {
      processingError?: string | null;
      processedAt?: string | null;
    }
  ): Promise<WebhookEventRecord> {
    const client = this.getClient();
    const updates: Record<string, unknown> = { status };
    if (details?.processingError !== undefined) {
      updates.processing_error = details.processingError;
    }
    if (details?.processedAt !== undefined) {
      updates.processed_at = details.processedAt;
    }

    const { data, error } = await client
      .from("webhook_events")
      .update(updates)
      .eq("id", id)
      .select("*")
      .single();

    if (error || !data) {
      throw new Error(`Database error updating webhook event status: ${error?.message || "Unknown error"}`);
    }

    return this.mapRowToRecord(data);
  }
}
