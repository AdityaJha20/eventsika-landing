"use client";

import React, { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import styles from "./LoginForm.module.css";

export default function LoginForm() {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionState, setSubmissionState] = useState<"idle" | "notice">("idle");
  const [activeInfo, setActiveInfo] = useState<"none" | "forgot-password" | "sign-up">("none");
  const [errors, setErrors] = useState<{ identifier?: string; password?: string }>({});

  const validateForm = () => {
    const newErrors: { identifier?: string; password?: string } = {};

    const cleanIdentifier = identifier.trim();
    if (!cleanIdentifier) {
      newErrors.identifier = "Please enter your email address or phone number.";
    } else if (cleanIdentifier.includes("@")) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(cleanIdentifier)) {
        newErrors.identifier = "Please enter a valid email address.";
      }
    } else {
      const digits = cleanIdentifier.replace(/\D/g, "");
      if (digits.length < 10) {
        newErrors.identifier = "Please enter a valid 10-digit phone number or email.";
      }
    }

    if (!password) {
      newErrors.password = "Please enter your password.";
    } else if (password.length < 6) {
      newErrors.password = "Password must be at least 6 characters.";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setActiveInfo("none");

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    // Presentation simulation only: NO backend transmission, persistence, or credential handling
    setTimeout(() => {
      setIsSubmitting(false);
      setSubmissionState("notice");
    }, 400);
  };

  const handleTogglePassword = () => {
    setShowPassword((prev) => !prev);
  };

  const handleForgotPasswordClick = () => {
    setSubmissionState("idle");
    setActiveInfo((prev) => (prev === "forgot-password" ? "none" : "forgot-password"));
  };

  const handleSignUpClick = () => {
    setSubmissionState("idle");
    setActiveInfo((prev) => (prev === "sign-up" ? "none" : "sign-up"));
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
        {/* Email or Phone Input */}
        <div className={styles.formGroup}>
          <label htmlFor="login-identifier" className={styles.label}>
            Email Address or Phone Number
          </label>
          <div className={styles.inputWrapper}>
            <input
              id="login-identifier"
              name="identifier"
              type="text"
              autoComplete="username"
              value={identifier}
              onChange={(e) => {
                setIdentifier(e.target.value);
                if (errors.identifier) {
                  setErrors((prev) => ({ ...prev, identifier: undefined }));
                }
              }}
              placeholder="e.g. priya@example.com or 9876543210"
              aria-invalid={Boolean(errors.identifier)}
              aria-describedby={errors.identifier ? "identifier-error" : undefined}
              className={`${styles.input} ${errors.identifier ? styles.inputError : ""}`}
            />
          </div>
          {errors.identifier && (
            <p id="identifier-error" className={styles.errorText} role="alert">
              {errors.identifier}
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
              className={`${styles.input} ${styles.inputWithToggle} ${errors.password ? styles.inputError : ""
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
              Self-serve password reset will be available when our portal launches. For immediate
              account assistance, email{" "}
              <a href="mailto:care@eventsika.in">care@eventsika.in</a>.
            </p>
          </div>
        )}

        {/* Sign Up Info Banner */}
        {activeInfo === "sign-up" && (
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
              Direct client registration will open soon. You can currently{" "}
              <Link href="/#plan-event">plan a celebration</Link> or{" "}
              <Link href="/for-vendors">apply as an event partner</Link>.
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

        {/* Presentation-Only Status Notification */}
        {submissionState === "notice" && (
          <div className={styles.statusNotice} role="status" aria-live="polite">
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
              <span className={styles.statusNoticeTitle}>
                Login functionality will be available soon.
              </span>
            </div>
            <p className={styles.statusNoticeText}>
              The Eventsika client &amp; vendor portal is currently undergoing final staging. Direct
              dashboard logins will be active with our upcoming portal release.
            </p>
            <p className={styles.statusNoticeContact}>
              Need active celebration assistance or booking status? Contact our team directly at{" "}
              <a href="mailto:care@eventsika.in">care@eventsika.in</a> or{" "}
              <a href="tel:+917876666056">+91 78766 66056</a>.
            </p>
          </div>
        )}
      </form>

      {/* Divider */}
      <div className={styles.divider} />

      {/* Secondary Link: Sign Up */}
      <div className={styles.footerRow}>
        <span>Don&apos;t have an account? </span>
        <button
          type="button"
          onClick={handleSignUpClick}
          className={styles.footerLink}
          aria-expanded={activeInfo === "sign-up"}
        >
          Sign Up
        </button>
      </div>

      {/* Vendor Onboarding Link */}
      <div className={styles.partnerBadge}>
        <span>Are you an event professional?</span>
        <Link href="/for-vendors">Apply to Join Partner Network →</Link>
      </div>
    </div>
  );
}
