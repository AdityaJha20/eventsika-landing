"use client";

import React, { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import styles from "./LoginForm.module.css";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [activeInfo, setActiveInfo] = useState<"none" | "forgot-password">("none");
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  const validateForm = () => {
    const newErrors: { email?: string; password?: string } = {};

    const cleanEmail = email.trim();
    if (!cleanEmail) {
      newErrors.email = "Please enter your email address.";
    } else if (!EMAIL_REGEX.test(cleanEmail)) {
      newErrors.email = "Please enter a valid email address.";
    }

    if (!password) {
      newErrors.password = "Please enter your password.";
    } else if (password.length < 6) {
      newErrors.password = "Password must be at least 6 characters.";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setActiveInfo("none");

    if (!validateForm() || isSubmitting) {
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/admin/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: email.trim(),
          password,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (response.ok && data.success) {
        // Redirect to admin dashboard on successful authentication
        router.push("/admin");
        router.refresh();
        return;
      }

      // Display generic server error response
      setAuthError(data.error || "Invalid email or password. Please try again.");
    } catch {
      setAuthError("Network connection error. Please verify your connection and try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTogglePassword = () => {
    setShowPassword((prev) => !prev);
  };

  const handleForgotPasswordClick = () => {
    setAuthError(null);
    setActiveInfo((prev) => (prev === "forgot-password" ? "none" : "forgot-password"));
  };

  return (
    <div className={styles.loginCard}>
      {/* Header with Brand Logo */}
      <div className={styles.brandHeader}>
        <Link href="/" className={styles.logoWrapper} aria-label="Return to Eventsika Homepage">
          <Image
            src="/images/eventsika-official-logo.png"
            alt="Eventsika - Celebrate Seamlessly"
            width={148}
            height={48}
            priority
            className={styles.logo}
          />
        </Link>
        <p className={styles.eyebrow}>CLIENT &amp; PARTNER PORTAL</p>
        <h1 className={styles.title}>Welcome Back</h1>
        <p className={styles.description}>
          Sign in to access your celebration timeline, custom proposals, and vendor coordination.
        </p>
      </div>

      {/* Main Form */}
      <form noValidate onSubmit={handleSubmit} className={styles.form}>
        {/* Server Error Alert Banner */}
        {authError && (
          <div className={styles.statusNotice} role="alert" aria-live="assertive">
            <div className={styles.statusNoticeHeader}>
              <svg
                className={styles.statusNoticeIcon}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span className={styles.statusNoticeTitle}>Authentication Error</span>
            </div>
            <p className={styles.statusNoticeText}>{authError}</p>
          </div>
        )}

        {/* Email Input */}
        <div className={styles.formGroup}>
          <label htmlFor="login-email" className={styles.label}>
            Email Address
          </label>
          <div className={styles.inputWrapper}>
            <input
              id="login-email"
              name="email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (errors.email) {
                  setErrors((prev) => ({ ...prev, email: undefined }));
                }
              }}
              placeholder="e.g. admin@eventsika.in or priya@example.com"
              aria-invalid={Boolean(errors.email)}
              aria-describedby={errors.email ? "email-error" : undefined}
              className={`${styles.input} ${errors.email ? styles.inputError : ""}`}
            />
          </div>
          {errors.email && (
            <p id="email-error" className={styles.errorText} role="alert">
              {errors.email}
            </p>
          )}
        </div>

        {/* Password Input with Show/Hide Toggle */}
        <div className={styles.formGroup}>
          <label htmlFor="login-password" className={styles.label}>
            Password
          </label>
          <div className={styles.inputWrapper}>
            <input
              id="login-password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (errors.password) {
                  setErrors((prev) => ({ ...prev, password: undefined }));
                }
              }}
              placeholder="Enter your password"
              aria-invalid={Boolean(errors.password)}
              aria-describedby={errors.password ? "password-error" : undefined}
              className={`${styles.input} ${styles.inputWithToggle} ${
                errors.password ? styles.inputError : ""
              }`}
            />
            <button
              type="button"
              onClick={handleTogglePassword}
              className={styles.passwordToggle}
              aria-label={showPassword ? "Hide password" : "Show password"}
              title={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? (
                <svg
                  className={styles.toggleIcon}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                  <line x1="1" y1="1" x2="23" y2="23" />
                </svg>
              ) : (
                <svg
                  className={styles.toggleIcon}
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
              )}
            </button>
          </div>
          {errors.password && (
            <p id="password-error" className={styles.errorText} role="alert">
              {errors.password}
            </p>
          )}
        </div>

        {/* Options Row: Remember Me + Forgot Password */}
        <div className={styles.optionsRow}>
          <label className={styles.checkboxLabel}>
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className={styles.checkbox}
            />
            <span>Remember this device</span>
          </label>

          <button
            type="button"
            onClick={handleForgotPasswordClick}
            className={styles.textLink}
            aria-expanded={activeInfo === "forgot-password"}
          >
            Forgot Password?
          </button>
        </div>

        {/* Forgot Password Info Banner */}
        {activeInfo === "forgot-password" && (
          <div className={styles.infoBanner} role="status">
            <svg
              className={styles.infoBannerIcon}
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
            <p className={styles.infoBannerText}>
              For account password resets, contact your system administrator at{" "}
              <a href="mailto:care@eventsika.in">care@eventsika.in</a>.
            </p>
          </div>
        )}

        {/* Primary Log In Button */}
        <button
          type="submit"
          disabled={isSubmitting}
          className={styles.submitButton}
        >
          {isSubmitting ? (
            <>
              <span className={styles.spinner} aria-hidden="true" />
              <span>Verifying...</span>
            </>
          ) : (
            <span>Log In</span>
          )}
        </button>
      </form>

      {/* Vendor Onboarding Link */}
      <div className={styles.partnerBadge}>
        <span>Are you an event professional?</span>
        <Link href="/for-vendors">Apply to Join Partner Network →</Link>
      </div>
    </div>
  );
}
