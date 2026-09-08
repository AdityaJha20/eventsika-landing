"use client";

import React, { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  AnalyticsData,
  AnalyticsDateRange,
  DATE_RANGE_PRESETS,
} from "@/lib/backend/repositories/analytics-repository.interface";
import { IndiaDemandMap } from "./IndiaDemandMap";
import { LeadSourcesDonut } from "./LeadSourcesDonut";
import styles from "./analytics.module.css";

interface AnalyticsWorkspaceProps {
  initialData: AnalyticsData;
  activeRange: AnalyticsDateRange;
}

const TABS = [
  { id: "overview", label: "Overview", isAvailable: true },
  { id: "event-demand", label: "Event Demand", isAvailable: false },
  { id: "geography", label: "Geography", isAvailable: false },
  { id: "client-profile", label: "Client Profile", isAvailable: false },
  { id: "vendors", label: "Vendors", isAvailable: false },
  { id: "reports", label: "Reports", isAvailable: false },
];

export function AnalyticsWorkspace({ initialData, activeRange }: AnalyticsWorkspaceProps) {
  const router = useRouter();
  const [selectedTab, setSelectedTab] = useState<string>("overview");
  const [isDateOpen, setIsDateOpen] = useState<boolean>(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const {
    dateRangeLabel,
    metrics,
    topCities,
    cityMarkers,
    keyTakeaway,
    eventTrends,
    journeyStages,
  } = initialData;

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDateOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleRangeSelect = (rangeId: AnalyticsDateRange) => {
    setIsDateOpen(false);
    if (rangeId === activeRange) return;
    router.push(`/admin/analytics?range=${rangeId}`);
  };

  const getEventIcon = (iconName: string) => {
    switch (iconName) {
      case "cake":
        return (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M20 21v-8a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8" />
            <path d="M4 16s.5-1 2-1 2.5 2 4 2 2.5-2 4-2 2.5 2 4 2 2-1 2-1" />
            <path d="M2 21h20" />
            <path d="M7 8v3" />
            <path d="M12 8v3" />
            <path d="M17 8v3" />
            <path d="M7 4h.01" />
            <path d="M12 4h.01" />
            <path d="M17 4h.01" />
          </svg>
        );
      case "favorite":
        return (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
          </svg>
        );
      case "wine_bar":
        return (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M8 22h8" />
            <path d="M7 10h10" />
            <path d="M12 15v7" />
            <path d="M12 15a5 5 0 0 0 5-5c0-2-.5-4-2-8H9c-1.5 4-2 6-2 8a5 5 0 0 0 5 5Z" />
          </svg>
        );
      case "business_center":
        return (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect width="20" height="14" x="2" y="7" rx="2" ry="2" />
            <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
          </svg>
        );
      default:
        return (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
          </svg>
        );
    }
  };

  return (
    <div className={styles.analyticsContainer}>
      {/* -------------------------------------------------------------------- */}
      {/* Section 1: Header & Date Selector                                    */}
      {/* -------------------------------------------------------------------- */}
      <section className={styles.headerSection}>
        <div className={styles.headerRow}>
          <div className={styles.headerCopy}>
            <span className={styles.eyebrow}>Analytics</span>
            <h1 className={styles.title}>Celebrations in Focus</h1>
            <p className={styles.subtitle}>
              Real insights. Better decisions. Greater celebrations.
            </p>
          </div>

          <div className={styles.dateRangeControls} ref={dropdownRef}>
            <button
              type="button"
              className={styles.datePill}
              onClick={() => setIsDateOpen((prev) => !prev)}
              aria-haspopup="listbox"
              aria-expanded={isDateOpen}
              aria-label="Filter analytics by date range"
            >
              <span className={styles.dateIcon}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
                  <line x1="16" x2="16" y1="2" y2="6" />
                  <line x1="8" x2="8" y1="2" y2="6" />
                  <line x1="3" x2="21" y1="10" y2="10" />
                </svg>
              </span>
              <span>{dateRangeLabel}</span>
              <span
                className={`${styles.dateChevron} ${
                  isDateOpen ? styles.dateChevronOpen : ""
                }`}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </span>
            </button>

            {isDateOpen && (
              <div className={styles.dateDropdownMenu} role="listbox">
                {DATE_RANGE_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    className={`${styles.dateDropdownItem} ${
                      preset.id === activeRange ? styles.dateDropdownItemActive : ""
                    }`}
                    onClick={() => handleRangeSelect(preset.id)}
                    role="option"
                    aria-selected={preset.id === activeRange}
                  >
                    <span>{preset.label}</span>
                    {preset.id === activeRange && (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ------------------------------------------------------------------ */}
        {/* Section 2: Tab Navigation Strip                                    */}
        {/* ------------------------------------------------------------------ */}
        <nav className={styles.tabStrip} aria-label="Analytics categories">
          {TABS.map((tab) => {
            const isActive = selectedTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                className={`${styles.tabItem} ${isActive ? styles.tabItemActive : ""}`}
                onClick={() => setSelectedTab(tab.id)}
                aria-current={isActive ? "page" : undefined}
              >
                <span>{tab.label}</span>
                {!tab.isAvailable && (
                  <span className={styles.tabPlaceholderBadge}>Phase 2</span>
                )}
                {isActive && <span className={styles.tabUnderline} />}
              </button>
            );
          })}
        </nav>
      </section>

      {/* -------------------------------------------------------------------- */}
      {/* Section 3: Demand Heatmap & Geographic Intelligence                  */}
      {/* -------------------------------------------------------------------- */}
      <section>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Demand Heatmap</h2>
          <p className={styles.sectionSubtitle}>Lead volume by city</p>
        </div>

        <div className={styles.heatmapGrid}>
          {/* Left: Map Card */}
          <div className={styles.mapCard}>
            <div className={styles.cardTopMeta}>
              <span className={styles.cardEyebrow}>Territorial Distribution</span>
              <span className={styles.activePeriodBadge}>{dateRangeLabel}</span>
            </div>

            <IndiaDemandMap markers={cityMarkers} />
          </div>

          {/* Middle: Top Cities Ranking */}
          <div className={styles.rankedHubsCard}>
            <div>
              <div className={styles.cardTopMeta}>
                <span className={styles.cardEyebrow}>Ranked Hubs</span>
              </div>
              <h3
                style={{
                  fontFamily: "var(--font-inter), sans-serif",
                  fontSize: "1.1rem",
                  fontWeight: 600,
                  color: "var(--foreground, #2b211d)",
                }}
              >
                Top Cities
              </h3>

              <div className={styles.rankedList}>
                {topCities.map((item) => (
                  <div key={item.city} className={styles.rankedRow}>
                    <div className={styles.rankedRowLeft}>
                      <span
                        className={
                          item.rank === 1
                            ? styles.rankBadgePrimary
                            : styles.rankBadgeMuted
                        }
                      >
                        {item.rank}
                      </span>
                      <span className={styles.cityName}>{item.city}</span>
                    </div>
                    <span
                      className={
                        item.rank === 1
                          ? styles.cityPercentPrimary
                          : styles.cityPercentMuted
                      }
                    >
                      {item.percentage}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right: Key Takeaway */}
          <div className={styles.takeawayCard}>
            <div>
              <div className={styles.takeawayIconWrap}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5" />
                  <path d="M9 18h6" />
                  <path d="M10 22h4" />
                </svg>
              </div>
              <span className={styles.cardEyebrow}>Key Takeaway</span>
              <h4 className={styles.takeawayTitle}>Regional Focus</h4>
              <p className={styles.takeawayBody}>{keyTakeaway.summary}</p>
            </div>

            <div className={styles.takeawayFooter}>
              <span>Actionable Intelligence</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            </div>
          </div>
        </div>
      </section>

      {/* -------------------------------------------------------------------- */}
      {/* Section 4: Celebration Trends                                        */}
      {/* -------------------------------------------------------------------- */}
      <section>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Celebration Trends</h2>
          <p className={styles.sectionSubtitle}>
            Which celebrations are people planning?
          </p>
        </div>

        <div className={styles.trendsGrid}>
          {eventTrends.map((trend, idx) => (
            <div key={trend.key} className={styles.trendCard}>
              <div>
                <div
                  className={styles.trendIconCircle}
                  style={{
                    backgroundColor:
                      idx === 0
                        ? "rgba(127, 16, 16, 0.12)"
                        : idx === 1
                        ? "#fed488"
                        : idx === 2
                        ? "rgba(127, 16, 16, 0.08)"
                        : "var(--cream, #f8f3ec)",
                    color:
                      idx === 0
                        ? "var(--primary, #7f1010)"
                        : idx === 1
                        ? "#775a19"
                        : idx === 2
                        ? "var(--primary, #7f1010)"
                        : "var(--foreground, #2b211d)",
                  }}
                >
                  {getEventIcon(trend.icon)}
                </div>
                <h4 className={styles.trendLabel}>{trend.label}</h4>
              </div>

              <div className={styles.trendStatArea}>
                <span
                  className={`${styles.trendPercent} ${
                    idx < 2 ? styles.trendPercentPrimary : styles.trendPercentNeutral
                  }`}
                >
                  {trend.percentage}%
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* -------------------------------------------------------------------- */}
      {/* Section 5: Two-Column Intelligence (Lead Journey & Lead Sources)     */}
      {/* -------------------------------------------------------------------- */}
      <section className={styles.intelGrid}>
        {/* Left Column: Lead Journey Funnel */}
        <div className={styles.journeyCard}>
          <div>
            <div className={styles.cardTopMeta}>
              <div>
                <span className={styles.cardEyebrow}>Conversion Flow</span>
                <h3
                  style={{
                    fontFamily: "var(--font-playfair), Georgia, serif",
                    fontSize: "1.3rem",
                    fontWeight: 600,
                    color: "var(--foreground, #2b211d)",
                    marginTop: "0.2rem",
                  }}
                >
                  Lead Journey
                </h3>
              </div>
              <span
                style={{
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  color: "var(--primary, #7f1010)",
                  backgroundColor: "rgba(127, 16, 16, 0.1)",
                  padding: "0.25rem 0.65rem",
                  borderRadius: "9999px",
                }}
              >
                Intake Stage
              </span>
            </div>

            <div className={styles.journeyStagesStack}>
              {journeyStages.map((stage, idx) => (
                <React.Fragment key={stage.step}>
                  <div
                    className={`${styles.stageRow} ${
                      stage.isReal ? styles.stageRowActive : ""
                    }`}
                  >
                    <div className={styles.stageRowLeft}>
                      <span
                        className={
                          stage.isReal
                            ? styles.stageStepPrimary
                            : styles.stageStepMuted
                        }
                      >
                        {stage.step}
                      </span>
                      <span className={styles.stageLabel}>{stage.label}</span>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      {stage.isReal ? (
                        <span className={`${styles.stageCount} ${styles.stageCountPrimary}`}>
                          {stage.count}
                        </span>
                      ) : (
                        <span
                          style={{
                            fontSize: "0.72rem",
                            color: "#8c716d",
                            backgroundColor: "var(--cream-light, #fffaf4)",
                            border: "1px solid var(--border, #dfd2c3)",
                            padding: "2px 6px",
                            borderRadius: "4px",
                            fontWeight: 500,
                          }}
                        >
                          {stage.statusNote || "Phase 2"}
                        </span>
                      )}
                    </div>
                  </div>

                  {idx < journeyStages.length - 1 && (
                    <div className={styles.stageArrowConnector}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <line x1="12" y1="5" x2="12" y2="19" />
                        <polyline points="19 12 12 19 5 12" />
                      </svg>
                    </div>
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Lead Sources Attribution */}
        <div className={styles.sourcesCard}>
          <div>
            <div className={styles.cardTopMeta}>
              <div>
                <span className={styles.cardEyebrow}>Attribution</span>
                <h3
                  style={{
                    fontFamily: "var(--font-playfair), Georgia, serif",
                    fontSize: "1.3rem",
                    fontWeight: 600,
                    color: "var(--foreground, #2b211d)",
                    marginTop: "0.2rem",
                  }}
                >
                  Lead Sources
                </h3>
              </div>
            </div>

            <LeadSourcesDonut totalLeads={metrics.periodLeadsCount} />
          </div>
        </div>
      </section>

      {/* -------------------------------------------------------------------- */}
      {/* Section 6: Operational Signals                                       */}
      {/* -------------------------------------------------------------------- */}
      <section>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Operational Signals</h2>
        </div>

        <div className={styles.signalsGrid}>
          {/* 1. Lead Growth */}
          <div className={styles.signalCard}>
            <div className={styles.signalContent}>
              <div className={styles.signalValueRow}>
                <span className={`${styles.signalValue} ${styles.signalValuePrimary}`}>
                  {metrics.leadGrowthPercent !== null
                    ? `${metrics.leadGrowthPercent >= 0 ? "+" : ""}${metrics.leadGrowthPercent}%`
                    : "—"}
                </span>
              </div>
              <span className={styles.signalLabel}>
                Lead growth (vs. previous period)
              </span>
            </div>
            <div
              className={styles.signalIconCircle}
              style={{
                backgroundColor: "rgba(127, 16, 16, 0.1)",
                color: "var(--primary, #7f1010)",
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
                <polyline points="17 6 23 6 23 12" />
              </svg>
            </div>
          </div>

          {/* 2. Target Response SLA */}
          <div className={styles.signalCard}>
            <div className={styles.signalContent}>
              <div className={styles.signalValueRow}>
                <span className={`${styles.signalValue} ${styles.signalValueNeutral}`}>
                  &lt; 2h
                </span>
              </div>
              <span className={styles.signalLabel}>
                Target concierge response SLA
              </span>
            </div>
            <div
              className={styles.signalIconCircle}
              style={{
                backgroundColor: "#fed488",
                color: "#775a19",
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            </div>
          </div>

          {/* 3. Upcoming Events */}
          <div className={styles.signalCard}>
            <div className={styles.signalContent}>
              <div className={styles.signalValueRow}>
                <span className={`${styles.signalValue} ${styles.signalValueNeutral}`}>
                  {metrics.upcomingEventsCount}
                </span>
              </div>
              <span className={styles.signalLabel}>
                Upcoming events scheduled
              </span>
            </div>
            <div
              className={styles.signalIconCircle}
              style={{
                backgroundColor: "var(--cream, #f8f3ec)",
                color: "var(--foreground, #2b211d)",
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
                <line x1="16" x2="16" y1="2" y2="6" />
                <line x1="8" x2="8" y1="2" y2="6" />
                <line x1="3" x2="21" y1="10" y2="10" />
              </svg>
            </div>
          </div>

          {/* 4. Vendor Applications in Period */}
          <div className={styles.signalCard}>
            <div className={styles.signalContent}>
              <div className={styles.signalValueRow}>
                <span className={`${styles.signalValue} ${styles.signalValuePrimary}`}>
                  {metrics.periodVendorAppsCount}
                </span>
                {metrics.vendorGrowthPercent !== null && (
                  <span className={styles.signalDeltaBadge}>
                    {metrics.vendorGrowthPercent >= 0 ? "+" : ""}
                    {metrics.vendorGrowthPercent}%
                  </span>
                )}
              </div>
              <span className={styles.signalLabel}>
                Vendor applications in period
              </span>
            </div>
            <div
              className={styles.signalIconCircle}
              style={{
                backgroundColor: "rgba(127, 16, 16, 0.1)",
                color: "var(--primary, #7f1010)",
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </div>
          </div>
        </div>
      </section>

      {/* -------------------------------------------------------------------- */}
      {/* Section 7: Bottom Editorial Brand Statement                          */}
      {/* -------------------------------------------------------------------- */}
      <section className={styles.brandStatementSection}>
        <div className={styles.goldDivider} />
        <blockquote className={styles.brandQuote}>
          “Data helps us plan. People help us celebrate.”
        </blockquote>
        <div className={styles.brandSignature}>
          Eventsika Admin Operations Portal
        </div>
        <div className={styles.goldDivider} />
      </section>
    </div>
  );
}
