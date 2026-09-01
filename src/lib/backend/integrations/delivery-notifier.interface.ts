import { ValidatedLeadInput } from "../validation/lead-schema";
import { ValidatedVendorInput } from "../validation/vendor-schema";

export interface DeliveryResult {
  delivered: boolean;
  channel?: "resend" | "sendgrid" | "webhook" | "fallback" | "noop";
  error?: string;
}

export interface IDeliveryNotifier {
  /**
   * Dispatches lead notification to the configured external delivery channel
   * (e.g. Email / Webhook / External Dispatcher).
   */
  notifyLead(
    lead: ValidatedLeadInput,
    context?: { requestId?: string }
  ): Promise<DeliveryResult>;

  /**
   * Dispatches vendor application notification to the configured external delivery channel.
   */
  notifyVendor(
    vendor: ValidatedVendorInput,
    context?: { requestId?: string }
  ): Promise<DeliveryResult>;
}
