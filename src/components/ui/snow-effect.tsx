"use client";

import { useEffect, useRef, useState } from "react";
import { Snowflake } from "lucide-react";

const STORAGE_KEY = "stockpilot_snowfall_v2";

export function useSnowfall() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    // Clear legacy key to ensure fresh default OFF for all users
    try {
      if (localStorage.getItem("stockpilot_snowfall_enabled") !== null) {
        localStorage.removeItem("stockpilot_snowfall_enabled");
      }
    } catch {}

    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      // Default to false (OFF) unless explicitly turned on
      if (saved === "true") {
        setEnabled(true);
      } else {
        setEnabled(false);
      }
    } catch {
      setEnabled(false);
    }

    const handler = (e: CustomEvent<boolean>) => {
      setEnabled(e.detail);
    };

    window.addEventListener("stockpilot:snowfall", handler as EventListener);
    return () => window.removeEventListener("stockpilot:snowfall", handler as EventListener);
  }, []);

  const toggle = () => {
    const next = !enabled;
    setEnabled(next);
    try {
      localStorage.setItem(STORAGE_KEY, String(next));
    } catch {}
    window.dispatchEvent(new CustomEvent("stockpilot:snowfall", { detail: next }));
  };

  return { enabled, toggle };
}

export function SnowfallToggle() {
  const { enabled, toggle } = useSnowfall();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div
        aria-hidden
        className="size-9 rounded-[13px] border border-shell-border/60 bg-card/60"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={enabled ? "Turn snowfall off" : "Turn snowfall on"}
      title={enabled ? "Snowfall Effect: ON (Click to turn OFF)" : "Snowfall Effect: OFF (Click to turn ON)"}
      className={`grid size-9 place-items-center rounded-[13px] border transition-all duration-200 ${
        enabled
          ? "border-primary/40 bg-primary/10 text-primary shadow-sm ring-1 ring-primary/20"
          : "border-shell-border/80 bg-card/85 text-muted-foreground hover:border-primary/30 hover:bg-primary-soft/50 hover:text-primary"
      }`}
    >
      <Snowflake
        size={17}
        className={`transition-transform duration-500 ${
          enabled ? "rotate-180 text-primary" : "text-muted-foreground opacity-70"
        }`}
      />
    </button>
  );
}

interface Flake {
  x: number;
  y: number;
  radius: number;
  speed: number;
  sway: number;
  swaySpeed: number;
  opacity: number;
}

export function SnowfallOverlay() {
  const { enabled } = useSnowfall();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const onResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener("resize", onResize);

    const flakeCount = width < 768 ? 35 : 70;
    const flakes: Flake[] = Array.from({ length: flakeCount }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      radius: Math.random() * 1.3 + 0.8, // Fine, small, delicate snowflakes (0.8px - 2.1px)
      speed: Math.random() * 0.45 + 0.25, // Gentle, slow floating motion (0.25px - 0.7px per frame)
      sway: Math.random() * Math.PI * 2,
      swaySpeed: Math.random() * 0.015 + 0.008,
      opacity: Math.random() * 0.35 + 0.5,
    }));

    const render = () => {
      ctx.clearRect(0, 0, width, height);
      const isDark = document.documentElement.classList.contains("dark");

      for (const flake of flakes) {
        flake.y += flake.speed;
        flake.sway += flake.swaySpeed;
        flake.x += Math.sin(flake.sway) * 0.35;

        // Wrap around when falling off bottom or side
        if (flake.y > height + 5) {
          flake.y = -5;
          flake.x = Math.random() * width;
        }
        if (flake.x > width + 5) {
          flake.x = -5;
        } else if (flake.x < -5) {
          flake.x = width + 5;
        }

        ctx.beginPath();
        ctx.arc(flake.x, flake.y, flake.radius, 0, Math.PI * 2);

        if (isDark) {
          // Dark mode: soft luminous snow
          ctx.shadowColor = "rgba(255, 255, 255, 0.4)";
          ctx.shadowBlur = 3;
          ctx.shadowOffsetY = 0;
          ctx.fillStyle = `rgba(255, 255, 255, ${flake.opacity})`;
          ctx.fill();
        } else {
          // Light mode: delicate frosted snow with subtle micro-shadow and fine hairline outline
          ctx.shadowColor = "rgba(16, 65, 52, 0.25)";
          ctx.shadowBlur = 2.5;
          ctx.shadowOffsetY = 1;
          ctx.fillStyle = `rgba(255, 255, 255, 0.95)`;
          ctx.fill();

          ctx.shadowColor = "transparent";
          ctx.shadowBlur = 0;
          ctx.strokeStyle = `rgba(16, 120, 100, 0.25)`;
          ctx.lineWidth = 0.5;
          ctx.stroke();
        }
      }

      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener("resize", onResize);
      cancelAnimationFrame(animId);
    };
  }, [enabled]);

  if (!enabled) return null;

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-50 overflow-hidden"
    />
  );
}
