import DiwaliLights from "./DiwaliLights";
import ChristmasNavbarDecoration from "./christmas/ChristmasNavbarDecoration";

/** Seasonal themes with an implemented decoration, plus "none". */
export type SeasonalTheme = "none" | "diwali" | "christmas";

/**
 * SEASONAL SWITCH — the only line to change between festivals.
 * "none" restores the plain navbar. To add a festival, build its decoration
 * in its own folder and register it in DECORATIONS below.
 */
export const ACTIVE_SEASONAL_THEME: SeasonalTheme = "christmas";

const DECORATIONS: Record<Exclude<SeasonalTheme, "none">, () => React.ReactElement> = {
  diwali: DiwaliLights,
  christmas: ChristmasNavbarDecoration,
};

/**
 * Mounts the active festival's decorative overlay inside the navbar.
 * Renders nothing when the theme is "none"; the navbar never depends on it.
 */
export default function SeasonalDecoration({
  theme = ACTIVE_SEASONAL_THEME,
}: {
  theme?: SeasonalTheme;
}) {
  if (theme === "none") return null;
  const Decoration = DECORATIONS[theme];
  return <Decoration />;
}
