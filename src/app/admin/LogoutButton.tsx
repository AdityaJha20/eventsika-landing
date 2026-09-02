"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./admin.module.css";

export function LogoutButton() {
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await fetch("/api/admin/auth/logout", { method: "POST" });
    } finally {
      router.push("/login");
      router.refresh();
    }
  };

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={isLoggingOut}
      className={styles.logoutBtn}
      aria-label="Log out of admin portal"
    >
      {isLoggingOut ? "Signing out..." : "Log Out"}
    </button>
  );
}
