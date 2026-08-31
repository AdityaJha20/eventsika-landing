import React from "react";
import styles from "./DiwaliCtaDiya.module.css";

/**
 * Traditional Indian Clay Diya (Mitti Ka Diya)
 * Designed based on the authentic reference illustration:
 * - Terracotta red/burgundy clay body with beaded rim and waist patterns
 * - Deep pool of warm oil
 * - Cotton wick resting on the spout
 * - Stylized Indian flame with radiant golden core and crimson artistic tip
 */
export default function DiwaliCtaDiya() {
  return (
    <div className={styles.ctaDiyaWrapper} aria-hidden="true">
      {/* Soft warm ambient glow behind flame */}
      <span className={styles.ambientGlow} />

      <svg
        className={styles.diyaSvg}
        viewBox="0 0 60 36"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* Terracotta Clay Body Gradient */}
          <linearGradient id="clayBodyGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#C4302B" />
            <stop offset="50%" stopColor="#A82020" />
            <stop offset="100%" stopColor="#7A1414" />
          </linearGradient>

          {/* Oil Pool Gradient */}
          <radialGradient
            id="oilPoolGrad"
            cx="40%"
            cy="50%"
            r="60%"
            fx="30%"
            fy="45%"
          >
            <stop offset="0%" stopColor="#E59B28" />
            <stop offset="45%" stopColor="#8C3806" />
            <stop offset="100%" stopColor="#3D1502" />
          </radialGradient>

          {/* Flame Core Gradient */}
          <radialGradient
            id="flameCoreGrad"
            cx="50%"
            cy="70%"
            r="60%"
            fx="50%"
            fy="80%"
          >
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="35%" stopColor="#FFE066" />
            <stop offset="70%" stopColor="#FF922B" />
            <stop offset="100%" stopColor="#E03131" />
          </radialGradient>

          {/* Flame Tip Accent Gradient */}
          <linearGradient id="flameTipGrad" x1="0%" y1="100%" x2="0%" y2="0%">
            <stop offset="0%" stopColor="#FF922B" />
            <stop offset="60%" stopColor="#E03131" />
            <stop offset="100%" stopColor="#C92A2A" />
          </linearGradient>
        </defs>

        {/* 1. Terracotta Diya Outer Clay Body */}
        <path
          d="M7 19.5 C10 28 22 33 35 33 C46 33 51 27 55 19 C48 20.5 40 21 27 21 C15 21 9 20 7 19.5 Z"
          fill="url(#clayBodyGrad)"
          stroke="#681010"
          strokeWidth="0.6"
        />

        {/* 2. Diya Inner Oil Reservoir */}
        <path
          d="M7 19.5 C9 17.5 25 16.5 40 17.5 C49 18 53 19 55 19 C51 21.5 38 22 25 21.8 C14 21.5 9 20.5 7 19.5 Z"
          fill="url(#oilPoolGrad)"
          stroke="#521804"
          strokeWidth="0.5"
        />

        {/* 3. Golden Oil Surface Glimmer */}
        <ellipse
          cx="28"
          cy="19.2"
          rx="12"
          ry="1.2"
          fill="#FFA94D"
          opacity="0.85"
        />

        {/* 4. Traditional Beaded Rim Accents */}
        <path
          d="M8 18.8 Q26 16.8 53.5 18.5"
          stroke="#FFD8A8"
          strokeWidth="0.8"
          strokeDasharray="1.2 1.6"
          strokeLinecap="round"
          opacity="0.9"
        />

        {/* 5. Delicate Waist Pattern */}
        <path
          d="M13 25.5 Q29 29.5 47 24.5"
          stroke="#FFA94D"
          strokeWidth="0.6"
          strokeDasharray="0.8 1.4"
          strokeLinecap="round"
          opacity="0.75"
        />

        {/* 6. Cotton Wick Emerging from Oil */}
        <path
          d="M30 19.5 Q40 18.5 47.5 17.2"
          stroke="#381E60"
          strokeWidth="1.2"
          strokeLinecap="round"
        />

        {/* 7. Stylized Traditional Diya Flame with Flick Tip (Animated) */}
        <g className={styles.animatedFlame}>
          {/* Outer Flame with Crimson Flick Tip */}
          <path
            d="M46.5 17 C43.5 12.5 44 7.5 48.5 2.8 C49.8 1.5 50.8 0 51.5 0.5 C51.5 2 50 4.5 52.5 6 C54.8 7.5 54.8 12.5 51.5 15.5 C49.5 17.2 48 17.5 46.5 17 Z"
            fill="url(#flameTipGrad)"
          />
          {/* Radiant Golden/White Core */}
          <path
            d="M47 16.5 C45 13 45.5 9 48.5 5.5 C49.5 4.5 50 3.5 50.5 4 C50.5 5 49.5 6.5 51 8 C52.2 9.2 52.2 13 49.8 15.2 C48.5 16.2 47.8 16.6 47 16.5 Z"
            fill="url(#flameCoreGrad)"
          />
          {/* Inner Light Sparkle */}
          <ellipse
            cx="48.8"
            cy="12"
            rx="1.2"
            ry="2.8"
            fill="#FFF9DB"
            opacity="0.9"
          />
        </g>
      </svg>
    </div>
  );
}
