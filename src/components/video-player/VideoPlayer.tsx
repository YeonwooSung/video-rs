"use client";

import dynamic from "next/dynamic";

/** video.js is browser-only and incompatible with SSR — lazy-load it. */
const VideoPlayerInner = dynamic(() => import("./VideoPlayerInner"), {
  ssr: false,
  loading: () => (
    <div className="flex h-64 items-center justify-center rounded-lg bg-black text-white text-sm">
      Loading player…
    </div>
  ),
});

export interface VideoPlayerProps {
  src: string;
  fps?: number;
  onTimeChange?: (seconds: number) => void;
  /** Seek the existing player here when `src` or this value changes. */
  startTime?: number;
  /** Bind Space to play/pause. Default true (Viewer / Clips). */
  enableSpace?: boolean;
}

export function VideoPlayer({
  src,
  fps,
  onTimeChange,
  startTime,
  enableSpace,
}: VideoPlayerProps) {
  return (
    <VideoPlayerInner
      src={src}
      fps={fps}
      onTimeChange={onTimeChange}
      startTime={startTime}
      enableSpace={enableSpace}
    />
  );
}
