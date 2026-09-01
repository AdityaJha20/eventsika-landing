/**
 * Eventsika Canonical Option Allowlists
 *
 * Authoritative backend definitions matching the frontend form selections.
 */

export const CITY_OPTIONS = [
  "Delhi",
  "Gurgaon",
  "Noida",
  "Mumbai",
  "Kolkata",
  "Other",
] as const;

export type CityOption = (typeof CITY_OPTIONS)[number];

export const EVENT_TYPE_OPTIONS = [
  "Diwali Special",
  "House Party",
  "Birthday",
  "Anniversary",
  "Housewarming",
  "Baby Shower",
  "Satsang & Puja",
  "Festive Party",
  "Family Dinner",
  "Other Celebration",
] as const;

export type EventTypeOption = (typeof EVENT_TYPE_OPTIONS)[number];

export const GUEST_COUNT_OPTIONS = [
  "2–10 guests",
  "10–30 guests",
  "30–50 guests",
  "50–100 guests",
  "100–200 guests",
  "200+ guests",
] as const;

export type GuestCountOption = (typeof GUEST_COUNT_OPTIONS)[number];

export const VENUE_TYPE_OPTIONS = [
  "Indoor",
  "Outdoor",
] as const;

export type VenueTypeOption = (typeof VENUE_TYPE_OPTIONS)[number];

export const SERVICE_OPTIONS = [
  "Decor & Styling",
  "Food & Catering",
  "Furniture & Seating",
  "Photography & Films",
  "Music & Entertainment",
  "More",
] as const;

export type ServiceOption = (typeof SERVICE_OPTIONS)[number];

export const BUDGET_OPTIONS = [
  "₹25,000 – ₹50,000",
  "₹50,000 – ₹1,00,000",
  "₹1,00,000 – ₹2,00,000",
  "₹2,00,000 – ₹3,00,000",
  "₹3,00,000 – ₹5,00,000",
  "₹5,00,000+",
] as const;

export type BudgetOption = (typeof BUDGET_OPTIONS)[number];

export const VENDOR_CATEGORIES = [
  "Decor & Styling",
  "Catering & Live Food",
  "Photography & Films",
  "Music & DJ",
  "Pandit / Vedic Services",
  "Gifting & Favors",
] as const;

export type VendorCategoryOption = (typeof VENDOR_CATEGORIES)[number];

export const VENDOR_EXPERIENCE_TIERS = [
  "Under 1 Year",
  "1–2 Years",
  "3–5 Years",
  "5–10 Years",
  "10+ Years",
] as const;

export type VendorExperienceTier = (typeof VENDOR_EXPERIENCE_TIERS)[number];
