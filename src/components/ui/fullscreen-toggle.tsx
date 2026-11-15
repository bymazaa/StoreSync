"use client";

import { useEffect, useState } from "react";
import { Maximize, Minimize } from "lucide-react";

export function FullscreenToggle() {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        if (document.documentElement.requestFullscreen) {
          await document.documentElement.requestFullscreen();
        }
      } else {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        }
      }
    } catch {
      // Browsers may block if user didn't initiate via trusted gesture
    }
  };

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
      onClick={toggleFullscreen}
      aria-label={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
      title={isFullscreen ? "Exit Fullscreen (Esc)" : "Enter Fullscreen (Kiosk mode)"}
      className={`grid size-9 place-items-center rounded-[13px] border transition-all duration-200 cursor-pointer ${
        isFullscreen
          ? "border-primary/40 bg-primary/10 text-primary shadow-sm ring-1 ring-primary/20"
          : "border-shell-border/80 bg-card/85 text-muted-foreground hover:border-primary/30 hover:bg-primary-soft/50 hover:text-primary"
      }`}
    >
      {isFullscreen ? (
        <Minimize size={16} strokeWidth={2} />
      ) : (
        <Maximize size={16} strokeWidth={2} />
      )}
    </button>
  );
}
