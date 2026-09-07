"use client";

import React, { useState, useMemo } from "react";
import { SavedLeadRecord } from "@/lib/backend/repositories/lead-repository.interface";
import { AdminLeadsMetrics } from "@/lib/backend/services/admin-lead-service";
import {
  EVENT_TYPE_OPTIONS,
  CITY_OPTIONS,
} from "@/lib/backend/constants/allowlists";
import styles from "./leads.module.css";

interface LeadsWorkspaceProps {
  initialLeads: SavedLeadRecord[];
  metrics: AdminLeadsMetrics;
}

function cleanIndianPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return digits.length === 10 ? digits : digits.slice(-10);
}

function formatDisplayDate(dateStr: string): string {
  try {
    const [year, month, day] = dateStr.split("-").map(Number);
    const d = new Date(Date.UTC(year, month - 1, day));
    return d.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    });
  } catch {
    return dateStr;
  }
}

function formatDisplayDateTime(isoStr: string): string {
  try {
    const d = new Date(isoStr);
    return d.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return isoStr;
  }
}

function isRecentSubmission(isoStr: string): boolean {
  try {
    const timeMs = new Date(isoStr).getTime();
    return Date.now() - timeMs <= 48 * 60 * 60 * 1000;
  } catch {
    return false;
  }
}

function renderServiceIcon(serviceName: string) {
  if (serviceName.includes("Decor")) {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
      </svg>
    );
  }
  if (serviceName.includes("Food") || serviceName.includes("Catering")) {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M18 8h1a4 4 0 0 1 0 8h-1" />
        <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z" />
        <line x1="6" y1="1" x2="6" y2="4" />
        <line x1="10" y1="1" x2="10" y2="4" />
        <line x1="14" y1="1" x2="14" y2="4" />
      </svg>
    );
  }
  if (serviceName.includes("Photography") || serviceName.includes("Films")) {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
        <circle cx="12" cy="13" r="4" />
      </svg>
    );
  }
  if (serviceName.includes("Music") || serviceName.includes("Entertainment")) {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M9 18V5l12-2v13" />
        <circle cx="6" cy="18" r="3" />
        <circle cx="18" cy="16" r="3" />
      </svg>
    );
  }
  if (serviceName.includes("Furniture")) {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M19 9V6a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v3" />
        <path d="M3 11v5a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2z" />
        <path d="M5 18v3" />
        <path d="M19 18v3" />
      </svg>
    );
  }
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}

export function LeadsWorkspace({ initialLeads, metrics }: LeadsWorkspaceProps) {
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(
    initialLeads[0]?.id || null
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedEventType, setSelectedEventType] = useState<string>("All");
  const [selectedCity, setSelectedCity] = useState<string>("All");
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "eventDate">("newest");
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isMobileDossierOpen, setIsMobileDossierOpen] = useState(false);

  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  };

  // Filter & Sort
  const filteredLeads = useMemo(() => {
    return initialLeads
      .filter((lead) => {
        if (selectedEventType !== "All" && lead.eventType !== selectedEventType) {
          return false;
        }
        if (selectedCity !== "All" && lead.city !== selectedCity) {
          return false;
        }
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const matchesName = lead.userName.toLowerCase().includes(q);
          const matchesPhone = lead.userPhone.includes(q);
          const matchesCity = lead.city.toLowerCase().includes(q);
          const matchesType = lead.eventType.toLowerCase().includes(q);
          const matchesServices = lead.selectedServices.some((s) =>
            s.toLowerCase().includes(q)
          );
          if (
            !matchesName &&
            !matchesPhone &&
            !matchesCity &&
            !matchesType &&
            !matchesServices
          ) {
            return false;
          }
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === "newest") {
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        }
        if (sortBy === "oldest") {
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        }
        if (sortBy === "eventDate") {
          return a.eventDate.localeCompare(b.eventDate);
        }
        return 0;
      });
  }, [initialLeads, selectedEventType, selectedCity, searchQuery, sortBy]);

  // Selected lead object
  const activeLead = useMemo(() => {
    if (!filteredLeads.length) return null;
    const found = filteredLeads.find((l) => l.id === selectedLeadId);
    return found || filteredLeads[0];
  }, [filteredLeads, selectedLeadId]);

  const handleSelectLead = (leadId: string) => {
    setSelectedLeadId(leadId);
    setIsMobileDossierOpen(true);
  };

  const handleCopyPhone = () => {
    if (!activeLead) return;
    navigator.clipboard.writeText(activeLead.userPhone);
    showToast(`Phone (+91 ${activeLead.userPhone}) copied to clipboard`);
  };

  const handleCopySummary = () => {
    if (!activeLead) return;
    const summary = [
      `Eventsika Celebration Inquiry`,
      `Client: ${activeLead.userName}`,
      `Occasion: ${activeLead.eventType}`,
      `City: ${activeLead.city}`,
      `Planned Date: ${formatDisplayDate(activeLead.eventDate)}`,
      `Guests: ${activeLead.guestCount}`,
      `Setting: ${activeLead.venueType}`,
      `Budget: ${activeLead.budgetRange}`,
      `Phone: +91 ${activeLead.userPhone} (WhatsApp: Verified)`,
      `Services: ${activeLead.selectedServices.join(", ")}`,
      `Submitted: ${formatDisplayDateTime(activeLead.createdAt)}`,
    ].join("\n");

    navigator.clipboard.writeText(summary);
    showToast("Inquiry summary copied to clipboard");
  };

  const handleResetFilters = () => {
    setSearchQuery("");
    setSelectedEventType("All");
    setSelectedCity("All");
  };

  const todayDate = new Date().toISOString().split("T")[0];
  const isUpcoming = activeLead ? activeLead.eventDate >= todayDate : false;
  const cleanPhone = activeLead ? cleanIndianPhone(activeLead.userPhone) : "";
  const whatsappGreeting = activeLead
    ? encodeURIComponent(
        `Hello ${activeLead.userName}, thank you for reaching out to Eventsika regarding your ${activeLead.eventType} celebration in ${activeLead.city}. We would love to discuss your celebration plans.`
      )
    : "";

  return (
    <div className={styles.leadsContainer}>
      {/* -------------------------------------------------------------------- */}
      {/* Top Header: Command Center Overview                                  */}
      {/* -------------------------------------------------------------------- */}
      <header className={styles.commandHeader}>
        <div className={styles.headerCopy}>
          <p className={styles.eyebrow}>
            <span className={styles.eyebrowDot} aria-hidden="true" />
            Celebration Inquiries • Operational Queue
          </p>
          <h1 className={styles.title}>Leads</h1>
          <p className={styles.subtitle}>
            Manage and respond to celebration inquiries.
          </p>
        </div>

        {/* Quiet Subordinate Status Strip */}
        <div className={styles.statusStrip} aria-label="Operational status summary">
          <div className={styles.statusBadge}>
            <span className={styles.statusDotCrimson} aria-hidden="true" />
            <span>Total:</span>
            <span className={styles.statusBadgeStrong}>{metrics.totalLeads}</span>
          </div>
          <div className={styles.statusBadge}>
            <span className={styles.statusDotGold} aria-hidden="true" />
            <span>New (7d):</span>
            <span className={styles.statusBadgeStrong}>{metrics.newLeadsLast7Days}</span>
          </div>
          <div className={styles.statusBadge}>
            <span className={styles.statusDotSage} aria-hidden="true" />
            <span>Upcoming:</span>
            <span className={styles.statusBadgeStrong}>{metrics.upcomingCelebrations}</span>
          </div>
        </div>
      </header>

      {/* -------------------------------------------------------------------- */}
      {/* Master Detail Split Workspace (Option B)                             */}
      {/* -------------------------------------------------------------------- */}
      <div className={styles.commandGrid}>
        {/* ================================================================== */}
        {/* LEFT COLUMN: Lead Navigator Stream                                  */}
        {/* ================================================================== */}
        <aside
          className={styles.navigatorAside}
          style={{ display: isMobileDossierOpen ? undefined : undefined }}
          aria-label="Celebration inquiry navigator stream"
        >
          {/* Navigator Header */}
          <div className={styles.navigatorHeader}>
            <div className={styles.navigatorHeaderTop}>
              <div className={styles.navigatorTitleWrap}>
                <h2 className={styles.navigatorTitle}>Inquiries</h2>
                <span className={styles.countBadge} id="leadsCountBadge">
                  {filteredLeads.length} Shown
                </span>
              </div>

              {/* Sort Selector */}
              <select
                className={styles.sortSelect}
                value={sortBy}
                onChange={(e) =>
                  setSortBy(e.target.value as "newest" | "oldest" | "eventDate")
                }
                aria-label="Sort inquiries"
              >
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
                <option value="eventDate">Event Date</option>
              </select>
            </div>

            {/* In-Stream Search Box */}
            <div className={styles.searchBox}>
              <svg
                className={styles.searchIcon}
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="search"
                className={styles.searchInput}
                placeholder="Search name, phone, city..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                aria-label="Search inquiries"
              />
              {searchQuery && (
                <button
                  type="button"
                  className={styles.clearSearchBtn}
                  onClick={() => setSearchQuery("")}
                  aria-label="Clear search text"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              )}
            </div>

            {/* Filter Controls Derived from Canonical Allowlists */}
            <div className={styles.filterControls}>
              <div className={styles.filterPillsRow} role="tablist" aria-label="Filter by event type">
                <button
                  type="button"
                  role="tab"
                  aria-selected={selectedEventType === "All"}
                  className={`${styles.filterPill} ${
                    selectedEventType === "All" ? styles.filterPillActive : ""
                  }`}
                  onClick={() => setSelectedEventType("All")}
                >
                  All ({initialLeads.length})
                </button>
                {EVENT_TYPE_OPTIONS.slice(0, 5).map((evt) => (
                  <button
                    key={evt}
                    type="button"
                    role="tab"
                    aria-selected={selectedEventType === evt}
                    className={`${styles.filterPill} ${
                      selectedEventType === evt ? styles.filterPillActive : ""
                    }`}
                    onClick={() => setSelectedEventType(evt)}
                  >
                    {evt}
                  </button>
                ))}
              </div>

              <div className={styles.filterDropdownsRow}>
                <select
                  className={styles.filterSelect}
                  value={selectedEventType}
                  onChange={(e) => setSelectedEventType(e.target.value)}
                  aria-label="Filter by all event types"
                >
                  <option value="All">All Occasions</option>
                  {EVENT_TYPE_OPTIONS.map((evt) => (
                    <option key={evt} value={evt}>
                      {evt}
                    </option>
                  ))}
                </select>

                <select
                  className={styles.filterSelect}
                  value={selectedCity}
                  onChange={(e) => setSelectedCity(e.target.value)}
                  aria-label="Filter by city"
                >
                  <option value="All">All Cities</option>
                  {CITY_OPTIONS.map((city) => (
                    <option key={city} value={city}>
                      {city}
                    </option>
                  ))}
                </select>

                {(searchQuery || selectedEventType !== "All" || selectedCity !== "All") && (
                  <button
                    type="button"
                    className={styles.resetFiltersBtn}
                    onClick={handleResetFilters}
                  >
                    Reset
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Scrollable Lead List */}
          <ul className={styles.leadStreamList} role="list" aria-label="Celebration inquiry list">
            {filteredLeads.length === 0 ? (
              <li className={styles.navigatorEmpty}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <p>No inquiries match your criteria.</p>
                <button
                  type="button"
                  className={styles.resetFiltersBtn}
                  onClick={handleResetFilters}
                >
                  Clear search &amp; filters
                </button>
              </li>
            ) : (
              filteredLeads.map((lead) => {
                const isSelected = activeLead?.id === lead.id;
                const isNew = isRecentSubmission(lead.createdAt);

                return (
                  <li key={lead.id} className={styles.leadCardItem}>
                    <button
                      type="button"
                      className={`${styles.leadCard} ${
                        isSelected ? styles.leadCardSelected : ""
                      }`}
                      onClick={() => handleSelectLead(lead.id)}
                      aria-pressed={isSelected}
                    >
                      <div className={styles.leadCardTop}>
                        <h3 className={styles.clientNamePreview}>{lead.userName}</h3>
                        {isNew && (
                          <span className={styles.newBadge}>
                            <span className={styles.newBadgeDot} aria-hidden="true" />
                            New
                          </span>
                        )}
                      </div>

                      <p className={styles.occasionPreview}>{lead.eventType}</p>

                      <div className={styles.leadMetaRow}>
                        <span className={styles.leadMetaItem}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                            <circle cx="12" cy="10" r="3" />
                          </svg>
                          {lead.city}
                        </span>
                        <span className={styles.metaDot}>•</span>
                        <span className={styles.leadMetaItem}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                            <line x1="16" y1="2" x2="16" y2="6" />
                            <line x1="8" y1="2" x2="8" y2="6" />
                            <line x1="3" y1="10" x2="21" y2="10" />
                          </svg>
                          {formatDisplayDate(lead.eventDate)}
                        </span>
                        <span className={styles.metaDot}>•</span>
                        <span className={styles.leadMetaItem}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                            <circle cx="9" cy="7" r="4" />
                            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                          </svg>
                          {lead.guestCount}
                        </span>
                      </div>
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </aside>

        {/* ================================================================== */}
        {/* RIGHT COLUMN: Client Dossier Panel                                  */}
        {/* ================================================================== */}
        <section
          className={styles.dossierSection}
          aria-label="Client inquiry dossier"
          style={{
            display:
              typeof window !== "undefined" &&
              window.innerWidth < 1024 &&
              !isMobileDossierOpen
                ? "none"
                : undefined,
          }}
        >
          {/* Mobile Back Header */}
          <div className={styles.mobileBackHeader}>
            <button
              type="button"
              className={styles.backBtn}
              onClick={() => setIsMobileDossierOpen(false)}
              aria-label="Back to inquiries list"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="19" y1="12" x2="5" y2="12" />
                <polyline points="12 19 5 12 12 5" />
              </svg>
              <span>Back to Inquiries</span>
            </button>
            <span className={styles.countBadge}>Dossier</span>
          </div>

          {!activeLead ? (
            <div className={styles.emptyDossier}>
              <div className={styles.emptyIconWrap} aria-hidden="true">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                </svg>
              </div>
              <h3 className={styles.emptyTitle}>No Inquiry Selected</h3>
              <p className={styles.emptyCopy}>
                {initialLeads.length === 0
                  ? "Celebration inquiries submitted through the guest planning concierge will appear here in your command center queue."
                  : "Select an inquiry from the left navigator list or adjust active filters to inspect full client coordinates and celebration specifications."}
              </p>
              {(searchQuery || selectedEventType !== "All" || selectedCity !== "All") && (
                <button
                  type="button"
                  className={styles.actionBtnSecondary}
                  onClick={handleResetFilters}
                >
                  Reset Filters
                </button>
              )}
            </div>
          ) : (
            <>
              {/* Hero Band */}
              <header className={styles.dossierHero}>
                <div className={styles.dossierHeroLeft}>
                  <div className={styles.timingBadgeRow}>
                    {isUpcoming ? (
                      <span className={styles.timingBadgeUpcoming}>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                          <circle cx="12" cy="12" r="10" />
                        </svg>
                        Upcoming Celebration
                      </span>
                    ) : (
                      <span className={styles.timingBadgePast}>Past Celebration</span>
                    )}
                    <span className={styles.leadIdTag}>ID: {activeLead.id.slice(0, 8)}...</span>
                  </div>

                  <h2 className={styles.dossierClientName}>{activeLead.userName}</h2>
                  <p className={styles.dossierOccasion}>{activeLead.eventType}</p>

                  <div className={styles.metaRibbon}>
                    <span className={styles.metaRibbonItem}>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                        <circle cx="12" cy="10" r="3" />
                      </svg>
                      {activeLead.city}
                    </span>
                    <span>•</span>
                    <span className={styles.metaRibbonItem}>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                        <line x1="16" y1="2" x2="16" y2="6" />
                        <line x1="8" y1="2" x2="8" y2="6" />
                        <line x1="3" y1="10" x2="21" y2="10" />
                      </svg>
                      {formatDisplayDate(activeLead.eventDate)}
                    </span>
                    <span>•</span>
                    <span className={styles.metaRibbonItem}>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                        <circle cx="9" cy="7" r="4" />
                        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                      </svg>
                      {activeLead.guestCount}
                    </span>
                  </div>
                </div>

                {/* Quick Action Bar */}
                <div className={styles.actionGroup}>
                  <a
                    className={styles.actionBtnPrimary}
                    href={`https://wa.me/91${cleanPhone}?text=${whatsappGreeting}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                    </svg>
                    <span>WhatsApp</span>
                  </a>

                  <a className={styles.actionBtnSecondary} href={`tel:+91${cleanPhone}`}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                    </svg>
                    <span>Call Phone</span>
                  </a>

                  <button
                    type="button"
                    className={styles.actionBtnUtility}
                    onClick={handleCopyPhone}
                    title="Copy normalized phone number to clipboard"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                    </svg>
                    <span>Copy Phone</span>
                  </button>

                  <button
                    type="button"
                    className={styles.actionBtnUtility}
                    onClick={handleCopySummary}
                    title="Copy clean summary for internal team coordination"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                      <line x1="16" y1="13" x2="8" y2="13" />
                      <line x1="16" y1="17" x2="8" y2="17" />
                      <polyline points="10 9 9 9 8 9" />
                    </svg>
                    <span>Copy Summary</span>
                  </button>
                </div>
              </header>

              {/* Dossier Body Quadrants */}
              <div className={styles.dossierBody}>
                {/* SECTION A: Direct Client Coordinates */}
                <section className={styles.dossierSectionBlock} aria-labelledby="headingCoordinates">
                  <div className={styles.sectionHeading}>
                    <h3 id="headingCoordinates" className={styles.sectionTitle}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                        <circle cx="12" cy="7" r="4" />
                      </svg>
                      A. Client Coordinates
                    </h3>
                    <span className={styles.sectionTag}>Verified Contact</span>
                  </div>

                  <div className={styles.coordinatesGrid}>
                    <div className={styles.coordinateCard}>
                      <span className={styles.fieldLabel}>Full Name</span>
                      <span className={styles.fieldValueBold}>{activeLead.userName}</span>
                    </div>

                    <div className={styles.coordinateCard}>
                      <span className={styles.fieldLabel}>Primary Phone</span>
                      <div className={styles.phoneFieldWrap}>
                        <span className={styles.fieldValueMono}>+91 {activeLead.userPhone}</span>
                        <button
                          type="button"
                          className={styles.inlineCopyBtn}
                          onClick={handleCopyPhone}
                          aria-label="Copy client phone number"
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                          </svg>
                        </button>
                      </div>
                    </div>

                    <div className={styles.coordinateCard}>
                      <span className={styles.fieldLabel}>City / Region</span>
                      <span className={styles.fieldValueBold}>{activeLead.city}</span>
                    </div>

                    <div className={styles.coordinateCard}>
                      <span className={styles.fieldLabel}>WhatsApp Consent</span>
                      <span className={styles.whatsappConsentBadge}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                        Consent Confirmed
                      </span>
                    </div>
                  </div>
                </section>

                {/* SECTION B: Celebration Specifications */}
                <section className={styles.dossierSectionBlock} aria-labelledby="headingSpecifications">
                  <div className={styles.sectionHeading}>
                    <h3 id="headingSpecifications" className={styles.sectionTitle}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                      </svg>
                      B. Celebration Specifications
                    </h3>
                    <span className={styles.sectionTag}>Logistics Scope</span>
                  </div>

                  <div className={styles.specsGrid}>
                    <div className={styles.specCard}>
                      <span className={styles.fieldLabel}>Occasion Occurring</span>
                      <span className={styles.specValue}>{activeLead.eventType}</span>
                      <span className={styles.specMeta}>Selected celebration occasion</span>
                    </div>

                    <div className={styles.specCard}>
                      <span className={styles.fieldLabel}>Planned Event Date</span>
                      <span className={styles.specValue}>{formatDisplayDate(activeLead.eventDate)}</span>
                      <span className={styles.specMeta}>{isUpcoming ? "Scheduled in the future" : "Past celebration date"}</span>
                    </div>

                    <div className={styles.specCard}>
                      <span className={styles.fieldLabel}>Anticipated Gathering</span>
                      <span className={styles.specValue}>{activeLead.guestCount}</span>
                      <span className={styles.specMeta}>Expected attendee range</span>
                    </div>

                    <div className={styles.specCard}>
                      <span className={styles.fieldLabel}>Venue Setting</span>
                      <span className={styles.specValue}>{activeLead.venueType} Venue</span>
                      <span className={styles.specMeta}>Client venue preference</span>
                    </div>

                    <div className={styles.specCard}>
                      <span className={styles.fieldLabel}>Planned Budget Range</span>
                      <span className={styles.specValue}>{activeLead.budgetRange}</span>
                      <span className={styles.specMeta}>Target expenditure tier</span>
                    </div>
                  </div>
                </section>

                {/* SECTION C: Requested Service Modules */}
                <section className={styles.dossierSectionBlock} aria-labelledby="headingServices">
                  <div className={styles.sectionHeading}>
                    <h3 id="headingServices" className={styles.sectionTitle}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                        <polyline points="22 4 12 14.01 9 11.01" />
                      </svg>
                      C. Requested Service Modules
                    </h3>
                    <span className={styles.sectionTag}>
                      {activeLead.selectedServices.length} Services Selected
                    </span>
                  </div>

                  <div className={styles.curationsGrid}>
                    {activeLead.selectedServices.map((serviceName) => (
                      <div key={serviceName} className={styles.curationCard}>
                        <div className={styles.curationIconWrap} aria-hidden="true">
                          {renderServiceIcon(serviceName)}
                        </div>
                        <span className={styles.curationName}>{serviceName}</span>
                      </div>
                    ))}
                  </div>
                </section>

                {/* SECTION D: Submission Integrity & Correlation */}
                <footer className={styles.auditFooter}>
                  <span className={styles.auditItem}>
                    <span>Submitted:</span>
                    <strong className={styles.auditStrong}>
                      {formatDisplayDateTime(activeLead.createdAt)}
                    </strong>
                  </span>

                  {activeLead.requestId && (
                    <span className={styles.auditItem}>
                      <span>Request ID:</span>
                      <strong className={styles.auditStrong} style={{ fontFamily: "monospace" }}>
                        {activeLead.requestId}
                      </strong>
                    </span>
                  )}
                </footer>
              </div>
            </>
          )}
        </section>
      </div>

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div className={styles.toastNotification} role="status" aria-live="polite">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#b99a67" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
