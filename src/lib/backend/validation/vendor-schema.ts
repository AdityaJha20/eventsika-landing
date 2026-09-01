import {
  VENDOR_CATEGORIES,
  VENDOR_EXPERIENCE_TIERS,
  VendorCategoryOption,
  VendorExperienceTier,
} from "../constants/allowlists";
import { validateIndianPhone } from "./phone";
import { validatePortfolioUrl } from "./url";

export interface RawVendorPayload {
  businessName?: unknown;
  contactName?: unknown;
  phone?: unknown;
  email?: unknown;
  city?: unknown;
  experience?: unknown;
  portfolioUrl?: unknown;
  categories?: unknown;
  honeypot?: unknown;
}

export interface ValidatedVendorInput {
  businessName: string;
  contactName: string;
  phone: string;
  email: string;
  city: string;
  experience: VendorExperienceTier;
  portfolioUrl: string;
  categories: VendorCategoryOption[];
  isBot: boolean;
}

export type VendorValidationResult =
  | { success: true; data: ValidatedVendorInput }
  | { success: false; error: string };

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Validates and sanitizes a raw vendor partner application payload.
 */
export function validateVendorInput(raw: unknown): VendorValidationResult {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { success: false, error: "Invalid request payload format." };
  }

  const payload = raw as RawVendorPayload;

  // 1. Honeypot check
  const honeypot = typeof payload.honeypot === "string" ? payload.honeypot.trim() : "";
  const isBot = honeypot.length > 0;

  if (isBot) {
    return {
      success: true,
      data: {
        businessName: "",
        contactName: "",
        phone: "",
        email: "",
        city: "",
        experience: "3–5 Years",
        portfolioUrl: "",
        categories: [],
        isBot: true,
      },
    };
  }

  // 2. Business / Brand Name
  if (typeof payload.businessName !== "string" || !payload.businessName.trim()) {
    return { success: false, error: "Please provide a valid business/brand name." };
  }
  const businessName = payload.businessName.trim();
  if (businessName.length > 150) {
    return { success: false, error: "Business name must not exceed 150 characters." };
  }

  // 3. Contact Person Name
  if (typeof payload.contactName !== "string" || !payload.contactName.trim()) {
    return { success: false, error: "Please provide a contact person name." };
  }
  const contactName = payload.contactName.trim();
  if (contactName.length > 100) {
    return { success: false, error: "Contact name must not exceed 100 characters." };
  }

  // 4. WhatsApp Phone (Indian mobile validation)
  const phoneResult = validateIndianPhone(payload.phone);
  if (!phoneResult.isValid) {
    return { success: false, error: phoneResult.error || "Please enter a valid 10-digit WhatsApp phone number." };
  }
  const phone = phoneResult.normalizedPhone;

  // 5. Email Address
  if (typeof payload.email !== "string" || !payload.email.trim()) {
    return { success: false, error: "Please provide an email address." };
  }
  const email = payload.email.trim().toLowerCase();
  if (!EMAIL_REGEX.test(email) || email.length > 150) {
    return { success: false, error: "Please provide a valid email address." };
  }

  // 6. Primary Operating City
  if (typeof payload.city !== "string" || !payload.city.trim()) {
    return { success: false, error: "Please specify your primary operating city." };
  }
  const city = payload.city.trim();
  if (city.length > 100) {
    return { success: false, error: "Operating city must not exceed 100 characters." };
  }

  // 7. Industry Experience Tier
  let experience: VendorExperienceTier = "3–5 Years";
  if (typeof payload.experience === "string" && payload.experience.trim()) {
    const candidateExp = payload.experience.trim() as VendorExperienceTier;
    if (VENDOR_EXPERIENCE_TIERS.includes(candidateExp)) {
      experience = candidateExp;
    } else {
      return {
        success: false,
        error: `Invalid experience tier. Allowed: ${VENDOR_EXPERIENCE_TIERS.join(", ")}.`,
      };
    }
  }

  // 8. Portfolio URL
  const urlResult = validatePortfolioUrl(payload.portfolioUrl);
  if (!urlResult.isValid) {
    return { success: false, error: urlResult.error || "Please provide your portfolio or Instagram link." };
  }
  const portfolioUrl = urlResult.normalizedUrl;

  // 9. Service Categories Allowlist
  if (!Array.isArray(payload.categories) || payload.categories.length === 0) {
    return { success: false, error: "Please select at least one service category." };
  }
  const categories: VendorCategoryOption[] = [];
  for (const cat of payload.categories) {
    if (typeof cat === "string" && cat.trim()) {
      const trimmed = cat.trim() as VendorCategoryOption;
      if (VENDOR_CATEGORIES.includes(trimmed)) {
        if (!categories.includes(trimmed)) {
          categories.push(trimmed);
        }
      } else {
        return {
          success: false,
          error: `Unrecognized partner category: "${trimmed}".`,
        };
      }
    }
  }
  if (categories.length === 0) {
    return { success: false, error: "Please select at least one valid service category." };
  }

  return {
    success: true,
    data: {
      businessName,
      contactName,
      phone,
      email,
      city,
      experience,
      portfolioUrl,
      categories,
      isBot: false,
    },
  };
}
