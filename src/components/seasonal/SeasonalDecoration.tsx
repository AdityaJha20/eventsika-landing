import React from "react";
import DiwaliLights from "./DiwaliLights";

/**
 * Supported seasonal occasions for Eventsika.
 * Add new festive themes (e.g., 'holi', 'christmas', 'wedding-season')
 * as isolated subcomponents under `src/components/seasonal/`.
 */
export type SeasonalOccasion =
  | "diwali"
  | "holi"
  | "christmas"
  | "wedding-season"
  | null;

/**
 * DEVELOPER CONTROL SWITCH:
 * - Set to 'diwali' to display the Diwali light arrangement.
 * - Set to null to disable all seasonal decorations website-wide.
 * - Set to another occasion key when a new festive component is integrated.
 */
export const ACTIVE_SEASONAL_OCCASION: SeasonalOccasion = "diwali";

interface SeasonalDecorationProps {
  /**
   * Optional override for page-specific or testing scenarios.
   * Defaults to ACTIVE_SEASONAL_OCCASION.
   */
  occasion?: SeasonalOccasion;
}

/**
 * SeasonalDecoration is an isolated wrapper that mounts occasion-specific
 * decorations above/within the Eventsika navbar header. It leaves the core
 * navbar untouched and renders null when disabled.
 */
export default function SeasonalDecoration({
  occasion = ACTIVE_SEASONAL_OCCASION,
}: SeasonalDecorationProps) {
  if (!occasion) return null;

  switch (occasion) {
    case "diwali":
      return <DiwaliLights />;
    // Future occasions (e.g. case "holi": return <HoliDecorations />)
    default:
      return null;
  }
}
