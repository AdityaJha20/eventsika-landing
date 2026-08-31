import DiwaliCtaDiya from "./DiwaliCtaDiya";
import styles from "./DiwaliLights.module.css";

interface DiyaLight {
  id: number;
  leftPercent: number;
  topOffset: number;
  dropHeight: number;
  tier: "primary" | "secondary" | "tertiary";
  animClass: string;
}

interface GoldenDot {
  id: number;
  leftPercent: number;
  topOffset: number;
  size: number;
  tier: "primary" | "secondary" | "tertiary";
  animClass: string;
}

// 8 selective hanging diyas balanced across festoon dips (increased by ~35% from 6)
const DIYA_LIGHTS: DiyaLight[] = [
  { id: 0, leftPercent: 5.5, topOffset: 13.5, dropHeight: 5.5, tier: "primary", animClass: "flickerA" },
  { id: 1, leftPercent: 17.0, topOffset: 16.0, dropHeight: 5.0, tier: "secondary", animClass: "glowSteady" },
  { id: 2, leftPercent: 29.0, topOffset: 14.0, dropHeight: 6.5, tier: "tertiary", animClass: "glowBreathe" },
  { id: 3, leftPercent: 42.0, topOffset: 16.5, dropHeight: 5.5, tier: "primary", animClass: "flickerB" },
  { id: 4, leftPercent: 54.5, topOffset: 14.5, dropHeight: 6.0, tier: "secondary", animClass: "flickerC" },
  { id: 5, leftPercent: 67.0, topOffset: 16.0, dropHeight: 5.0, tier: "primary", animClass: "glowSteady" },
  { id: 6, leftPercent: 79.5, topOffset: 14.0, dropHeight: 6.5, tier: "secondary", animClass: "flickerA" },
  { id: 7, leftPercent: 93.5, topOffset: 15.0, dropHeight: 5.0, tier: "primary", animClass: "flickerB" },
];

// Golden dots along the curved string crests & slopes
const GOLDEN_DOTS: GoldenDot[] = [
  { id: 0, leftPercent: 1.0, topOffset: 4.0, size: 2.6, tier: "primary", animClass: "glowSteady" },
  { id: 1, leftPercent: 11.0, topOffset: 5.0, size: 3.2, tier: "secondary", animClass: "flickerB" },
  { id: 2, leftPercent: 23.0, topOffset: 4.0, size: 2.6, tier: "primary", animClass: "glowSteady" },
  { id: 3, leftPercent: 35.5, topOffset: 5.2, size: 3.0, tier: "tertiary", animClass: "glowBreathe" },
  { id: 4, leftPercent: 48.0, topOffset: 4.0, size: 2.6, tier: "secondary", animClass: "glowSteady" },
  { id: 5, leftPercent: 60.5, topOffset: 5.2, size: 3.0, tier: "primary", animClass: "flickerA" },
  { id: 6, leftPercent: 73.0, topOffset: 4.0, size: 2.6, tier: "tertiary", animClass: "glowSteady" },
  { id: 7, leftPercent: 86.5, topOffset: 5.0, size: 3.2, tier: "secondary", animClass: "flickerC" },
  { id: 8, leftPercent: 98.5, topOffset: 4.0, size: 2.6, tier: "primary", animClass: "glowSteady" },
];

/**
 * Traditional Indian Diya / Festive Lamp Motif.
 * Designed with a warm brass cup base and a soft golden glowing flame.
 */
function DiyaFixture() {
  return (
    <div className={styles.diyaFixture}>
      {/* Soft warm glow halo */}
      <span className={styles.glowHalo} />
      {/* Diya SVG */}
      <svg
        className={styles.diyaSvg}
        viewBox="0 0 10 12"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <defs>
          <radialGradient
            id="diwaliFlameGrad"
            cx="50%"
            cy="50%"
            r="50%"
            fx="50%"
            fy="30%"
          >
            <stop offset="0%" stopColor="#FFF9E6" />
            <stop offset="40%" stopColor="#FFC837" />
            <stop offset="85%" stopColor="#FF8008" />
            <stop offset="100%" stopColor="#D35400" />
          </radialGradient>
          <linearGradient
            id="diwaliDiyaBaseGrad"
            x1="0%"
            y1="0%"
            x2="100%"
            y2="100%"
          >
            <stop offset="0%" stopColor="#D4AF37" />
            <stop offset="50%" stopColor="#B99A67" />
            <stop offset="100%" stopColor="#7A561E" />
          </linearGradient>
        </defs>

        {/* Diya Flame */}
        <path
          d="M5 1 C5.6 2.8, 7 4.2, 7 5.5 C7 6.8, 6.1 7.5, 5 7.5 C3.9 7.5, 3 6.8, 3 5.5 C3 4.2, 4.4 2.8, 5 1 Z"
          fill="url(#diwaliFlameGrad)"
          className={styles.diyaFlame}
        />

        {/* Traditional Brass Diya Base / Oil Lamp Holder */}
        <path
          d="M1.8 7.2 C2.7 9.2, 7.3 9.2, 8.2 7.2 C8.5 8.2, 7.5 10, 5 10 C2.5 10, 1.5 8.2, 1.8 7.2 Z"
          fill="url(#diwaliDiyaBaseGrad)"
        />
        <ellipse cx="5" cy="7.4" rx="3.2" ry="0.9" fill="#9C7A3C" />
      </svg>
    </div>
  );
}

export default function DiwaliLights() {
  return (
    <div className={styles.seasonalOverlay} aria-hidden="true">
      {/* Festive Draped Wire / Festoon */}
      <svg
        className={styles.festoonSvg}
        viewBox="0 0 1440 24"
        preserveAspectRatio="none"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M0,4 Q90,16 180,5 Q270,18 360,4 Q450,17 540,5 Q630,19 720,4 Q810,18 900,5 Q990,17 1080,4 Q1170,19 1260,5 Q1350,17 1440,4"
          className={styles.festoonPath}
        />
      </svg>

      {/* Golden Dots along the String */}
      <div className={styles.dotsTrack}>
        {GOLDEN_DOTS.map((dot) => (
          <span
            key={dot.id}
            className={`${styles.goldenDot} ${styles[dot.tier]} ${styles[dot.animClass]}`}
            style={{
              left: `${dot.leftPercent}%`,
              top: `${dot.topOffset}px`,
              width: `${dot.size}px`,
              height: `${dot.size}px`,
            }}
          />
        ))}
      </div>

      {/* Hanging Diya Lights */}
      <div className={styles.diyasTrack}>
        {DIYA_LIGHTS.map((diya) => (
          <div
            key={diya.id}
            className={`${styles.diyaNode} ${styles[diya.tier]} ${styles[diya.animClass]}`}
            style={{
              left: `${diya.leftPercent}%`,
              top: `${diya.topOffset}px`,
            }}
          >
            {/* Small attachment bead */}
            <span className={styles.bead} />
            {/* Delicate suspension thread */}
            <span
              className={styles.dropThread}
              style={{ height: `${diya.dropHeight}px` }}
            />
            {/* Traditional Diya Lamp */}
            <DiyaFixture />
          </div>
        ))}
      </div>

      {/* Dedicated Festive Diya above "Book a Consultation" CTA */}
      <DiwaliCtaDiya />
    </div>
  );
}
