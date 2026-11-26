import {
  VENDOR_CATEGORIES,
  VENDOR_EXPERIENCE_TIERS,
  VendorCategoryOption,
  VendorExperienceTier,
} from "../constants/allowlists";
import { EMAIL_REGEX } from "./email";
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

export type VendorField = Exclude<keyof RawVendorPayload, "honeypot">;
export type VendorFieldErrors = Partial<Record<VendorField, string>>;

export type VendorValidationResult =
  | { success: true; data: ValidatedVendorInput }
  | { success: false; error: string; fieldErrors: VendorFieldErrors };

const VENDOR_CATEGORIES_SET = new Set<string>(VENDOR_CATEGORIES);

function requiredText(
  value: unknown,
  maxLength: number,
  emptyError: string,
  lengthError: string,
): { value: string } | { error: string } {
  if (typeof value !== "string" || !value.trim()) return { error: emptyError };
  const trimmed = value.trim();
  return trimmed.length > maxLength ? { error: lengthError } : { value: trimmed };
}

/**
 * Validates and sanitizes a raw vendor partner application payload.
 * Shared by the API route and the browser form: every field is checked so the
 * form can show all field errors at once; `error` is the first one.
 */
export function validateVendorInput(raw: unknown): VendorValidationResult {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { success: false, error: "Invalid request payload format.", fieldErrors: {} };
  }

  const payload = raw as RawVendorPayload;

  // 1. Honeypot check
  const honeypot = typeof payload.honeypot === "string" ? payload.honeypot.trim() : "";
  if (honeypot.length > 0) {
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

  // Assigned in form order, so the first key is the first invalid field.
  const fieldErrors: VendorFieldErrors = {};

  // 2. Business / Brand Name
  const businessName = requiredText(
    payload.businessName,
    150,
    "Please provide a valid business/brand name.",
    "Business name must not exceed 150 characters.",
  );
  if ("error" in businessName) fieldErrors.businessName = businessName.error;

  // 3. Contact Person Name
  const contactName = requiredText(
    payload.contactName,
    100,
    "Please provide a contact person name.",
    "Contact name must not exceed 100 characters.",
  );
  if ("error" in contactName) fieldErrors.contactName = contactName.error;

  // 4. WhatsApp Phone (Indian mobile validation)
  const phoneResult = validateIndianPhone(payload.phone);
  if (!phoneResult.isValid) {
    fieldErrors.phone = phoneResult.error || "Please enter a valid 10-digit WhatsApp phone number.";
  }

  // 5. Email Address
  let email = "";
  if (typeof payload.email !== "string" || !payload.email.trim()) {
    fieldErrors.email = "Please provide an email address.";
  } else {
    email = payload.email.trim().toLowerCase();
    if (!EMAIL_REGEX.test(email) || email.length > 150) {
      fieldErrors.email = "Please provide a valid email address.";
    }
  }

  // 6. Primary Operating City
  const city = requiredText(
    payload.city,
    100,
    "Please specify your primary operating city.",
    "Operating city must not exceed 100 characters.",
  );
  if ("error" in city) fieldErrors.city = city.error;

  // 7. Industry Experience Tier (optional)
  let experience: VendorExperienceTier = "3–5 Years";
  if (typeof payload.experience === "string" && payload.experience.trim()) {
    const candidateExp = payload.experience.trim() as VendorExperienceTier;
    if (VENDOR_EXPERIENCE_TIERS.includes(candidateExp)) {
      experience = candidateExp;
    } else {
      fieldErrors.experience = `Invalid experience tier. Allowed: ${VENDOR_EXPERIENCE_TIERS.join(", ")}.`;
    }
  }

  // 8. Portfolio URL
  const urlResult = validatePortfolioUrl(payload.portfolioUrl);
  if (!urlResult.isValid) {
    fieldErrors.portfolioUrl = urlResult.error || "Please provide your portfolio or Instagram link.";
  }

  // 9. Service Categories Allowlist
  const categories: VendorCategoryOption[] = [];
  if (!Array.isArray(payload.categories) || payload.categories.length === 0) {
    fieldErrors.categories = "Please select at least one service category.";
  } else {
    for (const cat of payload.categories) {
      if (typeof cat !== "string" || !cat.trim()) continue;
      const trimmed = cat.trim();
      if (!VENDOR_CATEGORIES_SET.has(trimmed)) {
        fieldErrors.categories = `Unrecognized partner category: "${trimmed}".`;
        break;
      }
      if (!categories.includes(trimmed as VendorCategoryOption)) {
        categories.push(trimmed as VendorCategoryOption);
      }
    }
    if (!fieldErrors.categories && categories.length === 0) {
      fieldErrors.categories = "Please select at least one valid service category.";
    }
  }

  const firstError = Object.values(fieldErrors)[0];
  if (firstError || "error" in businessName || "error" in contactName || "error" in city) {
    return { success: false, error: firstError ?? "Invalid request payload format.", fieldErrors };
  }

  return {
    success: true,
    data: {
      businessName: businessName.value,
      contactName: contactName.value,
      phone: phoneResult.normalizedPhone,
      email,
      city: city.value,
      experience,
      portfolioUrl: urlResult.normalizedUrl,
      categories,
      isBot: false,
    },
  };
}
