"use client";

import React, { useState } from "react";
import { AdminSidebar } from "./AdminSidebar";
import { AdminHeader } from "./AdminHeader";
import styles from "./admin-shell.module.css";

interface AdminShellProps {
  children: React.ReactNode;
}

export function AdminShell({ children }: AdminShellProps) {
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  const toggleMobileSidebar = () => {
    setIsMobileSidebarOpen((prev) => !prev);
  };

  const closeMobileSidebar = () => {
    setIsMobileSidebarOpen(false);
  };

  return (
    <div className={styles.shellContainer}>
      <div
        className={`${styles.mobileBackdrop} ${
          isMobileSidebarOpen ? styles.mobileBackdropVisible : ""
        }`}
        onClick={closeMobileSidebar}
        aria-hidden="true"
      />

      <AdminSidebar isOpen={isMobileSidebarOpen} onClose={closeMobileSidebar} />

      <div className={styles.mainWrapper}>
        <AdminHeader onToggleMobileSidebar={toggleMobileSidebar} />
        <main className={styles.contentArea}>{children}</main>
      </div>
    </div>
  );
}
