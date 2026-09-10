"use client";

import { useEffect, useRef } from "react";
import { DotLottie } from "@lottiefiles/dotlottie-web";
import styles from "./HeroFireworks.module.css";

export default function HeroFireworks() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const playerRef = useRef<DotLottie | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let isMounted = true;
    const abortController = new AbortController();
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

    // Point WASM loading to the local asset to prevent external network requests
    DotLottie.setWasmUrl("/animation/dotlottie-player.wasm");

    // Fetch the dotlottie archive locally as an ArrayBuffer.
    // This allows React 19 lifecycle / StrictMode cleanup without unhandled abort errors.
    fetch("/animation/Fireworks.lottie", { signal: abortController.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP error ${res.status}`);
        return res.arrayBuffer();
      })
      .then((data) => {
        if (!isMounted || !canvasRef.current) return;

        const player = new DotLottie({
          canvas: canvasRef.current,
          data,
          loop: true,
          autoplay: !mediaQuery.matches,
          renderConfig: {
            autoResize: true,
            freezeOnOffscreen: true,
          },
          layout: {
            fit: "contain",
            align: [0.5, 0.5],
          },
        });

        playerRef.current = player;
      })
      .catch((err) => {
        if (err.name !== "AbortError") {
          console.error("Failed to load fireworks animation:", err);
        }
      });

    const handleMotionChange = (e: MediaQueryListEvent) => {
      if (!playerRef.current) return;
      if (e.matches) {
        playerRef.current.pause();
      } else {
        playerRef.current.play();
      }
    };

    mediaQuery.addEventListener("change", handleMotionChange);

    return () => {
      isMounted = false;
      abortController.abort();
      mediaQuery.removeEventListener("change", handleMotionChange);
      if (playerRef.current) {
        playerRef.current.destroy();
        playerRef.current = null;
      }
    };
  }, []);

  return (
    <div
      className={styles.fireworksLayer}
      aria-hidden="true"
      tabIndex={-1}
    >
      <canvas ref={canvasRef} className={styles.fireworksCanvas} />
    </div>
  );
}
