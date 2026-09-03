import { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdminClient } from "../supabase/client";
import {
  DashboardData,
  IDashboardRepository,
  RecentActivityItem,
  UpcomingCelebrationItem,
} from "./dashboard-repository.interface";

/**
 * Supabase Dashboard Repository
 *
 * Implements IDashboardRepository by querying real records from
 * `public.leads` and `public.vendor_applications`.
 * Strictly enforces NO mock/in-memory fallback when Supabase is unavailable.
 */
export class SupabaseDashboardRepository implements IDashboardRepository {
  private client: SupabaseClient | null;

  constructor(client?: SupabaseClient | null) {
    this.client = client !== undefined ? client : getSupabaseAdminClient();
  }

  async getDashboardData(): Promise<DashboardData> {
    const client = this.client || getSupabaseAdminClient();
    if (!client) {
      throw new Error("Supabase client is not configured or unavailable.");
    }

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const todayDate = new Date().toISOString().split("T")[0];

    const [
      totalLeadsRes,
      newLeadsRes,
      totalVendorsRes,
      recentLeadsRes,
      recentVendorsRes,
      upcomingCelebrationsRes,
    ] = await Promise.all([
      // 1. Total Leads Count
      client.from("leads").select("id", { count: "exact", head: true }),

      // 2. New Leads in Last 7 Days Count
      client
        .from("leads")
        .select("id", { count: "exact", head: true })
        .gte("created_at", sevenDaysAgo),

      // 3. Total Vendor Applications Count
      client.from("vendor_applications").select("id", { count: "exact", head: true }),

      // 4. Recent Lead Inquiries
      client
        .from("leads")
        .select("id, user_name, event_type, city, created_at")
        .order("created_at", { ascending: false })
        .limit(5),

      // 5. Recent Vendor Applications
      client
        .from("vendor_applications")
        .select("id, business_name, city, categories, created_at")
        .order("created_at", { ascending: false })
        .limit(5),

      // 6. Upcoming Celebrations (by event_date)
      client
        .from("leads")
        .select("id, user_name, event_type, event_date, city, guest_count, budget_range, selected_services")
        .gte("event_date", todayDate)
        .order("event_date", { ascending: true })
        .limit(5),
    ]);

    // Error verification: fail fast if database query fails (no fake fallback)
    if (totalLeadsRes.error) {
      throw new Error(`Database error querying total leads: ${totalLeadsRes.error.message}`);
    }
    if (newLeadsRes.error) {
      throw new Error(`Database error querying new leads: ${newLeadsRes.error.message}`);
    }
    if (totalVendorsRes.error) {
      throw new Error(`Database error querying vendor applications: ${totalVendorsRes.error.message}`);
    }
    if (recentLeadsRes.error) {
      throw new Error(`Database error querying recent leads: ${recentLeadsRes.error.message}`);
    }
    if (recentVendorsRes.error) {
      throw new Error(`Database error querying recent vendors: ${recentVendorsRes.error.message}`);
    }
    if (upcomingCelebrationsRes.error) {
      throw new Error(`Database error querying upcoming celebrations: ${upcomingCelebrationsRes.error.message}`);
    }

    // Transform recent leads into activity items
    const leadActivities: RecentActivityItem[] = (recentLeadsRes.data || []).map((lead) => ({
      id: `lead_${lead.id}`,
      type: "lead_received",
      title: "New celebration inquiry",
      subtitle: `${lead.user_name} • ${lead.event_type} (${lead.city})`,
      timestamp: lead.created_at,
    }));

    // Transform recent vendors into activity items
    const vendorActivities: RecentActivityItem[] = (recentVendorsRes.data || []).map((v) => {
      const categoriesText = Array.isArray(v.categories) && v.categories.length > 0
        ? v.categories.join(", ")
        : "Partner Application";
      return {
        id: `vendor_${v.id}`,
        type: "vendor_application_received",
        title: "New vendor partner application",
        subtitle: `${v.business_name} • ${categoriesText} (${v.city})`,
        timestamp: v.created_at,
      };
    });

    // Merge and sort chronologically descending
    const mergedActivity = [...leadActivities, ...vendorActivities].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    // Transform upcoming celebration items
    const upcomingCelebrations: UpcomingCelebrationItem[] = (upcomingCelebrationsRes.data || []).map(
      (row) => ({
        id: row.id,
        clientName: row.user_name,
        eventType: row.event_type,
        eventDate: row.event_date,
        city: row.city,
        guestCount: row.guest_count,
        budgetRange: row.budget_range,
        selectedServices: Array.isArray(row.selected_services) ? row.selected_services : [],
      })
    );

    return {
      metrics: {
        totalLeads: totalLeadsRes.count ?? 0,
        newLeadsLast7Days: newLeadsRes.count ?? 0,
        totalVendors: totalVendorsRes.count ?? 0,
      },
      recentActivity: mergedActivity.slice(0, 6),
      upcomingCelebrations,
    };
  }
}
