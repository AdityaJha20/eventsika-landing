import type { Metadata } from "next";
import Link from "next/link";
import {
  adminDashboardService,
  AdminDashboardService,
} from "@/lib/backend/services/admin-dashboard-service";
import styles from "./admin.module.css";

export const metadata: Metadata = {
  title: "Admin Dashboard | Eventsika Concierge Operations",
  description: "Executive operational overview of Eventsika celebration inquiries and vendor network.",
  robots: {
    index: false,
    follow: false,
  },
};

function getInitials(name: string): string {
  if (!name) return "EV";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default async function AdminDashboardPage() {
  const summary = await adminDashboardService.getDashboardSummary();

  if (!summary.success) {
    return (
      <div className={styles.dashboardContainer}>
        <header className={styles.executiveHeader}>
          <div className={styles.headerCopy}>
            <p className={styles.eyebrow}>
              <span className={styles.eyebrowDot} aria-hidden="true" />
              Concierge Operations Suite
            </p>
            <h1 className={styles.title}>Operations Dashboard</h1>
          </div>
        </header>

        <section className={styles.errorCard} aria-live="polite">
          <h2 className={styles.errorTitle}>Operational Notice</h2>
          <p className={styles.errorMessage}>{summary.error}</p>
        </section>
      </div>
    );
  }

  const { metrics, recentActivity, upcomingCelebrations } = summary.data;

  // Derive new inquiries percentage of total leads safely
  const newLeadsPercent =
    metrics.totalLeads > 0
      ? Math.round((metrics.newLeadsLast7Days / metrics.totalLeads) * 100)
      : 0;

  return (
    <div className={styles.dashboardContainer}>
      {/* -------------------------------------------------------------------- */}
      {/* Section 1: Executive Welcome & Header Actions                        */}
      {/* -------------------------------------------------------------------- */}
      <header className={styles.executiveHeader}>
        <div className={styles.headerCopy}>
          <p className={styles.eyebrow}>
            <span className={styles.eyebrowDot} aria-hidden="true" />
            Concierge Operations Suite
          </p>
          <h1 className={styles.title}>Good morning, Admin</h1>
          <p className={styles.subtitle}>
            Here&apos;s what&apos;s happening across your Eventsika operations today.
          </p>
        </div>

        <div className={styles.headerActions}>
          <Link href="/#plan-event" className={styles.primaryAction}>
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            <span>Plan New Event</span>
          </Link>

          <Link href="/for-vendors" className={styles.secondaryAction}>
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
            <span>Vendor Network</span>
          </Link>
        </div>
      </header>

      {/* -------------------------------------------------------------------- */}
      {/* Section 2: Four Key Metric Cards                                     */}
      {/* -------------------------------------------------------------------- */}
      <section className={styles.metricsGrid} aria-label="Key operational metrics">
        {/* Card 1: Total Leads */}
        <div className={styles.metricCard}>
          <div className={styles.metricCardTop}>
            <div>
              <p className={styles.metricLabel}>Total Leads</p>
              <p className={styles.metricValue}>{metrics.totalLeads}</p>
            </div>
            <div className={styles.metricIconWrap} aria-hidden="true">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </div>
          </div>
          <div className={styles.metricFooter}>
            <span className={styles.metricBadgeSage}>
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
                <polyline points="17 6 23 6 23 12" />
              </svg>
              <span>Active</span>
            </span>
            <span className={styles.metricFooterText}>Celebration inquiries</span>
          </div>
        </div>

        {/* Card 2: New Leads (Last 7 Days) */}
        <div className={styles.metricCard}>
          <div className={styles.metricCardTop}>
            <div>
              <p className={styles.metricLabel}>New Inquiries</p>
              <p className={`${styles.metricValue} ${styles.metricValueCrimson}`}>
                {metrics.newLeadsLast7Days}
              </p>
            </div>
            <div
              className={`${styles.metricIconWrap} ${styles.metricIconWrapCrimson}`}
              aria-hidden="true"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
            </div>
          </div>
          <div className={styles.metricFooter}>
            <span className={styles.metricBadgeCrimson}>
              <span
                style={{
                  display: "inline-block",
                  width: "6px",
                  height: "6px",
                  borderRadius: "50%",
                  backgroundColor: "var(--primary, #7f1010)",
                }}
              />
              <span>Review window</span>
            </span>
            <span className={styles.metricFooterText}>Received in last 7 days</span>
          </div>
        </div>

        {/* Card 3: Operational Follow-ups (Transparent Stage Indicator) */}
        <div className={styles.metricCard}>
          <div className={styles.metricCardTop}>
            <div>
              <p className={styles.metricLabel}>Follow-ups</p>
              <p className={styles.metricValue}>—</p>
            </div>
            <div className={styles.metricIconWrap} aria-hidden="true">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            </div>
          </div>
          <div className={styles.metricFooter}>
            <span className={styles.stageSubtextFuture}>Phase 2 Schema</span>
            <span className={styles.metricFooterText}>Requires status column</span>
          </div>
        </div>

        {/* Card 4: Vendor Partner Applications */}
        <div className={styles.metricCard}>
          <div className={styles.metricCardTop}>
            <div>
              <p className={styles.metricLabel}>Vendor Network</p>
              <p className={styles.metricValue}>{metrics.totalVendors}</p>
            </div>
            <div className={styles.metricIconWrap} aria-hidden="true">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M20 7h-9" />
                <path d="M14 17H5" />
                <circle cx="17" cy="17" r="3" />
                <circle cx="7" cy="7" r="3" />
              </svg>
            </div>
          </div>
          <div className={styles.metricFooter}>
            <span className={styles.metricBadgeSage}>
              <span>Partner Intake</span>
            </span>
            <span className={styles.metricFooterText}>Applications captured</span>
          </div>
        </div>
      </section>

      {/* -------------------------------------------------------------------- */}
      {/* Section 3: Middle Row (Lead Pipeline 8-col + Recent Activity 4-col)  */}
      {/* -------------------------------------------------------------------- */}
      <section className={styles.middleGrid}>
        {/* Left (8 cols): Lead Pipeline */}
        <div className={styles.sectionCard}>
          <div>
            <div className={styles.sectionHeader}>
              <div>
                <h2 className={styles.sectionTitle}>Lead Pipeline</h2>
                <p className={styles.sectionSubtitle}>
                  Operational inquiry progression across active stages
                </p>
              </div>
              <span className={styles.syncBadge}>
                <span className={styles.syncBadgeDot} aria-hidden="true" />
                Database Synchronized
              </span>
            </div>

            {/* 5-Stage Horizontal Progression Track */}
            <div className={styles.pipelineTrackContainer}>
              <div className={styles.pipelineConnectingLine} aria-hidden="true" />

              <div className={styles.pipelineStagesGrid}>
                {/* Stage 1: TOTAL INQUIRIES */}
                <div className={styles.pipelineStageCard}>
                  <span className={styles.stageLabel}>Total Intake</span>
                  <div className={styles.stageNode} aria-hidden="true">
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                      <circle cx="9" cy="7" r="4" />
                    </svg>
                  </div>
                  <span className={styles.stageValue}>{metrics.totalLeads}</span>
                  <span className={styles.stageSubtext}>100%</span>
                </div>

                {/* Stage 2: NEW INQUIRIES */}
                <div className={`${styles.pipelineStageCard} ${styles.pipelineStageActive}`}>
                  <span className={`${styles.stageLabel} ${styles.stageLabelActive}`}>
                    New (7d)
                  </span>
                  <div
                    className={`${styles.stageNode} ${styles.stageNodeActive}`}
                    aria-hidden="true"
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                    </svg>
                  </div>
                  <span className={`${styles.stageValue} ${styles.stageValueActive}`}>
                    {metrics.newLeadsLast7Days}
                  </span>
                  <span className={`${styles.stageSubtext} ${styles.stageSubtextActive}`}>
                    {newLeadsPercent}%
                  </span>
                </div>

                {/* Stage 3: FOLLOW-UP */}
                <div className={styles.pipelineStageCard}>
                  <span className={styles.stageLabel}>Follow-up</span>
                  <div className={styles.stageNode} aria-hidden="true">
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <circle cx="12" cy="12" r="10" />
                      <polyline points="12 6 12 12 16 14" />
                    </svg>
                  </div>
                  <span className={styles.stageValue}>—</span>
                  <span className={styles.stageSubtextFuture}>Phase 2</span>
                </div>

                {/* Stage 4: IN PROGRESS */}
                <div className={styles.pipelineStageCard}>
                  <span className={styles.stageLabel}>In Progress</span>
                  <div className={styles.stageNode} aria-hidden="true">
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                    </svg>
                  </div>
                  <span className={styles.stageValue}>—</span>
                  <span className={styles.stageSubtextFuture}>Phase 2</span>
                </div>

                {/* Stage 5: CONVERTED */}
                <div className={styles.pipelineStageCard}>
                  <span className={styles.stageLabel}>Converted</span>
                  <div className={styles.stageNode} aria-hidden="true">
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                      <polyline points="22 4 12 14.01 9 11.01" />
                    </svg>
                  </div>
                  <span className={styles.stageValue}>—</span>
                  <span className={styles.stageSubtextFuture}>Phase 2</span>
                </div>
              </div>
            </div>
          </div>

          <div className={styles.pipelineNotice}>
            <div className={styles.pipelineNoticeLeft}>
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="16" x2="12" y2="12" />
                <line x1="12" y1="8" x2="12.01" y2="8" />
              </svg>
              <span>Stages 3–5 require lead status workflow (Phase 2 schema update).</span>
            </div>
            <div className={styles.pipelineNoticeRight}>
              <span>Real database records connected</span>
            </div>
          </div>
        </div>

        {/* Right (4 cols): Recent Activity Timeline */}
        <div className={styles.sectionCard}>
          <div>
            <div className={styles.sectionHeader}>
              <div>
                <h2 className={styles.sectionTitle}>Recent Activity</h2>
                <p className={styles.sectionSubtitle}>Chronological intake stream</p>
              </div>
            </div>

            <div className={styles.activityList}>
              <div className={styles.activityTrackLine} aria-hidden="true" />

              {recentActivity.length === 0 ? (
                <p className={styles.emptyStateText}>No recent activity recorded yet.</p>
              ) : (
                recentActivity.map((item) => {
                  const isLead = item.type === "lead_received";
                  return (
                    <div key={item.id} className={styles.activityItem}>
                      <div
                        className={`${styles.activityIconWrap} ${
                          isLead ? styles.activityIconLead : styles.activityIconVendor
                        }`}
                        aria-hidden="true"
                      >
                        {isLead ? (
                          <svg
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                          >
                            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                          </svg>
                        ) : (
                          <svg
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                          >
                            <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                            <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
                          </svg>
                        )}
                      </div>

                      <div className={styles.activityContent}>
                        <div className={styles.activityTopRow}>
                          <p className={styles.activityTitle}>{item.title}</p>
                          <span className={styles.activityTime}>
                            {AdminDashboardService.formatRelativeTime(item.timestamp)}
                          </span>
                        </div>
                        <p className={styles.activitySubtitle}>{item.subtitle}</p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </section>

      {/* -------------------------------------------------------------------- */}
      {/* Section 4: Upcoming Celebrations Table                               */}
      {/* -------------------------------------------------------------------- */}
      <section className={styles.tableCard} aria-labelledby="upcoming-celebrations-heading">
        <div className={styles.sectionHeader}>
          <div>
            <h2 id="upcoming-celebrations-heading" className={styles.sectionTitle}>
              Upcoming Celebrations
            </h2>
            <p className={styles.sectionSubtitle}>
              Scheduled events based on client inquiry celebration dates.
            </p>
          </div>
        </div>

        <div className={styles.tableResponsiveWrap}>
          {upcomingCelebrations.length === 0 ? (
            <p className={styles.emptyStateText}>No upcoming celebration bookings yet.</p>
          ) : (
            <table className={styles.celebrationsTable}>
              <thead>
                <tr>
                  <th>Client &amp; City</th>
                  <th>Celebration Type</th>
                  <th>Event Date</th>
                  <th>Guest Tier</th>
                  <th>Selected Services</th>
                  <th>Inquiry Status</th>
                </tr>
              </thead>
              <tbody>
                {upcomingCelebrations.map((row) => (
                  <tr key={row.id} className={styles.tableRow}>
                    <td>
                      <div className={styles.clientCell}>
                        <div className={styles.clientAvatar} aria-hidden="true">
                          {getInitials(row.clientName)}
                        </div>
                        <div className={styles.clientDetails}>
                          <span className={styles.clientName}>{row.clientName}</span>
                          <span className={styles.clientCity}>{row.city}</span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className={styles.eventTypeBadge}>{row.eventType}</span>
                    </td>
                    <td className={styles.dateCell}>
                      {AdminDashboardService.formatEventDate(row.eventDate)}
                    </td>
                    <td>{row.guestCount}</td>
                    <td>
                      <div className={styles.servicesTagWrap}>
                        {row.selectedServices.map((service, idx) => (
                          <span key={idx} className={styles.serviceTag}>
                            {service}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td>
                      <span className={styles.statusPill}>
                        <span className={styles.statusPillDot} aria-hidden="true" />
                        Inquiry Scheduled
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}
