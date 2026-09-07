"use client";

import React, { useState, useMemo, useRef, useEffect, useCallback } from "react";
import {
  AdminVendorItem,
  AdminVendorsMetrics,
} from "@/lib/backend/services/admin-vendor-service";
import {
  VENDOR_CATEGORIES,
  VENDOR_EXPERIENCE_TIERS,
  CITY_OPTIONS,
} from "@/lib/backend/constants/allowlists";
import {
  buildVendorCsvContent,
  cleanIndianPhone,
  formatDisplayDate,
  formatDisplayDateTime,
  sanitizeEmailForMailto,
  sanitizeExternalUrl,
} from "./vendor-helpers";
import styles from "./vendors.module.css";

/* -------------------------------------------------------------------------- */
/* Reusable Micro Icon Components (Deduplicated inline SVGs)                  */
/* -------------------------------------------------------------------------- */

function WhatsAppIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    </svg>
  );
}

function ExternalLinkIcon({ size = 15 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  );
}

function CopyIcon({ size = 13 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function getBusinessInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return (name.slice(0, 2) || "VP").toUpperCase();
}

/* -------------------------------------------------------------------------- */
/* Slide-Over Detail Drawer Sub-Component                                     */
/* -------------------------------------------------------------------------- */

interface VendorDetailDrawerProps {
  vendor: AdminVendorItem;
  onClose: () => void;
  closeBtnRef: React.RefObject<HTMLButtonElement | null>;
  onCopyPhone: (phone: string) => void;
  onCopyEmail: (email: string) => void;
  onCopySummary: (vendor: AdminVendorItem) => void;
}

function VendorDetailDrawer({
  vendor,
  onClose,
  closeBtnRef,
  onCopyPhone,
  onCopyEmail,
  onCopySummary,
}: VendorDetailDrawerProps) {
  const safePortfolioUrl = sanitizeExternalUrl(vendor.portfolioUrl);
  const safeEmail = sanitizeEmailForMailto(vendor.email);
  const cleanPhone = cleanIndianPhone(vendor.phone);
  const encodedGreeting = encodeURIComponent(
    `Hello ${vendor.contactName}, thank you for applying to partner with Eventsika for ${vendor.businessName}. We would love to discuss your partnership application.`
  );

  return (
    <div
      className={styles.drawerOverlay}
      onClick={onClose}
      aria-hidden="true"
    >
      <div
        className={styles.drawerPanel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="drawerHeading"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drawer Header */}
        <header className={styles.drawerHeader}>
          <div className={styles.drawerHeaderProfile}>
            <div className={styles.drawerAvatar} aria-hidden="true">
              {getBusinessInitials(vendor.businessName)}
            </div>
            <div className={styles.drawerHeaderInfo}>
              <h2 id="drawerHeading" className={styles.drawerTitle}>
                {vendor.businessName}
              </h2>
              <p className={styles.drawerSubtitle}>
                {vendor.contactName} • {vendor.city}
              </p>
            </div>
          </div>

          <button
            type="button"
            ref={closeBtnRef}
            className={styles.drawerCloseBtn}
            onClick={onClose}
            aria-label="Close dossier drawer"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </header>

        {/* Drawer Scrollable Body */}
        <div className={styles.drawerBody}>
          {/* SECTION A: Submitted Business & Contact */}
          <section
            className={styles.drawerSectionBlock}
            aria-labelledby="headingDrawerContact"
          >
            <div className={styles.sectionHeading}>
              <h3 id="headingDrawerContact" className={styles.sectionTitle}>
                A. Submitted Business &amp; Contact
              </h3>
              <span className={styles.sectionTag}>Intake Details</span>
            </div>

            <div className={styles.coordinatesGrid}>
              <div className={styles.coordinateCard}>
                <span className={styles.fieldLabel}>Business / Brand</span>
                <span className={styles.fieldValueBold}>
                  {vendor.businessName}
                </span>
              </div>

              <div className={styles.coordinateCard}>
                <span className={styles.fieldLabel}>Contact Person</span>
                <span className={styles.fieldValueBold}>
                  {vendor.contactName}
                </span>
              </div>

              <div className={styles.coordinateCard}>
                <span className={styles.fieldLabel}>Contact Number</span>
                <div className={styles.fieldValueRow}>
                  <span className={styles.fieldValueMono}>
                    +91 {vendor.phone}
                  </span>
                  <button
                    type="button"
                    className={styles.inlineCopyBtn}
                    onClick={() => onCopyPhone(vendor.phone)}
                    aria-label="Copy contact phone"
                  >
                    <CopyIcon size={13} />
                  </button>
                </div>
              </div>

              <div className={styles.coordinateCard}>
                <span className={styles.fieldLabel}>Contact Email</span>
                <div className={styles.fieldValueRow}>
                  <span className={styles.fieldValueText}>
                    {vendor.email}
                  </span>
                  <button
                    type="button"
                    className={styles.inlineCopyBtn}
                    onClick={() => onCopyEmail(vendor.email)}
                    aria-label="Copy contact email"
                  >
                    <CopyIcon size={13} />
                  </button>
                </div>
              </div>

              <div className={styles.coordinateCard}>
                <span className={styles.fieldLabel}>Base Region / City</span>
                <span className={styles.fieldValueBold}>
                  {vendor.city}
                </span>
              </div>
            </div>
          </section>

          {/* SECTION B: Capabilities & Profile */}
          <section
            className={styles.drawerSectionBlock}
            aria-labelledby="headingDrawerCapabilities"
          >
            <div className={styles.sectionHeading}>
              <h3
                id="headingDrawerCapabilities"
                className={styles.sectionTitle}
              >
                B. Capabilities &amp; Profile
              </h3>
              <span className={styles.sectionTag}>
                {vendor.categories.length} Categories
              </span>
            </div>

            <div className={styles.capabilitiesCard}>
              <div className={styles.experienceRow}>
                <span className={styles.fieldLabel}>
                  Operational Experience
                </span>
                <span className={styles.experienceBadgeLarge}>
                  {vendor.experience}
                </span>
              </div>

              <div className={styles.categoriesBlock}>
                <span className={styles.fieldLabel}>Offered Services</span>
                <div className={styles.drawerTagsList}>
                  {vendor.categories.map((cat) => (
                    <span key={cat} className={styles.drawerCategoryTag}>
                      {cat}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* SECTION C: Digital Portfolio Link */}
          <section
            className={styles.drawerSectionBlock}
            aria-labelledby="headingDrawerPortfolio"
          >
            <div className={styles.sectionHeading}>
              <h3
                id="headingDrawerPortfolio"
                className={styles.sectionTitle}
              >
                C. Digital Portfolio Link
              </h3>
              <span className={styles.sectionTag}>Provided URL</span>
            </div>

            <div className={styles.portfolioCard}>
              {safePortfolioUrl ? (
                <div className={styles.portfolioLinkRow}>
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#7f1010"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <line x1="2" y1="12" x2="22" y2="12" />
                    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                  </svg>
                  <a
                    href={safePortfolioUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.portfolioLinkAnchor}
                  >
                    <span>{safePortfolioUrl}</span>
                    <ExternalLinkIcon size={13} />
                  </a>
                </div>
              ) : (
                <p className={styles.noPortfolioNotice}>
                  No external portfolio link was supplied with this
                  application.
                </p>
              )}
            </div>
          </section>

          {/* SECTION D: Submission Integrity & Correlation */}
          <footer className={styles.auditFooter}>
            <span className={styles.auditItem}>
              <span>Applied:</span>
              <strong className={styles.auditStrong}>
                {formatDisplayDateTime(vendor.createdAt)}
              </strong>
            </span>

            {vendor.requestId && (
              <span className={styles.auditItem}>
                <span>Request ID:</span>
                <strong
                  className={styles.auditStrong}
                  style={{ fontFamily: "monospace" }}
                >
                  {vendor.requestId}
                </strong>
              </span>
            )}
          </footer>
        </div>

        {/* Drawer Footer Actions */}
        <footer className={styles.drawerFooter}>
          <div className={styles.drawerActionRow}>
            <a
              className={styles.actionBtnPrimary}
              href={`https://wa.me/91${cleanPhone}?text=${encodedGreeting}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <WhatsAppIcon size={15} />
              <span>WhatsApp</span>
            </a>

            <a
              className={styles.actionBtnSecondary}
              href={`tel:+91${cleanPhone}`}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
              </svg>
              <span>Call</span>
            </a>

            {safeEmail && (
              <a
                className={styles.actionBtnSecondary}
                href={`mailto:${safeEmail}?subject=Eventsika%20Partner%20Application%20-%20${encodeURIComponent(
                  vendor.businessName
                )}`}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                  <polyline points="22,6 12,13 2,6" />
                </svg>
                <span>Email</span>
              </a>
            )}

            <button
              type="button"
              className={styles.actionBtnUtility}
              onClick={() => onCopySummary(vendor)}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <polyline points="10 9 9 9 8 9" />
              </svg>
              <span>Copy Summary</span>
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Main Vendors Workspace Component                                           */
/* -------------------------------------------------------------------------- */

interface VendorsWorkspaceProps {
  initialVendors: AdminVendorItem[];
  metrics: AdminVendorsMetrics;
}

export function VendorsWorkspace({
  initialVendors,
  metrics,
}: VendorsWorkspaceProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [selectedCity, setSelectedCity] = useState<string>("All");
  const [selectedExperience, setSelectedExperience] = useState<string>("All");
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "businessName">(
    "newest"
  );
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Single source of truth for drawer visibility: selectedVendor !== null
  const [selectedVendor, setSelectedVendor] = useState<AdminVendorItem | null>(
    null
  );
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const triggerRef = useRef<HTMLElement | null>(null);
  const drawerCloseBtnRef = useRef<HTMLButtonElement | null>(null);

  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  };

  const handleCloseDrawer = useCallback(() => {
    setSelectedVendor(null);
    triggerRef.current?.focus();
  }, []);

  // Drawer keyboard management: Escape closes drawer, focus restored on close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && selectedVendor) {
        handleCloseDrawer();
      }
    };

    if (selectedVendor) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [selectedVendor, handleCloseDrawer]);

  const handleOpenDrawer = (
    vendor: AdminVendorItem,
    event?: React.MouseEvent
  ) => {
    if (event?.currentTarget) {
      triggerRef.current = event.currentTarget as HTMLElement;
    } else {
      triggerRef.current = document.activeElement as HTMLElement;
    }
    setSelectedVendor(vendor);
    setTimeout(() => {
      drawerCloseBtnRef.current?.focus();
    }, 50);
  };

  const handleSearchChange = (val: string) => {
    setSearchQuery(val);
    setCurrentPage(1);
  };

  const handleCategoryChange = (val: string) => {
    setSelectedCategory(val);
    setCurrentPage(1);
  };

  const handleCityChange = (val: string) => {
    setSelectedCity(val);
    setCurrentPage(1);
  };

  const handleExperienceChange = (val: string) => {
    setSelectedExperience(val);
    setCurrentPage(1);
  };

  const handleSortChange = (val: "newest" | "oldest" | "businessName") => {
    setSortBy(val);
    setCurrentPage(1);
  };

  // Distinct cities from active applications or allowlist
  const availableCities = useMemo(() => {
    const fromVendors = initialVendors.map((v) => v.city.trim()).filter(Boolean);
    const combined = Array.from(new Set([...CITY_OPTIONS, ...fromVendors]));
    return combined.sort();
  }, [initialVendors]);

  // Filter and sort in-memory
  const filteredVendors = useMemo(() => {
    return initialVendors
      .filter((vendor) => {
        if (
          selectedCategory !== "All" &&
          !vendor.categories.includes(selectedCategory as never)
        ) {
          return false;
        }
        if (
          selectedCity !== "All" &&
          vendor.city.toLowerCase() !== selectedCity.toLowerCase()
        ) {
          return false;
        }
        if (
          selectedExperience !== "All" &&
          vendor.experience !== selectedExperience
        ) {
          return false;
        }
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const matchesBusiness = vendor.businessName.toLowerCase().includes(q);
          const matchesContact = vendor.contactName.toLowerCase().includes(q);
          const matchesCity = vendor.city.toLowerCase().includes(q);
          const matchesEmail = vendor.email.toLowerCase().includes(q);
          const matchesPhone = vendor.phone.includes(q);
          const matchesCategories = vendor.categories.some((c) =>
            c.toLowerCase().includes(q)
          );
          if (
            !matchesBusiness &&
            !matchesContact &&
            !matchesCity &&
            !matchesEmail &&
            !matchesPhone &&
            !matchesCategories
          ) {
            return false;
          }
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === "newest") {
          return (
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
        }
        if (sortBy === "oldest") {
          return (
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          );
        }
        if (sortBy === "businessName") {
          return a.businessName.localeCompare(b.businessName);
        }
        return 0;
      });
  }, [
    initialVendors,
    selectedCategory,
    selectedCity,
    selectedExperience,
    searchQuery,
    sortBy,
  ]);

  // UI Pagination over filtered dataset
  const totalPages = Math.ceil(filteredVendors.length / pageSize) || 1;
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedVendors = useMemo(() => {
    const startIndex = (safeCurrentPage - 1) * pageSize;
    return filteredVendors.slice(startIndex, startIndex + pageSize);
  }, [filteredVendors, safeCurrentPage, pageSize]);

  const handleResetFilters = () => {
    setSearchQuery("");
    setSelectedCategory("All");
    setSelectedCity("All");
    setSelectedExperience("All");
    setCurrentPage(1);
  };

  const handleCopyPhone = (phone: string) => {
    navigator.clipboard.writeText(phone);
    showToast(`Phone (+91 ${phone}) copied to clipboard`);
  };

  const handleCopyEmail = (email: string) => {
    navigator.clipboard.writeText(email);
    showToast(`Email (${email}) copied to clipboard`);
  };

  const handleCopySummary = (vendor: AdminVendorItem) => {
    const summary = [
      `Eventsika Partner Application`,
      `Business: ${vendor.businessName}`,
      `Contact Person: ${vendor.contactName}`,
      `City: ${vendor.city}`,
      `Phone: +91 ${vendor.phone}`,
      `Email: ${vendor.email}`,
      `Experience: ${vendor.experience}`,
      `Categories: ${vendor.categories.join(", ")}`,
      vendor.portfolioUrl ? `Portfolio: ${vendor.portfolioUrl}` : "",
      `Applied: ${formatDisplayDateTime(vendor.createdAt)}`,
    ]
      .filter(Boolean)
      .join("\n");

    navigator.clipboard.writeText(summary);
    showToast("Application summary copied to clipboard");
  };

  // Safe client-side CSV Export across ALL filtered records
  const handleExportCsv = () => {
    if (filteredVendors.length === 0) {
      showToast("No applications to export for active filter criteria");
      return;
    }

    const csvContent = buildVendorCsvContent(filteredVendors);
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const dateStr = new Date().toISOString().split("T")[0];

    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `eventsika_vendor_applications_${dateStr}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showToast(`Exported ${filteredVendors.length} applications to CSV`);
  };

  return (
    <div className={styles.vendorsContainer}>
      {/* -------------------------------------------------------------------- */}
      {/* 1. Header: Command Operations                                         */}
      {/* -------------------------------------------------------------------- */}
      <header className={styles.commandHeader}>
        <div className={styles.headerCopy}>
          <p className={styles.eyebrow}>
            <span className={styles.eyebrowDot} aria-hidden="true" />
            Registry Operations • Operational Register
          </p>
          <h1 className={styles.title}>Vendor Register</h1>
          <p className={styles.subtitle}>
            Operational registry of incoming vendor partnership applications.
          </p>
        </div>

        <div className={styles.headerActions}>
          <button
            type="button"
            className={styles.exportBtn}
            onClick={handleExportCsv}
            aria-label="Export filtered applications to CSV"
          >
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
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            <span>Export CSV</span>
          </button>
        </div>
      </header>

      {/* -------------------------------------------------------------------- */}
      {/* 2. KPI Summary Strip (4 Metric Cards)                                */}
      {/* -------------------------------------------------------------------- */}
      <section
        className={styles.kpiGrid}
        aria-label="Vendor operational metrics"
      >
        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>Total Applications</span>
          <div className={styles.kpiValueRow}>
            <span className={`${styles.kpiNumber} ${styles.kpiNumberCrimson}`}>
              {metrics.totalApplications}
            </span>
            <span className={styles.kpiContext}>Intake Queue</span>
          </div>
        </div>

        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>New · 7 Days</span>
          <div className={styles.kpiValueRow}>
            <span className={`${styles.kpiNumber} ${styles.kpiNumberGold}`}>
              {metrics.newApplicationsLast7Days}
            </span>
            <span className={styles.kpiContext}>Rolling Window</span>
          </div>
        </div>

        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>5+ Years Experience</span>
          <div className={styles.kpiValueRow}>
            <span className={`${styles.kpiNumber} ${styles.kpiNumberEspresso}`}>
              {metrics.experiencedApplicationsCount}
            </span>
            <span className={styles.kpiContext}>Senior Tiers</span>
          </div>
        </div>

        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>Portfolio Submitted</span>
          <div className={styles.kpiValueRow}>
            <span className={`${styles.kpiNumber} ${styles.kpiNumberSage}`}>
              {metrics.portfolioLinkedCount}
            </span>
            <span className={styles.kpiContext}>Links Attached</span>
          </div>
        </div>
      </section>

      {/* -------------------------------------------------------------------- */}
      {/* 3. Advanced Filter Bar                                               */}
      {/* -------------------------------------------------------------------- */}
      <section
        className={styles.filterCard}
        aria-label="Application search and filters"
      >
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
            placeholder="Search business, contact, city, category..."
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            aria-label="Search vendor applications"
          />
          {searchQuery && (
            <button
              type="button"
              className={styles.clearSearchBtn}
              onClick={() => handleSearchChange("")}
              aria-label="Clear search text"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>

        <div className={styles.filterDropdownsRow}>
          <select
            className={styles.filterSelect}
            value={selectedCategory}
            onChange={(e) => handleCategoryChange(e.target.value)}
            aria-label="Filter by service category"
          >
            <option value="All">All Categories</option>
            {VENDOR_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>

          <select
            className={styles.filterSelect}
            value={selectedCity}
            onChange={(e) => handleCityChange(e.target.value)}
            aria-label="Filter by base city"
          >
            <option value="All">All Cities</option>
            {availableCities.map((city) => (
              <option key={city} value={city}>
                {city}
              </option>
            ))}
          </select>

          <select
            className={styles.filterSelect}
            value={selectedExperience}
            onChange={(e) => handleExperienceChange(e.target.value)}
            aria-label="Filter by experience tier"
          >
            <option value="All">All Experience</option>
            {VENDOR_EXPERIENCE_TIERS.map((exp) => (
              <option key={exp} value={exp}>
                {exp}
              </option>
            ))}
          </select>

          <select
            className={styles.filterSelect}
            value={sortBy}
            onChange={(e) =>
              handleSortChange(
                e.target.value as "newest" | "oldest" | "businessName"
              )
            }
            aria-label="Sort applications"
          >
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
            <option value="businessName">Name (A–Z)</option>
          </select>

          {(searchQuery ||
            selectedCategory !== "All" ||
            selectedCity !== "All" ||
            selectedExperience !== "All") && (
            <button
              type="button"
              className={styles.resetFiltersBtn}
              onClick={handleResetFilters}
            >
              Reset
            </button>
          )}
        </div>
      </section>

      {/* -------------------------------------------------------------------- */}
      {/* 4. Structured High-Throughput Register Table                         */}
      {/* -------------------------------------------------------------------- */}
      <section className={styles.tableCard} aria-label="Vendor register table">
        <div className={styles.tableResponsiveWrap}>
          <table className={styles.registerTable}>
            <thead>
              <tr className={styles.tableHeaderRow}>
                <th scope="col" className={styles.thPrimary}>
                  Business &amp; Contact
                </th>
                <th scope="col" className={styles.thStandard}>
                  Categories
                </th>
                <th scope="col" className={styles.thStandard}>
                  Base Region
                </th>
                <th scope="col" className={styles.thStandard}>
                  Experience
                </th>
                <th scope="col" className={styles.thStandard}>
                  Applied Date
                </th>
                <th scope="col" className={styles.thActions}>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {paginatedVendors.length === 0 ? (
                <tr>
                  <td colSpan={6} className={styles.emptyTableState}>
                    <div className={styles.emptyWrap}>
                      <svg
                        width="28"
                        height="28"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <circle cx="11" cy="11" r="8" />
                        <line x1="21" y1="21" x2="16.65" y2="16.65" />
                      </svg>
                      <p className={styles.emptyTitle}>
                        No vendor applications match your criteria
                      </p>
                      <p className={styles.emptySubtitle}>
                        Adjust active filter dropdowns or clear search terms to
                        inspect other submissions.
                      </p>
                      {(searchQuery ||
                        selectedCategory !== "All" ||
                        selectedCity !== "All" ||
                        selectedExperience !== "All") && (
                        <button
                          type="button"
                          className={styles.resetFiltersBtn}
                          onClick={handleResetFilters}
                        >
                          Clear Filters
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedVendors.map((vendor) => {
                  const safePortfolioUrl = sanitizeExternalUrl(
                    vendor.portfolioUrl
                  );
                  const safeEmail = sanitizeEmailForMailto(vendor.email);
                  const cleanPhone = cleanIndianPhone(vendor.phone);
                  const encodedGreeting = encodeURIComponent(
                    `Hello ${vendor.contactName}, thank you for applying to partner with Eventsika for ${vendor.businessName}. We are reviewing your application coordinates.`
                  );

                  return (
                    <tr
                      key={vendor.id}
                      className={styles.tableRow}
                      onClick={(e) => {
                        const target = e.target as HTMLElement;
                        if (!target.closest("a, button")) {
                          handleOpenDrawer(vendor, e);
                        }
                      }}
                    >
                      {/* 1. Business & Contact */}
                      <td className={styles.tdPrimary}>
                        <div className={styles.businessCell}>
                          <div
                            className={styles.businessAvatar}
                            aria-hidden="true"
                          >
                            {getBusinessInitials(vendor.businessName)}
                          </div>
                          <div className={styles.businessMeta}>
                            <button
                              type="button"
                              className={styles.businessNameBtn}
                              onClick={(e) => handleOpenDrawer(vendor, e)}
                              aria-label={`View dossier for ${vendor.businessName}`}
                            >
                              {vendor.businessName}
                            </button>
                            <span className={styles.contactPersonText}>
                              {vendor.contactName}
                            </span>
                            <span className={styles.contactDetailsText}>
                              {safeEmail ? (
                                <a
                                  href={`mailto:${safeEmail}?subject=Eventsika%20Partner%20Application`}
                                  className={styles.emailInlineLink}
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {vendor.email}
                                </a>
                              ) : (
                                <span>{vendor.email}</span>
                              )}
                              <span className={styles.metaDot}>•</span>
                              <span>+91 {vendor.phone}</span>
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* 2. Categories */}
                      <td className={styles.tdStandard}>
                        <div className={styles.categoryTagsWrap}>
                          {vendor.categories.slice(0, 2).map((cat) => (
                            <span key={cat} className={styles.categoryBadge}>
                              {cat}
                            </span>
                          ))}
                          {vendor.categories.length > 2 && (
                            <span className={styles.categoryOverflowBadge}>
                              +{vendor.categories.length - 2}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* 3. Base Region */}
                      <td className={styles.tdStandard}>
                        <span className={styles.cityText}>{vendor.city}</span>
                      </td>

                      {/* 4. Experience Tier */}
                      <td className={styles.tdStandard}>
                        <span className={styles.experienceBadge}>
                          {vendor.experience}
                        </span>
                      </td>

                      {/* 5. Applied Date */}
                      <td className={styles.tdStandard}>
                        <span className={styles.dateText}>
                          {formatDisplayDate(vendor.createdAt)}
                        </span>
                      </td>

                      {/* 6. Actions */}
                      <td className={styles.tdActions}>
                        <div
                          className={styles.actionIconsRow}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            className={styles.actionIconBtn}
                            onClick={(e) => handleOpenDrawer(vendor, e)}
                            title={`View Dossier: ${vendor.businessName}`}
                            aria-label={`View dossier for ${vendor.businessName}`}
                          >
                            <svg
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
                              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                              <circle cx="12" cy="12" r="3" />
                            </svg>
                          </button>

                          <a
                            className={styles.actionIconBtn}
                            href={`https://wa.me/91${cleanPhone}?text=${encodedGreeting}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Chat on WhatsApp"
                            aria-label={`Chat on WhatsApp with ${vendor.contactName}`}
                          >
                            <WhatsAppIcon size={16} />
                          </a>

                          {safePortfolioUrl && (
                            <a
                              className={styles.actionIconBtn}
                              href={safePortfolioUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="Open External Portfolio"
                              aria-label={`Open portfolio for ${vendor.businessName}`}
                            >
                              <ExternalLinkIcon size={15} />
                            </a>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* ------------------------------------------------------------------ */}
        {/* Pagination Footer (UI Pagination)                                  */}
        {/* ------------------------------------------------------------------ */}
        <footer className={styles.tableFooter}>
          <span className={styles.paginationInfo}>
            Showing{" "}
            <strong>
              {filteredVendors.length === 0
                ? 0
                : (safeCurrentPage - 1) * pageSize + 1}
              –{Math.min(safeCurrentPage * pageSize, filteredVendors.length)}
            </strong>{" "}
            of <strong>{filteredVendors.length}</strong> applications
          </span>

          {totalPages > 1 && (
            <div
              className={styles.paginationControls}
              aria-label="Pagination controls"
            >
              <button
                type="button"
                className={styles.pageBtn}
                disabled={safeCurrentPage === 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                aria-label="Previous page"
              >
                Previous
              </button>

              {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                (pageNum) => (
                  <button
                    key={pageNum}
                    type="button"
                    className={`${styles.pageNumberBtn} ${
                      pageNum === safeCurrentPage ? styles.pageNumberActive : ""
                    }`}
                    onClick={() => setCurrentPage(pageNum)}
                    aria-current={
                      pageNum === safeCurrentPage ? "page" : undefined
                    }
                  >
                    {pageNum}
                  </button>
                )
              )}

              <button
                type="button"
                className={styles.pageBtn}
                disabled={safeCurrentPage === totalPages}
                onClick={() =>
                  setCurrentPage((p) => Math.min(totalPages, p + 1))
                }
                aria-label="Next page"
              >
                Next
              </button>
            </div>
          )}
        </footer>
      </section>

      {/* -------------------------------------------------------------------- */}
      {/* 5. Slide-Over Detail Drawer (Single Source of Truth: selectedVendor) */}
      {/* -------------------------------------------------------------------- */}
      {selectedVendor && (
        <VendorDetailDrawer
          vendor={selectedVendor}
          onClose={handleCloseDrawer}
          closeBtnRef={drawerCloseBtnRef}
          onCopyPhone={handleCopyPhone}
          onCopyEmail={handleCopyEmail}
          onCopySummary={handleCopySummary}
        />
      )}

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div
          className={styles.toastNotification}
          role="status"
          aria-live="polite"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#b99a67"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
