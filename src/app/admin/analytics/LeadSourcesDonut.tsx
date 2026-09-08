"use client";

import React from "react";
import styles from "./analytics.module.css";

interface LeadSourcesDonutProps {
  totalLeads: number;
}

export function LeadSourcesDonut({ totalLeads }: LeadSourcesDonutProps) {
  // SVG Donut geometry
  const radius = 38;
  const circumference = 2 * Math.PI * radius; // ~238.76

  // Website accounts for 100% of currently recorded intake submissions
  const websiteDash = circumference;

  const channels = [
    {
      name: "Website Intake",
      percentage: 100,
      color: "var(--primary, #7f1010)",
      isLive: true,
    },
    {
      name: "Instagram",
      percentage: 0,
      color: "var(--gold, #b99a67)",
      isLive: false,
      phase2: true,
    },
    {
      name: "Direct Inquiry",
      percentage: 0,
      color: "var(--primary-dark, #5f0808)",
      isLive: false,
      phase2: true,
    },
    {
      name: "Referrals",
      percentage: 0,
      color: "#e3c28b",
      isLive: false,
      phase2: true,
    },
    {
      name: "Others",
      percentage: 0,
      color: "var(--border, #dfd2c3)",
      isLive: false,
      phase2: true,
    },
  ];

  return (
    <div className={styles.donutWrapper}>
      <div
        style={{
          position: "relative",
          width: "176px",
          height: "176px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <svg
          style={{
            width: "100%",
            height: "100%",
            transform: "rotate(-90deg)",
          }}
          viewBox="0 0 100 100"
          aria-hidden="true"
        >
          {/* Base Inset Track */}
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="transparent"
            stroke="var(--cream, #f8f3ec)"
            strokeWidth="14"
          />

          {/* Website Segment (100% of recorded submissions) */}
          {totalLeads > 0 && (
            <circle
              cx="50"
              cy="50"
              r={radius}
              fill="transparent"
              stroke="var(--primary, #7f1010)"
              strokeWidth="14"
              strokeDasharray={`${websiteDash} ${circumference}`}
              strokeDashoffset="0"
            />
          )}
        </svg>

        {/* Donut Center Hole */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            pointerEvents: "none",
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-playfair), Georgia, serif",
              fontSize: "1.45rem",
              fontWeight: 700,
              color: "var(--primary, #7f1010)",
              lineHeight: 1,
            }}
          >
            {totalLeads}
          </span>
          <span
            style={{
              fontSize: "10px",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: "#6b5a52",
              marginTop: "3px",
              fontWeight: 600,
            }}
          >
            Leads
          </span>
        </div>
      </div>

      {/* Legend Rows */}
      <div className={styles.sourcesList} style={{ width: "100%", marginTop: "1.25rem" }}>
        {channels.map((channel) => (
          <div key={channel.name} className={styles.sourceRow}>
            <div className={styles.sourceRowLeft}>
              <span
                className={styles.sourceDot}
                style={{ backgroundColor: channel.color }}
              />
              <span className={styles.sourceName}>{channel.name}</span>
            </div>
            {channel.isLive ? (
              <span className={styles.sourcePercent} style={{ color: "var(--primary, #7f1010)" }}>
                {channel.percentage}%
              </span>
            ) : (
              <span
                style={{
                  fontSize: "0.72rem",
                  color: "#8c716d",
                  backgroundColor: "var(--cream, #f8f3ec)",
                  padding: "2px 6px",
                  borderRadius: "4px",
                  fontWeight: 500,
                }}
              >
                Phase 2
              </span>
            )}
          </div>
        ))}
      </div>

      <p className={styles.attributionDisclaimer}>
        100% of currently recorded leads originate from the Eventsika website intake form;
        acquisition/source attribution is not currently captured.
      </p>
    </div>
  );
}
