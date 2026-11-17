import type { CSSProperties } from "react";
import styles from "./ChristmasNavbarDecoration.module.css";

/**
 * Christmas Luxe navbar decoration: an evergreen garland with warm twinkling
 * lights along the top edge, a few hanging ornaments and light snowfall.
 * Original SVG/CSS artwork (no third-party assets). Purely decorative.
 */

// Garland drape: each scallop is one cubic curve from a pin point (y=TOP) down to
// DIP at its centre and back up. It stays inside the navbar's top padding.
const TOP = 3;
const DIP = 13;
// Scallops are drawn in their own SVG with a viewBox close to their rendered
// width, so needle dashes keep their true shape instead of being stretched.
const VB_W = 160;
const C1 = 0.3; // control-point x fraction: shallow tangents keep the joins soft
const CY = (DIP - 0.25 * TOP) / 0.75; // control y that makes the curve's lowest point DIP
const SCALLOP_PATH = `M0 ${TOP} C${C1 * VB_W} ${CY} ${(1 - C1) * VB_W} ${CY} ${VB_W} ${TOP}`;
const bezier = (a: number, b: number, c: number, d: number, t: number) =>
  a * (1 - t) ** 3 + 3 * b * (1 - t) ** 2 * t + 3 * c * (1 - t) * t ** 2 + d * t ** 3;
const bezierSlope = (a: number, b: number, c: number, d: number, t: number) =>
  3 * ((b - a) * (1 - t) ** 2 + 2 * (c - b) * (1 - t) * t + (d - c) * t ** 2);
// Lights at the pin point and evenly along the curve (as fractions of scallop width).
const LIGHTS = [0, 1 / 3, 2 / 3].map((t) => ({
  x: bezier(0, C1, 1 - C1, 1, t),
  y: bezier(TOP, CY, CY, TOP, t),
}));

// Seeded PRNG: identical needles on server and client, so hydration always matches.
function seededRandom(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Needle passes, back to front: dense dark inner needles, the main mid-green
// body, longer soft outer tips, then a few pale sunlit tips on the upper side.
const NEEDLE_LAYERS = [
  { className: "needleDeep", count: 200, length: [1.4, 3], splay: 0.6, depth: 1.1, upOnly: false },
  { className: "needleMid", count: 230, length: [2, 3.8], splay: 0.7, depth: 1.6, upOnly: false },
  { className: "needleSoft", count: 130, length: [2.6, 4.6], splay: 0.75, depth: 2, upOnly: false },
  { className: "needleTip", count: 50, length: [1.1, 2.2], splay: 0.5, depth: 1.8, upOnly: true },
] as const;

/** One scallop's needles as a single path per layer; ends overrun the pins so joins stay full. */
function pineNeedles(seed: number) {
  const random = seededRandom(seed);
  const between = ([min, max]: readonly [number, number]) => min + random() * (max - min);
  return NEEDLE_LAYERS.map(({ className, count, length, splay, depth, upOnly }) => {
    let d = "";
    for (let n = 0; n < count; n++) {
      const t = -0.04 + random() * 1.08;
      const x = bezier(0, C1 * VB_W, (1 - C1) * VB_W, VB_W, t);
      const y = bezier(TOP, CY, CY, TOP, t);
      const along = Math.atan2(bezierSlope(TOP, CY, CY, TOP, t), bezierSlope(0, C1 * VB_W, (1 - C1) * VB_W, VB_W, t));
      const side = upOnly || random() < 0.5 ? -1 : 1; // -1: upper side of the bough
      const offset = side * random() * depth;
      // Most needles sweep the same way along the branch (as real pine grows),
      // a few the other way, each splayed off the branch at a varied angle
      const sweep = !upOnly && random() < 0.18 ? Math.PI : 0;
      const angle = along + sweep + side * (0.45 + random() * splay);
      const len = between(length);
      const sx = x - Math.sin(along) * offset;
      const sy = y + Math.cos(along) * offset;
      d += `M${sx.toFixed(1)} ${sy.toFixed(1)}l${(Math.cos(angle) * len).toFixed(1)} ${(Math.sin(angle) * len).toFixed(1)}`;
    }
    return { className, d };
  });
}

const PINE_VARIANTS = [7, 19, 41]; // alternated per scallop so no two neighbours match

// Needle artwork, defined once and reused by every scallop via <use>.
function PineDefs() {
  return (
    <svg width="0" height="0" className={styles.defs}>
      <defs>
        {PINE_VARIANTS.map((seed) => (
          <g key={seed} id={`xmas-pine-${seed}`}>
            {pineNeedles(seed).map(({ className, d }) => (
              <path key={className} d={d} className={styles[className]} />
            ))}
          </g>
        ))}
      </defs>
    </svg>
  );
}

function Garland({ scallops, className }: { scallops: number; className: string }) {
  const w = 100 / scallops;

  return (
    <div className={className}>
      {Array.from({ length: scallops }, (_, i) => (
        // Back to front: soft shadow, bough core, needle layers, fine gold wire
        <svg
          key={i}
          className={styles.garland}
          style={{ left: `${i * w}%`, width: `${w}%` }}
          viewBox={`0 0 ${VB_W} 18`}
          preserveAspectRatio="none"
        >
          <path d={SCALLOP_PATH} className={styles.shadow} transform="translate(0 1.2)" />
          <path d={SCALLOP_PATH} className={styles.bough} />
          <use href={`#xmas-pine-${PINE_VARIANTS[i % PINE_VARIANTS.length]}`} />
          <path d={SCALLOP_PATH} className={styles.wire} />
        </svg>
      ))}
      {Array.from({ length: scallops + 1 }, (_, i) =>
        LIGHTS.filter((_, j) => i < scallops || j === 0).map(({ x, y }, j) => (
          <span
            key={`${i}-${j}`}
            className={styles.light}
            style={{
              left: `${(i + x) * w}%`,
              top: `${y}px`,
              // Staggered, unsynchronised twinkle
              animationDelay: `${-((i * 7 + j * 3) % 11) * 0.45}s`,
              animationDuration: `${3.2 + ((i + j) % 4) * 0.7}s`,
            } as CSSProperties}
          />
        ))
      )}
    </div>
  );
}

type OrnamentKind = "gold" | "ruby" | "star";

// Hang from garland dips, kept between logo and CTAs (nav spans ~21–62% from
// 1241px up): desktop garland has 8 scallops; `mobileLeft` is a dip of the
// 6-scallop tablet garland, between logo and the mobile controls.
const ORNAMENTS: { left: number; mobileLeft?: number; drop: number; kind: OrnamentKind }[] = [
  { left: 31.25, mobileLeft: 41.67, drop: 6, kind: "gold" },
  { left: 43.75, drop: 3, kind: "star" },
  { left: 56.25, mobileLeft: 58.33, drop: 5, kind: "ruby" },
];

function OrnamentShape({ kind }: { kind: OrnamentKind }) {
  if (kind === "star") {
    return (
      <svg viewBox="0 0 12 12" className={styles.star}>
        <defs>
          <linearGradient id="xmas-star-gold" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#f6e8c4" />
            <stop offset="0.45" stopColor="#d9bd84" />
            <stop offset="1" stopColor="#9c7d43" />
          </linearGradient>
        </defs>
        <path
          d="M6 0.8 7.4 4.4 11.2 4.6 8.3 7 9.3 10.8 6 8.7 2.7 10.8 3.7 7 0.8 4.6 4.6 4.4Z"
          fill="url(#xmas-star-gold)"
        />
      </svg>
    );
  }
  return <span className={`${styles.bauble} ${styles[kind]}`} />;
}

// Low particle count; [left %, size px, fall s, delay s, opacity]. Larger flakes
// fall slower and read as nearer, smaller ones are fainter and farther away.
const SNOW = [
  [4, 3.2, 14, 0, 0.85], [11, 2, 11, -6, 0.6], [19, 2.6, 13, -3, 0.75], [27, 1.8, 10, -9, 0.55],
  [36, 3, 15, -2, 0.85], [48, 2.2, 12, -11, 0.65], [57, 3.4, 16, -7, 0.9], [66, 1.8, 11, -4, 0.55],
  [74, 2.8, 14, -10, 0.8], [83, 2, 12, -1, 0.6], [91, 3.2, 15, -8, 0.85], [97, 2.2, 11, -5, 0.6],
] as const;

export default function ChristmasNavbarDecoration() {
  return (
    <div className={styles.overlay} aria-hidden="true">
      <PineDefs />
      <div className={styles.snow}>
        {SNOW.map(([left, size, duration, delay, opacity], i) => (
          <span
            key={i}
            className={styles.flake}
            style={{
              left: `${left}%`,
              width: `${size}px`,
              height: `${size}px`,
              opacity,
              animationDuration: `${duration}s`,
              animationDelay: `${delay}s`,
            }}
          />
        ))}
      </div>

      {/* Scallop count per breakpoint keeps each scallop near VB_W pixels wide */}
      <Garland scallops={8} className={styles.desktopOnly} />
      <Garland scallops={6} className={styles.tabletOnly} />
      <Garland scallops={4} className={styles.phoneOnly} />

      {ORNAMENTS.map(({ left, mobileLeft, drop, kind }, i) => (
        <span
          key={kind}
          className={`${styles.ornament} ${mobileLeft ? "" : styles.desktopOnly}`}
          style={{
            "--left": `${left}%`,
            "--mobile-left": `${mobileLeft ?? left}%`,
            top: `${DIP}px`,
            animationDuration: `${4.6 + i * 0.8}s`,
            animationDelay: `${-i * 1.3}s`,
          } as CSSProperties}
        >
          <span className={styles.thread} style={{ height: `${drop}px` }} />
          <OrnamentShape kind={kind} />
        </span>
      ))}
    </div>
  );
}
