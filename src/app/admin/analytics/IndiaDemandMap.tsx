"use client";

import React, { useState } from "react";
import { CityMarkerItem } from "@/lib/backend/repositories/analytics-repository.interface";
import { INDIA_MAP_STATES, INDIA_MAP_VIEWBOX } from "./indiaMapData";
import styles from "./analytics.module.css";

interface IndiaDemandMapProps {
  markers: CityMarkerItem[];
}

/**
 * Calibrated geographic coordinates for recognized celebration hubs
 * mapped to the authentic 612 x 696 India vector boundary map.
 */
const CITY_GEO_COORDINATES: Record<
  string,
  { x: number; y: number; labelOffsetY?: number }
> = {
  "Delhi NCR": { x: 186.5, y: 210.5, labelOffsetY: 26 },
  Delhi: { x: 186.5, y: 210.5, labelOffsetY: 26 },
  Mumbai: { x: 112, y: 416, labelOffsetY: 22 },
  Kolkata: { x: 418, y: 348, labelOffsetY: 22 },
  Bengaluru: { x: 196, y: 552, labelOffsetY: 22 },
  Bangalore: { x: 196, y: 552, labelOffsetY: 22 },
};

export function IndiaDemandMap({ markers }: IndiaDemandMapProps) {
  const [activeTooltip, setActiveTooltip] = useState<{
    name: string;
    count: number;
    percentage: number;
    x: number;
    y: number;
  } | null>(null);

  // Normalize markers to guarantee Delhi NCR, Mumbai, Kolkata, Bengaluru exist
  const normalizedMarkers: CityMarkerItem[] = [
    markers.find((m) => m.name === "Delhi NCR") || {
      name: "Delhi NCR",
      count: 0,
      percentage: 0,
      top: "22%",
      left: "49%",
      isPrimary: true,
    },
    markers.find((m) => m.name === "Mumbai") || {
      name: "Mumbai",
      count: 0,
      percentage: 0,
      top: "56%",
      left: "32%",
    },
    markers.find((m) => m.name === "Kolkata") || {
      name: "Kolkata",
      count: 0,
      percentage: 0,
      top: "46%",
      left: "70%",
    },
    markers.find((m) => m.name === "Bengaluru") || {
      name: "Bengaluru",
      count: 0,
      percentage: 0,
      top: "75%",
      left: "44%",
    },
  ];

  // Include any other dynamic city markers from analytics data
  for (const m of markers) {
    if (!normalizedMarkers.some((nm) => nm.name === m.name)) {
      normalizedMarkers.push(m);
    }
  }

  // Determine top-demand city for visual focus
  const highestCount = Math.max(...normalizedMarkers.map((m) => m.count), 0);

  return (
    <div
      className={styles.mapCanvasWrapper}
      role="img"
      aria-label="India Geographic Celebration Demand Heatmap showing lead concentration by city"
    >
      <svg
        className={styles.mapSvg}
        viewBox={INDIA_MAP_VIEWBOX}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <defs>
          <radialGradient id="demand-halo" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#7f1010" stopOpacity="0.32" />
            <stop offset="65%" stopColor="#7f1010" stopOpacity="0.12" />
            <stop offset="100%" stopColor="#7f1010" stopOpacity="0" />
          </radialGradient>

          <radialGradient id="demand-halo-primary" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#7f1010" stopOpacity="0.45" />
            <stop offset="60%" stopColor="#7f1010" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#7f1010" stopOpacity="0" />
          </radialGradient>

          <filter id="node-shadow" x="-40%" y="-40%" width="180%" height="180%">
            <feDropShadow
              dx="0"
              dy="1.5"
              stdDeviation="2.5"
              floodColor="#2b211d"
              floodOpacity="0.28"
            />
          </filter>

          <filter id="pill-shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow
              dx="0"
              dy="1"
              stdDeviation="2"
              floodColor="#2b211d"
              floodOpacity="0.12"
            />
          </filter>
        </defs>

        {/* 1. Authentic State and Union Territory Vector Boundaries */}
        <g className={styles.indiaStatesLayer}>
          {INDIA_MAP_STATES.map((state) => (
            <path
              key={state.id}
              id={`state-${state.id}`}
              d={state.path}
              className={styles.mapStatePath}
            >
              <title>{state.name}</title>
            </path>
          ))}
        </g>

        {/* 2. Geographically Calibrated City Demand Nodes */}
        <g className="india-demand-markers-layer">
          {normalizedMarkers.map((marker) => {
            const coords = CITY_GEO_COORDINATES[marker.name] || {
              x: parseFloat(marker.left) * 6.12,
              y: parseFloat(marker.top) * 6.96,
              labelOffsetY: 22,
            };

            const isTopHub = marker.count > 0 && marker.count === highestCount;
            const isPrimary = marker.isPrimary || isTopHub;
            const hasActivity = marker.count > 0;

            // Radius scales dynamically with demand percentage (7px to 14px)
            const coreRadius = isPrimary
              ? 13
              : hasActivity
              ? 8.5 + (marker.percentage / 100) * 4
              : 7;
            const haloRadius = isPrimary ? 34 : hasActivity ? 22 : 14;
            const labelText = `${marker.name} (${marker.percentage}%)`;
            const pillWidth = Math.max(76, labelText.length * 6.8 + 14);
            const pillY = coords.y + (coords.labelOffsetY || 22);

            return (
              <g
                key={marker.name}
                tabIndex={0}
                role="button"
                aria-label={`${marker.name}: ${marker.count} inquiries (${marker.percentage}% of demand)`}
                style={{ cursor: "pointer" }}
                onMouseEnter={() =>
                  setActiveTooltip({
                    name: marker.name,
                    count: marker.count,
                    percentage: marker.percentage,
                    x: coords.x,
                    y: coords.y,
                  })
                }
                onMouseLeave={() => setActiveTooltip(null)}
                onFocus={() =>
                  setActiveTooltip({
                    name: marker.name,
                    count: marker.count,
                    percentage: marker.percentage,
                    x: coords.x,
                    y: coords.y,
                  })
                }
                onBlur={() => setActiveTooltip(null)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setActiveTooltip((prev) =>
                      prev && prev.name === marker.name
                        ? null
                        : {
                            name: marker.name,
                            count: marker.count,
                            percentage: marker.percentage,
                            x: coords.x,
                            y: coords.y,
                          }
                    );
                  }
                }}
              >
                {/* Translucent Crimson Halo */}
                <circle
                  cx={coords.x}
                  cy={coords.y}
                  r={haloRadius}
                  fill={
                    isPrimary
                      ? "url(#demand-halo-primary)"
                      : "url(#demand-halo)"
                  }
                  className={isPrimary ? styles.pulseHalo : undefined}
                />

                {/* Animated Pulsing Ring for Delhi NCR / Top Demand Hub */}
                {isPrimary && (
                  <circle
                    cx={coords.x}
                    cy={coords.y}
                    r={coreRadius + 9}
                    fill="none"
                    stroke="rgba(127, 16, 16, 0.45)"
                    strokeWidth="1.5"
                    className={styles.pulseRing}
                  />
                )}

                {/* Core Demand Circle */}
                <circle
                  cx={coords.x}
                  cy={coords.y}
                  r={coreRadius}
                  fill={
                    hasActivity
                      ? "var(--primary, #7f1010)"
                      : "rgba(127, 16, 16, 0.65)"
                  }
                  stroke="#ffffff"
                  strokeWidth={isPrimary ? 2 : 1.5}
                  filter="url(#node-shadow)"
                />

                {/* Direct Inquiry Count inside Primary Marker */}
                {isPrimary && (
                  <text
                    x={coords.x}
                    y={coords.y + 0.5}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fill="#ffffff"
                    fontSize="10"
                    fontWeight="700"
                    fontFamily="var(--font-inter), sans-serif"
                    pointerEvents="none"
                  >
                    {marker.count}
                  </text>
                )}

                {/* Editorial City Label Pill */}
                <g filter="url(#pill-shadow)">
                  <rect
                    x={coords.x - pillWidth / 2}
                    y={pillY - 9}
                    width={pillWidth}
                    height="18"
                    rx="4"
                    fill="rgba(255, 250, 244, 0.95)"
                    stroke="rgba(223, 210, 195, 0.75)"
                    strokeWidth="0.8"
                  />
                  <text
                    x={coords.x}
                    y={pillY + 0.5}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize="10.5"
                    fontWeight={isPrimary ? "700" : "500"}
                    fill={
                      isPrimary
                        ? "var(--primary, #7f1010)"
                        : "var(--foreground, #2b211d)"
                    }
                    fontFamily="var(--font-inter), sans-serif"
                    pointerEvents="none"
                  >
                    {labelText}
                  </text>
                </g>
              </g>
            );
          })}
        </g>
      </svg>

      {/* Floating Detailed Tooltip (Interactive Focus/Hover State) */}
      {activeTooltip && (
        <div
          className={styles.mapInteractiveTooltip}
          style={{
            position: "absolute",
            top: `${(activeTooltip.y / 696) * 100}%`,
            left: `${(activeTooltip.x / 612) * 100}%`,
            transform: "translate(-50%, -125%)",
            pointerEvents: "none",
            zIndex: 30,
          }}
          role="tooltip"
        >
          <div className={styles.tooltipTitle}>{activeTooltip.name}</div>
          <div className={styles.tooltipDetail}>
            <strong>{activeTooltip.count}</strong> inquiries (
            {activeTooltip.percentage}% share)
          </div>
        </div>
      )}

      {/* Map Legend */}
      <div className={styles.mapLegendBottom}>
        <span className={styles.legendDot} />
        <span>Marker scaled by celebration inquiry volume</span>
      </div>
    </div>
  );
}
