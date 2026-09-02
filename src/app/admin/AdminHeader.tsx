"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./admin-shell.module.css";

interface AdminHeaderProps {
  onToggleMobileSidebar: () => void;
}

export function AdminHeader({ onToggleMobileSidebar }: AdminHeaderProps) {
  const pathname = usePathname();

  const getBreadcrumbTitle = (path: string) => {
    if (path === "/admin") return "Dashboard";
    if (path.startsWith("/admin/leads")) return "Leads";
    if (path.startsWith("/admin/vendors")) return "Vendors";
    if (path.startsWith("/admin/analytics")) return "Analytics";
    if (path.startsWith("/admin/settings")) return "Settings";
    return "Portal";
  };

  const currentTitle = getBreadcrumbTitle(pathname);

  return (
    <header className={styles.topHeader}>
      <div className={styles.headerLeft}>
        <button
          type="button"
          onClick={onToggleMobileSidebar}
          className={styles.mobileMenuBtn}
          aria-label="Toggle navigation drawer"
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
            aria-hidden="true"
          >
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>

        <nav aria-label="Breadcrumb" className={styles.breadcrumbs}>
          <Link href="/admin" className={styles.breadcrumbRoot}>
            Admin
          </Link>
          <span className={styles.breadcrumbSeparator} aria-hidden="true">
            /
          </span>
          <span className={styles.breadcrumbCurrent}>{currentTitle}</span>
        </nav>
      </div>

      <div className={styles.headerRight}>
        <div className={styles.headerSearch}>
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
            placeholder="Global search..."
            className={styles.searchInput}
            aria-label="Global search input"
            disabled
          />
        </div>

        <button
          type="button"
          className={styles.iconBtn}
          aria-label="Notifications"
          title="Notifications"
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
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
          <span className={styles.notificationDot} aria-hidden="true" />
        </button>
      </div>
    </header>
  );
}
