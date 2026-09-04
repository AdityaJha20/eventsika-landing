/**
 * Eventsika Package & Estimation Configuration
 *
 * Centralized configuration for package tiers, per-person rates,
 * guest count presets, and flat optional add-ons.
 */

export interface PackageTierConfig {
  id: "essential" | "signature" | "grand";
  name: string;
  pricePerGuest: number;
  displayRate: string;
  tagline: string;
  badge?: string;
  features: string[];
}

export interface AddonConfig {
  id: string;
  name: string;
  price: number;
  displayPrice: string;
}

export const MIN_GUEST_COUNT = 10;
export const DEFAULT_GUEST_COUNT = 25;
export const DEFAULT_PACKAGE_ID = "signature";

export const GUEST_PRESETS: readonly number[] = [10, 15, 25, 50, 75, 100] as const;

export const PACKAGES_CONFIG: PackageTierConfig[] = [
  {
    id: "essential",
    name: "ESSENTIAL",
    pricePerGuest: 1500,
    displayRate: "₹1,500 / guest",
    tagline: "Simple celebrations, thoughtfully arranged.",
    features: [
      "Event planning consultation",
      "Venue & decor coordination",
      "Essential vendor coordination",
      "Event-day guidance",
    ],
  },
  {
    id: "signature",
    name: "SIGNATURE",
    pricePerGuest: 2500,
    displayRate: "₹2,500 / guest",
    tagline: "Everything comes together beautifully.",
    badge: "OUR SIGNATURE",
    features: [
      "Complete event planning",
      "Venue & decor coordination",
      "Catering coordination",
      "Photography & films coordination",
      "Entertainment coordination",
      "Event-day management",
    ],
  },
  {
    id: "grand",
    name: "GRAND",
    pricePerGuest: 3500,
    displayRate: "₹3,500 / guest",
    tagline: "Complete planning, from idea to celebration.",
    features: [
      "Full event management",
      "Premium venue & decor planning",
      "Catering & hospitality coordination",
      "Photography & films",
      "Entertainment & production",
      "Guest experience coordination",
      "Complete event-day execution",
    ],
  },
];

export const ADDONS_CONFIG: AddonConfig[] = [
  {
    id: "live-chaat",
    name: "Live Chaat & Mocktail Corner",
    price: 15000,
    displayPrice: "+₹15,000",
  },
  {
    id: "drone-reels",
    name: "Drone Cinematography & Reels",
    price: 18000,
    displayPrice: "+₹18,000",
  },
  {
    id: "live-music",
    name: "Live Acoustic / Sufi Duo",
    price: 20000,
    displayPrice: "+₹20,000",
  },
  {
    id: "hampers",
    name: "Custom Welcome Hampers (50 Boxes)",
    price: 12000,
    displayPrice: "+₹12,000",
  },
  {
    id: "valet-concierge",
    name: "Guest Valet & Concierge Desk",
    price: 8000,
    displayPrice: "+₹8,000",
  },
];
