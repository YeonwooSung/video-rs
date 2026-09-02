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
}

export function VideoPlayer({ src, fps, onTimeChange }: VideoPlayerProps) {
  return <VideoPlayerInner src={src} fps={fps} onTimeChange={onTimeChange} />;
}
