"use client";

import { useEffect, useRef } from "react";
import videojs from "video.js";
import type Player from "video.js/dist/types/player";
import "video.js/dist/video-js.css";

export interface VideoPlayerInnerProps {
  src: string;
}

export default function VideoPlayerInner({ src }: VideoPlayerInnerProps) {
  const videoRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<Player | null>(null);

  useEffect(() => {
    if (!videoRef.current) return;

    // Initialize player only once
    if (!playerRef.current) {
      const videoEl = document.createElement("video-js");
      videoEl.classList.add("vjs-big-play-centered");
      videoRef.current.appendChild(videoEl);

      playerRef.current = videojs(videoEl, {
        controls: true,
        responsive: true,
        fluid: true,
        playbackRates: [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 4],
        sources: [{ src, type: guessType(src) }],
      });
    } else {
      // Update source when `src` prop changes
      playerRef.current.src([{ src, type: guessType(src) }]);
    }
  }, [src]);

  // Dispose on unmount
  useEffect(() => {
    return () => {
      if (playerRef.current && !playerRef.current.isDisposed()) {
        playerRef.current.dispose();
        playerRef.current = null;
      }
    };
  }, []);

  return (
    <div data-vjs-player>
      <div ref={videoRef} />
    </div>
  );
}

/** Infer a MIME type from file extension for video.js source. */
function guessType(src: string): string {
  const ext = src.split(".").pop()?.toLowerCase();
  const map: Record<string, string> = {
    mp4: "video/mp4",
    mkv: "video/x-matroska",
    mov: "video/quicktime",
    webm: "video/webm",
    avi: "video/avi",
    flv: "video/x-flv",
    m4v: "video/x-m4v",
  };
  return map[ext ?? ""] ?? "video/mp4";
}
