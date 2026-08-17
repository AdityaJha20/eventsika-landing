"use client";

import { useState } from "react";
import styles from "./VendorApplicationForm.module.css";

interface FormData {
  businessName: string;
  contactName: string;
  phone: string;
  email: string;
  city: string;
  experience: string;
  portfolioUrl: string;
  categories: string[];
}

interface FormErrors {
  businessName?: string;
  contactName?: string;
  phone?: string;
  email?: string;
  city?: string;
  portfolioUrl?: string;
  categories?: string;
}

const SERVICE_CATEGORIES = [
  "Decor & Styling",
  "Catering & Live Food",
  "Photography & Films",
  "Music & DJ",
  "Pandit / Vedic Services",
  "Gifting & Favors",
];

const INITIAL_FORM_DATA: FormData = {
  businessName: "",
  contactName: "",
  phone: "",
  email: "",
  city: "",
  experience: "3–5 Years",
  portfolioUrl: "",
  categories: ["Decor & Styling"],
};

export default function VendorApplicationForm() {
  const [formData, setFormData] = useState<FormData>(INITIAL_FORM_DATA);
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitted, setIsSubmitted] = useState(false);

  const toggleCategory = (category: string) => {
    setFormData((prev) => ({
      ...prev,
      categories: prev.categories.includes(category)
        ? prev.categories.filter((c) => c !== category)
        : [...prev.categories, category],
    }));
    if (errors.categories) {
      setErrors((prev) => ({ ...prev, categories: undefined }));
    }
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name as keyof FormErrors]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  };

  const validate = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.businessName.trim()) {
      newErrors.businessName = "Business / Brand Name is required";
    }

    if (!formData.contactName.trim()) {
      newErrors.contactName = "Contact Person Name is required";
    }

    const cleanPhone = formData.phone.replace(/[^0-9]/g, "");
    if (!cleanPhone || cleanPhone.length < 10) {
      newErrors.phone = "Please enter a valid 10-digit WhatsApp phone number";
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!formData.email.trim() || !emailRegex.test(formData.email.trim())) {
      newErrors.email = "Please enter a valid email address";
    }

    if (!formData.city.trim()) {
      newErrors.city = "Primary operating city is required";
    }

    if (!formData.portfolioUrl.trim()) {
      newErrors.portfolioUrl = "Portfolio or Instagram link is required";
    }

    if (formData.categories.length === 0) {
      newErrors.categories = "Please select at least one service category";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validate()) {
      setIsSubmitted(true);
    }
  };

  const handleReset = () => {
    setFormData(INITIAL_FORM_DATA);
    setErrors({});
    setIsSubmitted(false);
  };

  return (
    <section
      id="apply"
      className={styles.section}
      aria-labelledby="apply-heading"
    >
      <div className={styles.container}>
        <div className={styles.header}>
          <p className={styles.eyebrow}>JOIN THE NETWORK</p>
          <h2 id="apply-heading" className={styles.title}>
            Become an Approved Eventsika Partner
          </h2>
          <p className={styles.description}>
            Join India&apos;s curated network of event specialists. Tell us about
            your craft, services, and past work to get started.
          </p>
        </div>

        <div className={styles.card}>
          {isSubmitted ? (
            <div
              className={styles.successContainer}
              role="alert"
              aria-live="polite"
            >
              <div className={styles.successIconBox}>
                <svg
                  className={styles.successIcon}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <h3 className={styles.successTitle}>Application Received</h3>
              <p className={styles.successText}>
                Thank you for applying, <strong>{formData.contactName}</strong>!
                Our vendor onboarding team will review your portfolio and reach
                out on WhatsApp (<strong>{formData.phone}</strong>) within 2–3
                business days.
              </p>
              <div className={styles.successSummary}>
                <div className={styles.summaryRow}>
                  <span>Brand:</span>
                  <strong>{formData.businessName}</strong>
                </div>
                <div className={styles.summaryRow}>
                  <span>Operating City:</span>
                  <strong>{formData.city}</strong>
                </div>
                <div className={styles.summaryRow}>
                  <span>Categories:</span>
                  <strong>{formData.categories.join(", ")}</strong>
                </div>
              </div>
              <button
                type="button"
                onClick={handleReset}
                className={styles.resetButton}
              >
                Submit Another Application
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} noValidate className={styles.form}>
              <div className={styles.formGrid}>
                {/* Business Name */}
                <div className={styles.formGroup}>
                  <label htmlFor="businessName" className={styles.label}>
                    Business / Brand Name{" "}
                    <span className={styles.required}>*</span>
                  </label>
                  <input
                    type="text"
                    id="businessName"
                    name="businessName"
                    value={formData.businessName}
                    onChange={handleInputChange}
                    placeholder="e.g. Royal Blooms Decor"
                    aria-invalid={Boolean(errors.businessName)}
                    aria-describedby={
                      errors.businessName ? "err-businessName" : undefined
                    }
                    className={`${styles.input} ${
                      errors.businessName ? styles.inputError : ""
                    }`}
                  />
                  {errors.businessName && (
                    <span id="err-businessName" className={styles.errorText}>
                      {errors.businessName}
                    </span>
                  )}
                </div>

                {/* Contact Person Name */}
                <div className={styles.formGroup}>
                  <label htmlFor="contactName" className={styles.label}>
                    Contact Person Name{" "}
                    <span className={styles.required}>*</span>
                  </label>
                  <input
                    type="text"
                    id="contactName"
                    name="contactName"
                    value={formData.contactName}
                    onChange={handleInputChange}
                    placeholder="e.g. Vikram Sharma"
                    aria-invalid={Boolean(errors.contactName)}
                    aria-describedby={
                      errors.contactName ? "err-contactName" : undefined
                    }
                    className={`${styles.input} ${
                      errors.contactName ? styles.inputError : ""
                    }`}
                  />
                  {errors.contactName && (
                    <span id="err-contactName" className={styles.errorText}>
                      {errors.contactName}
                    </span>
                  )}
                </div>

                {/* WhatsApp Phone */}
                <div className={styles.formGroup}>
                  <label htmlFor="phone" className={styles.label}>
                    Phone Number (WhatsApp){" "}
                    <span className={styles.required}>*</span>
                  </label>
                  <input
                    type="tel"
                    id="phone"
                    name="phone"
                    value={formData.phone}
                    onChange={handleInputChange}
                    placeholder="e.g. 9876543210"
                    aria-invalid={Boolean(errors.phone)}
                    aria-describedby={errors.phone ? "err-phone" : undefined}
                    className={`${styles.input} ${
                      errors.phone ? styles.inputError : ""
                    }`}
                  />
                  {errors.phone && (
                    <span id="err-phone" className={styles.errorText}>
                      {errors.phone}
                    </span>
                  )}
                </div>

                {/* Email Address */}
                <div className={styles.formGroup}>
                  <label htmlFor="email" className={styles.label}>
                    Email Address <span className={styles.required}>*</span>
                  </label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    placeholder="e.g. contact@royalblooms.in"
                    aria-invalid={Boolean(errors.email)}
                    aria-describedby={errors.email ? "err-email" : undefined}
                    className={`${styles.input} ${
                      errors.email ? styles.inputError : ""
                    }`}
                  />
                  {errors.email && (
                    <span id="err-email" className={styles.errorText}>
                      {errors.email}
                    </span>
                  )}
                </div>

                {/* Primary Operating City */}
                <div className={styles.formGroup}>
                  <label htmlFor="city" className={styles.label}>
                    Primary Operating City{" "}
                    <span className={styles.required}>*</span>
                  </label>
                  <input
                    type="text"
                    id="city"
                    name="city"
                    value={formData.city}
                    onChange={handleInputChange}
                    placeholder="e.g. Delhi NCR, Mumbai, Jaipur"
                    aria-invalid={Boolean(errors.city)}
                    aria-describedby={errors.city ? "err-city" : undefined}
                    className={`${styles.input} ${
                      errors.city ? styles.inputError : ""
                    }`}
                  />
                  {errors.city && (
                    <span id="err-city" className={styles.errorText}>
                      {errors.city}
                    </span>
                  )}
                </div>

                {/* Years in Industry */}
                <div className={styles.formGroup}>
                  <label htmlFor="experience" className={styles.label}>
                    Years in Industry
                  </label>
                  <select
                    id="experience"
                    name="experience"
                    value={formData.experience}
                    onChange={handleInputChange}
                    className={styles.select}
                  >
                    <option value="Under 1 Year">Under 1 Year</option>
                    <option value="1–2 Years">1–2 Years</option>
                    <option value="3–5 Years">3–5 Years</option>
                    <option value="5–10 Years">5–10 Years</option>
                    <option value="10+ Years">10+ Years</option>
                  </select>
                </div>
              </div>

              {/* Portfolio / Instagram Link */}
              <div className={styles.fullWidthGroup}>
                <label htmlFor="portfolioUrl" className={styles.label}>
                  Portfolio / Instagram Link{" "}
                  <span className={styles.required}>*</span>
                </label>
                <input
                  type="text"
                  id="portfolioUrl"
                  name="portfolioUrl"
                  value={formData.portfolioUrl}
                  onChange={handleInputChange}
                  placeholder="e.g. instagram.com/yourhandle or yourwebsite.com"
                  aria-invalid={Boolean(errors.portfolioUrl)}
                  aria-describedby={
                    errors.portfolioUrl ? "err-portfolioUrl" : undefined
                  }
                  className={`${styles.input} ${
                    errors.portfolioUrl ? styles.inputError : ""
                  }`}
                />
                {errors.portfolioUrl && (
                  <span id="err-portfolioUrl" className={styles.errorText}>
                    {errors.portfolioUrl}
                  </span>
                )}
              </div>

              {/* Service Categories Multi-select */}
              <fieldset className={styles.categoriesFieldset}>
                <legend className={styles.label}>
                  Select Service Categories Offered{" "}
                  <span className={styles.required}>*</span>
                </legend>
                <div
                  className={styles.categoryPillsGrid}
                  role="group"
                  aria-label="Select Service Categories"
                >
                  {SERVICE_CATEGORIES.map((cat) => {
                    const isChecked = formData.categories.includes(cat);
                    return (
                      <label
                        key={cat}
                        className={`${styles.categoryCheckboxLabel} ${
                          isChecked ? styles.categoryCheckboxLabelActive : ""
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleCategory(cat)}
                          className={styles.checkboxHidden}
                        />
                        <span
                          className={`${styles.customCheck} ${
                            isChecked ? styles.customCheckActive : ""
                          }`}
                          aria-hidden="true"
                        >
                          {isChecked && (
                            <svg
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="3"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              className={styles.checkIcon}
                            >
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          )}
                        </span>
                        <span className={styles.categoryName}>{cat}</span>
                      </label>
                    );
                  })}
                </div>
                {errors.categories && (
                  <span className={styles.errorText}>{errors.categories}</span>
                )}
              </fieldset>

              <button type="submit" className={styles.submitButton}>
                Submit Partner Application
              </button>

              <p className={styles.formNote}>
                By submitting, you agree to Eventsika&apos;s quality guidelines
                and transparent partner onboarding terms.
              </p>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
